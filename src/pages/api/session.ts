import type { NextApiRequest, NextApiResponse } from "next";
import {
  SessionServiceError,
  SignInRefusedError,
  readSessionCookie,
  revokeToken,
  sessionCookieHeader,
  signInWithGoogle,
  viewerForToken,
} from "@/server/auth/session";

/*
 * The session, as the browser sees it.
 *
 *   GET    → { viewer } — the signed-in account, or null
 *   POST   { idToken } → sign in with a Google ID token
 *   DELETE → sign out
 *
 * The session token itself never reaches the browser's JavaScript: it is set
 * here as an HTTP-only cookie and only this app's server forwards it to the
 * API. See `src/server/auth/session.ts`.
 */

/** Whether the request reached us over HTTPS, directly or through Vercel's proxy. */
function isSecure(req: NextApiRequest): boolean {
  const forwarded = req.headers["x-forwarded-proto"];
  const proto = Array.isArray(forwarded) ? forwarded[0] : forwarded;
  if (proto) return proto.split(",")[0].trim() === "https";
  return false;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader("cache-control", "no-store");
  const secure = isSecure(req);
  const token = readSessionCookie(req.headers.cookie);

  if (req.method === "GET") {
    try {
      const viewer = await viewerForToken(token);
      // A cookie whose session has ended, or whose account is no longer an
      // admin, is cleared rather than re-checked on every request.
      if (token && !viewer?.isAdmin) {
        res.setHeader("set-cookie", sessionCookieHeader(null, secure));
        return res.json({ viewer: null });
      }
      return res.json({ viewer: viewer?.isAdmin ? viewer : null });
    } catch (error) {
      console.error("[auth] Session check failed:", error);
      return res.status(503).json({ viewer: null, error: "unavailable" });
    }
  }

  if (req.method === "POST") {
    const idToken = (req.body as { idToken?: unknown } | undefined)?.idToken;
    if (typeof idToken !== "string" || !idToken) {
      return res.status(400).json({ error: "bad_request" });
    }

    try {
      const { token: newToken, viewer } = await signInWithGoogle(idToken);

      // The API admits anyone on its sign-in list; this app is admin-only
      // while there is no payment step. A signed-in non-admin gets no cookie,
      // and their fresh session is revoked so it doesn't linger unused.
      if (!viewer.isAdmin) {
        await revokeToken(newToken);
        return res.status(403).json({ error: "not_admin" });
      }

      res.setHeader("set-cookie", sessionCookieHeader(newToken, secure));
      return res.json({ viewer });
    } catch (error) {
      if (error instanceof SignInRefusedError) return res.status(401).json({ error: "refused" });
      console.error("[auth] Sign-in failed:", error);
      return res.status(error instanceof SessionServiceError ? 503 : 500).json({ error: "unavailable" });
    }
  }

  if (req.method === "DELETE") {
    await revokeToken(token);
    res.setHeader("set-cookie", sessionCookieHeader(null, secure));
    return res.json({ ok: true });
  }

  res.setHeader("allow", "GET, POST, DELETE");
  return res.status(405).json({ error: "method_not_allowed" });
}
