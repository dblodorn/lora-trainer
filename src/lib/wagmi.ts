import { http, createConfig } from "wagmi";
import { mainnet, base } from "wagmi/chains";
import { injected } from "wagmi/connectors";
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
