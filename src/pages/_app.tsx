import "@/themes/lora-trainer/globals.css";
import "@/themes/lora-trainer/theme.css";
import "@/styles/globals.css";
import type { AppProps } from "next/app";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { httpBatchLink } from "@trpc/client";
import { trpc } from "@/utils/trpc";
import { useState } from "react";
import { Reshaped } from "reshaped";
import { WagmiProvider } from "wagmi";
import { wagmiConfig } from "@/lib/wagmi";
import AuthModalProvider from "@/components/AuthModalProvider";
import VerticalNav from "@/components/VerticalNav";

export default function App({ Component, pageProps }: AppProps) {
  const [queryClient] = useState(() => new QueryClient());
  const [trpcClient] = useState(() =>
    trpc.createClient({
      links: [
        httpBatchLink({
          url: "/api/trpc",
        }),
      ],
    })
  );

  return (
    <WagmiProvider config={wagmiConfig}>
      <trpc.Provider client={trpcClient} queryClient={queryClient}>
        <QueryClientProvider client={queryClient}>
          <Reshaped theme="lora-trainer">
            <AuthModalProvider>
              <Component {...pageProps} />
              <VerticalNav />
            </AuthModalProvider>
          </Reshaped>
        </QueryClientProvider>
      </trpc.Provider>
    </WagmiProvider>
  );
}