#!/usr/bin/env node
// Run the Relay compiler for this app's operations against the dmbk GraphQL
// API (relay.config.json). Arguments pass through, so `npm run relay -- --watch`
// works.
//
// The compiler persists every operation to a local JSON file, the allowlist
// the /api/graphql proxy forwards from, but refuses to start unless that file
// already exists. It is git-ignored and regenerated, so a fresh checkout has
// none; this seeds an empty map first.
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const persisted = path.join(root, "src/server/graphql/persisted-operations.json");

if (!existsSync(persisted)) {
  mkdirSync(path.dirname(persisted), { recursive: true });
  writeFileSync(persisted, "{}\n");
}

const result = spawnSync(path.join(root, "node_modules/.bin/relay-compiler"), process.argv.slice(2), {
  cwd: root,
  stdio: "inherit",
});
process.exit(result.status ?? 1);
