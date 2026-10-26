import { useState } from "react";
import { View, Text, Button, Alert } from "reshaped";
import NextLink from "next/link";
import NextImage from "next/image";
import { graphql, useLazyLoadQuery } from "react-relay";
import { toTrainingGlobalId } from "@/lib/relay/ids";
import type { LoraDetailQuery } from "./__generated__/LoraDetailQuery.graphql";
import SlideshowModal from "./SlideshowModal";
import ArenaChannelBadge from "./ArenaChannelBadge";
import TrainingImagesBadge from "./TrainingImagesBadge";
import LoraUrlCopyBadge from "./LoraUrlCopyBadge";
import LoraHideToggle from "./LoraHideToggle";
import LoraImages from "./LoraImages";

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

/** One LoRA by its raw id. Render under a FeatureBoundary. */
export default function LoraDetail({ id }: { id: string }) {
  const [trainingSlideshowIndex, setTrainingSlideshowIndex] = useState<number | null>(null);

  const { node } = useLazyLoadQuery<LoraDetailQuery>(
    graphql`
      query LoraDetailQuery($id: ID!) {
        node(id: $id) {
          __typename
          ... on LoraTraining {
            id
            triggerWord
            steps
            status
            createdAt
            trainingImageUrls
            loraWeightsUrl
            arenaChannelUrl
            arenaChannelTitle
            hidden
            ...LoraImages_training @alias(as: "imagesFragment")
          }
        }
      }
    `,
    { id: toTrainingGlobalId(id) },
  );

  // Missing, and hidden from this viewer, look the same: the API returns null.
  if (node?.__typename !== "LoraTraining") {
    return (
      <View height="100vh" padding={4}>
        <View gap={4}>
          <Alert color="critical" title="LoRA unavailable">
            This LoRA doesn&apos;t exist or isn&apos;t public.
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

  const lora = node;
  // Set whenever the node is a LoraTraining, which was just checked.
  const imagesFragment = lora.imagesFragment!;
  const imageUrls = lora.trainingImageUrls;
  const isCompleted = lora.status === "COMPLETED" && !!lora.loraWeightsUrl;
  // `hidden` is revealed to the owner only.
  const isOwner = lora.hidden != null;

  return (
    <>
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
                  {imageUrls.length} training images
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
          {imageUrls.slice(0, 8).map((url, i) => (
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
              count={imageUrls.length > 8 ? imageUrls.length - 8 : 0}
              onClick={() => setTrainingSlideshowIndex(0)}
            />
          </View>
        </View>
      </View>

      {/* Generated Images Gallery */}
      <View gap={3} padding={4}>
        <LoraImages
          training={imagesFragment}
          loraId={id}
          triggerWord={lora.triggerWord}
          trainingImageUrls={imageUrls}
          canGenerate={isCompleted}
        />
      </View>

      {/* Training Images Slideshow Modal */}
      {trainingSlideshowIndex !== null && (
        <SlideshowModal
          active={trainingSlideshowIndex !== null}
          onClose={() => setTrainingSlideshowIndex(null)}
          images={imageUrls.map((url, i) => ({
            id: `training-${i}`,
            url,
            prompt: `Training image ${i + 1}`,
          }))}
          startIndex={trainingSlideshowIndex}
        />
      )}
    </>
  );
}
