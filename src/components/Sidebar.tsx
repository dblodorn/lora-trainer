import { View, Text } from "reshaped";
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
  if (selectedImages.length === 0) {
    return (
      <View position="sticky" insetTop={2}>
        <Text variant="body-2" color="neutral-faded">
          No images selected yet. Select up to 20 images from the grid.
        </Text>
      </View>
    );
  }

  return (
    <View position="sticky" insetTop={2}>
      <View gap={2}>
        <Text variant="body-2" color="neutral-faded">
          {selectedImages.length} image{selectedImages.length !== 1 ? "s" : ""}{" "}
          selected
        </Text>

        <StatusAlerts downloadMutation={downloadMutation} />

        {selectedImages?.length > 0 && (
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
        )}
      </View>
    </View>
  );
}
