import { useEffect } from "react";
import NextLink from "next/link";
import { Select, Text, View } from "reshaped";
import { graphql, useLazyLoadQuery, usePaginationFragment } from "react-relay";
import { useSession } from "@/lib/session";
import FeatureBoundary from "./FeatureBoundary";
import type { ArenaChannelPickerQuery } from "./__generated__/ArenaChannelPickerQuery.graphql";
import type { ArenaChannelPicker_viewer$key } from "./__generated__/ArenaChannelPicker_viewer.graphql";

/*
 * Your Are.na channels, from the username saved on /auth. Picking one loads it
 * the same way as pasting its URL. Hidden when signed out; a nudge to /auth
 * when no username is saved.
 */

/** Each page re-lists the channels on Are.na, so follow pages only this far. */
const MAX_PAGES = 10;
const PAGE_SIZE = 100;

interface ArenaChannelPickerProps {
  onPick: (url: string) => void;
  disabled?: boolean;
}

export default function ArenaChannelPicker(props: ArenaChannelPickerProps) {
  const { viewer } = useSession();
  if (!viewer) return null;
  return (
    <FeatureBoundary errorTitle="Couldn't load your Are.na channels" fallback={null}>
      <ChannelSelect {...props} />
    </FeatureBoundary>
  );
}

function ChannelSelect(props: ArenaChannelPickerProps) {
  // store-and-network: the username may have changed on /auth since.
  const { viewer } = useLazyLoadQuery<ArenaChannelPickerQuery>(
    graphql`
      query ArenaChannelPickerQuery($count: Int!, $cursor: String) {
        viewer {
          ...ArenaChannelPicker_viewer @arguments(count: $count, cursor: $cursor)
        }
      }
    `,
    { count: PAGE_SIZE },
    { fetchPolicy: "store-and-network" },
  );
  if (!viewer) return null;
  return <ChannelList viewer={viewer} {...props} />;
}

function ChannelList({ viewer, onPick, disabled }: ArenaChannelPickerProps & { viewer: ArenaChannelPicker_viewer$key }) {
  const { data, hasNext, isLoadingNext, loadNext } = usePaginationFragment(
    graphql`
      fragment ArenaChannelPicker_viewer on Viewer
      @argumentDefinitions(count: { type: "Int!" }, cursor: { type: "String" })
      @refetchable(queryName: "ArenaChannelPickerPaginationQuery") {
        arena {
          channels(first: $count, after: $cursor) @connection(key: "ArenaChannelPicker_channels") {
            edges {
              node {
                slug
                title
                url
                visibility
                blockCount
                owner {
                  name
                  isGroup
                }
              }
            }
          }
        }
      }
    `,
    viewer,
  );

  const edges = data.arena?.channels.edges;
  const pages = Math.ceil((edges?.length ?? 0) / PAGE_SIZE);
  useEffect(() => {
    if (hasNext && !isLoadingNext && pages < MAX_PAGES) loadNext(PAGE_SIZE);
  }, [hasNext, isLoadingNext, pages, loadNext]);

  if (!edges) {
    return (
      <Text variant="caption-1" color="neutral-faded">
        <NextLink href="/auth">Add your Are.na username</NextLink> to pick from your channels.
      </Text>
    );
  }

  const list = edges.map((e) => e.node);
  if (list.length === 0) {
    return (
      <Text variant="caption-1" color="neutral-faded">
        No public channels on your Are.na account.
      </Text>
    );
  }

  const own = list.filter((c) => !c.owner.isGroup);
  const groups = list.filter((c) => c.owner.isGroup);
  const label = (c: (typeof list)[number]) =>
    `${c.title}${c.blockCount != null ? ` (${c.blockCount})` : ""}${c.visibility === "CLOSED" ? " · closed" : ""}`;

  return (
    <View gap={1}>
      <Select
        name="arenaChannel"
        placeholder={`Or pick one of your ${list.length} channels`}
        disabled={disabled}
        value=""
        onChange={({ value }) => value && onPick(value)}
      >
        {own.length > 0 && groups.length > 0 ? (
          <>
            <optgroup label="Your channels">
              {own.map((c) => (
                <option key={c.url} value={c.url}>{label(c)}</option>
              ))}
            </optgroup>
            <optgroup label="Group channels">
              {groups.map((c) => (
                <option key={c.url} value={c.url}>{`${label(c)} — ${c.owner.name}`}</option>
              ))}
            </optgroup>
          </>
        ) : (
          list.map((c) => (
            <option key={c.url} value={c.url}>
              {c.owner.isGroup ? `${label(c)} — ${c.owner.name}` : label(c)}
            </option>
          ))
        )}
      </Select>
    </View>
  );
}
