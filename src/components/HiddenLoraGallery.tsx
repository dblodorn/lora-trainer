import { View, Text, Alert, Loader, Button } from "reshaped";
import NextLink from "next/link";
import { trpc } from "@/utils/trpc";
import LoraRow from "./LoraRow";

export default function HiddenLoraGallery() {
  const { data, isLoading, error } = trpc.lora.listHidden.useQuery();

  if (isLoading) {
    return (
      <View align="center" justify="center" padding={10}>
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
      <View align="center" justify="center" padding={10} gap={2}>
        <Text variant="body-1" color="neutral-faded">
          No hidden LoRAs.
        </Text>
        <NextLink href="/" passHref legacyBehavior>
          <Button as="a" color="primary" size="small">
            Train a new LoRA
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