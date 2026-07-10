import { View, Alert, Text } from "reshaped";

interface MutationState {
  isError: boolean;
  isSuccess: boolean;
  error?: { message: string } | null;
  data?: unknown;
}

interface StatusAlertsProps {
  downloadMutation: MutationState;
}

export default function StatusAlerts({
  downloadMutation,
}: StatusAlertsProps) {
  const hasAlerts = downloadMutation.isError || downloadMutation.isSuccess;

  if (!hasAlerts) return null;

  return (
    <View gap={3}>
      {downloadMutation.isError && (
        <Alert color="critical" title="Download Error">
          {downloadMutation.error?.message}
        </Alert>
      )}

      {downloadMutation.isSuccess && (
        <Alert color="primary" title="Download Complete">
          <View gap={1}>
            <Text variant="body-2">Zip archive downloaded successfully!</Text>
            <Text variant="caption-1" color="neutral-faded">
              Check your Downloads folder for the zip file.
            </Text>
          </View>
        </Alert>
      )}
    </View>
  );
}
