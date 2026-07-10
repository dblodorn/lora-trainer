import { View, Text, Card, Image, Actionable } from "reshaped";

interface GeneratedImage {
  id: string;
  imageUrl: string;
  prompt: string;
  createdAt: string;
  width?: number | null;
  height?: number | null;
}

interface GeneratedImageGridProps {
  images: GeneratedImage[];
  /** Use "modal" for 2x2 in modal, "page" for responsive gallery */
  variant?: "modal" | "page";
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default function GeneratedImageGrid({
  images,
  variant = "page",
}: GeneratedImageGridProps) {
  if (images.length === 0) return null;

  const columns =
    variant === "modal"
      ? { s: 6 as const, m: 6 as const }
      : { s: 6 as const, m: 6 as const, l: 3 as const };

  return (
    <View direction="row" wrap gap={2}>
      {images.map((img) => (
        <View.Item key={img.id} columns={columns}>
          <Actionable
            href={img.imageUrl}
            attributes={{ target: "_blank", rel: "noopener noreferrer" }}
          >
            <Card padding={0}>
              <Image
                src={img.imageUrl}
                alt={img.prompt}
                borderRadius="medium"
                width="100%"
                attributes={{ style: { aspectRatio: "1", objectFit: "cover", display: "block" } }}
              />
              {variant === "page" && (
                <View padding={2} gap={1}>
                  <Text variant="caption-1" maxLines={2}>
                    {img.prompt}
                  </Text>
                  <Text variant="caption-1" color="neutral-faded">
                    {formatDate(img.createdAt)}
                  </Text>
                </View>
              )}
            </Card>
          </Actionable>
        </View.Item>
      ))}
    </View>
  );
}
