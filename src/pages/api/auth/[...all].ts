import type { NextApiRequest, NextApiResponse } from "next";
import { toNodeHandler } from "better-auth/node";
import { getAuth } from "@/lib/auth";

export const config = { api: { bodyParser: false } };

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  const host = (req.headers["x-forwarded-host"] as string) || req.headers.host;
  return toNodeHandler(getAuth(host))(req, res);
}
