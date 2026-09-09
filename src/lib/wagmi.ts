import { http, createConfig } from "wagmi";
import { mainnet, base } from "wagmi/chains";
// The dedicated subpath, not the `wagmi/connectors` barrel. The barrel also
// re-exports baseAccount, coinbaseWallet, metaMask, porto, safe and
// tempoWallet; tempoWallet reaches @wagmi/core/tempo, which imports a bare
// `accounts` specifier that webpack cannot resolve. Turbopack handles it, so
// this changes nothing today — it stops `next dev --webpack` from failing
// outright, which is how it surfaced in the dmbk app.
import { injected } from "wagmi/connectors/injected";
import { BASE_CHAIN_ID } from "@/lib/constants";

// Order chains so the configured default chain is first (wagmi uses the first chain as default)
const allChains = [mainnet, base] as const;
const defaultChain = allChains.find((c) => c.id === BASE_CHAIN_ID) ?? base;
const otherChains = allChains.filter((c) => c.id !== defaultChain.id);
const chains = [defaultChain, ...otherChains] as const;

export const wagmiConfig = createConfig({
  chains: chains as unknown as readonly [typeof defaultChain, ...typeof otherChains],
  connectors: [injected()],
  transports: {
    [mainnet.id]: http(),
    [base.id]: http(),
  },
  ssr: true,
});
