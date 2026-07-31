import { View } from "reshaped";
import { useAccount } from "wagmi";
import HiddenLoraGallery from "@/components/HiddenLoraGallery";
import AuthLeftNav from "@/components/AuthLeftNav";
import { NAV_WIDTH } from "@/components/VerticalNav";
import { LEFT_NAV_WIDTH } from "@/components/AuthLeftNav";

export default function HiddenPage() {
  const { address: connectedAddress } = useAccount();

  return (
    <>
      <AuthLeftNav />
      <View
        height="100vh"
        direction="column"
        attributes={{
          style: {
            width: `calc(100% - ${NAV_WIDTH}px - ${LEFT_NAV_WIDTH}px)`,
            marginLeft: `${LEFT_NAV_WIDTH}px`,
            backgroundColor: "var(--color-background-page, #ffffff)",
          },
        }}
      >
        <View padding={2} attributes={{ style: { flex: 1, overflowY: "auto" } }}>
          <HiddenLoraGallery walletAddress={connectedAddress} />
        </View>
      </View>
    </>
  );
}