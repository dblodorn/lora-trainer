import { View } from "reshaped";
import { GetServerSideProps } from "next";
import LoraGallery from "@/components/LoraGallery";
import { NAV_WIDTH } from "@/components/VerticalNav";
import { getDb } from "@/server/api/db";

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

interface Props {
  initialLoras: LoraRowData[];
}

export const getServerSideProps: GetServerSideProps<Props> = async () => {
  const db = await getDb();
  const docs = await db
    .collection("lora_trainings")
    .find({ status: "completed", hidden: { $ne: true } })
    .sort({ createdAt: -1 })
    .toArray();

  const initialLoras = docs.map((doc) => ({
    id: doc._id.toString(),
    requestId: doc.requestId,
    walletAddress: doc.walletAddress,
    triggerWord: doc.triggerWord,
    steps: doc.steps,
    imageUrls: doc.imageUrls,
    imageUrlsSpaces: doc.imageUrlsSpaces ?? [],
    trainingZipUrl: doc.trainingZipUrl ?? null,
    loraWeightsUrl: doc.loraWeightsUrl,
    arenaChannelUrl: doc.arenaChannelUrl,
    arenaChannelTitle: doc.arenaChannelTitle,
    createdAt: doc.createdAt,
  }));

  return { props: { initialLoras } };
};

export default function LorasPage({ initialLoras }: Props) {
  return (
    <View
      height="100vh"
      direction="column"
      attributes={{
        style: {
          width: `calc(100% - ${NAV_WIDTH}px)`,
          backgroundColor: "var(--color-background-page, #ffffff)",
        },
      }}
    >
      <View padding={2} attributes={{ style: { flex: 1, overflowY: "auto" } }}>
        <LoraGallery initialLoras={initialLoras} />
      </View>
    </View>
  );
}