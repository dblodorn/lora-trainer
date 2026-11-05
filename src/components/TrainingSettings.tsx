import { View, Card, Text, TextField, NumberField, Select, Button, FormControl } from "reshaped";
import { Controller, type Control, type UseFormSetValue } from "react-hook-form";
import { LORA_MODELS, LORA_MODEL_KEYS, loraModelKeySchema } from "@/lib/lora-models";
import type { FormData } from "./types";

interface TrainingSettingsProps {
  control: Control<FormData>;
  setValue: UseFormSetValue<FormData>;
  onTrain: () => void;
  onDownload: () => void;
  isTraining: boolean;
  isDownloading: boolean;
  hasSelection: boolean;
}

export default function TrainingSettings({
  control,
  setValue,
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
          <FormControl.Label>Base Model</FormControl.Label>
          <Controller
            name="model"
            control={control}
            render={({ field }) => (
              <Select.Custom
                name="model"
                value={field.value}
                renderValue={({ value }) => LORA_MODELS[loraModelKeySchema.parse(value)].label}
                onChange={({ value }) => {
                  const key = loraModelKeySchema.parse(value);
                  field.onChange(key);
                  // Each model has its own sensible step count.
                  setValue("trainingSteps", LORA_MODELS[key].defaultSteps);
                }}
              >
                {LORA_MODEL_KEYS.map((key) => (
                  <Select.Option key={key} value={key}>
                    <View gap={0.5}>
                      <Text variant="body-2" weight="medium">
                        {LORA_MODELS[key].label}
                      </Text>
                      <Text variant="caption-1" color="neutral-faded">
                        {LORA_MODELS[key].description}
                      </Text>
                    </View>
                  </Select.Option>
                ))}
              </Select.Custom>
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
