import { useEffect, useState, type ReactNode } from "react";

/*
 * Renders its children only after mount. Pages have no data function, so
 * Next prerenders them at build time, where a Relay query would run against a
 * relative URL with no server behind it. Queries sit under this instead and
 * the prerendered page shows the fallback.
 */
export default function ClientOnly({ children, fallback = null }: { children: ReactNode; fallback?: ReactNode }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  return mounted ? children : fallback;
}
