import { View } from "reshaped";
import ArenaChannelFetcher from "@/components/ArenaChannelFetcher";

export default function Home() {
  return (
    <View height="100vh" overflow="hidden" direction="column">
      <View attributes={{ style: { flex: 1, overflow: "hidden" } }}>
        <ArenaChannelFetcher />
      </View>
    </View>
  );
}
