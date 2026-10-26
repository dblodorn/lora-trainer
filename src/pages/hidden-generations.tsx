import { View } from "reshaped";
import FeatureBoundary from "@/components/FeatureBoundary";
import HiddenGenerations from "@/components/HiddenGenerations";
import AuthLeftNav from "@/components/AuthLeftNav";
import { NAV_WIDTH } from "@/components/VerticalNav";
import { LEFT_NAV_WIDTH } from "@/components/AuthLeftNav";

export default function HiddenGenerationsPage() {
  return (
    <>
      <AuthLeftNav />
      <View
        height="100vh"
        overflow="hidden"
        direction="column"
        attributes={{
          style: {
            width: `calc(100% - ${NAV_WIDTH}px - ${LEFT_NAV_WIDTH}px)`,
            marginLeft: `${LEFT_NAV_WIDTH}px`,
            position: "relative",
          },
        }}
      >
        <FeatureBoundary errorTitle="Failed to load hidden images">
          <HiddenGenerations />
        </FeatureBoundary>
      </View>
    </>
  );
}
