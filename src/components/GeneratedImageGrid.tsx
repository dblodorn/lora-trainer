import { useState } from "react";
import { View, Text, Card, Badge } from "reshaped";

interface GeneratedImage {
  id: string;
  imageUrl: string;
  prompt: string;
  createdAt: string;
  width?: number | null;
  height?: number | null;
  loraScaleName?: string | null;
}

interface GeneratedImageGridProps {
  images: GeneratedImage[];
  /** Use "modal" for 2x2 in modal, "page" for responsive gallery */
  variant?: "modal" | "page";
  /** Called when a page-variant thumbnail is clicked, with the image index */
  onImageClick?: (index: number) => void;
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
  onImageClick,
}: GeneratedImageGridProps) {
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  if (images.length === 0) return null;

  const columns =
    variant === "modal"
      ? { s: 6 as const, m: 6 as const }
      : { s: 6 as const, m: 6 as const, l: 3 as const };

  return (
    <View direction="row" wrap gap={2}>
      {images.map((img, index) => (
        <View.Item key={img.id} columns={columns}>
          {variant === "page" && onImageClick ? (
            <div
              onMouseEnter={() => setHoveredId(img.id)}
              onMouseLeave={() => setHoveredId(null)}
              onClick={() => onImageClick(index)}
              style={{ cursor: "pointer" }}
            >
              <Card padding={0}>
                <img
                  src={img.imageUrl}
                  alt={img.prompt}
                  style={{
                    aspectRatio: "1",
                    objectFit: hoveredId === img.id ? "contain" : "cover",
                    display: "block",
                    width: "100%",
                    transition: "object-fit 0.2s ease",
                    borderRadius: "var(--rs-radius-medium)",
                  }}
                />
                <View padding={2} gap={1}>
                  <Text variant="caption-1" maxLines={2}>
                    {img.prompt}
                  </Text>
                  <View direction="row" align="center" gap={2}>
                    <Text variant="caption-1" color="neutral-faded">
                      {formatDate(img.createdAt)}
                    </Text>
                    {img.loraScaleName && (
                      <Badge size="small" color="primary" variant="faded">
                        {img.loraScaleName}
                      </Badge>
                    )}
                  </View>
                </View>
              </Card>
            </div>
          ) : (
            <a
              href={img.imageUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              <Card padding={0}>
                <img
                  src={img.imageUrl}
                  alt={img.prompt}
                  style={{
                    aspectRatio: "1",
                    objectFit: "cover",
                    display: "block",
                    width: "100%",
                    borderRadius: "var(--rs-radius-medium)",
                  }}
                />
                {variant === "page" && (
                  <View padding={2} gap={1}>
                    <Text variant="caption-1" maxLines={2}>
                      {img.prompt}
                    </Text>
                    <View direction="row" align="center" gap={2}>
                      <Text variant="caption-1" color="neutral-faded">
                        {formatDate(img.createdAt)}
                      </Text>
                      {img.loraScaleName && (
                        <Badge size="small" color="primary" variant="faded">
                          {img.loraScaleName}
                        </Badge>
                      )}
                    </View>
                  </View>
                )}
              </Card>
            </a>
          )}
        </View.Item>
      ))}
    </View>
  );
}
