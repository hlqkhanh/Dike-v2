import { Field } from "./ui";

export function DeparturePicker({
  value,
  onChange,
  disabled,
}: {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}) {
  return (
    <Field
      label="Ngày và giờ khởi hành"
      placeholder="2026-10-20 07:30"
      value={value}
      editable={!disabled}
      onChangeText={onChange}
    />
  );
}
