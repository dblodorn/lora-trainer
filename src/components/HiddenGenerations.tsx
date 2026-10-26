import { useRouter } from "next/router";
import { View, Text, Button } from "reshaped";
import { graphql, useLazyLoadQuery, usePaginationFragment } from "react-relay";
import type { HiddenGenerationsQuery } from "./__generated__/HiddenGenerationsQuery.graphql";
import type { HiddenGenerations_viewer$key } from "./__generated__/HiddenGenerations_viewer.graphql";
import GeneratedImageGrid from "./GeneratedImageGrid";
import ImageSlideshow from "./ImageSlideshow";

const PAGE_SIZE = 24;

/** The viewer's own hidden images. Render under a FeatureBoundary. */
export default function HiddenGenerations() {
  const { viewer } = useLazyLoadQuery<HiddenGenerationsQuery>(
    graphql`
      query HiddenGenerationsQuery($count: Int!, $cursor: String) {
        viewer {
          ...HiddenGenerations_viewer @arguments(count: $count, cursor: $cursor)
        }
      }
    `,
    { count: PAGE_SIZE },
    { fetchPolicy: "store-and-network" },
  );

  if (!viewer) return <Empty message="Sign in to see your hidden images." />;
  return <HiddenImageList viewer={viewer} />;
}

function HiddenImageList({ viewer }: { viewer: HiddenGenerations_viewer$key }) {
  const { data, hasNext, isLoadingNext, loadNext } = usePaginationFragment(
    graphql`
      fragment HiddenGenerations_viewer on Viewer
      @argumentDefinitions(count: { type: "Int!" }, cursor: { type: "String" })
      @refetchable(queryName: "HiddenGenerationsPaginationQuery") {
        loraTrainerImages(first: $count, after: $cursor, visibility: HIDDEN)
          @connection(key: "HiddenGenerations_loraTrainerImages") {
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
    viewer,
  );

  const images = data.loraTrainerImages.edges.map(({ node }) => node);
  if (images.length === 0 && !hasNext) return <Empty message="No hidden images." />;

  return (
    <View padding={2} attributes={{ style: { flex: 1, overflowY: "auto" } }}>
      <GeneratedImageGrid images={images} variant="page" connections={[data.loraTrainerImages.__id]} />
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

function Empty({ message }: { message: string }) {
  const router = useRouter();
  return (
    <>
      {/* Full-bleed canvas background */}
      <View attributes={{ style: { position: "absolute", inset: 0, overflow: "hidden" } }}>
        <ImageSlideshow key={router.asPath} />
      </View>
      {/* Centered empty text */}
      <View align="center" justify="center" attributes={{ style: { position: "relative", zIndex: 10, flex: 1 } }}>
        <Text variant="body-1" color="neutral-faded" align="center">
          {message}
        </Text>
      </View>
    </>
  );
}
