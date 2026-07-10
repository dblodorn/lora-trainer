import { View, TextField, Button, Text } from "reshaped";
import { Controller, type Control } from "react-hook-form";
import type { FormData } from "./types";

interface ChannelUrlFormProps {
  control: Control<FormData>;
  onSubmit: () => void;
  isLoading: boolean;
}

export default function ChannelUrlForm({
  control,
  onSubmit,
  isLoading,
}: ChannelUrlFormProps) {
  return (
    <View
      as="form"
      width="100%"
      attributes={{
        onSubmit: (e) => {
          e.preventDefault();
          onSubmit();
        },
      }}
    >
      <View direction="row" gap={2}>
        <View.Item grow>
          <Controller
            name="url"
            control={control}
            render={({ field, fieldState }) => (
              <View direction="column" gap={1}>
                <TextField
                  name="url"
                  value={field.value}
                  onChange={({ value }) => field.onChange(value)}
                  placeholder="Enter are.na channel URL (e.g., https://www.are.na/dain-blodorn-kim/earth-s-objects)"
                  hasError={!!fieldState.error}
                  inputAttributes={{ type: "url" }}
                />
                {fieldState.error && (
                  <Text variant="caption-1" color="critical">
                    {fieldState.error.message}
                  </Text>
                )}
              </View>
            )}
          />
        </View.Item>
        <Button type="submit" color="primary" loading={isLoading}>
          Fetch Images
        </Button>
      </View>
    </View>
  );
}
