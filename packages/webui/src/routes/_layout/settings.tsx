import { useConfig$, useSetConfig } from "#/hooks/config";
import { useAppForm } from "#/hooks/form";
import { useServices } from "#/hooks/services";
import { Separator, tv } from "@heroui/react";
import { zConfig, zConfigStrict } from "@repo/shared/schema";
import { createFileRoute } from "@tanstack/react-router";
import { debounce } from "es-toolkit";

export const Route = createFileRoute("/_layout/settings")({
  component: SettingsPage,
});

const settingsTv = tv({
  slots: {
    header: "text-2xl font-bold",
    groupSection: "flex flex-col gap-4",
    groupInput: "grid grid-cols-[repeat(auto-fill,_minmax(320px,_1fr))] gap-4",
  },
});

const defaultConfig = zConfig.parse({});

function SettingsPage() {
  const { toast } = useServices();
  const { header, groupSection, groupInput } = settingsTv();
  const { data: config } = useConfig$();
  const { mutate: updateConfig } = useSetConfig();

  const form = useAppForm({
    defaultValues: { ...config },
    validators: { onChange: zConfigStrict },
    onSubmit: async ({ value }) => {
      const newValue = zConfigStrict.parse(value);
      updateConfig(newValue, {
        onSuccess() {
          toast.success("Config has been updated");
        },
      });
    },
  });

  const submitD = debounce(() => form.handleSubmit(), 2000);

  return (
    <div className="flex h-full justify-center">
      <div className="w-full max-w-7xl p-4">
        <form
          onChange={() => {
            submitD();
          }}
          onSubmit={async (e) => {
            e.preventDefault();
            await form.handleSubmit();
          }}
          className="flex flex-col gap-4"
        >
          <div className={groupSection()}>
            <h3 className={header()}>Anki</h3>
            <div className={groupInput()}>
              <form.AppField
                name="ankiConnectAddress"
                children={(field) => (
                  <field.TextFieldSet
                    label="AnkiConnect Address"
                    placeholder={defaultConfig.ankiConnectAddress}
                    defaultValue={defaultConfig.ankiConnectAddress}
                  />
                )}
              />

              <form.AppField
                name="ankiExpressionField"
                children={(field) => (
                  <field.TextFieldSet
                    label="Expression Field"
                    placeholder={defaultConfig.ankiExpressionField}
                    defaultValue={defaultConfig.ankiExpressionField}
                  />
                )}
              />

              <form.AppField
                name="ankiPictureField"
                children={(field) => (
                  <field.TextFieldSet
                    label="Picture Field"
                    placeholder={defaultConfig.ankiPictureField}
                    defaultValue={defaultConfig.ankiPictureField}
                  />
                )}
              />

              <form.AppField
                name="ankiSentenceField"
                children={(field) => (
                  <field.TextFieldSet
                    label="Sentence Field"
                    placeholder={defaultConfig.ankiSentenceField}
                    defaultValue={defaultConfig.ankiSentenceField}
                  />
                )}
              />

              <form.AppField
                name="ankiSentenceAudioField"
                children={(field) => (
                  <field.TextFieldSet
                    label="Sentence Audio Field"
                    placeholder={defaultConfig.ankiSentenceAudioField}
                    defaultValue={defaultConfig.ankiSentenceAudioField}
                  />
                )}
              />
            </div>
            <Separator />
          </div>

          <div className={groupSection()}>
            <h3 className={header()}>OBS</h3>
            <div className={groupInput()}>
              <form.AppField
                name="obsWebSocketAddress"
                children={(field) => (
                  <field.TextFieldSet
                    label="WebSocket Address"
                    placeholder={defaultConfig.obsWebSocketAddress}
                    defaultValue={defaultConfig.obsWebSocketAddress}
                  />
                )}
              />

              <form.AppField
                name="obsReplayBufferDurationS"
                children={(field) => (
                  <field.TextFieldSet
                    label="Replay Buffer Duration (s)"
                    type="number"
                    placeholder={defaultConfig.obsReplayBufferDurationS.toString()}
                    defaultValue={defaultConfig.obsReplayBufferDurationS}
                  />
                )}
              />
            </div>
            <Separator />
          </div>
        </form>
      </div>
    </div>
  );
}
