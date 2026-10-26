import { useEffect, useState } from "react";
import { fetchQuery, graphql, useRelayEnvironment } from "react-relay";
import type {
  useArenaChannelImagesQuery,
  useArenaChannelImagesQuery$data,
} from "./__generated__/useArenaChannelImagesQuery.graphql";
import type { ArenaImage } from "./types";

/*
 * A channel's images, through the dmbk API (`arenaChannel`), which reads
 * Are.na's v3 API without credentials. Only public and closed channels exist
 * there; a private channel looks the same as a missing one.
 *
 * Fetched imperatively: one Are.na page can hold fewer images than asked for,
 * since non-image blocks share pages, so this follows pages until it has
 * enough. Nothing renders from the store, so a suspending query would add
 * nothing.
 */

/** The most images loaded from one channel (one page of 100, as before). */
const MAX_IMAGES = 100;
/** Are.na pages scanned to find them. */
const MAX_PAGES = 5;

const CHANNEL_URL = /^https?:\/\/(www\.)?are\.na\/[^/]+\/[^/]+\/?$/;

// `ArenaImage.id` is an Int. Relay keys records by any field named `id` and
// needs a string there, so the query reads it as `blockId`.
const channelQuery = graphql`
  query useArenaChannelImagesQuery($slug: String!, $after: String) {
    arenaChannel(slug: $slug) {
      title
      slug
      url
      images(first: 100, after: $after) {
        edges {
          node {
            blockId: id
            title
            src
            thumbnailSrc
            width
            height
          }
        }
        pageInfo {
          hasNextPage
          endCursor
        }
      }
    }
  }
`;

export interface ArenaChannelImages {
  channel: { title: string; slug: string; url: string };
  images: ArenaImage[];
  total: number;
}

interface State {
  url: string;
  data?: ArenaChannelImages;
  error?: Error;
}

/** Load `url`'s images; an empty url loads nothing. */
export function useArenaChannelImages(url: string) {
  const environment = useRelayEnvironment();
  const [state, setState] = useState<State>({ url: "" });

  useEffect(() => {
    if (!url) return;
    let cancelled = false;

    async function load(): Promise<ArenaChannelImages> {
      if (!CHANNEL_URL.test(url)) {
        throw new Error("Invalid are.na URL format. Expected format: https://www.are.na/username/channel-name");
      }
      const slug = url.replace(/\/+$/, "").split("/").pop()!;
      const images: ArenaImage[] = [];
      let channel: ArenaChannelImages["channel"] | null = null;
      let after: string | null = null;

      for (let page = 0; page < MAX_PAGES && images.length < MAX_IMAGES; page++) {
        const data: useArenaChannelImagesQuery$data | undefined = await fetchQuery<useArenaChannelImagesQuery>(
          environment,
          channelQuery,
          { slug, after },
          { fetchPolicy: "network-only" },
        ).toPromise();
        const found: useArenaChannelImagesQuery$data["arenaChannel"] | undefined = data?.arenaChannel;
        if (!found) {
          throw new Error("Channel not found. Only public and closed Are.na channels can be used.");
        }
        channel = { title: found.title, slug: found.slug, url: found.url };
        for (const { node } of found.images.edges) {
          images.push({
            id: node.blockId,
            title: node.title ?? null,
            src: node.src,
            thumbnailSrc: node.thumbnailSrc,
            width: node.width ?? null,
            height: node.height ?? null,
          });
        }
        if (!found.images.pageInfo.hasNextPage) break;
        after = found.images.pageInfo.endCursor ?? null;
      }

      const kept = images.slice(0, MAX_IMAGES);
      return { channel: channel!, images: kept, total: kept.length };
    }

    load().then(
      (data) => !cancelled && setState({ url, data }),
      (error: Error) => !cancelled && setState({ url, error }),
    );
    return () => {
      cancelled = true;
    };
  }, [url, environment]);

  // A result for a previous url is stale the moment the url changes.
  const current = url && state.url === url ? state : null;
  return {
    data: current?.data,
    error: current?.error ?? null,
    isLoading: !!url && !current,
  };
}
