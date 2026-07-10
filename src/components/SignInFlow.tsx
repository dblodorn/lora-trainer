import { useState } from "react";
import { View, Text, Button, Alert } from "reshaped";
import { useConnect, useAccount, useSignMessage, useDisconnect } from "wagmi";
import { createSiweMessage } from "viem/siwe";
import { authClient } from "@/lib/auth-client";

interface SignInFlowProps {
  onSuccess?: () => void;
}

export default function SignInFlow({ onSuccess }: SignInFlowProps) {
  const { connectors, connect } = useConnect();
  const { address, isConnected, chain } = useAccount();
  const { signMessageAsync } = useSignMessage();
  const { disconnect } = useDisconnect();
  const [error, setError] = useState<string | null>(null);
  const [isSigning, setIsSigning] = useState(false);

  const handleSignIn = async () => {
    if (!address) return;
    setError(null);
    setIsSigning(true);

    try {
      const { data: nonceData } = await authClient.siwe.nonce({
        walletAddress: address,
        chainId: chain?.id ?? 1,
      });
      if (!nonceData?.nonce) {
        throw new Error("Failed to get nonce from server");
      }

      const message = createSiweMessage({
        domain: window.location.host,
        address,
        statement: "Sign in to LoRA Trainer",
        uri: window.location.origin,
        version: "1",
        chainId: chain?.id ?? 1,
        nonce: nonceData.nonce,
      });

      const signature = await signMessageAsync({ message });

      const { error: verifyError } = await authClient.siwe.verify({
        message,
        signature,
        walletAddress: address,
        chainId: chain?.id ?? 1,
      });

      if (verifyError) {
        throw new Error(verifyError.message || "Verification failed");
      }

      onSuccess?.();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Sign in failed";
      if (!msg.includes("User rejected")) {
        setError(msg);
      }
    } finally {
      setIsSigning(false);
    }
  };

  return (
    <View gap={6} maxWidth="400px">
      <View gap={2}>
        <Text variant="title-3" weight="bold">
          Sign In
        </Text>
        <Text variant="body-2" color="neutral-faded">
          Connect your wallet to access LoRA training features.
        </Text>
      </View>

      {error && <Alert color="critical">{error}</Alert>}

      {!isConnected ? (
        <View gap={3}>
          {connectors.map((connector) => (
            <Button
              key={connector.uid}
              color="primary"
              fullWidth
              onClick={() => connect({ connector })}
            >
              {connector.name}
            </Button>
          ))}
        </View>
      ) : (
        <View gap={4}>
          <View gap={1}>
            <Text variant="body-3" color="neutral-faded">
              Connected as
            </Text>
            <Text
              variant="body-2"
              attributes={{ style: { fontFamily: "monospace" } }}
            >
              {address?.slice(0, 6)}...{address?.slice(-4)}
            </Text>
          </View>

          <Button
            color="positive"
            fullWidth
            onClick={handleSignIn}
            loading={isSigning}
          >
            Sign Message
          </Button>

          <Button color="neutral" fullWidth onClick={() => disconnect()}>
            Disconnect
          </Button>
        </View>
      )}
    </View>
  );
}
