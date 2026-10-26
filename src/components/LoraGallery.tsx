import { View, Text, Button } from "reshaped";
import NextLink from "next/link";
import { graphql, useLazyLoadQuery, usePaginationFragment } from "react-relay";
import type { LoraGalleryQuery } from "./__generated__/LoraGalleryQuery.graphql";
import type { LoraGallery_query$key } from "./__generated__/LoraGallery_query.graphql";
import LoraRow from "./LoraRow";

const PAGE_SIZE = 50;

/** Completed, visible LoRAs, newest first. Render under a FeatureBoundary. */
export default function LoraGallery() {
  // store-and-network: a hide toggled on a LoRA page shows here on return.
  const query = useLazyLoadQuery<LoraGalleryQuery>(
    graphql`
      query LoraGalleryQuery($count: Int!, $cursor: String) {
        ...LoraGallery_query @arguments(count: $count, cursor: $cursor)
      }
    `,
    { count: PAGE_SIZE },
    { fetchPolicy: "store-and-network" },
  );

  const { data, hasNext, isLoadingNext, loadNext } = usePaginationFragment(
    graphql`
      fragment LoraGallery_query on Query
      @argumentDefinitions(count: { type: "Int!" }, cursor: { type: "String" })
      @refetchable(queryName: "LoraGalleryPaginationQuery") {
        loraTrainerTrainings(first: $count, after: $cursor) @connection(key: "LoraGallery_loraTrainerTrainings") {
          edges {
            node {
              id
              ...LoraRow_training
            }
          }
        }
      }
    `,
    query as LoraGallery_query$key,
  );

  const edges = data.loraTrainerTrainings.edges;
  if (edges.length === 0) {
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
