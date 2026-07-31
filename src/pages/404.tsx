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
        gap={8}
        align="center"
        justify="center"
        attributes={{
          style: {
            position: "relative",
            zIndex: 10,
            flex: 1,
            display: "flex",
            flexDirection: "column",
          },
        }}
      >
        <Text variant="body-1" color="neutral-faded" align="center">
          Page not found
        </Text>
        <Link href="/">
          <Text variant="body-1" color="neutral-faded" align="center">
            Return home
          </Text>
        </Link>
      </View>
    </View>
  );
}