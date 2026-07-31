import { useState } from "react";
import { Button } from "reshaped";
import { Eye, EyeOff } from "lucide-react";
import { trpc } from "@/utils/trpc";

interface LoraHideToggleProps {
  id: string;
  hidden: boolean;
}

export default function LoraHideToggle({ id, hidden }: LoraHideToggleProps) {
  const [justToggled, setJustToggled] = useState(false);
  const utils = trpc.useUtils();

  const hideMutation = trpc.lora.hide.useMutation({
    onSuccess: () => {
      utils.lora.getById.invalidate({ id });
      utils.lora.list.invalidate();
      utils.lora.listHidden.invalidate();
      setJustToggled(false);
    },
  });

  const unhideMutation = trpc.lora.unhide.useMutation({
    onSuccess: () => {
      utils.lora.getById.invalidate({ id });
      utils.lora.list.invalidate();
      utils.lora.listHidden.invalidate();
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
      {hidden ? <EyeOff size={16} /> : <Eye size={16} />}
    </Button>
  );
}
