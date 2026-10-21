import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";

/*
 * The session, from the browser's side. The session token is an HTTP-only
 * cookie this code cannot read; it only asks `/api/session` who is signed in,
 * and posts a Google ID token there to sign in.
 */

export interface Viewer {
  id: string;
  email: string;
  name: string | null;
  isAdmin: boolean;
}

const SESSION_KEY = ["session"] as const;

async function fetchSession(): Promise<Viewer | null> {
  const res = await fetch("/api/session", { credentials: "include", cache: "no-store" });
  if (!res.ok && res.status !== 503) throw new Error(`Session check failed: ${res.status}`);
  const body = (await res.json()) as { viewer: Viewer | null; error?: string };
  if (body.error === "unavailable") throw new Error("The accounts service is unavailable. Try again shortly.");
  return body.viewer;
}

export function useSession() {
  const query = useQuery({
    queryKey: SESSION_KEY,
    queryFn: fetchSession,
    staleTime: 60_000,
    retry: 1,
  });
  return { viewer: query.data ?? null, isPending: query.isPending, error: query.error };
}

/** Why a sign-in didn't produce a session, in words for the sign-in surface. */
export class SignInError extends Error {}

export function useSignIn() {
  const client = useQueryClient();
  return useCallback(
    async (idToken: string) => {
      const res = await fetch("/api/session", {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ idToken }),
      });
      if (!res.ok) {
        const { error } = (await res.json().catch(() => ({}))) as { error?: string };
        throw new SignInError(
          error === "not_admin"
            ? "That Google account is not permitted to use LoRA Trainer."
            : error === "refused"
              ? "Google sign-in was refused. Use an account on the allowlist, or try again."
              : "Sign-in is unavailable right now. Try again shortly.",
        );
      }
      const { viewer } = (await res.json()) as { viewer: Viewer };
      client.setQueryData(SESSION_KEY, viewer);
      // Ownership flags on public queries depend on who is asking.
      await client.invalidateQueries({ predicate: (q) => q.queryKey[0] !== SESSION_KEY[0] });
    },
    [client],
  );
}

export function useSignOut() {
  const client = useQueryClient();
  return useCallback(async () => {
    await fetch("/api/session", { method: "DELETE", credentials: "include" }).catch(() => undefined);
    client.setQueryData(SESSION_KEY, null);
    // Anything cached under the old session belongs to it.
    client.removeQueries({ predicate: (q) => q.queryKey[0] !== SESSION_KEY[0] });
  }, [client]);
}
