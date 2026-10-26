import type { NextApiRequest, NextApiResponse } from "next";
import persistedOperations from "@/server/graphql/persisted-operations.json";
import { SessionServiceError, callApi, readSessionCookie } from "@/server/auth/session";

/*
 * The browser's way to the dmbk GraphQL API (graphql.dmbk.network).
 *
 *   POST { id, variables } → the API's response to that operation
 *
 * The API wants the viewer's session as a bearer token and this app's key as
 * `x-api-key`. The token lives in the HTTP-only `lora_trainer_session` cookie
 * and the key in the server's env, so page scripts can read neither. The Relay
 * environment posts here, same-origin, and `callApi` attaches both on the way
 * out.
 *
 * Signed-out requests are forwarded too, without a token: the gallery, LoRA
 * pages and slideshow are public, and the API returns owner-only fields as
 * null to anonymous viewers.
 *
 * Only operations the Relay compiler persisted from this app's source are
 * forwarded, by id. The key and the token are credentials: forwarding
 * arbitrary query text would let anything that can make a same-origin request
 * run any operation the API has. With the allowlist, this route can do exactly
 * what the app's pages do and nothing more.
 *
 * Nothing but the operation, its variables, the token and the key is
 * forwarded: no other cookie, no other header.
 */

const OPERATIONS: Record<string, string> = persistedOperations;

function refuse(res: NextApiResponse, status: number, code: string, message: string) {
  return res.status(status).json({ data: null, errors: [{ message, extensions: { code } }] });
}

function header(req: NextApiRequest, name: string): string | undefined {
  const value = req.headers[name];
  return Array.isArray(value) ? value[0] : value;
}

/**
 * Whether the request came from a page on this origin. Browsers send
 * `Sec-Fetch-Site` on every fetch; `Origin` is the fallback for those that do
 * not. A request carrying neither is refused, so the check cannot be skipped
 * by omitting headers.
 */
function isSameOrigin(req: NextApiRequest): boolean {
  const site = header(req, "sec-fetch-site");
  if (site) return site === "same-origin";
  const origin = header(req, "origin");
  const host = header(req, "x-forwarded-host") ?? header(req, "host");
  if (!origin || !host) return false;
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader("cache-control", "no-store");

  if (req.method !== "POST") {
    res.setHeader("allow", "POST");
    return refuse(res, 405, "METHOD_NOT_ALLOWED", "Use POST.");
  }
  if (!isSameOrigin(req)) {
    return refuse(res, 403, "FORBIDDEN", "Cross-origin requests are not accepted.");
  }

  const body = (req.body ?? {}) as { id?: unknown; variables?: unknown };
  // hasOwn, so an id like "constructor" cannot reach the prototype. A body
  // with query text and no id lands here too.
  const id = typeof body.id === "string" ? body.id : null;
  const query = id && Object.hasOwn(OPERATIONS, id) ? OPERATIONS[id] : undefined;
  if (!query) {
    return refuse(res, 400, "PERSISTED_QUERY_NOT_FOUND", "Unknown operation.");
  }
  const variables =
    body.variables && typeof body.variables === "object" ? (body.variables as Record<string, unknown>) : {};

  const token = readSessionCookie(req.headers.cookie) ?? undefined;
  try {
    const result = await callApi(query, variables, token);
    return res.json(result);
  } catch (error) {
    if (!(error instanceof SessionServiceError)) throw error;
    console.error("[graphql-proxy]", error);
    return refuse(res, 502, "API_UNAVAILABLE", "The dmbk API could not be reached.");
  }
}
