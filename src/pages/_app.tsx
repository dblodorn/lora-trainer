import "@/themes/lora-trainer/globals.css";
import "@/themes/lora-trainer/theme.css";
import "@/styles/globals.css";
import type { AppProps } from "next/app";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { httpBatchLink } from "@trpc/client";
import { trpc } from "@/utils/trpc";
import { useState } from "react";
import { Reshaped, View, Button } from "reshaped";
import { WagmiProvider } from "wagmi";
import { wagmiConfig } from "@/lib/wagmi";
import { useRouter } from "next/router";
import NextLink from "next/link";
import AuthModalProvider from "@/components/AuthModalProvider";
import WalletStatus from "@/components/WalletStatus";

export default function App({ Component, pageProps }: AppProps) {
  const router = useRouter();
  const isLoras = router.pathname.startsWith("/loras");

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
              <View position="fixed" insetStart={2} insetBottom={2} width={112 / 4}>
                <NextLink href={isLoras ? "/" : "/loras"} passHref legacyBehavior>
                  <Button as="a" fullWidth color="primary">
                    {isLoras ? "Train" : "Gallery"}
                  </Button>
                </NextLink>
              </View>
              <WalletStatus />
            </AuthModalProvider>
          </Reshaped>
        </QueryClientProvider>
      </trpc.Provider>
    </WagmiProvider>
  );
}
