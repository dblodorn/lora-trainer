import { TRPCError } from "@trpc/server";
import { callApi, SessionServiceError } from "@/server/auth/session";

/*
 * GraphQL calls to the dmbk API (graphql.dmbk.network) from tRPC procedures,
 * with the API's error codes turned into tRPC ones. The session token, when
 * passed, is the viewer's own, so the API applies its rules to them.
 */

const CODES: Record<string, TRPCError["code"]> = {
  NOT_FOUND: "NOT_FOUND",
  BAD_USER_INPUT: "BAD_REQUEST",
  FORBIDDEN: "UNAUTHORIZED",
  UNAUTHENTICATED: "UNAUTHORIZED",
  RATE_LIMITED: "TOO_MANY_REQUESTS",
};

export async function dmbkApi<T>(
  query: string,
  variables: Record<string, unknown> = {},
  token?: string | null,
): Promise<T> {
  let response;
  try {
    response = await callApi<T>(query, variables, token ?? undefined);
  } catch (error) {
    if (error instanceof SessionServiceError) {
      console.error("[dmbk-api]", error);
      throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "The dmbk API is unavailable. Try again shortly." });
    }
    throw error;
  }

  const first = response.errors?.[0];
  if (first) {
    const code = CODES[first.extensions?.code ?? ""];
    if (code) throw new TRPCError({ code, message: first.message });
    console.error("[dmbk-api]", response.errors);
    throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "The dmbk API returned an error." });
  }
  if (!response.data) {
    throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "The dmbk API returned no data." });
  }
  return response.data;
}
