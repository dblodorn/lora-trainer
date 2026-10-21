import { useState } from "react";
import { Alert, Button, Text, TextField, View } from "reshaped";
import { trpc } from "@/utils/trpc";

/*
 * The Are.na username saved on your dmbk account, which the Train page's
 * channel picker lists channels for. Only public and closed channels are read,
 * so no Are.na sign-in is involved.
 */

export default function ArenaUsername() {
  const utils = trpc.useUtils();
  const profile = trpc.arena.profile.useQuery();
  const [slug, setSlug] = useState("");

  const onChanged = () => {
    utils.arena.profile.invalidate();
    utils.arena.myChannels.invalidate();
  };
  const setUser = trpc.arena.setUser.useMutation({ onSuccess: () => { setSlug(""); onChanged(); } });
  const clearUser = trpc.arena.clearUser.useMutation({ onSuccess: onChanged });

  if (profile.isLoading) return null;
  const user = profile.data;

  return (
    <View gap={3} attributes={{ style: { minWidth: 280, maxWidth: 400 } }}>
      <Text variant="body-3" color="neutral-faded">
        Are.na
      </Text>

      {user ? (
        <View gap={3}>
          <Text variant="body-2">
            <a href={`https://www.are.na/${user.slug}`} target="_blank" rel="noopener noreferrer">
              {user.name}
            </a>{" "}
            <Text as="span" color="neutral-faded">({user.slug})</Text>
          </Text>
          <Button color="neutral" fullWidth loading={clearUser.isPending} onClick={() => clearUser.mutate()}>
            Remove
          </Button>
        </View>
      ) : (
        <View
          as="form"
          gap={2}
          attributes={{
            onSubmit: (e) => {
              e.preventDefault();
              if (slug.trim()) setUser.mutate({ slug: slug.trim() });
            },
          }}
        >
          <TextField
            name="arenaUsername"
            placeholder="Are.na username or profile URL"
            value={slug}
            onChange={({ value }) => setSlug(value)}
          />
          <Button type="submit" color="primary" fullWidth loading={setUser.isPending} disabled={!slug.trim()}>
            Save
          </Button>
          <Text variant="caption-1" color="neutral-faded">
            Lists your public and closed channels, and your groups&apos; channels, on the Train page.
          </Text>
        </View>
      )}

      {setUser.error && (
        <Alert color="critical">
          {setUser.error.data?.code === "NOT_FOUND"
            ? "No Are.na user with that username."
            : setUser.error.message}
        </Alert>
      )}
      {clearUser.error && <Alert color="critical">{clearUser.error.message}</Alert>}
    </View>
  );
}
