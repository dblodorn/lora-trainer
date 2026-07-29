import { View, Text } from "reshaped";
import { NAV_WIDTH } from "@/components/VerticalNav";

export default function AboutPage() {
  return (
    <View
      height="100vh"
      direction="column"
      attributes={{ style: { width: `calc(100% - ${NAV_WIDTH}px)` } }}
    >
      <View
        padding={4}
        gap={6}
        attributes={{ style: { flex: 1, overflowY: "auto" } }}
      >
        <Text variant="title-1">About</Text>
        <Text variant="body-1" color="neutral-faded">
          LoRA Trainer — train custom image models from are.na channels.
        </Text>
      </View>
    </View>
  );
}