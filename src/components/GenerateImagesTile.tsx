import { View, Text } from "reshaped";
import ImageSlideshow from "@/components/ImageSlideshow";
import { CirclePlus } from "lucide-react";

interface GenerateImagesTileProps {
  onClick: () => void;
  images?: string[];
}

export default function GenerateImagesTile({ onClick, images }: GenerateImagesTileProps) {
  return (
    <View.Item columns={{ s: 6, m: 6, l: 3 }}>
      <div
        onClick={onClick}
        style={{
          cursor: "pointer",
          width: "100%",
          position: "relative",
          borderRadius: "var(--rs-radius-medium)",
          overflow: "hidden",
        }}
      >
        {/* Canvas background — absolute, fills entire tile, behind everything */}
        <div
          style={{
            position: "absolute",
            width: "100%",
            height: "100%",
            top: 0,
            left: 0,
            zIndex: 0,
          }}
        >
          <ImageSlideshow images={images} />
        </div>

        {/* Dashed border overlay — on top of canvas, transparent fill */}
        <div
          style={{
            position: "absolute",
            width: "100%",
            height: "100%",
            top: 0,
            left: 0,
            zIndex: 1,
            borderRadius: "var(--rs-radius-medium)",
            border: "2px dashed var(--rs-color-border-neutral-faded, rgba(0,0,0,0.12))",
            pointerEvents: "none",
          }}
        />

        {/* Height structure — square + caption area (same as image tiles) */}
        <div style={{ width: "100%", aspectRatio: "1", position: "relative", zIndex: 2 }}>
          {/* CTA centered in the square area */}
          <div
            style={{
              position: "absolute",
              width: "100%",
              height: "100%",
              top: 0,
              left: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              paddingTop: 24,
            }}
          >
            <View gap={2} align="center">
              <CirclePlus size={22} color="#000000" />
              <Text variant="body-2">
                Generate Images
              </Text>
            </View>
          </div>
        </div>

        {/* Caption area — matches image tile caption height */}
        <View padding={2} gap={1} attributes={{ style: { position: "relative", zIndex: 2 } }}>
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