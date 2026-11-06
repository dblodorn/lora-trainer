import { useState, useRef, useEffect } from "react";
import { View, Text, Card, Alert, Button, Loader } from "reshaped";
import NextLink from "next/link";
import type { TrainingPhase } from "./ArenaChannelFetcher";

interface TrainingProgressProps {
  phase: TrainingPhase;
  logs: { timestamp: string; message: string }[];
  /** The trained weights' URL, once the result has been fetched. */
  loraUrl: string | null;
  /** Why fetching the result failed, if it did. */
  resultError: string | null;
  /** The model's usual training time, shown when its trainer sends no logs. */
  typicalMinutes: number;
  error: string | null;
  queuePosition?: number;
  loraId?: string | null;
  onReset: () => void;
  onCancel: () => void;
  isCancelling: boolean;
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

function formatElapsed(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

const isActive = (phase: TrainingPhase) =>
  phase === "preparing" || phase === "queued" || phase === "training";

export default function TrainingProgress({
  phase,
  logs,
  loraUrl,
  resultError,
  typicalMinutes,
  error,
  queuePosition,
  loraId,
  onReset,
  onCancel,
  isCancelling,
}: TrainingProgressProps) {
  const [expanded, setExpanded] = useState(false);
  const logsContainerRef = useRef<HTMLDivElement>(null);

  // Auto-expand when training starts (transitions from queued to training).
  // Adjusted during render rather than in an effect, so there's no extra pass.
  const [seenPhase, setSeenPhase] = useState(phase);
  if (phase !== seenPhase) {
    setSeenPhase(phase);
    if (phase === "training") setExpanded(true);
  }

  // Time since the training was started. Some trainers send no logs, so this
  // is the only sign of life while they run.
  const active = isActive(phase);
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    if (!active) return;
    const startedAt = Date.now();
    const id = setInterval(() => setElapsed(Math.floor((Date.now() - startedAt) / 1000)), 1000);
    return () => clearInterval(id);
  }, [active]);

  // Auto-scroll the logs container internally (not the window)
  useEffect(() => {
    const container = logsContainerRef.current;
    if (container) {
      container.scrollTop = container.scrollHeight;
    }
  }, [logs.length]);

  if (phase === "idle") return null;

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

            {active && (
              <Text variant="caption-1" color="neutral-faded">
                {formatElapsed(elapsed)}
              </Text>
            )}

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
              {phase === "training" && logs.length === 0 && (
                <Text variant="body-3" color="neutral-faded">
                  This model doesn&apos;t report progress. Training usually takes about {typicalMinutes} min.
                </Text>
              )}

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

                  {!loraUrl && resultError && (
                    <Alert color="critical" title="Couldn't read the trained weights">
                      <View gap={2}>
                        <Text variant="body-2">{resultError}</Text>
                        <Button color="neutral" size="small" onClick={onReset}>
                          Train Another
                        </Button>
                      </View>
                    </Alert>
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
