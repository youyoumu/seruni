import { createFormHook, createFormHookContexts } from "@tanstack/react-form";
import { Button, FieldError, Input, Label, NumberField, TextField } from "@heroui/react";

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

function TextFieldSet({ label, placeholder }: { label?: React.ReactNode; placeholder?: string }) {
  const field = useFieldContext<string>();
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
      <Input placeholder={placeholder} />
      <FieldError>{field.state.meta.errors[0]?.message}</FieldError>
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
