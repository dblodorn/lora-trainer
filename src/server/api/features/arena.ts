import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { protectedProcedure, publicProcedure, router } from "../trpc";
import { dmbkApi } from "../dmbk-api";

/*
 * Are.na, through the dmbk API (`arenaChannel`, `viewer.arena`), which reads
 * Are.na's v3 API without credentials. Only public and closed channels exist
 * here; a private channel looks the same as a missing one.
 */

const urlSchema = z.string().regex(/^https?:\/\/(www\.)?are\.na\/[^/]+\/[^/]+\/?$/, {
  message:
    "Invalid are.na URL format. Expected format: https://www.are.na/username/channel-name",
});

/** The most images loaded from one channel, as before (one page of 100). */
const MAX_IMAGES = 100;
/** Are.na pages scanned to find them, since non-image blocks share pages. */
const MAX_PAGES = 5;

export interface ArenaImage {
  id: number;
  title: string | null;
  src: string;
  thumbnailSrc: string;
  width: number | null;
  height: number | null;
}

interface ChannelPage {
  arenaChannel: {
    title: string;
    slug: string;
    url: string;
    images: {
      edges: { node: ArenaImage }[];
      pageInfo: { hasNextPage: boolean; endCursor: string | null };
    };
  } | null;
}

const CHANNEL_QUERY = `query ($slug: String!, $after: String) {
  arenaChannel(slug: $slug) {
    title slug url
    images(first: 100, after: $after) {
      edges { node { id title src thumbnailSrc width height } }
      pageInfo { hasNextPage endCursor }
    }
  }
}`;

const PROFILE_FIELDS = "user { id slug name avatarUrl }";

interface ArenaUser {
  id: number;
  slug: string;
  name: string;
  avatarUrl: string | null;
}

export interface ArenaChannelSummary {
  slug: string;
  title: string;
  url: string;
  visibility: "PUBLIC" | "CLOSED";
  blockCount: number | null;
  updatedAt: string;
  owner: { slug: string; name: string; isGroup: boolean };
}

interface ChannelsPage {
  viewer: {
    arena: {
      channels: {
        totalCount: number;
        edges: { node: ArenaChannelSummary }[];
        pageInfo: { hasNextPage: boolean; endCursor: string | null };
      };
    } | null;
  } | null;
}

const CHANNELS_QUERY = `query ($after: String) {
  viewer { arena { channels(first: 100, after: $after) {
    totalCount
    edges { node { slug title url visibility blockCount updatedAt owner { slug name isGroup } } }
    pageInfo { hasNextPage endCursor }
  } } }
}`;

export const arenaRouter = router({
  getChannelImages: publicProcedure
    .input(z.object({ url: urlSchema }))
    .query(async ({ input }) => {
      const slug = input.url.replace(/\/+$/, "").split("/").pop()!;
      const images: ArenaImage[] = [];
      let channel: NonNullable<ChannelPage["arenaChannel"]> | null = null;
      let after: string | null = null;

      for (let page = 0; page < MAX_PAGES && images.length < MAX_IMAGES; page++) {
        const data: ChannelPage = await dmbkApi<ChannelPage>(CHANNEL_QUERY, { slug, after });
        if (!data.arenaChannel) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Channel not found. Only public and closed Are.na channels can be used.",
          });
        }
        channel = data.arenaChannel;
        images.push(...channel.images.edges.map((e) => e.node));
        if (!channel.images.pageInfo.hasNextPage) break;
        after = channel.images.pageInfo.endCursor;
      }

      const kept = images.slice(0, MAX_IMAGES);
      return {
        channel: { title: channel!.title, slug: channel!.slug, url: channel!.url },
        images: kept,
        total: kept.length,
      };
    }),

  /** The Are.na user this account saved, or null. */
  profile: protectedProcedure.query(async ({ ctx }) => {
    const data = await dmbkApi<{ viewer: { arena: { user: ArenaUser } | null } | null }>(
      `{ viewer { arena { ${PROFILE_FIELDS} } } }`,
      {},
      ctx.sessionToken,
    );
    return data.viewer?.arena?.user ?? null;
  }),

  setUser: protectedProcedure
    .input(z.object({ slug: z.string().trim().min(1).max(100) }))
    .mutation(async ({ input, ctx }) => {
      // Accept a pasted profile URL as well as a bare username.
      const slug = input.slug.replace(/^https?:\/\/(www\.)?are\.na\//, "").split("/")[0];
      const data = await dmbkApi<{ arenaSetUser: { viewer: { arena: { user: ArenaUser } | null } } }>(
        `mutation ($input: ArenaSetUserInput!) { arenaSetUser(input: $input) { viewer { arena { ${PROFILE_FIELDS} } } } }`,
        { input: { slug } },
        ctx.sessionToken,
      );
      return data.arenaSetUser.viewer.arena?.user ?? null;
    }),

  clearUser: protectedProcedure.mutation(async ({ ctx }) => {
    await dmbkApi<{ arenaClearUser: boolean }>("mutation { arenaClearUser }", {}, ctx.sessionToken);
    return { success: true };
  }),

  /** The saved user's public and closed channels, own and group, newest first. Null with no saved user. */
  myChannels: protectedProcedure.query(async ({ ctx }) => {
    const channels: ArenaChannelSummary[] = [];
    let after: string | null = null;
    // Each page re-lists the channels on Are.na, so follow pages only as far
    // as needed. 100 channels is one call.
    for (let page = 0; page < 10; page++) {
      const data: ChannelsPage = await dmbkApi<ChannelsPage>(CHANNELS_QUERY, { after }, ctx.sessionToken);
      const conn = data.viewer?.arena?.channels;
      if (!conn) return null;
      channels.push(...conn.edges.map((e) => e.node));
      if (!conn.pageInfo.hasNextPage) break;
      after = conn.pageInfo.endCursor;
    }
    return channels;
  }),
});
