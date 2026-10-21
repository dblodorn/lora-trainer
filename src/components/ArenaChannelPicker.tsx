import NextLink from "next/link";
import { Select, Text, View } from "reshaped";
import { trpc } from "@/utils/trpc";
import { useSession } from "@/lib/session";

/*
 * Your Are.na channels, from the username saved on /auth. Picking one loads it
 * the same way as pasting its URL. Hidden when signed out; a nudge to /auth
 * when no username is saved.
 */

interface ArenaChannelPickerProps {
  onPick: (url: string) => void;
  disabled?: boolean;
}

export default function ArenaChannelPicker({ onPick, disabled }: ArenaChannelPickerProps) {
  const { viewer } = useSession();
  const channels = trpc.arena.myChannels.useQuery(undefined, {
    enabled: !!viewer,
    staleTime: 5 * 60_000,
  });

  if (!viewer || channels.isLoading) return null;

  if (channels.error) {
    return (
      <Text variant="caption-1" color="critical">
        Couldn&apos;t load your Are.na channels: {channels.error.message}
      </Text>
    );
  }

  if (channels.data === null) {
    return (
      <Text variant="caption-1" color="neutral-faded">
        <NextLink href="/auth">Add your Are.na username</NextLink> to pick from your channels.
      </Text>
    );
  }

  const list = channels.data ?? [];
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
