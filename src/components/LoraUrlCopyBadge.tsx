import { useState } from "react";
import { View, Badge } from "reshaped";
import { Copy, CopyCheck } from "lucide-react";

interface LoraUrlCopyBadgeProps {
  url: string;
  size?: "small" | "medium";
}

export default function LoraUrlCopyBadge({
  url,
  size = "small",
}: LoraUrlCopyBadgeProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard not available
    }
  };

  return (
    <View
      onClick={handleCopy}
      attributes={{
        style: {
          display: "inline-flex",
          cursor: "pointer",
        },
      }}
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
            cursor: "pointer",
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
          <span style={{ marginRight: 2 }}>LoRA URL</span>
          {copied ? <CopyCheck size={12} /> : <Copy size={12} />}
        </View>
      </Badge>
    </View>
  );
}
