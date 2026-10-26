import { useRouter } from "next/router";
import { Card, Divider, View } from "reshaped";
import { useSession } from "@/lib/session";
import ImageSlideshow from "@/components/ImageSlideshow";
import GoogleSignIn from "@/components/GoogleSignIn";
import ArenaUsername from "@/components/ArenaUsername";
import FeatureBoundary from "@/components/FeatureBoundary";
import AuthLeftNav from "@/components/AuthLeftNav";
import { NAV_WIDTH } from "@/components/VerticalNav";

const LEFT_NAV_WIDTH = 60;

export default function AuthPage() {
  const router = useRouter();
  const { viewer } = useSession();
  const isSignedIn = !!viewer;

  return (
    <>
      {isSignedIn && <AuthLeftNav />}
      <View
        height="100vh"
        overflow="hidden"
        direction="column"
        attributes={{
          style: {
            marginLeft: isSignedIn ? `${LEFT_NAV_WIDTH}px` : "0px",
            width: isSignedIn
              ? `calc(100% - ${NAV_WIDTH}px - ${LEFT_NAV_WIDTH}px)`
              : `calc(100% - ${NAV_WIDTH}px)`,
            position: "relative",
          },
        }}
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
          <ImageSlideshow key={router.asPath} />
        </View>

        {/* Content overlay */}
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
          <Card padding={6}>
            <View gap={6}>
              <GoogleSignIn />
              {isSignedIn && (
                <>
                  <Divider />
                  <FeatureBoundary errorTitle="Failed to load your Are.na user" fallback={null}>
                    <ArenaUsername />
                  </FeatureBoundary>
                </>
              )}
            </View>
          </Card>
        </View>
      </View>
    </>
  );
}