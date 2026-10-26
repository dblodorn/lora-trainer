import { useState } from "react";
import { View, Button } from "reshaped";
import { graphql, usePaginationFragment } from "react-relay";
import type { LoraImages_training$key } from "./__generated__/LoraImages_training.graphql";
import GenerateModal from "./GenerateModal";
import GeneratedImageGrid, { type GeneratedImage } from "./GeneratedImageGrid";
import GenerateImagesTile from "./GenerateImagesTile";
import SlideshowModal from "./SlideshowModal";

const PAGE_SIZE = 24;

interface LoraImagesProps {
  training: LoraImages_training$key;
  /** The raw training id, which generation takes. */
  loraId: string;
  triggerWord: string;
  trainingImageUrls: readonly string[];
  /** Whether the LoRA is completed and has weights, so it can generate. */
  canGenerate: boolean;
}

/** A LoRA's visible generated images, with the generate tile and slideshow. */
export default function LoraImages({ training, loraId, triggerWord, trainingImageUrls, canGenerate }: LoraImagesProps) {
  const [showGenerateModal, setShowGenerateModal] = useState(false);
  const [slideshowIndex, setSlideshowIndex] = useState<number | null>(null);

  const { data, hasNext, isLoadingNext, loadNext, refetch } = usePaginationFragment(
    graphql`
      fragment LoraImages_training on LoraTraining
      @argumentDefinitions(count: { type: "Int", defaultValue: 24 }, cursor: { type: "String" })
      @refetchable(queryName: "LoraImagesPaginationQuery") {
        images(first: $count, after: $cursor) @connection(key: "LoraImages_images") {
          __id
          edges {
            node {
              id
              url
              prompt
              createdAt
              width
              height
              loraScaleName
              hidden
            }
          }
        }
      }
    `,
    training,
  );

  const images: GeneratedImage[] = data.images.edges.map(({ node }) => node);

  return (
    <>
      <GeneratedImageGrid
        images={images}
        variant="page"
        connections={[data.images.__id]}
        onImageClick={(index) => setSlideshowIndex(index)}
        prependTile={
          canGenerate ? (
            <GenerateImagesTile onClick={() => setShowGenerateModal(true)} images={[...trainingImageUrls]} />
          ) : null
        }
      />
      {hasNext && (
        <View align="center" padding={2}>
          <Button color="neutral" loading={isLoadingNext} onClick={() => loadNext(PAGE_SIZE)}>
            Load more
          </Button>
        </View>
      )}

      {canGenerate && (
        <GenerateModal
          active={showGenerateModal}
          onClose={() => setShowGenerateModal(false)}
          loraId={loraId}
          triggerWord={triggerWord}
          // The images were recorded server-side, so refetch rather than
          // write them into the store by hand.
          onGenerated={() => refetch({ count: PAGE_SIZE, cursor: null }, { fetchPolicy: "network-only" })}
        />
      )}

      {images.length > 0 && (
        <SlideshowModal
          active={slideshowIndex !== null}
          onClose={() => setSlideshowIndex(null)}
          images={images}
          startIndex={slideshowIndex ?? 0}
        />
      )}
    </>
  );
}
