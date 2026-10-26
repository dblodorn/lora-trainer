import { View } from "reshaped";
import LoraGallery from "@/components/LoraGallery";
import FeatureBoundary from "@/components/FeatureBoundary";
import { NAV_WIDTH } from "@/components/VerticalNav";

export default function LorasPage() {
  return (
    <View
      height="100vh"
      direction="column"
      attributes={{
        style: {
          width: `calc(100% - ${NAV_WIDTH}px)`,
          backgroundColor: "var(--color-background-page, #ffffff)",
        },
      }}
    >
      <View padding={2} attributes={{ style: { flex: 1, overflowY: "auto" } }}>
        <FeatureBoundary errorTitle="Failed to load gallery">
          <LoraGallery />
        </FeatureBoundary>
      </View>
    </View>
  );
}