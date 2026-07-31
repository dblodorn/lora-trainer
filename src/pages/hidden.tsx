import { View } from "reshaped";
import { useAccount } from "wagmi";
import HiddenLoraGallery from "@/components/HiddenLoraGallery";
import AuthLeftNav from "@/components/AuthLeftNav";
import ImageSlideshow from "@/components/ImageSlideshow";
import { NAV_WIDTH } from "@/components/VerticalNav";
import { LEFT_NAV_WIDTH } from "@/components/AuthLeftNav";

export default function HiddenPage() {
  const { address: connectedAddress } = useAccount();

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
          <HiddenLoraGallery walletAddress={connectedAddress} />
        </View>
      </View>
    </>
  );
}