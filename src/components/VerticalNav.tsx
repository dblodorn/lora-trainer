import { View, Text } from "reshaped";
import NextLink from "next/link";
import { useRouter } from "next/router";

const NAV_WIDTH = 60;

const NAV_ITEMS = [
  { label: "Train", href: "/", match: (path: string) => path === "/" },
  { label: "Loras", href: "/loras", match: (path: string) => path.startsWith("/loras") },
  { label: "About", href: "/about", match: (path: string) => path === "/about" },
] as const;

export default function VerticalNav() {
  const router = useRouter();
  const currentPath = router.pathname;

  return (
    <View
      position="fixed"
      insetEnd={0}
      insetTop={0}
      direction="column"
      attributes={{
        style: {
          width: `${NAV_WIDTH}px`,
          height: "100vh",
          zIndex: 100,
          display: "flex",
          flexDirection: "column",
          borderLeft: "1px solid var(--rs-color-border-neutral-faded, rgba(0,0,0,0.08))",
          backgroundColor: "var(--rs-color-background-base, #ffffff)",
        },
      }}
    >
      {NAV_ITEMS.map((item) => {
        const isActive = item.match(currentPath);
        return (
          <NextLink key={item.href} href={item.href} passHref legacyBehavior>
            <View
              as="a"
              align="center"
              justify="center"
              attributes={{
                style: {
                  flex: 1,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  textDecoration: "none",
                  borderBottom: "1px solid var(--rs-color-border-neutral-faded, rgba(0,0,0,0.08))",
                  cursor: "pointer",
                  transition: "background-color 150ms ease",
                  writingMode: "vertical-rl",
                  transform: "rotate(180deg)",
                },
              }}
            >
              <Text
                variant="body-1"
                color={isActive ? "primary" : "neutral-faded"}
                weight={isActive ? "bold" : "regular"}
              >
                {item.label}
              </Text>
            </View>
          </NextLink>
        );
      })}
    </View>
  );
}

export { NAV_WIDTH };