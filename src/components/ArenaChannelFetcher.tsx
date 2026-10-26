import { useState, useCallback, useEffect, useRef } from "react";
import { useForm, useWatch } from "react-hook-form";
import { View, Alert } from "reshaped";
import { useRouter } from "next/router";
import { zodResolver } from "@hookform/resolvers/zod";
import { trpc } from "@/utils/trpc";
import { downloadBase64File } from "@/utils/downloadBase64File";
import ChannelUrlForm from "./ChannelUrlForm";
import ArenaChannelPicker from "./ArenaChannelPicker";
import ArenaChannelResults from "./ArenaChannelResults";
import Sidebar from "./Sidebar";
import TrainingProgress from "./TrainingProgress";
import ImageSlideshow from "./ImageSlideshow";
import { formSchema, type FormData } from "./types";
import { useArenaChannelImages } from "./useArenaChannelImages";

export type TrainingPhase =
  | "idle"
  | "preparing"
  | "queued"
  | "training"
  | "completed"
  | "failed";

interface ArenaChannelFetcherProps {
  /**
   * The channel URL from `?channel=`, or "". The page remounts this component
   * whenever it changes (it is the `key`), so each channel, and the landing
   * view, starts with fresh form and training state.
   */
  channel: string;
}

export default function ArenaChannelFetcher({ channel }: ArenaChannelFetcherProps) {
  const router = useRouter();
  const submittedUrl = channel;
  const [trainingRequestId, setTrainingRequestId] = useState<string | null>(
    null,
  );
  const [trainingLoraId, setTrainingLoraId] = useState<string | null>(null);
  const [trainingPhase, setTrainingPhase] = useState<TrainingPhase>("idle");
  const [trainingError, setTrainingError] = useState<string | null>(null);

  const { handleSubmit, control, setValue, getValues } = useForm<FormData>({
    resolver: zodResolver(formSchema),
    mode: "onChange",
    defaultValues: {
      url: channel,
      selectedImages: [],
      triggerWord: "",
      trainingSteps: 1000,
    },
  });

  const selectedImages = useWatch({ control, name: "selectedImages" });

  const { data, isLoading, error } = useArenaChannelImages(submittedUrl);

  // --- Training polling queries ---
  const isPolling =
    !!trainingRequestId &&
    trainingPhase !== "completed" &&
    trainingPhase !== "failed" &&
    trainingPhase !== "idle";

  const trainingStatus = trpc.fal.getTrainingStatus.useQuery(
    { requestId: trainingRequestId! },
    {
      enabled: isPolling,
      refetchInterval: isPolling ? 2000 : false,
      refetchIntervalInBackground: true,
    },
  );

  // Follow the phase from each new status response, or fail on a polling
  // error. Adjusted during render rather than in an effect.
  const [seenStatus, setSeenStatus] = useState({ data: trainingStatus.data, error: trainingStatus.error });
  if (trainingStatus.data !== seenStatus.data || trainingStatus.error !== seenStatus.error) {
    setSeenStatus({ data: trainingStatus.data, error: trainingStatus.error });
    if (trainingStatus.error && trainingStatus.error !== seenStatus.error) {
      setTrainingPhase("failed");
      setTrainingError(trainingStatus.error.message);
    } else if (trainingStatus.data && trainingStatus.data !== seenStatus.data) {
      const s = trainingStatus.data.status;
      if (s === "IN_QUEUE") setTrainingPhase("queued");
      else if (s === "IN_PROGRESS") setTrainingPhase("training");
      else if (s === "COMPLETED") setTrainingPhase("completed");
    }
  }

  const trainingResult = trpc.fal.getTrainingResult.useQuery(
    { requestId: trainingRequestId! },
    { enabled: trainingPhase === "completed" && !!trainingRequestId },
  );

  // --- Auto-save completed LoRA to gallery ---
  const hasSavedRef = useRef(false);
  const { mutate: completeLora } = trpc.fal.completeTraining.useMutation({
    onError: (error) => console.error("Failed to save the completed LoRA:", error),
  });

  useEffect(() => {
    if (
      trainingPhase === "completed" &&
      trainingResult.data?.data &&
      trainingRequestId &&
      !hasSavedRef.current
    ) {
      const loraFile = trainingResult.data.data.diffusers_lora_file as
        | { url?: string }
        | undefined;
      const configFile = trainingResult.data.data.config_file as
        | { url?: string }
        | undefined;
      const loraUrl = loraFile?.url ?? configFile?.url;
      if (loraUrl) {
        hasSavedRef.current = true;
        completeLora({
          requestId: trainingRequestId,
          loraWeightsUrl: loraUrl,
        });
      }
    }
  }, [trainingPhase, trainingResult.data, trainingRequestId, completeLora]);

  // --- Mutations ---
  const trainLoraMutation = trpc.fal.trainLora.useMutation({
    onSuccess: (data) => {
      setTrainingRequestId(data.requestId);
      setTrainingLoraId(data.loraId ?? null);
      setTrainingPhase("queued");
    },
    onError: (error) => {
      setTrainingPhase("failed");
      setTrainingError(error.message);
    },
  });

  const cancelTrainingMutation = trpc.fal.cancelTraining.useMutation({
    onSuccess: () => {
      setTrainingPhase("idle");
      setTrainingRequestId(null);
      setTrainingError(null);
    },
    onError: (error) => {
      // Still reset locally even if the cancel API call fails
      console.error("Cancel training error:", error);
      setTrainingPhase("idle");
      setTrainingRequestId(null);
      setTrainingError(null);
    },
  });

  const downloadZipMutation = trpc.fal.downloadImageZip.useMutation({
    onSuccess: (data) => {
      downloadBase64File(data.data, data.filename, "application/zip");
    },
    onError: (error) => console.error("Download failed:", error),
  });

  const loadChannel = (url: string) => {
    // The page remounts this component for the new channel.
    router.replace({ query: { channel: url } }, undefined, { shallow: true });
  };

  const onSubmit = (formData: FormData) => {
    if (formData.url.trim()) loadChannel(formData.url.trim());
  };

  const onPickChannel = (url: string) => {
    setValue("url", url);
    loadChannel(url);
  };

  const handleImageSelection = (imageUrl: string, isSelected: boolean) => {
    const currentSelected = selectedImages || [];
    if (isSelected) {
      if (currentSelected.length < 20) {
        setValue("selectedImages", [...currentSelected, imageUrl]);
      }
    } else {
      setValue(
        "selectedImages",
        currentSelected.filter((url) => url !== imageUrl),
      );
    }
  };

  const handleTrainLora = useCallback(async () => {
    const formData = getValues();
    if (!formData.selectedImages || formData.selectedImages.length === 0) {
      alert("Please select at least one image to train the LoRA");
      return;
    }
    if (!formData.triggerWord.trim()) {
      alert("Please enter a trigger word for the LoRA");
      return;
    }

    // Reset state for new run
    setTrainingPhase("preparing");
    setTrainingError(null);
    setTrainingRequestId(null);

    try {
      await trainLoraMutation.mutateAsync({
        imageUrls: formData.selectedImages,
        triggerWord: formData.triggerWord,
        steps: formData.trainingSteps,
        ...(submittedUrl ? { arenaChannelUrl: submittedUrl } : {}),
        ...(data?.channel.title ? { arenaChannelTitle: data.channel.title } : {}),
      });
    } catch {
      // error handled in onError callback
    }
  }, [getValues, trainLoraMutation, submittedUrl, data]);

  // Back to the landing view. Clearing `?channel=` remounts this component,
  // which resets the form and training state.
  const handleResetTraining = useCallback(() => {
    router.replace({ query: {} }, undefined, { shallow: true });
  }, [router]);

  const handleCancelTraining = useCallback(() => {
    if (trainingRequestId) {
      cancelTrainingMutation.mutate({ requestId: trainingRequestId });
    } else {
      // No request ID yet (still in preparing phase) — just reset locally
      handleResetTraining();
    }
  }, [trainingRequestId, cancelTrainingMutation, handleResetTraining]);

  const handleDownloadZip = async () => {
    const formData = getValues();
    if (!formData.selectedImages || formData.selectedImages.length === 0) {
      alert("No images selected to download");
      return;
    }
    if (!formData.triggerWord.trim()) {
      alert("Please enter a trigger word for the filename");
      return;
    }
    try {
      await downloadZipMutation.mutateAsync({
        imageUrls: formData.selectedImages,
        triggerWord: formData.triggerWord,
      });
    } catch (error) {
      console.error("Download error:", error);
    }
  };

  const isTrainingActive = trainingPhase !== "idle";

  const showLanding = !data && !isLoading && !error;

  return (
    <>
      <View
        width="100%"
        height="100%"
        direction="column"
        attributes={{
          style: {
            display: "flex",
            flexDirection: "column",
            position: "relative",
          },
        }}
      >
        {/* Full-bleed canvas background — idle/landing state only */}
        {showLanding && (
          <View
            attributes={{
              style: {
                position: "absolute",
                inset: 0,
                overflow: "hidden",
              },
            }}
          >
            <ImageSlideshow />
          </View>
        )}

        {/* Centered input overlay — idle/landing state only */}
        {showLanding && (
          <View
            attributes={{
              style: {
                position: "absolute",
                inset: 0,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                zIndex: 10,
                pointerEvents: "none",
              },
            }}
          >
            <View
              width="100%"
              attributes={{
                style: {
                  maxWidth: "680px",
                  padding: "0 16px",
                  pointerEvents: "auto",
                },
              }}
            >
              <View gap={3}>
                <ChannelUrlForm
                  control={control}
                  onSubmit={handleSubmit(onSubmit)}
                  isLoading={isLoading}
                />
                <ArenaChannelPicker onPick={onPickChannel} disabled={isLoading} />
              </View>
            </View>
          </View>
        )}

        {/* Error state */}
        {error && (
          <View
            padding={4}
            attributes={{ style: { flex: "1 1 0%" } }}
          >
            <Alert color="critical">Error: {error.message}</Alert>
          </View>
        )}

        {/* Results state — grid + sidebar */}
        {data && (
          <View
            direction={{ s: "column", l: "row" }}
            attributes={{
              style: { flex: "1 1 0%", minHeight: 0, overflow: "hidden" },
            }}
          >
            <View
              attributes={{
                style: {
                  flex: 9,
                  minWidth: 0,
                  height: "100%",
                  overflow: "hidden",
                  borderRight: "1px solid var(--rs-color-border-neutral-faded, rgba(0,0,0,0.08))",
                },
              }}
            >
              <View
                className="scrollbar-hidden"
                attributes={{
                  style: { height: "100%", overflowY: "auto" },
                }}
              >
                <ArenaChannelResults
                  channel={data.channel}
                  total={data.total}
                  images={data.images}
                  selectedImages={selectedImages}
                  onImageSelect={handleImageSelection}
                />
              </View>
            </View>

            <View
              attributes={{
                style: {
                  flex: 3,
                  minWidth: 0,
                  height: "100%",
                  overflowY: "auto",
                  padding: 8,
                },
              }}
            >
              <Sidebar
                selectedImages={selectedImages}
                control={control}
                onTrain={handleTrainLora}
                onDownload={handleDownloadZip}
                downloadMutation={downloadZipMutation}
                isSubmitting={trainLoraMutation.isPending}
                isTrainingActive={isTrainingActive}
              />
            </View>
          </View>
        )}
      </View>

      <TrainingProgress
        phase={trainingPhase}
        logs={trainingStatus.data?.logs ?? []}
        result={trainingResult.data?.data ?? null}
        error={trainingError}
        queuePosition={trainingStatus.data?.queuePosition ?? undefined}
        loraId={trainingLoraId}
        onReset={handleResetTraining}
        onCancel={handleCancelTraining}
        isCancelling={cancelTrainingMutation.isPending}
      />
    </>
  );
}
