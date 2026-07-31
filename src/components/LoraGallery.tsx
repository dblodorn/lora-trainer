import { View, Text, Alert, Loader, Button } from "reshaped";
import NextLink from "next/link";
import { trpc } from "@/utils/trpc";
import LoraRow from "./LoraRow";

interface LoraRowData {
  id: string;
  requestId: string;
  walletAddress: string;
  triggerWord: string;
  steps: number;
  imageUrls: string[];
  imageUrlsSpaces: string[];
  trainingZipUrl: string | null;
  loraWeightsUrl: string | null;
  arenaChannelUrl: string | null;
  arenaChannelTitle: string | null;
  createdAt: string;
}

interface LoraGalleryProps {
  initialLoras?: LoraRowData[];
}

export default function LoraGallery({ initialLoras }: LoraGalleryProps) {
  const { data, isLoading, error } = trpc.lora.list.useQuery(undefined, {
    initialData: initialLoras,
  });

  if (isLoading && !initialLoras) {
    return (
      <View align="center" justify="center" attributes={{ style: { height: "100%" } }}>
        <Loader />
      </View>
    );
  }

  if (error) {
    return (
      <View padding={4}>
        <Alert color="critical" title="Failed to load gallery">
          {error.message}
        </Alert>
      </View>
    );
  }

  if (!data || data.length === 0) {
    return (
      <View align="center" justify="center" padding={10} gap={2}>
        <Text variant="body-1" color="neutral-faded">
          No LoRAs trained yet.
        </Text>
        <NextLink href="/" passHref legacyBehavior>
          <Button as="a" color="primary" size="small">
            Train your first LoRA
          </Button>
        </NextLink>
      </View>
    );
  }

  return (
    <View gap={2}>
      {data.map((lora) => (
        <LoraRow
          key={lora.id}
          id={lora.id}
          triggerWord={lora.triggerWord}
          loraWeightsUrl={lora.loraWeightsUrl}
          imageUrls={lora.imageUrls}
          steps={lora.steps}
          createdAt={lora.createdAt}
          arenaChannelUrl={lora.arenaChannelUrl}
          arenaChannelTitle={lora.arenaChannelTitle}
        />
      ))}
    </View>
  );
}