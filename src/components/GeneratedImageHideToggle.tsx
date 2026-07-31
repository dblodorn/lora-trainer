import { useState } from "react";
import { Button } from "reshaped";
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
    <Button
      variant="ghost"
      size="small"
      onClick={handleToggle}
      loading={justToggled && (hideMutation.isPending || unhideMutation.isPending)}
    >
      {hidden ? <EyeOff size={14} /> : <Eye size={14} />}
    </Button>
  );
}