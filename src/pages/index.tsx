import { View } from "reshaped";
import ArenaChannelFetcher from "@/components/ArenaChannelFetcher";
import { NAV_WIDTH } from "@/components/VerticalNav";

export default function Home() {
  return (
    <View
      height="100vh"
      overflow="hidden"
      direction="column"
      attributes={{ style: { width: `calc(100% - ${NAV_WIDTH}px)` } }}
    >
      <View attributes={{ style: { flex: 1, overflow: "hidden" } }}>
        <ArenaChannelFetcher />
      </View>
    </View>
  );
}