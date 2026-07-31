import { useState } from "react";
import { useRouter } from "next/router";
import { View, Text, Button, Alert, Loader } from "reshaped";
import NextLink from "next/link";
import NextImage from "next/image";
import { isAddress, isAddressEqual } from "viem";
import { useAccount } from "wagmi";
import { trpc } from "@/utils/trpc";
import GenerateModal from "@/components/GenerateModal";
import GeneratedImageGrid from "@/components/GeneratedImageGrid";
import SlideshowModal from "@/components/SlideshowModal";
import ArenaChannelBadge from "@/components/ArenaChannelBadge";
import TrainingImagesBadge from "@/components/TrainingImagesBadge";
import GenerateImagesTile from "@/components/GenerateImagesTile";
import LoraUrlCopyBadge from "@/components/LoraUrlCopyBadge";
import LoraHideToggle from "@/components/LoraHideToggle";
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
  const [trainingSlideshowIndex, setTrainingSlideshowIndex] = useState<number | null>(null);
  const { address: connectedAddress } = useAccount();

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

  const isOwner = !!(
    connectedAddress &&
    lora.walletAddress &&
    isAddress(connectedAddress) &&
    isAddress(lora.walletAddress) &&
    isAddressEqual(connectedAddress, lora.walletAddress as `0x${string}`)
  );

  const isCompleted = lora.status === "completed" && !!lora.loraWeightsUrl;
  const images = imagesQuery.data ?? [];

  return (
    <View height="100vh" direction="column" attributes={{ style: { width: `calc(100% - ${NAV_WIDTH}px)` } }}>
      <View
        attributes={{ style: { flex: 1, overflowY: "auto" } }}
      >
        {/* Header */}
        <View
          padding={4}
          gap={4}
          attributes={{
            style: {
              borderBottom: "1px solid var(--rs-color-border-neutral-faded, rgba(0,0,0,0.08))",
            },
          }}
        >
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
                <View direction="row" gap={2} wrap>
                  {lora.arenaChannelUrl && lora.arenaChannelTitle && (
                    <ArenaChannelBadge
                      title={lora.arenaChannelTitle}
                      url={lora.arenaChannelUrl}
                    />
                  )}
                  {lora.loraWeightsUrl && (
                    <LoraUrlCopyBadge url={lora.loraWeightsUrl} />
                  )}
                </View>
              </View>
            </View.Item>

            {isOwner && (
              <div style={{ alignSelf: "flex-start" }}>
                <LoraHideToggle id={lora.id} hidden={lora.hidden ?? false} />
              </div>
            )}

          </View>

          {/* Training image thumbnails */}
          <View direction="row" gap={1} wrap align="center">
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
            <View paddingStart={2}>
              <TrainingImagesBadge
                count={lora.imageUrls.length > 8 ? lora.imageUrls.length - 8 : 0}
                onClick={() => setTrainingSlideshowIndex(0)}
              />
            </View>
          </View>
        </View>

        {/* Generated Images Gallery */}
        <View gap={3} padding={4}>
          {imagesQuery.isLoading && (
            <View align="center" padding={6}>
              <Loader />
            </View>
          )}

          {!imagesQuery.isLoading && (
            <GeneratedImageGrid
              images={images}
              variant="page"
              onImageClick={(index) => setSlideshowIndex(index)}
              currentWallet={connectedAddress}
              prependTile={
                isCompleted ? (
                  <GenerateImagesTile
                    onClick={() => setShowGenerateModal(true)}
                    images={lora.imageUrls}
                  />
                ) : null
              }
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

      {/* Training Images Slideshow Modal */}
      {trainingSlideshowIndex !== null && (
        <SlideshowModal
          active={trainingSlideshowIndex !== null}
          onClose={() => setTrainingSlideshowIndex(null)}
          images={lora.imageUrls.map((url, i) => ({
            id: `training-${i}`,
            imageUrl: url,
            cdnUrl: null,
            prompt: `Training image ${i + 1}`,
          }))}
          startIndex={trainingSlideshowIndex}
        />
      )}
    </View>
  );
}