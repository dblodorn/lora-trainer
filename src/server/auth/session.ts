/*
 * Sessions, held by the dmbk GraphQL API (graphql.dmbk.network).
 *
 * The API owns accounts: it verifies the Google ID token, decides who may sign
 * in and who is an admin (its ALLOWED_EMAILS / ADMIN_EMAILS), and issues a
 * revocable session token. This app never sees a Google secret or an
 * allowlist of its own.
 *
 * What it does keep is the token, in an HTTP-only cookie on this app's own
 * domain, so page scripts can never read it. Every tRPC request asks the API
 * who the token belongs to. Nothing about the answer is cached, so revoking a
 * session, or removing an address from the API's lists, takes effect at the
 * next request.
 *
 * Training and generation spend fal.ai credit and there is no payment step, so
 * for now only admins hold a session here. Opening the app to other accounts
 * means relaxing `resolveViewer` and the POST in `pages/api/session.ts`.
 */

/** The signed-in account, as the API reports it. */
export interface Viewer {
  id: string;
  email: string;
  name: string | null;
  isAdmin: boolean;
}

export const SESSION_COOKIE = "lora_trainer_session";

/**
 * Matches the API's session lifetime (better-auth's default, seven days). The
 * API stays the authority: a cookie that outlives its session is anonymous.
 */
const SESSION_MAX_AGE = 60 * 60 * 24 * 7;

/** Raised when the API cannot be reached or answers with something unusable. */
export class SessionServiceError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "SessionServiceError";
  }
}

/** Raised when the API refuses a sign-in. Deliberately carries no reason. */
export class SignInRefusedError extends Error {
  constructor() {
    super("Sign-in failed.");
    this.name = "SignInRefusedError";
  }
}

function apiUrl(): string {
  return process.env.DMBK_GRAPHQL_API_URL || "https://graphql.dmbk.network/graphql";
}

interface GqlResponse<T> {
  data?: T | null;
  errors?: { message: string; extensions?: { code?: string } }[];
}

async function callApi<T>(
  query: string,
  variables: Record<string, unknown> = {},
  token?: string,
): Promise<GqlResponse<T>> {
  let res: Response;
  try {
    res = await fetch(apiUrl(), {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(token ? { authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ query, variables }),
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    });
  } catch (error) {
    throw new SessionServiceError("The accounts API could not be reached.", { cause: error });
  }

  try {
    return (await res.json()) as GqlResponse<T>;
  } catch (error) {
    throw new SessionServiceError(`The accounts API answered ${res.status} with no JSON.`, { cause: error });
  }
}

const VIEWER_FIELDS = "id email name isAdmin";

/** Read the session cookie from a Cookie header, without pulling in a parser. */
export function readSessionCookie(cookieHeader: string | undefined): string | null {
  if (!cookieHeader) return null;
  for (const part of cookieHeader.split(";")) {
    const idx = part.indexOf("=");
    if (idx === -1) continue;
    if (part.slice(0, idx).trim() === SESSION_COOKIE) {
      const value = part.slice(idx + 1).trim();
      try {
        return decodeURIComponent(value) || null;
      } catch {
        return null;
      }
    }
  }
  return null;
}

/**
 * Who a session token belongs to, or null. A missing, expired, revoked or
 * forged token is null — never an error — so a stale cookie simply reads as
 * signed out. Only an unreachable API throws.
 */
export async function viewerForToken(token: string | null): Promise<Viewer | null> {
  if (!token) return null;
  const { data } = await callApi<{ viewer: Viewer | null }>(`{ viewer { ${VIEWER_FIELDS} } }`, {}, token);
  return data?.viewer ?? null;
}

/**
 * The viewer behind a request, or null. Fails closed: a request whose session
 * cannot be resolved, for whatever reason, is anonymous.
 */
export async function resolveViewer(cookieHeader: string | undefined): Promise<Viewer | null> {
  const token = readSessionCookie(cookieHeader);
  if (!token) return null;
  try {
    const viewer = await viewerForToken(token);
    return viewer?.isAdmin ? viewer : null;
  } catch (error) {
    console.error("[auth] Failed to resolve the session:", error);
    return null;
  }
}

/** Trade a Google ID token for an API session. */
export async function signInWithGoogle(idToken: string): Promise<{ token: string; viewer: Viewer }> {
  const { data, errors } = await callApi<{ signInWithGoogle: { token: string; viewer: Viewer } }>(
    `mutation ($input: SignInWithGoogleInput!) { signInWithGoogle(input: $input) { token viewer { ${VIEWER_FIELDS} } } }`,
    { input: { idToken } },
  );
  const result = data?.signInWithGoogle;
  if (result) return result;

  if (errors?.some((e) => e.extensions?.code === "UNAUTHENTICATED")) throw new SignInRefusedError();
  throw new SessionServiceError(`signInWithGoogle failed: ${errors?.map((e) => e.message).join("; ") ?? "no data"}`);
}

/** Revoke a session at the API. Best effort: the cookie is cleared regardless. */
export async function revokeToken(token: string | null): Promise<void> {
  if (!token) return;
  try {
    await callApi("mutation { signOut }", {}, token);
  } catch (error) {
    console.error("[auth] Failed to revoke the session at the API:", error);
  }
}

/** `Set-Cookie` for a new session, or for clearing one (`token: null`). */
export function sessionCookieHeader(token: string | null, secure: boolean): string {
  const attrs = [
    `${SESSION_COOKIE}=${token ? encodeURIComponent(token) : ""}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    `Max-Age=${token ? SESSION_MAX_AGE : 0}`,
  ];
  if (secure) attrs.push("Secure");
  return attrs.join("; ");
}
