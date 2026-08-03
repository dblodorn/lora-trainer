import { Text } from "reshaped";
import NextLink from "next/link";
import { useRouter } from "next/router";

export const LEFT_NAV_WIDTH = 60;

const NAV_ITEMS = [
  { label: "Hidden Loras", href: "/hidden" },
  { label: "Hidden Images", href: "/hidden-generations" },
] as const;

export default function AuthLeftNav() {
  const router = useRouter();

  return (
    <nav
      style={{
        position: "fixed",
        left: 0,
        top: 0,
        width: `${LEFT_NAV_WIDTH}px`,
        height: "100vh",
        zIndex: 100,
        display: "flex",
        flexDirection: "column",
        borderRight: "1px solid var(--rs-color-border-neutral-faded, rgba(0,0,0,0.08))",
        backgroundColor: "var(--rs-color-background-base, #ffffff)",
      }}
    >
      {NAV_ITEMS.map((item) => {
        const isActive = item.href === router.pathname;
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