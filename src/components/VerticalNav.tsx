import { Text } from "reshaped";
import NextLink from "next/link";
import { useRouter } from "next/router";

const NAV_WIDTH = 60;

const NAV_ITEMS = [
  { label: "Train", href: "/", match: (path: string) => path === "/" },
  { label: "Loras", href: "/loras", match: (path: string) => path.startsWith("/loras") },
  { label: "Auth", href: "/auth", match: (path: string) => path === "/auth" },
  { label: "About", href: "/about", match: (path: string) => path === "/about" },
] as const;

export default function VerticalNav() {
  const router = useRouter();
  const currentPath = router.pathname;

  return (
    <nav
      style={{
        position: "fixed",
        right: 0,
        top: 0,
        width: `${NAV_WIDTH}px`,
        height: "100vh",
        zIndex: 100,
        display: "flex",
        flexDirection: "column",
        borderLeft: "1px solid var(--rs-color-border-neutral-faded, rgba(0,0,0,0.08))",
        backgroundColor: "var(--rs-color-background-base, #ffffff)",
      }}
    >
      {NAV_ITEMS.map((item) => {
        const isActive = item.match(currentPath);
        return (
          <NextLink
            key={item.href}
            href={item.href}
            style={{
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
            }}
          >
            <Text
              variant="body-1"
              color={isActive ? "primary" : "neutral-faded"}
              weight={isActive ? "bold" : "regular"}
            >
              {item.label}
            </Text>
          </NextLink>
        );
      })}
    </nav>
  );
}

export { NAV_WIDTH };