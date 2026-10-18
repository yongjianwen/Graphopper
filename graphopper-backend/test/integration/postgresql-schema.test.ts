import {
  PostgreSqlContainer,
  type StartedPostgreSqlContainer,
} from '@testcontainers/postgresql';
import { randomUUID } from 'node:crypto';
import { resolve } from 'node:path';
import { runner } from 'node-pg-migrate';
import { Pool } from 'pg';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

const externalDatabaseUrl = process.env.TEST_DATABASE_URL;
let container: StartedPostgreSqlContainer | undefined;
let pool: Pool;

describe('initial PostgreSQL schema', () => {
  beforeAll(async () => {
    const databaseUrl = await startDatabase();
    await runner({
      count: Infinity,
      databaseUrl,
      direction: 'up',
      dir: resolve(import.meta.dirname, '../../migrations'),
      log: () => undefined,
      migrationsTable: 'pgmigrations',
    });
    pool = new Pool({ connectionString: databaseUrl });
  }, 120_000);

  beforeEach(async () => {
    await pool.query(`
      TRUNCATE TABLE
        idempotency_records,
        outbox_events,
        audit_events,
        file_references,
        file_objects,
        relationships,
        nodes,
        template_fields,
        node_templates,
        graphs,
        users
      CASCADE
    `);
  });

  afterAll(async () => {
    await pool?.end();
    await container?.stop();
  });

  it('creates every proposed Phase 1 table', async () => {
    const result = await pool.query<{ table_name: string }>(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      ORDER BY table_name
    `);

    expect(result.rows.map(({ table_name }) => table_name)).toEqual(
      expect.arrayContaining([
        'audit_events',
        'file_objects',
        'file_references',
        'graphs',
        'idempotency_records',
        'node_templates',
        'nodes',
        'outbox_events',
        'relationships',
        'template_fields',
        'users',
      ]),
    );
  });

  it('creates the required listing, JSONB, adjacency, and outbox indexes', async () => {
    const result = await pool.query<{ indexname: string }>(`
      SELECT indexname
      FROM pg_indexes
      WHERE schemaname = 'public'
    `);

    expect(result.rows.map(({ indexname }) => indexname)).toEqual(
      expect.arrayContaining([
        'graphs_owner_created_id_idx',
        'graphs_owner_name_id_idx',
        'nodes_graph_created_id_idx',
        'nodes_values_gin_idx',
        'relationships_graph_source_type_id_idx',
        'relationships_graph_target_type_id_idx',
        'relationships_graph_type_id_idx',
        'outbox_events_ready_idx',
        'idempotency_records_expiry_idx',
      ]),
    );
  });

  it('enforces one logical template per graph', async () => {
    const { graphId } = await insertGraph();
    await pool.query(
      'INSERT INTO node_templates (id, graph_id) VALUES ($1, $2)',
      [randomUUID(), graphId],
    );

    await expect(
      pool.query('INSERT INTO node_templates (id, graph_id) VALUES ($1, $2)', [
        randomUUID(),
        graphId,
      ]),
    ).rejects.toMatchObject({ code: '23505' });
  });

  it('rejects relationship endpoints from another graph', async () => {
    const first = await insertGraph();
    const second = await insertGraph();
    const firstNode = randomUUID();
    const secondNode = randomUUID();
    await pool.query(
      'INSERT INTO nodes (id, graph_id, template_version, values) VALUES ($1, $2, 0, $3), ($4, $5, 0, $3)',
      [firstNode, first.graphId, {}, secondNode, second.graphId],
    );

    await expect(
      pool.query(
        `INSERT INTO relationships
          (id, graph_id, source_node_id, target_node_id, type)
         VALUES ($1, $2, $3, $4, 'RELATED_TO')`,
        [randomUUID(), first.graphId, firstNode, secondNode],
      ),
    ).rejects.toMatchObject({ code: '23503' });
  });

  it('cascades graph-owned template, node, and relationship records', async () => {
    const { graphId } = await insertGraph();
    const templateId = randomUUID();
    const sourceId = randomUUID();
    const targetId = randomUUID();
    await pool.query(
      'INSERT INTO node_templates (id, graph_id) VALUES ($1, $2)',
      [templateId, graphId],
    );
    await pool.query(
      'INSERT INTO template_fields (id, graph_id, key, label, data_type) VALUES ($1, $2, $3, $4, $5)',
      [randomUUID(), graphId, 'name', 'Name', 'text'],
    );
    await pool.query(
      'INSERT INTO nodes (id, graph_id, template_version, values) VALUES ($1, $3, 0, $4), ($2, $3, 0, $4)',
      [sourceId, targetId, graphId, {}],
    );
    await pool.query(
      `INSERT INTO relationships
        (id, graph_id, source_node_id, target_node_id, type)
       VALUES ($1, $2, $3, $4, 'RELATED_TO')`,
      [randomUUID(), graphId, sourceId, targetId],
    );

    await pool.query('DELETE FROM graphs WHERE id = $1', [graphId]);

    for (const table of [
      'node_templates',
      'template_fields',
      'nodes',
      'relationships',
    ]) {
      const result = await pool.query<{ count: number }>(
        `SELECT count(*)::integer AS count FROM ${table}`,
      );
      expect(result.rows[0]?.count).toBe(0);
    }
  });
});

async function startDatabase(): Promise<string> {
  if (externalDatabaseUrl !== undefined && externalDatabaseUrl !== '') {
    return externalDatabaseUrl;
  }

  container = await new PostgreSqlContainer('postgres:18-alpine').start();
  return container.getConnectionUri();
}

async function insertGraph(): Promise<{ graphId: string; userId: string }> {
  const userId = randomUUID();
  const graphId = randomUUID();
  await pool.query(
    `INSERT INTO users (id, identity_issuer, identity_subject)
     VALUES ($1, 'https://identity.test', $2)`,
    [userId, randomUUID()],
  );
  await pool.query(
    'INSERT INTO graphs (id, owner_id, name) VALUES ($1, $2, $3)',
    [graphId, userId, 'Test graph'],
  );
  return { graphId, userId };
}
