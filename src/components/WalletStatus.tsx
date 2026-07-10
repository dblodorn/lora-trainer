import { useCallback } from "react";
import { View, Button } from "reshaped";
import { authClient } from "@/lib/auth-client";
import { useAuthModal } from "./AuthModalProvider";

export default function WalletStatus() {
  const { openAuthModal } = useAuthModal();
  const { data: session, isPending } = authClient.useSession();

  const handleClick = useCallback(() => {
    if (session) {
      authClient.signOut();
    } else {
      openAuthModal();
    }
  }, [session, openAuthModal]);

  return (
    <View position="fixed" insetEnd={2} insetBottom={2} width={112 / 4}>
      <Button fullWidth color="primary" loading={isPending} onClick={handleClick}>
        {session ? "Sign Out" : "AUTH"}
      </Button>
    </View>
  );
}
