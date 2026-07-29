import { Actionable, View, Text } from "reshaped";

interface GenerateImagesTileProps {
  onClick: () => void;
}

export default function GenerateImagesTile({ onClick }: GenerateImagesTileProps) {
  return (
    <View.Item columns={{ s: 6, m: 6, l: 3 }}>
      <Actionable
        onClick={onClick}
        attributes={{ style: { cursor: "pointer", height: "100%" } }}
      >
        <View
          align="center"
          justify="center"
          attributes={{
            style: {
              aspectRatio: "1",
              borderRadius: "var(--rs-radius-medium)",
              border: "2px dashed var(--rs-color-border-neutral-faded, rgba(0,0,0,0.12))",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            },
          }}
        >
          <View gap={2} align="center">
            <Text variant="title-2" color="neutral-faded">
              +
            </Text>
            <Text variant="body-2" color="neutral-faded">
              Generate Images
            </Text>
          </View>
        </View>
      </Actionable>
    </View.Item>
  );
}
