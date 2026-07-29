import { View, Text, Link } from "reshaped";
import ImageSlideshow from "@/components/ImageSlideshow";
import { NAV_WIDTH } from "@/components/VerticalNav";

export default function AboutPage() {
  return (
    <View
      height="100vh"
      overflow="hidden"
      direction="column"
      attributes={{ style: { width: `calc(100% - ${NAV_WIDTH}px)`, position: "relative" } }}
    >
      {/* Full-bleed canvas background */}
      <View
        attributes={{
          style: {
            position: "absolute",
            inset: 0,
            overflow: "hidden",
          },
        }}
      >
        <ImageSlideshow />
      </View>

      {/* Content overlay */}
      <View
        padding={4}
        attributes={{
          style: {
            position: "relative",
            zIndex: 10,
            flex: 1,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          },
        }}
      >
        <View direction="column" gap={2} align="center">
          <Text variant="body-1" color="neutral-faded">
            LoRA Trainer — train custom image models from are.na channels.
          </Text>
          <Link
            href="https://github.com/dblodorn/lora-trainer"
            attributes={{ target: "_blank", rel: "noopener noreferrer" }}
          >
            <Text variant="body-1" color="neutral-faded">
              github.com/dblodorn/lora-trainer
            </Text>
          </Link>
        </View>
      </View>
    </View>
  );
}