import { Environment, Network, RecordSource, Store, type FetchFunction } from "relay-runtime";

/*
 * The Relay environment for the dmbk GraphQL API (graphql.dmbk.network).
 *
 * Operations go to /api/graphql by persisted id, never as query text. That
 * route forwards only ids the Relay compiler wrote from this app's source, and
 * attaches the session token (from the HTTP-only cookie) and the app's API
 * key on the way out. See src/pages/api/graphql.ts.
 */

/** An error from the API (or the proxy), with its `extensions.code`. */
export class ApiError extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

interface GraphQLResponseBody {
  data?: unknown;
  errors?: { message: string; extensions?: { code?: string } }[];
}

const fetchOperation: FetchFunction = async (params, variables) => {
  if (!params.id) {
    // Only persisted operations can be forwarded; text would be refused.
    throw new Error(`Operation ${params.name} was not persisted. Run \`npm run relay\`.`);
  }

  let res: Response;
  try {
    res = await fetch("/api/graphql", {
      method: "POST",
      headers: { "content-type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify({ id: params.id, variables }),
    });
  } catch {
    throw new ApiError("API_UNAVAILABLE", "The dmbk API could not be reached.");
  }

  let body: GraphQLResponseBody;
  try {
    body = await res.json();
  } catch {
    throw new ApiError("API_UNAVAILABLE", `The dmbk API answered ${res.status} with no JSON.`);
  }

  // Raised with the API's code rather than handed to Relay, which would report
  // a nulled payload only as "no data returned".
  const first = body.errors?.[0];
  if (first) {
    throw new ApiError(first.extensions?.code ?? "INTERNAL_SERVER_ERROR", first.message);
  }
  return body as { data: Record<string, unknown> };
};

export function createRelayEnvironment(): Environment {
  return new Environment({
    network: Network.create(fetchOperation),
    store: new Store(new RecordSource()),
  });
}
