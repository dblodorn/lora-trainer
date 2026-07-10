import { useState, useRef, useEffect } from "react";
import { View, Text, Card, Alert, Button, Loader } from "reshaped";
import NextLink from "next/link";
import type { TrainingPhase } from "./ArenaChannelFetcher";

interface TrainingProgressProps {
  phase: TrainingPhase;
  logs: { timestamp: string; message: string }[];
  result: Record<string, unknown> | null;
  error: string | null;
  queuePosition?: number;
  loraId?: string | null;
  onReset: () => void;
  onCancel: () => void;
  isCancelling: boolean;
}

function getLoraWeightsUrl(
  result: Record<string, unknown> | null,
): string | null {
  if (!result) return null;
  const loraFile = result.diffusers_lora_file as
    | { url?: string }
    | undefined;
  if (loraFile?.url) return loraFile.url;
  const configFile = result.config_file as { url?: string } | undefined;
  if (configFile?.url) return configFile.url;
  return null;
}

function phaseLabel(phase: TrainingPhase, queuePosition?: number): string {
  switch (phase) {
    case "preparing":
      return "Preparing images...";
    case "queued":
      return `Waiting in queue${queuePosition != null ? ` (#${queuePosition})` : ""}`;
    case "training":
      return "Training in progress...";
    case "completed":
      return "Training complete";
    case "failed":
      return "Training failed";
    default:
      return "";
  }
}

const isActive = (phase: TrainingPhase) =>
  phase === "preparing" || phase === "queued" || phase === "training";

export default function TrainingProgress({
  phase,
  logs,
  result,
  error,
  queuePosition,
  loraId,
  onReset,
  onCancel,
  isCancelling,
}: TrainingProgressProps) {
  const [expanded, setExpanded] = useState(false);
  const logsContainerRef = useRef<HTMLDivElement>(null);

  // Auto-expand when training starts (transitions from queued to training)
  useEffect(() => {
    if (phase === "training") {
      setExpanded(true);
    }
  }, [phase]);

  // Auto-scroll the logs container internally (not the window)
  useEffect(() => {
    const container = logsContainerRef.current;
    if (container) {
      container.scrollTop = container.scrollHeight;
    }
  }, [logs.length]);

  if (phase === "idle") return null;

  const loraUrl = getLoraWeightsUrl(result);
  const showLogs =
    logs.length > 0 &&
    (phase === "training" || phase === "queued" || phase === "completed");

  return (
    <div
      style={{
        position: "fixed",
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 1000,
        pointerEvents: "none",
      }}
    >
      <div
        style={{
          pointerEvents: "auto",
          filter: "drop-shadow(0 -4px 24px rgba(0,0,0,0.18))",
        }}
      >
        <Card padding={0}>
          {/* Header bar — always visible, acts as toggle */}
          <div
            role="button"
            tabIndex={0}
            onClick={() => setExpanded((v) => !v)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") setExpanded((v) => !v);
            }}
            style={{
              cursor: "pointer",
              userSelect: "none",
              padding: "10px 16px",
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            {isActive(phase) && <Loader size="small" />}
            {phase === "completed" && (
              <Text color="positive" variant="body-3" weight="bold">
                ✓
              </Text>
            )}
            {phase === "failed" && (
              <Text color="critical" variant="body-3" weight="bold">
                ✕
              </Text>
            )}

            <Text
              variant="body-3"
              weight="medium"
              attributes={{ style: { flex: 1 } }}
            >
              {phaseLabel(phase, queuePosition)}
            </Text>

            {isActive(phase) && (
              <div
                onClick={(e) => e.stopPropagation()}
                onKeyDown={(e) => e.stopPropagation()}
              >
                <Button
                  color="critical"
                  variant="ghost"
                  size="small"
                  onClick={onCancel}
                  loading={isCancelling}
                >
                  Cancel
                </Button>
              </div>
            )}

            <Text
              variant="caption-1"
              color="neutral-faded"
              attributes={{
                style: {
                  transition: "transform 0.2s",
                  transform: expanded ? "rotate(180deg)" : "rotate(0deg)",
                },
              }}
            >
              ▾
            </Text>
          </div>

          {/* Expandable body */}
          <div
            style={{
              maxHeight: expanded ? 360 : 0,
              overflow: "hidden",
              transition: "max-height 0.25s ease-in-out",
            }}
          >
            <View padding={4} paddingTop={0} gap={3}>
              {/* Error state */}
              {phase === "failed" && (
                <Alert color="critical" title="Training Failed">
                  <View gap={2}>
                    <Text variant="body-2">
                      {error ?? "An unknown error occurred."}
                    </Text>
                    <Button color="neutral" size="small" onClick={onReset}>
                      Dismiss
                    </Button>
                  </View>
                </Alert>
              )}

              {/* Success state */}
              {phase === "completed" && (
                <View gap={3}>
                  <Text variant="body-2" color="positive">
                    LoRA training finished successfully!
                  </Text>

                  {loraUrl && (
                    <View gap={1}>
                      <Text
                        variant="caption-1"
                        weight="medium"
                        color="neutral-faded"
                      >
                        LoRA Weights URL
                      </Text>
                      <View
                        padding={2}
                        borderRadius="small"
                        backgroundColor="elevation-raised"
                      >
                        <Text
                          variant="caption-1"
                          attributes={{
                            style: {
                              wordBreak: "break-all",
                              fontFamily: "monospace",
                            },
                          }}
                        >
                          {loraUrl}
                        </Text>
                      </View>
                      <View direction="row" gap={2}>
                        <Button
                          color="primary"
                          size="small"
                          onClick={() =>
                            navigator.clipboard.writeText(loraUrl)
                          }
                        >
                          Copy URL
                        </Button>
                        {loraId && (
                          <NextLink href={`/loras/${loraId}`} passHref legacyBehavior>
                            <Button as="a" color="positive" size="small">
                              Generate Images
                            </Button>
                          </NextLink>
                        )}
                        <NextLink href="/loras" passHref legacyBehavior>
                          <Button as="a" color="neutral" size="small">
                            View in Gallery
                          </Button>
                        </NextLink>
                        <Button
                          color="neutral"
                          size="small"
                          onClick={onReset}
                        >
                          Train Another
                        </Button>
                      </View>
                    </View>
                  )}

                  {!loraUrl && result && (
                    <View gap={1}>
                      <Text
                        variant="caption-1"
                        weight="medium"
                        color="neutral-faded"
                      >
                        Raw Result
                      </Text>
                      <pre
                        style={{
                          fontSize: 11,
                          background:
                            "var(--rs-color-background-elevation-raised)",
                          padding: 8,
                          borderRadius: 4,
                          overflow: "auto",
                          maxHeight: 160,
                          margin: 0,
                        }}
                      >
                        {JSON.stringify(result, null, 2)}
                      </pre>
                      <Button color="neutral" size="small" onClick={onReset}>
                        Train Another
                      </Button>
                    </View>
                  )}
                </View>
              )}

              {/* Log output — scrolls internally */}
              {showLogs && (
                <View gap={1}>
                  <Text
                    variant="caption-1"
                    weight="medium"
                    color="neutral-faded"
                  >
                    Logs ({logs.length})
                  </Text>
                  <div
                    ref={logsContainerRef}
                    style={{
                      fontFamily: "monospace",
                      fontSize: 11,
                      lineHeight: 1.5,
                      background:
                        "var(--rs-color-background-elevation-raised)",
                      padding: 8,
                      borderRadius: 4,
                      maxHeight: 200,
                      overflowY: "auto",
                      whiteSpace: "pre-wrap",
                      wordBreak: "break-all",
                    }}
                  >
                    {logs.map((log, i) => (
                      <div
                        key={i}
                        style={{
                          opacity: i === logs.length - 1 ? 1 : 0.7,
                        }}
                      >
                        {log.message}
                      </div>
                    ))}
                  </div>
                </View>
              )}
            </View>
          </div>
        </Card>
      </div>
    </div>
  );
}
