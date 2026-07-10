import { useState } from "react";
import { Actionable, Card, Checkbox, Image, Text, Link, View } from "reshaped";
import type { ArenaImage } from "./types";

interface ImageCardProps {
  image: ArenaImage;
  imageUrl: string;
  isSelected: boolean;
  canSelect: boolean;
  onSelect: (imageUrl: string, selected: boolean) => void;
}

export default function ImageCard({
  image,
  imageUrl,
  isSelected,
  canSelect,
  onSelect,
}: ImageCardProps) {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <Card selected={isSelected} padding={0}>
      <View position="relative">
        <View
          position="absolute"
          insetTop={2}
          insetStart={2}
          attributes={{ style: { zIndex: 10 } }}
        >
          <Checkbox
            name={`image-${image.id}`}
            checked={isSelected}
            onChange={({ checked }) => onSelect(imageUrl, checked)}
            disabled={!canSelect}
          />
        </View>
        <View
          attributes={{
            style: { aspectRatio: 4 / 3 },
            onMouseEnter: () => setIsHovered(true),
            onMouseLeave: () => setIsHovered(false),
          }}
        >
          <Actionable
            onClick={() => onSelect(imageUrl, !isSelected)}
            disabled={!canSelect}
            attributes={{
              style: {
                width: "100%",
                height: "100%",
              },
            }}
          >
            <Image
              src={imageUrl}
              alt={image.title || "Untitled"}
              width="100%"
              height="100%"
              displayMode={isHovered ? "contain" : "cover"}
              attributes={{
                style: {
                  opacity: !canSelect ? 0.5 : 1,
                },
              }}
            />
          </Actionable>
        </View>
        <View padding={3} gap={1}>
          <Text variant="body-2" weight="medium" maxLines={1}>
            {image.title || "Untitled"}
          </Text>
          <Text variant="caption-1" color="neutral-faded">
            {new Date(image.created_at).toLocaleDateString()}
          </Text>
          {image.source?.url && (
            <Link
              href={image.source.url}
              attributes={{ target: "_blank", rel: "noopener noreferrer" }}
            >
              <Text variant="caption-1">Source</Text>
            </Link>
          )}
        </View>
      </View>
    </Card>
  );
}
