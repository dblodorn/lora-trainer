import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { trpc } from "@/utils/trpc";

interface GeneratedImageHideToggleProps {
  id: string;
  hidden: boolean;
}

export default function GeneratedImageHideToggle({ id, hidden }: GeneratedImageHideToggleProps) {
  const [justToggled, setJustToggled] = useState(false);
  const utils = trpc.useUtils();

  const hideMutation = trpc.generate.hideImage.useMutation({
    onSuccess: () => {
      utils.generate.listByLora.invalidate();
      utils.generate.listHiddenImages.invalidate();
      setJustToggled(false);
    },
  });

  const unhideMutation = trpc.generate.unhideImage.useMutation({
    onSuccess: () => {
      utils.generate.listByLora.invalidate();
      utils.generate.listHiddenImages.invalidate();
      setJustToggled(false);
    },
  });

  const handleToggle = () => {
    setJustToggled(true);
    if (hidden) {
      unhideMutation.mutate({ id });
    } else {
      hideMutation.mutate({ id });
    }
  };

  return (
    <button
      onClick={handleToggle}
      disabled={justToggled && (hideMutation.isPending || unhideMutation.isPending)}
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