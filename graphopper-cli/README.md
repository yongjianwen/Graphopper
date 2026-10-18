# graphopper-cli

Command-line client for `graphopper-backend`, designed for both interactive terminals and automation.

## Requirements

- Node.js 24 LTS
- A compatible `/v1` graphopper-backend

## Development

```sh
npm install
npm run build
node dist/main.js --help
```

Run the complete local verification suite with:

```sh
npm run check
```

## Configuration

Configuration precedence is command option, environment variable, selected profile, then built-in default. Common environment variables are:

- `GRAPHOPPER_PROFILE`
- `GRAPHOPPER_SERVER`
- `GRAPHOPPER_OUTPUT`
- `GRAPHOPPER_TIMEOUT_MS`
- `GRAPHOPPER_TOKEN` (process-only automation credential)
- `GRAPHOPPER_CONFIG_DIR` (test or controlled override of the platform config directory)

Run `graphopper config get` to inspect non-secret effective values and their sources.

## Automation

Use `--output json` for stable output and `--non-interactive` to prohibit prompts. Destructive commands additionally require `--yes`; non-interactive mode never implies consent.

Exit codes are stable: `0` success, `2` usage, `3` authentication, `4` access/not found, `5` validation, `6` conflict, `7` network, `8` partial, `70` internal, and `130` cancelled.

## Distribution

The initial release is a runtime-dependent npm package for Node.js 24 on macOS 14+ (x64/arm64), Ubuntu 22.04+ (x64/arm64), and Windows 11 (x64). Run `npm run release:artifact` to create the package and its SHA-256 checksum. Artifact signing is not part of the initial channel.

Install a packed release with `npm install --global ./graphopper-cli-<version>.tgz`. Upgrade by installing the newer archive and uninstall with `npm uninstall --global graphopper-cli`.

Generate static completions without credentials or network access:

```sh
graphopper completion bash > ~/.local/share/bash-completion/completions/graphopper
graphopper completion zsh > ~/.zfunc/_graphopper
graphopper completion fish > ~/.config/fish/completions/graphopper.fish
```

## Examples

```sh
graphopper auth login
graphopper graph create "Research" --description "Reading map"
graphopper --output json node list --graph <graph-id> --all
graphopper node create --graph <graph-id> --value title='"First node"'
graphopper relationship create --graph <graph-id> --source <node-id> --target <node-id> --type REFERENCES
graphopper traverse --graph <graph-id> --start <node-id> --depth 2
graphopper --yes graph delete <graph-id>
```
