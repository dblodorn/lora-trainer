import { createAuthClient } from "better-auth/react";
import { siweClient } from "better-auth/client/plugins";

export const authClient = createAuthClient({
  plugins: [
    siweClient(),
    {
      id: "siwe-session-refresh",
      atomListeners: [
        {
          signal: "$sessionSignal",
          matcher: (path: string) => path === "/siwe/verify",
        },
      ],
    },
  ],
});
