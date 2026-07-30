import { View } from "reshaped";
import ImageSlideshow from "@/components/ImageSlideshow";
import SignInFlow from "@/components/SignInFlow";
import { NAV_WIDTH } from "@/components/VerticalNav";

export default function AuthPage() {
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
        align="center"
        justify="center"
        attributes={{
          style: {
            position: "relative",
            zIndex: 10,
            flex: 1,
          },
        }}
      >
        <SignInFlow />
      </View>
    </View>
  );
}
