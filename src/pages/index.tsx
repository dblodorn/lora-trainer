import { useRouter } from "next/router";
import { View } from "reshaped";
import ArenaChannelFetcher from "@/components/ArenaChannelFetcher";
import { NAV_WIDTH } from "@/components/VerticalNav";

export default function Home() {
  const router = useRouter();
  const channel = typeof router.query.channel === "string" ? router.query.channel : "";
  return (
    <View
      height="100vh"
      overflow="hidden"
      direction="column"
      attributes={{ style: { width: `calc(100% - ${NAV_WIDTH}px)` } }}
    >
      <View attributes={{ style: { flex: 1, overflow: "hidden" } }}>
        <ArenaChannelFetcher key={channel} channel={channel} />
      </View>
    </View>
  );
}