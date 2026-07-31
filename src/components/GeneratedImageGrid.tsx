import { useState } from "react";
import { View, Text, Card, Badge } from "reshaped";
import NextImage from "next/image";
import GeneratedImageHideToggle from "./GeneratedImageHideToggle";

interface GeneratedImage {
  id: string;
  imageUrl: string;
  cdnUrl?: string | null;
  prompt: string;
  createdAt: string;
  width?: number | null;
  height?: number | null;
  loraScaleName?: string | null;
  walletAddress?: string;
  hidden?: boolean;
}

/** Prefer CDN URL, fallback to original imageUrl */
function displayUrl(img: GeneratedImage): string {
  return img.cdnUrl ?? img.imageUrl;
}

interface GeneratedImageGridProps {
  images: GeneratedImage[];
  /** Use "modal" for 2x2 in modal, "page" for responsive gallery */
  variant?: "modal" | "page";
  /** Called when a page-variant thumbnail is clicked, with the image index */
  onImageClick?: (index: number) => void;
  /** Optional React node rendered as the first grid cell (e.g. a CTA tile) */
  prependTile?: React.ReactNode;
  /** Current viewer's wallet address — enables hide toggle when it matches an image's wallet */
  currentWallet?: string;
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

function isOwner(currentWallet: string | undefined, imgWallet: string | undefined): boolean {
  if (!currentWallet || !imgWallet) return false;
  return currentWallet.toLowerCase() === imgWallet.toLowerCase();
}

export default function GeneratedImageGrid({
  images,
  variant = "page",
  onImageClick,
  prependTile,
  currentWallet,
}: GeneratedImageGridProps) {
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  const columns =
    variant === "modal"
      ? { s: 6 as const, m: 6 as const }
      : { s: 6 as const, m: 6 as const, l: 3 as const };

  return (
    <View direction="row" wrap gap={2}>
      {prependTile}
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
                <div
                  style={{
                    position: "relative",
                    width: "100%",
                    aspectRatio: "1",
                    overflow: "hidden",
                    borderRadius: "var(--rs-radius-medium)",
                  }}
                >
                  <NextImage
                    src={displayUrl(img)}
                    alt={img.prompt}
                    fill
                    sizes="(max-width: 768px) 50vw, 25vw"
                    style={{ objectFit: hoveredId === img.id ? "contain" : "cover" }}
                  />
                </div>
                <View padding={2} gap={1}>
                  <Text variant="caption-1" maxLines={2}>
                    {img.prompt}
                  </Text>
                  <View direction="row" align="center" gap={2}>
                    <View.Item grow>
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
                    </View.Item>
                    {isOwner(currentWallet, img.walletAddress) && (
                      <GeneratedImageHideToggle id={img.id} hidden={img.hidden ?? false} />
                    )}
                  </View>
                </View>
              </Card>
            </div>
          ) : (
            <a
              href={displayUrl(img)}
              target="_blank"
              rel="noopener noreferrer"
            >
              <Card padding={0}>
                <div
                  style={{
                    position: "relative",
                    width: "100%",
                    aspectRatio: "1",
                    overflow: "hidden",
                    borderRadius: "var(--rs-radius-medium)",
                  }}
                >
                  <NextImage
                    src={displayUrl(img)}
                    alt={img.prompt}
                    fill
                    sizes="(max-width: 768px) 50vw, 50vw"
                    style={{ objectFit: "cover" }}
                  />
                </div>
                {variant === "page" && (
                  <View padding={2} gap={1}>
                    <Text variant="caption-1" maxLines={2}>
                      {img.prompt}
                    </Text>
                    <View direction="row" align="center" gap={2}>
                      <View.Item grow>
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
                      </View.Item>
                      {isOwner(currentWallet, img.walletAddress) && (
                        <GeneratedImageHideToggle id={img.id} hidden={img.hidden ?? false} />
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