import { useRouter } from "next/router";
import { View, Loader } from "reshaped";
import FeatureBoundary from "@/components/FeatureBoundary";
import LoraDetail from "@/components/LoraDetail";
import { NAV_WIDTH } from "@/components/VerticalNav";

export default function LoraDetailPage() {
  const router = useRouter();
  const id = router.query.id as string | undefined;

  return (
    <View height="100vh" direction="column" attributes={{ style: { width: `calc(100% - ${NAV_WIDTH}px)` } }}>
      <View attributes={{ style: { flex: 1, overflowY: "auto" } }}>
        {id ? (
          <FeatureBoundary errorTitle="Failed to load this LoRA" resetKey={id}>
            <LoraDetail id={id} />
          </FeatureBoundary>
        ) : (
          <View height="100vh" align="center" justify="center">
            <Loader />
          </View>
        )}
      </View>
    </View>
  );
}
