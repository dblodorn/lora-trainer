import { View, Text, Button } from "reshaped";
import NextLink from "next/link";
import NextImage from "next/image";
import { graphql, useFragment } from "react-relay";
import { fromTrainingGlobalId } from "@/lib/relay/ids";
import type { LoraRow_training$key } from "./__generated__/LoraRow_training.graphql";
import ArenaChannelBadge from "./ArenaChannelBadge";

interface LoraRowProps {
  training: LoraRow_training$key;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default function LoraRow({ training }: LoraRowProps) {
  const lora = useFragment(
    graphql`
      fragment LoraRow_training on LoraTraining {
        id
        triggerWord
        steps
        createdAt
        trainingImageUrls
        arenaChannelUrl
        arenaChannelTitle
      }
    `,
    training,
  );
  const { triggerWord, steps, createdAt, arenaChannelUrl, arenaChannelTitle } = lora;
  const imageUrls = lora.trainingImageUrls;
  const maxThumbnails = 4;
  const visibleImages = imageUrls.slice(0, maxThumbnails);
  const overflow = imageUrls.length - maxThumbnails;

  return (
    <View
      direction="row"
      align="center"
      gap={4}
      padding={4}
      borderRadius="medium"
      borderColor="neutral-faded"
      backgroundColor="elevation-base"
    >
      {/* Thumbnails */}
      <View direction="row" gap={1} align="center">
        {visibleImages.map((url, i) => (
          <div
            key={i}
            style={{
              position: "relative",
              width: 48,
              height: 48,
              borderRadius: "var(--rs-radius-small)",
              overflow: "hidden",
              flexShrink: 0,
            }}
          >
            <NextImage
              src={url}
              alt=""
              fill
              sizes="48px"
              style={{ objectFit: "cover" }}
            />
          </div>
        ))}
        {overflow > 0 && (
          <Text variant="caption-1" color="neutral-faded">
            +{overflow}
          </Text>
        )}
      </View>

      {/* Details */}
      <View.Item grow>
        <Text variant="body-1" weight="bold">
          {triggerWord}
        </Text>
        <View direction="row" gap={3}>
          <Text variant="caption-1" color="neutral-faded">
            {steps} steps
          </Text>
          <Text variant="caption-1" color="neutral-faded">
            {imageUrls.length} images
          </Text>
          <Text variant="caption-1" color="neutral-faded">
            {formatDate(createdAt)}
          </Text>
          {arenaChannelUrl && arenaChannelTitle && (
            <ArenaChannelBadge
              title={arenaChannelTitle}
              url={arenaChannelUrl}
            />
          )}
        </View>
      </View.Item>

      {/* Actions */}
      <View direction="row" gap={2}>
        <NextLink href={`/loras/${fromTrainingGlobalId(lora.id)}`} passHref legacyBehavior>
          <Button as="a" color="primary" size="medium" attributes={{ style: { width: 120 } }}>
            View
          </Button>
        </NextLink>
      </View>
    </View>
  );
}
