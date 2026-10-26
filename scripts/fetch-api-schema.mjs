#!/usr/bin/env node
// Pull the dmbk GraphQL API's schema (graphql.dmbk.network) into
// schemas/dmbk-graphql-api.graphql, where the Relay compiler reads it.
//
// The API answers introspection publicly. Run this when the API's schema
// changes and commit the result: every `npm run relay` validates this app's
// operations against the checked-in copy, so a deploy never compiles against
// a schema nobody reviewed.
import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const endpoint =
  process.env.DMBK_GRAPHQL_API_URL || "https://graphql.dmbk.network/graphql";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const outFile = path.join(root, "schemas", "dmbk-graphql-api.graphql");

const schema = execFileSync(path.join(root, "node_modules/.bin/get-graphql-schema"), [endpoint], {
  encoding: "utf-8",
});

mkdirSync(path.dirname(outFile), { recursive: true });
writeFileSync(outFile, schema);

console.log(`Schema from ${endpoint} written to ${outFile}`);
