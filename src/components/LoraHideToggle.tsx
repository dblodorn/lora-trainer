import { Button } from "reshaped";
import { Eye, EyeOff } from "lucide-react";
import { graphql, useMutation } from "react-relay";
import type { LoraHideToggleMutation } from "./__generated__/LoraHideToggleMutation.graphql";

interface LoraHideToggleProps {
  /** The training's global ID. */
  id: string;
  hidden: boolean;
}

/*
 * The payload carries `hidden`, so the store updates the training in place.
 * The gallery and hidden lists refetch when next shown (store-and-network).
 */
export default function LoraHideToggle({ id, hidden }: LoraHideToggleProps) {
  const [commit, isInFlight] = useMutation<LoraHideToggleMutation>(graphql`
    mutation LoraHideToggleMutation($input: LoraTrainerSetTrainingHiddenInput!) {
      loraTrainerSetTrainingHidden(input: $input) {
        loraTraining {
          id
          hidden
        }
      }
    }
  `);

  return (
    <Button
      variant="ghost"
      size="small"
      onClick={() =>
        commit({
          variables: { input: { id, hidden: !hidden } },
          onError: (error) => console.error("Failed to change the LoRA's visibility:", error),
        })
      }
      loading={isInFlight}
    >
      {hidden ? <EyeOff size={16} /> : <Eye size={16} />}
    </Button>
  );
}
