import { View, Text, Link } from "reshaped";
import ImageSlideshow from "@/components/ImageSlideshow";
import { NAV_WIDTH } from "@/components/VerticalNav";

export default function Custom404() {
  return (
    <View
      height="100vh"
      overflow="hidden"
      direction="column"
      attributes={{ style: { width: `calc(100% - ${NAV_WIDTH}px)`, position: "relative" } }}
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

      {/* Content overlay */}
      <View
        attributes={{
          style: {
            position: "relative",
            zIndex: 10,
            flex: 1,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 16,
          },
        }}
      >
        <Text variant="body-1" color="neutral-faded">
          Page not found
        </Text>
        <Link href="/">
          <Text variant="body-1" color="neutral-faded">
            Return home
          </Text>
        </Link>
      </View>
    </View>
  );
}