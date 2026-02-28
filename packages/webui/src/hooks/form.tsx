import { Button, FieldError, Label, NumberField, TextField } from "@heroui/react";
import { Description, InputGroup } from "@heroui/react";
import { createFormHook, createFormHookContexts } from "@tanstack/react-form";
import { UndoIcon } from "lucide-react";

const { fieldContext, formContext, useFieldContext, useFormContext } = createFormHookContexts();

export const { useAppForm } = createFormHook({
  fieldComponents: {
    TextFieldSet,
    TextField,
    NumberField,
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
}: {
  label?: React.ReactNode;
  placeholder?: string;
  description?: React.ReactNode;
  defaultValue?: string;
}) {
  const field = useFieldContext<string>();
  const isDefaultValue = field.state.value === defaultValue;

  return (
    <TextField
      name={field.name}
      aria-label={field.name}
      value={field.state.value}
      onChange={field.handleChange}
      onBlur={field.handleBlur}
      isInvalid={!field.state.meta.isValid}
    >
      {label && <Label>{label}</Label>}
      <InputGroup>
        <InputGroup.Input placeholder={placeholder} />
        {defaultValue && !isDefaultValue && (
          <InputGroup.Suffix>
            <UndoIcon
              className="size-4 cursor-pointer"
              onClick={() => {
                if (!defaultValue) return;
                field.setValue(defaultValue);
              }}
            />
          </InputGroup.Suffix>
        )}
      </InputGroup>
      <FieldError>{field.state.meta.errors[0]?.message}</FieldError>
      {description && <Description>{description}</Description>}
    </TextField>
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
