import { Button, ErrorMessage, FieldError, Label, NumberField, TextField } from "@heroui/react";
import { Description, InputGroup } from "@heroui/react";
import { ListBox, Select } from "@heroui/react";
import { createFormHook, createFormHookContexts } from "@tanstack/react-form";
import { UndoIcon } from "lucide-react";

const { fieldContext, formContext, useFieldContext, useFormContext } = createFormHookContexts();

export const { useAppForm } = createFormHook({
  fieldComponents: {
    TextFieldSet,
    TextField,
    NumberField,
    SelectSet,
  },
  formComponents: {
    SubmitButton,
    ResetButton,
    Button,
  },
  fieldContext,
  formContext,
});

export function WithSuffixIcon() {
  return (
    <TextField className="w-full max-w-[280px]" name="email">
      <Label>Email address</Label>
    </TextField>
  );
}

function TextFieldSet({
  label,
  placeholder,
  description,
  defaultValue,
  type,
  min,
  max,
}: {
  label?: React.ReactNode;
  placeholder?: string;
  description?: React.ReactNode;
  defaultValue?: string | number;
  type?: React.HTMLInputTypeAttribute;
  min?: number;
  max?: number;
}) {
  const field = useFieldContext<string | number>();
  const isDefaultValue = field.state.value === defaultValue;

  return (
    <TextField
      name={field.name}
      aria-label={field.name}
      value={field.state.value.toString()}
      onChange={(v) => {
        const newValue = type === "number" ? parseInt(v) : v;
        field.handleChange(newValue);
      }}
      onBlur={field.handleBlur}
      isInvalid={!field.state.meta.isValid}
    >
      {label && (
        <Label className="flex items-center gap-2">
          {label}
          {!isDefaultValue && (
            <UndoIcon
              className="size-4 cursor-pointer"
              onClick={() => {
                if (!defaultValue) return;
                field.setValue(defaultValue);
              }}
            />
          )}
        </Label>
      )}

      <InputGroup>
        <InputGroup.Input placeholder={placeholder} type={type} min={min} max={max} />
        <InputGroup.Suffix></InputGroup.Suffix>
      </InputGroup>
      <FieldError>{field.state.meta.errors[0]?.message}</FieldError>
      {description && <Description>{description}</Description>}
    </TextField>
  );
}

export type SelectItems = {
  id: string;
  name: string;
}[];

function SelectSet({
  items,
  label,
  placeholder,
  description,
  defaultValue,
  isNumber,
}: {
  items: SelectItems;
  label?: React.ReactNode;
  placeholder?: string;
  description?: React.ReactNode;
  defaultValue?: string | number;
  isNumber?: boolean;
}) {
  const field = useFieldContext<string | number>();
  const isDefaultValue = field.state.value === defaultValue;
  const error = field.state.meta.errors[0]?.message;

  return (
    <Select
      placeholder={placeholder}
      value={field.state.value.toString()}
      onChange={(v) => {
        if (v) {
          const newValue = isNumber ? parseInt(v.toString()) : v;
          field.handleChange(newValue);
        }
      }}
    >
      {label && (
        <Label className="flex items-center gap-2">
          {label}
          {!isDefaultValue && (
            <UndoIcon
              className="size-4 cursor-pointer"
              onClick={() => {
                if (!defaultValue) return;
                field.setValue(defaultValue);
              }}
            />
          )}
        </Label>
      )}
      <Select.Trigger>
        <Select.Value />
        <Select.Indicator />
      </Select.Trigger>
      <Select.Popover>
        <ListBox>
          {items.map((item) => (
            <ListBox.Item key={item.id} id={item.id} textValue={item.name}>
              {item.name}
              <ListBox.ItemIndicator />
            </ListBox.Item>
          ))}
        </ListBox>
      </Select.Popover>
      {error && <ErrorMessage>{error}</ErrorMessage>}
      {description && <Description>{description}</Description>}
    </Select>
  );
}

function SubmitButton(props: Button["Props"]) {
  const form = useFormContext();
  <ResetButton />;
  return (
    <form.Subscribe
      selector={(state) => ({
        isDisabled: (state.isDirty && !state.isValid) || state.isSubmitting,
      })}
      children={({ isDisabled }) => {
        return <Button type="submit" isDisabled={isDisabled} {...props} />;
      }}
    />
  );
}

function ResetButton(props: Button["Props"]) {
  const form = useFormContext();
  return (
    <form.Subscribe
      children={() => {
        return (
          <Button
            type="reset"
            onClick={(e) => {
              e.preventDefault();
              form.reset();
            }}
            {...props}
          />
        );
      }}
    />
  );
}
