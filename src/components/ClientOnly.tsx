import { useSyncExternalStore, type ReactNode } from "react";

/*
 * Renders its children only in the browser. Pages have no data function, so
 * Next prerenders them at build time, where a Relay query would run against a
 * relative URL with no server behind it. Queries sit under this instead and
 * the prerendered page shows the fallback.
 *
 * useSyncExternalStore gives false on the server and during hydration and
 * true after it, with no state set from an effect.
 */
const subscribe = () => () => {};

export default function ClientOnly({ children, fallback = null }: { children: ReactNode; fallback?: ReactNode }) {
  const isClient = useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
  return isClient ? children : fallback;
}
