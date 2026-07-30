import { useState, useCallback, useEffect } from "react";
import { View, Text, Button, Modal, TextArea, Alert, Loader, ToggleButton, ToggleButtonGroup, NumberField } from "reshaped";
import { trpc } from "@/utils/trpc";
import { authClient } from "@/lib/auth-client";
import { useAuthModal } from "./AuthModalProvider";
import GeneratedImageGrid from "./GeneratedImageGrid";
import {
  LORA_SCALE_PRESETS,
  DEFAULT_LORA_SCALE,
  LORA_SCALE_VALUES,
  type LoraScale,
} from "@/lib/lora-scale";
import {
  IMAGE_DIMENSION_MIN,
  IMAGE_DIMENSION_MAX,
  DEFAULT_IMAGE_WIDTH,
  DEFAULT_IMAGE_HEIGHT,
} from "@/lib/image-dimensions";

interface GenerateModalProps {
  active: boolean;
  onClose: () => void;
  loraId: string;
  triggerWord: string;
}

export default function GenerateModal({
  active,
  onClose,
  loraId,
  triggerWord,
}: GenerateModalProps) {
  const [prompt, setPrompt] = useState("");
  const [generatedImages, setGeneratedImages] = useState<
    { id: string; imageUrl: string; cdnUrl: string | null; prompt: string; createdAt: string; loraScaleName?: string | null }[]
  >([]);
  const [nsfwWarning, setNsfwWarning] = useState(false);
  const [loraScale, setLoraScale] = useState<LoraScale>(DEFAULT_LORA_SCALE);
  const [imageWidth, setImageWidth] = useState<number>(DEFAULT_IMAGE_WIDTH);
  const [imageHeight, setImageHeight] = useState<number>(DEFAULT_IMAGE_HEIGHT);

  const { data: session } = authClient.useSession();
  const { openAuthModal } = useAuthModal();

  const utils = trpc.useUtils();

  const remainingQuery = trpc.generate.remaining.useQuery(undefined, {
    enabled: active && !!session,
  });

  const generateMutation = trpc.generate.images.useMutation({
    onSuccess: (data) => {
      const now = new Date().toISOString();
      setGeneratedImages(
        data.images.map((img) => ({
          id: img.id,
          imageUrl: img.imageUrl,
          cdnUrl: img.cdnUrl,
          prompt: data.prompt,
          createdAt: now,
          loraScaleName: img.loraScaleName ?? null,
        })),
      );
      setNsfwWarning(data.nsfwFiltered);
      utils.generate.listByLora.invalidate({ loraTrainingId: loraId });
      utils.generate.remaining.invalidate();
    },
  });

  useEffect(() => {
    if (active) {
      setGeneratedImages([]);
      setNsfwWarning(false);
      setLoraScale(DEFAULT_LORA_SCALE);
      setImageWidth(DEFAULT_IMAGE_WIDTH);
      setImageHeight(DEFAULT_IMAGE_HEIGHT);
      generateMutation.reset();
    }
  }, [active]);

  const handleGenerate = useCallback(() => {
    if (!session) {
      openAuthModal();
      return;
    }
    if (!prompt.trim()) return;

    setGeneratedImages([]);
    setNsfwWarning(false);
    generateMutation.mutate({
      loraTrainingId: loraId,
      prompt: prompt.trim(),
      loraScale,
      imageWidth,
      imageHeight,
    });
  }, [session, prompt, loraId, loraScale, imageWidth, imageHeight, generateMutation, openAuthModal]);

  const handleGenerateAgain = useCallback(() => {
    setGeneratedImages([]);
    setNsfwWarning(false);
    generateMutation.reset();
    generateMutation.mutate({
      loraTrainingId: loraId,
      prompt: prompt.trim(),
      loraScale,
      imageWidth,
      imageHeight,
    });
  }, [prompt, loraId, loraScale, imageWidth, imageHeight, generateMutation]);

  const isGenerating = generateMutation.isPending;
  const hasResults = generatedImages.length > 0;
  const remaining = remainingQuery.data?.remaining ?? null;
  const isExempt = remainingQuery.data?.isExempt ?? false;

  return (
    <Modal active={active} onClose={onClose} position="center" padding={6} size="640px">
      <View gap={4} direction="column">
        <View gap={1}>
          <Text variant="body-2" color="neutral-faded">
            Your prompt will include: &ldquo;... in the style of {triggerWord}&rdquo;
          </Text>
        </View>

        <View gap={1}>
          <TextArea
            name="prompt"
            value={prompt}
            onChange={({ value }) => setPrompt(value)}
            placeholder="Describe the image you want to create..."
            inputAttributes={{ maxLength: 500 }}
            size="large"
            resize="none"
            disabled={isGenerating}
          />
          <Text variant="caption-1" color="neutral-faded" align="end">
            {prompt.length}/500
          </Text>
        </View>

        <View gap={1}>
          <Text variant="caption-1" color="neutral-faded">
            LoRA weight
          </Text>
          <ToggleButtonGroup
            value={[loraScale]}
            selectionMode="single"
            onChange={({ value }) => {
              const v = value[0];
              if (v && LORA_SCALE_VALUES.includes(v as LoraScale)) {
                setLoraScale(v as LoraScale);
              }
            }}
          >
            {LORA_SCALE_PRESETS.map((preset) => (
              <ToggleButton
                key={preset.value}
                value={preset.value}
                variant="outline"
              >
                {preset.label}
              </ToggleButton>
            ))}
          </ToggleButtonGroup>
        </View>

        <View gap={1}>
          <Text variant="caption-1" color="neutral-faded">
            Image dimensions
          </Text>
          <View direction="row" gap={3}>
            <View.Item grow>
              <NumberField
                name="imageWidth"
                placeholder="Width"
                value={imageWidth}
                onChange={({ value }) => setImageWidth(value ?? DEFAULT_IMAGE_WIDTH)}
                min={IMAGE_DIMENSION_MIN}
                max={IMAGE_DIMENSION_MAX}
                step={1}
                increaseAriaLabel="Increase width"
                decreaseAriaLabel="Decrease width"
                disabled={isGenerating}
              />
            </View.Item>
            <View.Item grow>
              <NumberField
                name="imageHeight"
                placeholder="Height"
                value={imageHeight}
                onChange={({ value }) => setImageHeight(value ?? DEFAULT_IMAGE_HEIGHT)}
                min={IMAGE_DIMENSION_MIN}
                max={IMAGE_DIMENSION_MAX}
                step={1}
                increaseAriaLabel="Increase height"
                decreaseAriaLabel="Decrease height"
                disabled={isGenerating}
              />
            </View.Item>
          </View>
          <Text variant="caption-1" color="neutral-faded">
            {IMAGE_DIMENSION_MIN}–{IMAGE_DIMENSION_MAX}px · default {DEFAULT_IMAGE_WIDTH}×{DEFAULT_IMAGE_HEIGHT}
          </Text>
        </View>

        {remaining !== null && !isExempt && (
          <Text variant="caption-1" color="neutral-faded">
            {remaining} of 8 generations remaining today
          </Text>
        )}

        {!hasResults && !isGenerating && (
          <Button
            color="primary"
            fullWidth
            onClick={handleGenerate}
            disabled={!prompt.trim() || (remaining === 0 && !isExempt)}
          >
            {!session ? "Connect Wallet to Generate" : "Generate 4 Images"}
          </Button>
        )}

        {isGenerating && (
          <View align="center" padding={6} gap={3}>
            <Loader />
            <Text variant="body-2" color="neutral-faded">
              Generating images... this takes about 10-15 seconds
            </Text>
          </View>
        )}

        {generateMutation.error && (
          <Alert color="critical" title="Generation Failed">
            {generateMutation.error.message}
          </Alert>
        )}

        {nsfwWarning && (
          <Alert color="neutral">
            Some images were filtered by the safety checker and may not appear.
          </Alert>
        )}

        {hasResults && (
          <View gap={3}>
            <GeneratedImageGrid images={generatedImages} variant="modal" />
            <Button
              color="primary"
              fullWidth
              onClick={handleGenerateAgain}
              disabled={!prompt.trim() || (remaining === 0 && !isExempt)}
            >
              Generate Again
            </Button>
          </View>
        )}
      </View>
    </Modal>
  );
}
