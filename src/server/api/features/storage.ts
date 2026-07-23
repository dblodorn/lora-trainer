import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { requireSpacesConfig } from "../env";

let _client: S3Client | null = null;

function getClient(): S3Client {
  if (_client) return _client;
  const cfg = requireSpacesConfig();
  _client = new S3Client({
    endpoint: cfg.endpoint,
    region: cfg.region,
    credentials: {
      accessKeyId: cfg.key,
      secretAccessKey: cfg.secret,
    },
    forcePathStyle: false,
  });
  return _client;
}

/**
 * Upload a buffer to DO Spaces and return the CDN URL.
 * @param key  - S3 key (e.g. "lora-trainer/images/{loraId}/{imgId}.jpg")
 * @param data - File content
 * @param contentType - MIME type
 */
export async function uploadToSpaces(
  key: string,
  data: Buffer | Uint8Array,
  contentType: string,
): Promise<string> {
  const cfg = requireSpacesConfig();
  const client = getClient();

  await client.send(
    new PutObjectCommand({
      Bucket: cfg.bucket,
      Key: key,
      Body: data,
      ContentType: contentType,
      ACL: "public-read",
    }),
  );

  return `${cfg.cdnUrl}/${key}`;
}

/**
 * Download a URL and re-upload to Spaces. Returns the CDN URL.
 */
export async function mirrorUrlToSpaces(
  sourceUrl: string,
  spacesKey: string,
  contentType: string,
): Promise<string> {
  const response = await fetch(sourceUrl, {
    signal: AbortSignal.timeout(120_000),
  });
  if (!response.ok) {
    throw new Error(`Failed to fetch ${sourceUrl}: ${response.status}`);
  }
  const buffer = Buffer.from(await response.arrayBuffer());
  return uploadToSpaces(spacesKey, buffer, contentType);
}
