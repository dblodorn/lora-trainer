import { View, Text, Alert, Loader } from "reshaped";
import { trpc } from "@/utils/trpc";
import LoraRow from "./LoraRow";

interface HiddenLoraGalleryProps {
  walletAddress?: string;
}

export default function HiddenLoraGallery({ walletAddress }: HiddenLoraGalleryProps) {
  const { data, isLoading, error } = trpc.lora.listHidden.useQuery(
    { walletAddress },
    { enabled: !!walletAddress },
  );

  if (isLoading || !walletAddress) {
    return (
      <View align="center" justify="center" attributes={{ style: { height: "100%" } }}>
        <Loader />
      </View>
    );
  }

  if (error) {
    return (
      <View padding={4}>
        <Alert color="critical" title="Failed to load hidden LoRAs">
          {error.message}
        </Alert>
      </View>
    );
  }

  if (!data || data.length === 0) {
    return (
      <View align="center" justify="center" attributes={{ style: { height: "100%" } }}>
        <Text variant="body-1" color="neutral-faded" align="center">
          No hidden LoRAs.
        </Text>
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