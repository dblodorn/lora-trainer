import { Eye, EyeOff } from "lucide-react";
import { graphql, useMutation } from "react-relay";
import type { GeneratedImageHideToggleMutation } from "./__generated__/GeneratedImageHideToggleMutation.graphql";

interface GeneratedImageHideToggleProps {
  /** The image's global ID. */
  id: string;
  hidden: boolean;
  /**
   * Connections the image leaves once toggled: the list it is shown in is
   * filtered by visibility, so hiding takes it off a LoRA's public list and
   * unhiding takes it off the hidden list.
   */
  connections: string[];
}

export default function GeneratedImageHideToggle({ id, hidden, connections }: GeneratedImageHideToggleProps) {
  const [commit, isInFlight] = useMutation<GeneratedImageHideToggleMutation>(graphql`
    mutation GeneratedImageHideToggleMutation($input: LoraTrainerSetImageHiddenInput!, $connections: [ID!]!) {
      loraTrainerSetImageHidden(input: $input) {
        generatedImage {
          id
          hidden
          removedId: id @deleteEdge(connections: $connections)
        }
      }
    }
  `);

  return (
    <button
      onClick={() =>
        commit({
          variables: { input: { id, hidden: !hidden }, connections },
          onError: (error) => console.error("Failed to change the image's visibility:", error),
        })
      }
      disabled={isInFlight}
      style={{
        background: "none",
        border: "none",
        padding: 0,
        cursor: "pointer",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        width: 28,
        height: 28,
        lineHeight: 0,
      }}
    >
      {hidden ? <EyeOff size={14} color="#fff" /> : <Eye size={14} color="#fff" />}
    </button>
  );
}
