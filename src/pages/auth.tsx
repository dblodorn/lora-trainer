import { View } from "reshaped";
import ImageSlideshow from "@/components/ImageSlideshow";
import SignInFlow from "@/components/SignInFlow";
import AuthLeftNav from "@/components/AuthLeftNav";
import { NAV_WIDTH } from "@/components/VerticalNav";

const LEFT_NAV_WIDTH = 60;

export default function AuthPage() {
  return (
    <>
      <AuthLeftNav />
      <View
        height="100vh"
        overflow="hidden"
        direction="column"
        attributes={{
          style: {
            marginLeft: `${LEFT_NAV_WIDTH}px`,
            width: `calc(100% - ${NAV_WIDTH}px - ${LEFT_NAV_WIDTH}px)`,
            position: "relative",
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
    </>
  );
}