import { useRouter } from "next/router";
import { View } from "reshaped";
import LoraGallery from "@/components/LoraGallery";
import ImageSlideshow from "@/components/ImageSlideshow";
import { NAV_WIDTH } from "@/components/VerticalNav";

export default function LorasPage() {
  const router = useRouter();
  return (
    <View
      height="100vh"
      direction="column"
      attributes={{
        style: {
          width: `calc(100% - ${NAV_WIDTH}px)`,
          position: "relative",
          overflow: "hidden",
        },
      }}
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
        <ImageSlideshow key={router.asPath} />
      </View>

      {/* Content */}
      <View
        padding={2}
        attributes={{
          style: {
            position: "relative",
            zIndex: 10,
            flex: 1,
            overflowY: "auto",
          },
        }}
      >
        <LoraGallery />
      </View>
    </View>
  );
}