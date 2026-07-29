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
            borderRadius: "var(--rs-radius-medium)",
            border: "2px dashed var(--rs-color-border-neutral-faded, rgba(0,0,0,0.12))",
            display: "flex",
            flexDirection: "column",
            position: "relative",
            overflow: "hidden",
          },
        }}
      >
        {/* Top padding to offset for caption area height */}
        <View padding={2} gap={1}>
          <Text variant="caption-1" attributes={{ style: { visibility: "hidden" } }}>
            placeholder
          </Text>
          <View direction="row" align="center" gap={2}>
            <Text variant="caption-1" color="neutral-faded" attributes={{ style: { visibility: "hidden" } }}>
              placeholder
            </Text>
          </View>
        </View>
        {/* Canvas fills the remaining space of the tile */}
        <View
          grow
          attributes={{
            style: {
              position: "relative",
              flex: 1,
              minHeight: 0,
            },
          }}
        >
          <View
            attributes={{
              style: {
                position: "absolute",
                inset: 0,
              },
            }}
          >
            <ImageSlideshow />
          </View>
          {/* CTA overlay on top of canvas */}
          <View
            align="center"
            justify="center"
            attributes={{
              style: {
                position: "relative",
                zIndex: 1,
                height: "100%",
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
        </View>
      </Actionable>
    </View.Item>
  );
}
