import { Actionable, Badge, View } from "reshaped";

interface TrainingImagesBadgeProps {
  count: number;
  onClick: () => void;
  size?: "small" | "medium";
}

export default function TrainingImagesBadge({
  count,
  onClick,
  size = "small",
}: TrainingImagesBadgeProps) {
  return (
    <Actionable
      onClick={onClick}
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
          +{count}
          {" "}
          training images
        </View>
      </Badge>
    </Actionable>
  );
}
