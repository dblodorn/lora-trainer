import { useState, useCallback, useEffect } from "react";
import {
  View,
  Text,
  Button,
  Card,
  Loader,
  Modal,
  Divider,
  Alert,
  Badge,
} from "reshaped";
import { useAccount, useSendTransaction, useSwitchChain, useWaitForTransactionReceipt } from "wagmi";
import { formatUnits } from "viem";
import { trpc } from "@/utils/trpc";
import { PAYMENT_RECIPIENT, BASE_CHAIN_ID } from "@/lib/constants";

type PaymentStep = "price" | "switching" | "sending" | "confirming" | "done";

interface PaymentGateProps {
  active: boolean;
  onClose: () => void;
  onPaymentComplete: (txHash: string) => void;
}

export default function PaymentGate({
  active,
  onClose,
  onPaymentComplete,
}: PaymentGateProps) {
  const [step, setStep] = useState<PaymentStep>("price");
  const [error, setError] = useState<string | null>(null);

  const { chainId } = useAccount();
  const isOnBase = chainId === BASE_CHAIN_ID;

  // Fetch ETH price from server
  const ethPriceQuery = trpc.payment.getEthPrice.useQuery(undefined, {
    enabled: active,
    refetchInterval: 30_000, // refresh price every 30s while modal is open
  });

  const { switchChain } = useSwitchChain();

  const {
    sendTransaction,
    data: txHash,
    isPending: isSending,
    error: sendError,
    reset: resetSend,
  } = useSendTransaction();

  const {
    isLoading: isConfirming,
    isSuccess: isConfirmed,
    error: confirmError,
  } = useWaitForTransactionReceipt({
    hash: txHash,
  });

  // Reset state when modal opens
  useEffect(() => {
    if (active) {
      setStep("price");
      setError(null);
      resetSend();
    }
  }, [active, resetSend]);

  // Track step progression
  useEffect(() => {
    if (isSending) setStep("sending");
  }, [isSending]);

  useEffect(() => {
    if (txHash && isConfirming) setStep("confirming");
  }, [txHash, isConfirming]);

  useEffect(() => {
    if (isConfirmed && txHash && step !== "done") {
      setStep("done");
      onPaymentComplete(txHash);
    }
  }, [isConfirmed, txHash, onPaymentComplete, step]);

  // Handle errors
  useEffect(() => {
    if (sendError) {
      setError(sendError.message.includes("User rejected")
        ? "Transaction rejected"
        : `Transaction failed: ${sendError.message}`);
      setStep("price");
    }
  }, [sendError]);

  useEffect(() => {
    if (confirmError) {
      setError(`Confirmation failed: ${confirmError.message}`);
      setStep("price");
    }
  }, [confirmError]);

  const handleSwitchChain = useCallback(() => {
    setStep("switching");
    setError(null);
    switchChain(
      { chainId: BASE_CHAIN_ID },
      {
        onSuccess: () => setStep("price"),
        onError: (err) => {
          setError(`Failed to switch chain: ${err.message}`);
          setStep("price");
        },
      },
    );
  }, [switchChain]);

  const handlePay = useCallback(() => {
    if (!ethPriceQuery.data) return;

    setError(null);
    const requiredWei = BigInt(ethPriceQuery.data.requiredEthWei);

    sendTransaction({
      to: PAYMENT_RECIPIENT as `0x${string}`,
      value: requiredWei,
      chainId: BASE_CHAIN_ID,
    });
  }, [ethPriceQuery.data, sendTransaction]);

  const priceData = ethPriceQuery.data;
  const requiredEthFormatted = priceData
    ? Number(formatUnits(BigInt(priceData.requiredEthWei), 18)).toFixed(6)
    : null;

  return (
    <Modal active={active} onClose={onClose} position="center" padding={6}>
      <View gap={4} direction="column">
        <View gap={1}>
          <Text variant="body-1" weight="bold">
            Training Fee
          </Text>
          <Text variant="body-2" color="neutral-faded">
            A one-time payment is required to train your LoRA model.
          </Text>
        </View>

        <Divider />

        {ethPriceQuery.isLoading ? (
          <View align="center" padding={6}>
            <View gap={2} align="center">
              <Loader />
              <Text variant="body-2" color="neutral-faded">
                Fetching current ETH price...
              </Text>
            </View>
          </View>
        ) : ethPriceQuery.error ? (
          <Alert color="critical">
            Failed to fetch ETH price: {ethPriceQuery.error.message}
          </Alert>
        ) : priceData ? (
          <>
            <Card padding={4}>
              <View gap={3}>
                <View direction="row" align="center" gap={2}>
                  <Text variant="body-2" color="neutral-faded">
                    Training Cost
                  </Text>
                  <View.Item grow>
                    <Text variant="body-2" weight="bold" align="end">
                      ${priceData.trainingPriceUsd.toFixed(2)} USD
                    </Text>
                  </View.Item>
                </View>

                <Divider />

                <View direction="row" align="center" gap={2}>
                  <Text variant="body-2" color="neutral-faded">
                    ETH Price
                  </Text>
                  <View.Item grow>
                    <Text variant="body-1" align="end">
                      ${priceData.ethPriceUsd.toFixed(2)}
                    </Text>
                  </View.Item>
                </View>

                <View direction="row" align="center" gap={2}>
                  <Text variant="body-2" color="neutral-faded">
                    You Pay
                  </Text>
                  <View.Item grow>
                    <View direction="row" align="center" justify="end" gap={2}>
                      <Text variant="body-2" weight="bold">
                        {requiredEthFormatted} ETH
                      </Text>
                      <Badge color="neutral" size="small">
                        BASE
                      </Badge>
                    </View>
                  </View.Item>
                </View>
              </View>
            </Card>

            <Text variant="caption-1" color="neutral-faded">
              Price updates every 30s via Uniswap V3 on BASE. You cover gas fees.
              If training fails, your ETH will be automatically refunded.
            </Text>

            {error && (
              <Alert color="critical">{error}</Alert>
            )}

            {!isOnBase ? (
              <Button
                color="primary"
                fullWidth
                onClick={handleSwitchChain}
                loading={step === "switching"}
              >
                Switch to BASE Network
              </Button>
            ) : step === "sending" ? (
              <Button color="positive" fullWidth loading disabled>
                Confirm in Wallet...
              </Button>
            ) : step === "confirming" ? (
              <View gap={2} align="center">
                <Button color="positive" fullWidth loading disabled>
                  Confirming Transaction...
                </Button>
                {txHash && (
                  <Text variant="caption-1" color="neutral-faded">
                    Tx:{" "}
                    <a
                      href={`https://basescan.org/tx/${txHash}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ color: "inherit", textDecoration: "underline" }}
                    >
                      {txHash.slice(0, 10)}...{txHash.slice(-8)}
                    </a>
                  </Text>
                )}
              </View>
            ) : (
              <Button
                color="positive"
                fullWidth
                onClick={handlePay}
                disabled={!priceData}
              >
                Pay & Train — {requiredEthFormatted} ETH
              </Button>
            )}
          </>
        ) : null}
      </View>
    </Modal>
  );
}
