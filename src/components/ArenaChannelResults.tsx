import { View, Text, Link } from "reshaped";
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
    <View gap={6}>
      <View gap={2}>
        <Link
          href={channel.url}
          attributes={{
            target: "_blank",
            rel: "noopener noreferrer",
            style: {
              color: "var(--rs-color-foreground-neutral)"
            }
          }}
        >
          <Text variant="title-1" weight="bold" color="neutral">{channel.slug}</Text>
        </Link>
        <Text variant="body-2" color="neutral-faded">
          {total} images
        </Text>
      </View>

      {renderImageGrid()}
    </View>
  );
}
