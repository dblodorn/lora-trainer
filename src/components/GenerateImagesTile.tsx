import { Actionable, View, Text } from "reshaped";
import ImageSlideshow from "@/components/ImageSlideshow";

interface GenerateImagesTileProps {
  onClick: () => void;
}

export default function GenerateImagesTile({ onClick }: GenerateImagesTileProps) {
  return (
    <View.Item columns={{ s: 6, m: 6, l: 3 }}>
      <Actionable
        onClick={onClick}
        attributes={{
          style: {
            cursor: "pointer",
            width: "100%",
            height: "100%",
            position: "relative",
            borderRadius: "var(--rs-radius-medium)",
            border: "2px dashed var(--rs-color-border-neutral-faded, rgba(0,0,0,0.12))",
            overflow: "hidden",
          },
        }}
      >
        {/* Canvas fills the entire tile */}
        <View
          attributes={{
            style: {
              position: "absolute",
              width: "100%",
              height: "100%",
              top: 0,
              left: 0,
            },
          }}
        >
          <ImageSlideshow />
        </View>
        {/* CTA overlay */}
        <View
          align="center"
          justify="center"
          attributes={{
            style: {
              position: "absolute",
              width: "100%",
              height: "100%",
              top: 0,
              left: 0,
              zIndex: 1,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            },
          }}
        >
          <View gap={2} align="center">
            <Text variant="title-2" color="neutral-faded">
              +
            </Text>
            <Text variant="body-2" color="neutral-faded">
              Generate Images
            </Text>
          </View>
        </View>
      </Actionable>
    </View.Item>
  );
}
