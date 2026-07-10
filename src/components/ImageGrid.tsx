import { View } from "reshaped";
import ImageCard from "./ImageCard";
import type { ArenaImage } from "./types";

interface ImageGridProps {
  images: ArenaImage[];
  selectedImages: string[];
  onImageSelect: (imageUrl: string, selected: boolean) => void;
  getImageUrl: (image: ArenaImage) => string | undefined;
}

export default function ImageGrid({
  images,
  selectedImages,
  onImageSelect,
  getImageUrl,
}: ImageGridProps) {
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
