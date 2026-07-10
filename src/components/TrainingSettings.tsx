import { View, Card, TextField, NumberField, Button, FormControl } from "reshaped";
import { Controller, type Control } from "react-hook-form";
import type { FormData } from "./types";

interface TrainingSettingsProps {
  control: Control<FormData>;
  onTrain: () => void;
  onDownload: () => void;
  isTraining: boolean;
  isDownloading: boolean;
  hasSelection: boolean;
}

export default function TrainingSettings({
  control,
  onTrain,
  onDownload,
  isTraining,
  isDownloading,
  hasSelection,
}: TrainingSettingsProps) {
  return (
    <Card padding={4}>
      <View gap={4}>
        <FormControl>
          <FormControl.Label>Trigger Word</FormControl.Label>
          <Controller
            name="triggerWord"
            control={control}
            rules={{ required: true }}
            render={({ field }) => (
              <TextField
                name="triggerWord"
                value={field.value}
                onChange={({ value }) => field.onChange(value)}
                placeholder="e.g., mystyle, myart, mycharacter"
              />
            )}
          />
        </FormControl>

        <FormControl>
          <FormControl.Label>Training Steps</FormControl.Label>
          <Controller
            name="trainingSteps"
            control={control}
            rules={{ min: 100, max: 2000 }}
            render={({ field }) => (
              <NumberField
                name="trainingSteps"
                value={field.value}
                onChange={({ value }) => field.onChange(value)}
                min={100}
                max={2000}
                step={100}
                increaseAriaLabel="Increase training steps"
                decreaseAriaLabel="Decrease training steps"
              />
            )}
          />
        </FormControl>

        <Button
          color="positive"
          fullWidth
          onClick={() => onTrain()}
          loading={isTraining}
          disabled={!hasSelection}
        >
          Train LoRA
        </Button>

        <Button
          color="primary"
          fullWidth
          onClick={onDownload}
          loading={isDownloading}
          disabled={!hasSelection}
        >
          Download Images Zip
        </Button>
      </View>
    </Card>
  );
}
