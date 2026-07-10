import { View } from "reshaped";
import LoraGallery from "@/components/LoraGallery";

export default function LorasPage() {
  return (
    <View height="100vh" direction="column" attributes={{ style: { backgroundColor: "var(--color-accent)" } }}>
      <View padding={2} attributes={{ style: { flex: 1, overflowY: "auto" } }}>
        <LoraGallery />
      </View>
    </View>
  );
}
