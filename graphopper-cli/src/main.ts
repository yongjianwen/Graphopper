#!/usr/bin/env node
import { executeCli } from './program.js';

const controller = new AbortController();
for (const signal of ['SIGINT', 'SIGTERM'] as const)
  process.once(signal, () => controller.abort(new Error(signal)));
process.exitCode = await executeCli(process.argv.slice(2), {
  signal: controller.signal,
});
