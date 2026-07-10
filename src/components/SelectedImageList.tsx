import { View, Text, Button } from "reshaped";

interface SelectedImageListProps {
  selectedImages: string[];
  onRemove: (imageUrl: string) => void;
}

export default function SelectedImageList({
  selectedImages,
  onRemove,
}: SelectedImageListProps) {
  if (selectedImages.length === 0) {
    return (
      <Text variant="body-2" color="neutral-faded">
        No images selected yet. Select up to 20 images from the left panel.
      </Text>
    );
  }

  return (
    <View gap={3}>
      {selectedImages.map((imageUrl, index) => (
        <View
          key={index}
          direction="row"
          align="center"
          gap={3}
          padding={2}
          borderRadius="small"
          borderColor="neutral-faded"
        >
          <img
            src={imageUrl}
            alt={`Selected ${index + 1}`}
            style={{
              width: 64,
              height: 64,
              objectFit: "cover",
              borderRadius: 4,
            }}
          />
          <View.Item grow>
            <Text variant="body-2" weight="medium">
              Image {index + 1}
            </Text>
            <Text variant="caption-1" color="neutral-faded" maxLines={1}>
              {imageUrl}
            </Text>
          </View.Item>
          <Button
            variant="ghost"
            color="critical"
            size="small"
            onClick={() => onRemove(imageUrl)}
          >
            Remove
          </Button>
        </View>
      ))}
    </View>
  );
}
