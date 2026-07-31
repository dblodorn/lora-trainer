import { View, Text, Button } from "reshaped";
import NextLink from "next/link";
import NextImage from "next/image";
import { Eye, EyeOff } from "lucide-react";
import { trpc } from "@/utils/trpc";
import ArenaChannelBadge from "./ArenaChannelBadge";

interface LoraRowProps {
  id: string;
  triggerWord: string;
  loraWeightsUrl: string | null;
  imageUrls: string[];
  steps: number;
  createdAt: string;
  arenaChannelUrl?: string | null;
  arenaChannelTitle?: string | null;
  walletAddress?: string;
  hidden?: boolean;
  isOwner?: boolean;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default function LoraRow({
  id,
  triggerWord,
  loraWeightsUrl,
  imageUrls,
  steps,
  createdAt,
  arenaChannelUrl,
  arenaChannelTitle,
  walletAddress,
  hidden,
  isOwner,
}: LoraRowProps) {
  const utils = trpc.useUtils();
  const hideMutation = trpc.lora.hide.useMutation({
    onSuccess: () => utils.lora.list.invalidate(),
  });
  const unhideMutation = trpc.lora.unhide.useMutation({
    onSuccess: () => utils.lora.list.invalidate(),
  });

  const maxThumbnails = 4;
  const visibleImages = imageUrls.slice(0, maxThumbnails);
  const overflow = imageUrls.length - maxThumbnails;

  const handleToggleHide = () => {
    if (hidden) {
      unhideMutation.mutate({ id });
    } else {
      hideMutation.mutate({ id });
    }
  };

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
      <View direction="row" gap={2} align="center">
        {isOwner && (
          <Button
            variant="ghost"
            size="small"
            onClick={handleToggleHide}
            loading={hideMutation.isPending || unhideMutation.isPending}
          >
            {hidden ? <EyeOff size={16} /> : <Eye size={16} />}
          </Button>
        )}
        <NextLink href={`/loras/${id}`} passHref legacyBehavior>
          <Button as="a" color="primary" size="medium" attributes={{ style: { width: 120 } }}>
            View
          </Button>
        </NextLink>
      </View>
    </View>
  );
}