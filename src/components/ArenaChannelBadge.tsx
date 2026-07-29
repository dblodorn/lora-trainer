import { View, Badge, Link } from "reshaped";
import NextImage from "next/image";

interface ArenaChannelBadgeProps {
  title: string;
  url: string;
  size?: "small" | "medium";
}

export default function ArenaChannelBadge({
  title,
  url,
  size = "small",
}: ArenaChannelBadgeProps) {
  return (
    <Link
      href={url}
      attributes={{ target: "_blank", rel: "noopener noreferrer" }}
    >
      <Badge
        size={size}
        color="neutral"
        variant="faded"
        attributes={{
          style: {
            borderRadius: "9999px",
            backgroundColor: "#ffffff",
            boxShadow: "0 1px 2px rgba(0,0,0,0.08)",
          },
        }}
      >
        <View
          direction="row"
          gap={1}
          align="center"
          attributes={{
            style: { display: "inline-flex", alignItems: "center" },
          }}
        >
          <NextImage
            src="/are-na-logo.png"
            alt="are.na"
            width={12}
            height={12}
            style={{ borderRadius: 2 }}
          />
          {title}
        </View>
      </Badge>
    </Link>
  );
}
