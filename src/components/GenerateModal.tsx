import { useState, useCallback, useEffect } from "react";
import { View, Text, Button, Modal, TextField, Alert, Loader } from "reshaped";
import { trpc } from "@/utils/trpc";
import { authClient } from "@/lib/auth-client";
import { useAuthModal } from "./AuthModalProvider";
import GeneratedImageGrid from "./GeneratedImageGrid";

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
    { id: string; imageUrl: string; prompt: string; createdAt: string }[]
  >([]);
  const [nsfwWarning, setNsfwWarning] = useState(false);

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
          prompt: data.prompt,
          createdAt: now,
        })),
      );
      setNsfwWarning(data.nsfwFiltered);
      // Invalidate queries so gallery refreshes
      utils.generate.listByLora.invalidate({ loraTrainingId: loraId });
      utils.generate.remaining.invalidate();
    },
  });

  // Reset state when modal opens
  useEffect(() => {
    if (active) {
      setGeneratedImages([]);
      setNsfwWarning(false);
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
    });
  }, [session, prompt, loraId, generateMutation, openAuthModal]);

  const handleGenerateAgain = useCallback(() => {
    setGeneratedImages([]);
    setNsfwWarning(false);
    generateMutation.reset();
    generateMutation.mutate({
      loraTrainingId: loraId,
      prompt: prompt.trim(),
    });
  }, [prompt, loraId, generateMutation]);

  const isGenerating = generateMutation.isPending;
  const hasResults = generatedImages.length > 0;
  const remaining = remainingQuery.data?.remaining ?? null;
  const isExempt = remainingQuery.data?.isExempt ?? false;

  return (
    <Modal active={active} onClose={onClose} position="center" padding={6}>
      <View gap={4} direction="column">
        <View gap={1}>
          <Text variant="title-3">Generate Images</Text>
          <Text variant="body-2" color="neutral-faded">
            Your prompt will include: &ldquo;... in the style of {triggerWord}&rdquo;
          </Text>
        </View>

        <TextField
          name="prompt"
          value={prompt}
          onChange={({ value }) => setPrompt(value)}
          placeholder="Describe the image you want to create..."
          inputAttributes={{ maxLength: 500 }}
          disabled={isGenerating}
        />

        <View direction="row" align="center" gap={2}>
          {remaining !== null && !isExempt && (
            <Text variant="caption-1" color="neutral-faded">
              {remaining} of 8 generations remaining today
            </Text>
          )}
          <View.Item grow>
            <Text variant="caption-1" color="neutral-faded" align="end">
              {prompt.length}/500
            </Text>
          </View.Item>
        </View>

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
