import type { ReactNode } from "react";
import { View, Text, Button, Card, Loader } from "reshaped";
import { useSession } from "@/lib/session";
import { useAuthModal } from "./AuthModalProvider";

interface AuthGuardProps {
  children: ReactNode;
}

export default function AuthGuard({ children }: AuthGuardProps) {
  const { openAuthModal } = useAuthModal();
  const { viewer, isPending } = useSession();

  if (isPending) {
    return (
      <View align="center" justify="center" padding={4}>
        <Loader />
      </View>
    );
  }

  if (!viewer) {
    return (
      <Card padding={4}>
        <View gap={3} align="center">
          <Text variant="body-2" color="neutral-faded" align="center">
            Sign in to access training features.
          </Text>
          <Button color="primary" size="small" onClick={openAuthModal}>
            Sign In
          </Button>
        </View>
      </Card>
    );
  }

  return <>{children}</>;
}
