import { View, Text, Alert, Loader } from "reshaped";
import { useAccount } from "wagmi";
import { trpc } from "@/utils/trpc";
import GeneratedImageGrid from "@/components/GeneratedImageGrid";
import AuthLeftNav from "@/components/AuthLeftNav";
import ImageSlideshow from "@/components/ImageSlideshow";
import { NAV_WIDTH } from "@/components/VerticalNav";
import { LEFT_NAV_WIDTH } from "@/components/AuthLeftNav";

export default function HiddenGenerationsPage() {
  const { address: connectedAddress } = useAccount();
  const { data, isLoading, error } = trpc.generate.listHiddenImages.useQuery(
    { walletAddress: connectedAddress },
    { enabled: !!connectedAddress },
  );

  if (isLoading) {
    return (
      <View height="100vh" align="center" justify="center" attributes={{ style: { width: `calc(100% - ${NAV_WIDTH}px - ${LEFT_NAV_WIDTH}px)`, marginLeft: `${LEFT_NAV_WIDTH}px` } }}>
        <Loader />
      </View>
    );
  }

  if (error) {
    return (
      <View height="100vh" padding={4} attributes={{ style: { width: `calc(100% - ${NAV_WIDTH}px - ${LEFT_NAV_WIDTH}px)`, marginLeft: `${LEFT_NAV_WIDTH}px` } }}>
        <Alert color="critical" title="Failed to load hidden images">
          {error.message}
        </Alert>
      </View>
    );
  }

  const isEmpty = !data || data.length === 0;

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
        {isEmpty ? (
          <>
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
            {/* Centered empty text */}
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
              <Text variant="body-1" color="neutral-faded" align="center">
                No hidden images.
              </Text>
            </View>
          </>
        ) : (
          <View padding={2} attributes={{ style: { flex: 1, overflowY: "auto" } }}>
            <GeneratedImageGrid
              images={data}
              variant="page"
              currentWallet={connectedAddress}
            />
          </View>
        )}
      </View>
    </>
  );
}