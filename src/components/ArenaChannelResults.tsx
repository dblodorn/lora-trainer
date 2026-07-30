import { View, Text, Link } from "reshaped";
import NextImage from "next/image";
import ImageCard from "./ImageCard";
import type { ArenaImage } from "./types";

interface ArenaChannelResultsProps {
  channel: { title: string; slug: string; url: string };
  total: number;
  images: ArenaImage[];
  selectedImages: string[];
  onImageSelect: (imageUrl: string, isSelected: boolean) => void;
}

export default function ArenaChannelResults({
  channel,
  total,
  images,
  selectedImages,
  onImageSelect,
}: ArenaChannelResultsProps) {
  const getImageUrl = (image: ArenaImage) => {
    return (
      image.image?.original.url ||
      image.image?.large.url ||
      image.image?.display.url
    );
  };

  function renderImageGrid() {
    return (
      <View direction="row" wrap gap={2}>
        {images.map((image) => {
          const imageUrl = getImageUrl(image);
          if (!imageUrl) return null;

          const isSelected = selectedImages?.includes(imageUrl) || false;
          const canSelect = selectedImages.length < 20 || isSelected;

          return (
            <View.Item key={image.id} columns={{ s: 12, m: 6, l: 4 }}>
              <ImageCard
                image={image}
                imageUrl={imageUrl}
                isSelected={isSelected}
                canSelect={canSelect}
                onSelect={onImageSelect}
              />
            </View.Item>
          );
        })}
      </View>
    );
  }

  return (
    <View>
      {/* Header */}
      <View
        padding={4}
        gap={2}
        attributes={{
          style: {
            position: "sticky",
            top: 0,
            zIndex: 20,
            backgroundColor: "var(--rs-color-background-page, #ffffff)",
            borderBottom: "1px solid var(--rs-color-border-neutral-faded, rgba(0,0,0,0.08))",
          },
        }}
      >
        <View direction="row" gap={2} align="center">
          <NextImage
            src="/are-na-logo.png"
            alt="are.na"
            width={30}
            height={30}
            style={{ borderRadius: 4, flexShrink: 0 }}
          />
          <Link
            href={channel.url}
            attributes={{
              target: "_blank",
              rel: "noopener noreferrer",
              style: {
                color: "var(--rs-color-foreground-neutral)",
              },
            }}
          >
            <Text variant="body-1" weight="bold" color="neutral">{channel.title}</Text>
          </Link>
        </View>
        <Text variant="body-2" color="neutral-faded">
          {selectedImages.length} / {total} images selected
        </Text>
      </View>

      {/* Grid */}
      <View padding={4}>
        {renderImageGrid()}
      </View>
    </View>
  );
}