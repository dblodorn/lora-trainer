import { View, Text, Button } from "reshaped";
import { graphql, useLazyLoadQuery, usePaginationFragment } from "react-relay";
import type { HiddenLoraGalleryQuery } from "./__generated__/HiddenLoraGalleryQuery.graphql";
import type { HiddenLoraGallery_viewer$key } from "./__generated__/HiddenLoraGallery_viewer.graphql";
import LoraRow from "./LoraRow";

const PAGE_SIZE = 50;

/** The viewer's own hidden LoRAs. Render under a FeatureBoundary. */
export default function HiddenLoraGallery() {
  const { viewer } = useLazyLoadQuery<HiddenLoraGalleryQuery>(
    graphql`
      query HiddenLoraGalleryQuery($count: Int!, $cursor: String) {
        viewer {
          ...HiddenLoraGallery_viewer @arguments(count: $count, cursor: $cursor)
        }
      }
    `,
    { count: PAGE_SIZE },
    { fetchPolicy: "store-and-network" },
  );

  if (!viewer) {
    return (
      <View align="center" justify="center" attributes={{ style: { height: "100%" } }}>
        <Text variant="body-1" color="neutral-faded" align="center">
          Sign in to see your hidden LoRAs.
        </Text>
      </View>
    );
  }
  return <HiddenLoraList viewer={viewer} />;
}

function HiddenLoraList({ viewer }: { viewer: HiddenLoraGallery_viewer$key }) {
  const { data, hasNext, isLoadingNext, loadNext } = usePaginationFragment(
    graphql`
      fragment HiddenLoraGallery_viewer on Viewer
      @argumentDefinitions(count: { type: "Int!" }, cursor: { type: "String" })
      @refetchable(queryName: "HiddenLoraGalleryPaginationQuery") {
        loraTrainerTrainings(first: $count, after: $cursor, visibility: HIDDEN)
          @connection(key: "HiddenLoraGallery_loraTrainerTrainings") {
          edges {
            node {
              id
              status
              ...LoraRow_training
            }
          }
        }
      }
    `,
    viewer,
  );

  // Hidden trainings at any status come back; this list has always shown the
  // finished ones only.
  const edges = data.loraTrainerTrainings.edges.filter(({ node }) => node.status === "COMPLETED");

  if (edges.length === 0 && !hasNext) {
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
      {edges.map(({ node }) => (
        <LoraRow key={node.id} training={node} />
      ))}
      {hasNext && (
        <View align="center" padding={2}>
          <Button color="neutral" loading={isLoadingNext} onClick={() => loadNext(PAGE_SIZE)}>
            Load more
          </Button>
        </View>
      )}
    </View>
  );
}
