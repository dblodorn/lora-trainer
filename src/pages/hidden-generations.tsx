import { View, Text, Alert, Loader } from "reshaped";
import { useAccount } from "wagmi";
import { trpc } from "@/utils/trpc";
import GeneratedImageGrid from "@/components/GeneratedImageGrid";
import AuthLeftNav from "@/components/AuthLeftNav";
import { NAV_WIDTH } from "@/components/VerticalNav";
import { LEFT_NAV_WIDTH } from "@/components/AuthLeftNav";

export default function HiddenGenerationsPage() {
  const { address: connectedAddress } = useAccount();
  const { data, isLoading, error } = trpc.generate.listHiddenImages.useQuery();

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
          {!data || data.length === 0 ? (
            <View align="center" justify="center" padding={10}>
              <Text variant="body-1" color="neutral-faded">
                No hidden images.
              </Text>
            </View>
          ) : (
            <GeneratedImageGrid
              images={data}
              variant="page"
              currentWallet={connectedAddress}
            />
          )}
        </View>
      </View>
    </>
  );
}