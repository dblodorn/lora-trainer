import { useState } from "react";
import { useRouter } from "next/router";
import { View, Text, Button, Alert, Loader } from "reshaped";
import NextLink from "next/link";
import NextImage from "next/image";
import { trpc } from "@/utils/trpc";
import GenerateModal from "@/components/GenerateModal";
import GeneratedImageGrid from "@/components/GeneratedImageGrid";
import SlideshowModal from "@/components/SlideshowModal";
import { NAV_WIDTH } from "@/components/VerticalNav";

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
  const [slideshowIndex, setSlideshowIndex] = useState<number | null>(null);

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
    <View height="100vh" direction="column" attributes={{ style: { width: `calc(100% - ${NAV_WIDTH}px)` } }}>
      <View
        padding={4}
        gap={6}
        attributes={{ style: { flex: 1, overflowY: "auto" } }}
      >
        {/* Header */}
        <View gap={4}>
          <View direction="row" align="center" gap={4}>
            <View.Item grow>
              <View gap={1}>
                <Text variant="body-1" weight="bold">{lora.triggerWord}</Text>
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
              <div
                key={i}
                style={{
                  position: "relative",
                  width: 56,
                  height: 56,
                  borderRadius: "var(--rs-radius-small)",
                  overflow: "hidden",
                  flexShrink: 0,
                }}
              >
                <NextImage
                  src={url}
                  alt=""
                  fill
                  sizes="56px"
                  style={{ objectFit: "cover" }}
                />
              </div>
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

        {/* Divider */}
        <View
          attributes={{
            style: {
              width: "100%",
              height: "1px",
              backgroundColor: "var(--rs-color-border-neutral-faded, rgba(0,0,0,0.08))",
            },
          }}
        />

        {/* Generated Images Gallery */}
        <View gap={3}>
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
              onImageClick={(index) => setSlideshowIndex(index)}
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

      {/* Slideshow Modal */}
      {images.length > 0 && (
        <SlideshowModal
          active={slideshowIndex !== null}
          onClose={() => setSlideshowIndex(null)}
          images={images}
          startIndex={slideshowIndex ?? 0}
        />
      )}
    </View>
  );
}
