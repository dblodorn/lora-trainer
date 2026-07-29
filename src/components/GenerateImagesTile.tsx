import { Actionable, View, Text } from "reshaped";
import ImageSlideshow from "@/components/ImageSlideshow";

interface GenerateImagesTileProps {
  onClick: () => void;
}

export default function GenerateImagesTile({ onClick }: GenerateImagesTileProps) {
  return (
    <View.Item columns={{ s: 6, m: 6, l: 3 }}>
      <div
        onClick={onClick}
        style={{
          cursor: "pointer",
          width: "100%",
          position: "relative",
          borderRadius: "var(--rs-radius-medium)",
          border: "2px dashed var(--rs-color-border-neutral-faded, rgba(0,0,0,0.12))",
          overflow: "hidden",
        }}
      >
        {/* Canvas + CTA area — same aspect ratio as image tiles */}
        <div
          style={{
            width: "100%",
            aspectRatio: "1",
            position: "relative",
            overflow: "hidden",
          }}
        >
          <div style={{ position: "absolute", width: "100%", height: "100%", top: 0, left: 0 }}>
            <ImageSlideshow />
          </div>
          <div
            style={{
              position: "absolute",
              width: "100%",
              height: "100%",
              top: 0,
              left: 0,
              zIndex: 1,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
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
          </div>
        </div>
        {/* Caption area — matches image tile caption height */}
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
      </div>
    </View.Item>
  );
}
