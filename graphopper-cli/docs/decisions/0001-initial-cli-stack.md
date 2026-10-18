# ADR 0001: Initial CLI Stack and Distribution

- Status: Accepted
- Date: 2026-10-18

## Context

`graphopper-cli` must support interactive terminals and deterministic automation, OIDC device login, OS credential stores, HTTPS, Unicode, cancellation, and distribution across common desktop and CI platforms. Its public integration boundary is the backend OpenAPI contract rather than shared source code.

## Decision

- Use Node.js 24 LTS and TypeScript 6 in strict mode.
- Use Commander 15 for command parsing and contextual help.
- Distribute a runtime-dependent npm package initially. Supported targets are macOS 14+ on x64/arm64, Ubuntu 22.04+ on x64/arm64, and Windows 11 on x64, all with a supported Node.js 24 release.
- Store non-secret configuration as UTF-8 JSON in the platform's conventional per-user configuration directory.
- Store credentials with `@napi-rs/keyring`. When an OS store is unavailable, allow in-memory or externally supplied tokens; never enable plaintext persistence automatically.
- Prefer OIDC device authorization. A profile supplies issuer and public client metadata; browser opening is optional and manual URL use remains possible.
- Use the built-in Fetch API behind an application-facing backend port.
- Use Vitest, ESLint, and Prettier. Use npm with a committed lockfile.
- Generate static completion scripts for Bash, Zsh, and Fish.
- Publish npm package archives with SHA-256 checksums. Artifact signing and registry publication are deferred for the initial local distribution channel.

## Consequences

- Users must install Node.js 24; single-binary distribution is deferred until measured demand justifies another packaging path.
- Native credential-store availability is platform-dependent, so automation must remain fully usable with an external token.
- Command handlers depend on application ports, not Commander, Fetch, keyring, or filesystem implementations directly.
- Backend resource routes are tested against a conforming mock until the corresponding backend stories implement and publish them in OpenAPI.
