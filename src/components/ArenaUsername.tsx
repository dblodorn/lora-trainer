import { useState } from "react";
import { Alert, Button, Text, TextField, View } from "reshaped";
import { graphql, useLazyLoadQuery, useMutation } from "react-relay";
import { ApiError } from "@/lib/relay/environment";
import type { ArenaUsernameQuery } from "./__generated__/ArenaUsernameQuery.graphql";
import type { ArenaUsernameSetMutation } from "./__generated__/ArenaUsernameSetMutation.graphql";
import type { ArenaUsernameClearMutation } from "./__generated__/ArenaUsernameClearMutation.graphql";

/*
 * The Are.na username saved on your dmbk account, which the Train page's
 * channel picker lists channels for. Only public and closed channels are read,
 * so no Are.na sign-in is involved. Render under a FeatureBoundary.
 *
 * The viewer has no global ID, so the mutations' payloads can't update this
 * query's record in place; it refetches instead. The channel picker refetches
 * whenever it is shown.
 */

export default function ArenaUsername() {
  const [fetchKey, setFetchKey] = useState(0);
  const { viewer } = useLazyLoadQuery<ArenaUsernameQuery>(
    graphql`
      query ArenaUsernameQuery {
        viewer {
          arena {
            user {
              slug
              name
            }
          }
        }
      }
    `,
    {},
    { fetchKey, fetchPolicy: fetchKey === 0 ? "store-or-network" : "network-only" },
  );
  const [slug, setSlug] = useState("");
  const [error, setError] = useState<Error | null>(null);

  const [commitSet, isSetting] = useMutation<ArenaUsernameSetMutation>(graphql`
    mutation ArenaUsernameSetMutation($input: ArenaSetUserInput!) {
      arenaSetUser(input: $input) {
        viewer {
          arena {
            user {
              slug
            }
          }
        }
      }
    }
  `);
  const [commitClear, isClearing] = useMutation<ArenaUsernameClearMutation>(graphql`
    mutation ArenaUsernameClearMutation {
      arenaClearUser
    }
  `);

  const onChanged = () => setFetchKey((k) => k + 1);

  const save = (value: string) => {
    // Accept a pasted profile URL as well as a bare username.
    const parsed = value.replace(/^https?:\/\/(www\.)?are\.na\//, "").split("/")[0];
    setError(null);
    commitSet({
      variables: { input: { slug: parsed } },
      onCompleted: () => {
        setSlug("");
        onChanged();
      },
      onError: setError,
    });
  };

  const clear = () => {
    setError(null);
    commitClear({ variables: {}, onCompleted: onChanged, onError: setError });
  };

  const user = viewer?.arena?.user ?? null;

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
          <Button color="neutral" fullWidth loading={isClearing} onClick={clear}>
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
              if (slug.trim()) save(slug.trim());
            },
          }}
        >
          <TextField
            name="arenaUsername"
            placeholder="Are.na username or profile URL"
            value={slug}
            onChange={({ value }) => setSlug(value)}
          />
          <Button type="submit" color="primary" fullWidth loading={isSetting} disabled={!slug.trim()}>
            Save
          </Button>
          <Text variant="caption-1" color="neutral-faded">
            Lists your public and closed channels, and your groups&apos; channels, on the Train page.
          </Text>
        </View>
      )}

      {error && (
        <Alert color="critical">
          {error instanceof ApiError && error.code === "NOT_FOUND"
            ? "No Are.na user with that username."
            : error.message}
        </Alert>
      )}
    </View>
  );
}
