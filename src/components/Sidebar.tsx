import { View } from "reshaped";
import { type Control } from "react-hook-form";
import TrainingSettings from "./TrainingSettings";
import StatusAlerts from "./StatusAlerts";
import AuthGuard from "./AuthGuard";
import type { FormData } from "./types";

interface DownloadMutationState {
  isError: boolean;
  isSuccess: boolean;
  isPending: boolean;
  error?: { message: string } | null;
  data?: unknown;
}

interface SidebarProps {
  selectedImages: string[];
  control: Control<FormData>;
  onTrain: () => void;
  onDownload: () => void;
  downloadMutation: DownloadMutationState;
  isSubmitting: boolean;
  isTrainingActive: boolean;
}

export default function Sidebar({
  selectedImages,
  control,
  onTrain,
  onDownload,
  downloadMutation,
  isSubmitting,
  isTrainingActive,
}: SidebarProps) {
  return (
    <View position="sticky" insetTop={2}>
      <View gap={2}>
        <StatusAlerts downloadMutation={downloadMutation} />

        <AuthGuard>
          <TrainingSettings
            control={control}
            onTrain={onTrain}
            onDownload={onDownload}
            isTraining={isSubmitting || isTrainingActive}
            isDownloading={downloadMutation.isPending}
            hasSelection={selectedImages.length > 0}
          />

          <StatusAlerts downloadMutation={downloadMutation} />
        </AuthGuard>
      </View>
    </View>
  );
}