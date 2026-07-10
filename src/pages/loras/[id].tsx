import { useState } from "react";
import { useRouter } from "next/router";
import { View, Text, Button, Alert, Loader, Image } from "reshaped";
import NextLink from "next/link";
import { trpc } from "@/utils/trpc";
import GenerateModal from "@/components/GenerateModal";
import GeneratedImageGrid from "@/components/GeneratedImageGrid";

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default function LoraDetailPage() {
  const router = useRouter();
  const id = router.query.id as string | undefined;
  const [showGenerateModal, setShowGenerateModal] = useState(false);

  const loraQuery = trpc.lora.getById.useQuery(
    { id: id! },
    { enabled: !!id },
  );

  const imagesQuery = trpc.generate.listByLora.useQuery(
    { loraTrainingId: id! },
    { enabled: !!id },
  );

  if (!id) {
    return (
      <View height="100vh" align="center" justify="center">
        <Loader />
      </View>
    );
  }

  if (loraQuery.isLoading) {
    return (
      <View height="100vh" align="center" justify="center">
        <Loader />
      </View>
    );
  }

  if (loraQuery.error) {
    return (
      <View height="100vh" padding={4}>
        <View gap={4}>
          <Alert color="critical" title="LoRA not found">
            {loraQuery.error.message}
          </Alert>
          <NextLink href="/loras" passHref legacyBehavior>
            <Button as="a" color="neutral" size="small">
              Back to Gallery
            </Button>
          </NextLink>
        </View>
      </View>
    );
  }

  const lora = loraQuery.data;
  if (!lora) return null;

  const isCompleted = lora.status === "completed" && !!lora.loraWeightsUrl;
  const images = imagesQuery.data ?? [];

  return (
    <View height="100vh" direction="column">
      <View
        padding={4}
        gap={6}
        attributes={{ style: { flex: 1, overflowY: "auto" } }}
      >
        {/* Header */}
        <View gap={4}>
          <View direction="row" align="center" gap={2}>
            <NextLink href="/loras" passHref legacyBehavior>
              <Button as="a" variant="ghost" size="small">
                &larr; Gallery
              </Button>
            </NextLink>
          </View>

          <View direction="row" align="center" gap={4}>
            <View.Item grow>
              <View gap={1}>
                <Text variant="title-1">{lora.triggerWord}</Text>
                <View direction="row" gap={3}>
                  <Text variant="body-2" color="neutral-faded">
                    {lora.steps} steps
                  </Text>
                  <Text variant="body-2" color="neutral-faded">
                    {lora.imageUrls.length} training images
                  </Text>
                  <Text variant="body-2" color="neutral-faded">
                    {formatDate(lora.createdAt)}
                  </Text>
                </View>
              </View>
            </View.Item>

            {isCompleted && (
              <Button
                color="primary"
                onClick={() => setShowGenerateModal(true)}
              >
                Generate Images
              </Button>
            )}
          </View>

          {/* Training image thumbnails */}
          <View direction="row" gap={1} wrap>
            {lora.imageUrls.slice(0, 8).map((url, i) => (
              <Image
                key={i}
                src={url}
                alt=""
                width="56px"
                height="56px"
                displayMode="cover"
                borderRadius="small"
              />
            ))}
            {lora.imageUrls.length > 8 && (
              <View
                width="56px"
                height="56px"
                align="center"
                justify="center"
                borderRadius="small"
                backgroundColor="elevation-raised"
              >
                <Text variant="caption-1" color="neutral-faded">
                  +{lora.imageUrls.length - 8}
                </Text>
              </View>
            )}
          </View>
        </View>

        {/* Generated Images Gallery */}
        <View gap={3}>
          <Text variant="title-3">Generated Images</Text>

          {imagesQuery.isLoading && (
            <View align="center" padding={6}>
              <Loader />
            </View>
          )}

          {images.length === 0 && !imagesQuery.isLoading && (
            <View
              align="center"
              padding={8}
              borderRadius="medium"
              backgroundColor="elevation-raised"
            >
              <View gap={2} align="center">
                <Text variant="body-1" color="neutral-faded">
                  No images generated yet.
                </Text>
                {isCompleted && (
                  <Button
                    color="primary"
                    size="small"
                    onClick={() => setShowGenerateModal(true)}
                  >
                    Generate your first images
                  </Button>
                )}
              </View>
            </View>
          )}

          {images.length > 0 && (
            <GeneratedImageGrid
              images={images}
              variant="page"
            />
          )}
        </View>
      </View>

      {/* Generate Modal */}
      {isCompleted && (
        <GenerateModal
          active={showGenerateModal}
          onClose={() => setShowGenerateModal(false)}
          loraId={lora.id}
          triggerWord={lora.triggerWord}
        />
      )}
    </View>
  );
}
