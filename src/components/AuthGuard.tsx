import type { ReactNode } from "react";
import { View, Text, Button, Card, Loader } from "reshaped";
import { authClient } from "@/lib/auth-client";
import { useAuthModal } from "./AuthModalProvider";

interface AuthGuardProps {
  children: ReactNode;
}

export default function AuthGuard({ children }: AuthGuardProps) {
  const { openAuthModal } = useAuthModal();
  const { data: session, isPending } = authClient.useSession();

  if (isPending) {
    return (
      <View align="center" justify="center" padding={4}>
        <Loader />
      </View>
    );
  }

  if (!session) {
    return (
      <Card padding={4}>
        <View gap={3} align="center">
          <Text variant="body-2" color="neutral-faded" align="center">
            Connect your wallet to access training features.
          </Text>
          <Button color="primary" size="small" onClick={openAuthModal}>
            Connect Wallet
          </Button>
        </View>
      </Card>
    );
  }

  return <>{children}</>;
}
