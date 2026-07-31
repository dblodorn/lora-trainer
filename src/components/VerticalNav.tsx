import { Text } from "reshaped";
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

      {/* Auth button at bottom */}
      <div
        style={{
          borderTop: "1px solid var(--rs-color-border-neutral-faded, rgba(0,0,0,0.08))",
          width: "100%",
          aspectRatio: "1",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}
      >
        <NextLink
          href="/auth"
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: "100%",
            height: "100%",
            opacity: 0.4,
            transition: "opacity 150ms ease",
          }}
          onMouseEnter={(e) => { e.currentTarget.style.opacity = "1"; }}
          onMouseLeave={(e) => { e.currentTarget.style.opacity = "0.4"; }}
        >
          <svg width="28" height="28" viewBox="0 0 960 960" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M85,122.7 C230,183.5 260,525.5 340,582.5 C430,649 560,525.5 620,525.5 C740,525.5 820,496 897,487.5" stroke="#111111" stroke-width="9" stroke-linecap="round"/>
            <path d="M85,310.8 C260,402 380,240.5 470,240.5 C560,240.5 600,69.5 690,60 C780,50.5 840,60 897,63.8" stroke="#111111" stroke-width="9" stroke-linecap="round"/>
            <path d="M85,884.5 C210,818 265.566737,700.800543 340,468.5 C379.887848,344.013065 469.795893,352.884099 500,373.5 C779.155702,564.038534 470,848.5 620,848.5 C740,848.5 830,877 897,886.5" stroke="#111111" stroke-width="9" stroke-linecap="round"/>
            <circle cx="85" cy="122.7" r="15" fill="#111111"/>
            <circle cx="85" cy="310.8" r="15" fill="#111111"/>
            <circle cx="85" cy="884.5" r="15" fill="#111111"/>
            <circle cx="897" cy="63.8" r="15" fill="#111111"/>
            <circle cx="897" cy="487.5" r="15" fill="#111111"/>
            <circle cx="897" cy="886.5" r="15" fill="#111111"/>
          </svg>
        </NextLink>
      </div>
    </nav>
  );
}

export { NAV_WIDTH };