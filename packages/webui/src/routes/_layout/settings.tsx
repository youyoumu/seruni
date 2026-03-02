import { useConfig$, useSetConfig } from "#/hooks/config";
import { useAppForm } from "#/hooks/form";
import { useServices } from "#/hooks/services";
import {
  ffmpegAudioFormatMap,
  ffmpegAudioQualityMap,
  ffmpegMaxPictureResolutionMap,
  ffmpegPictureFormatMap,
  ffmpegPictureQualityMap,
} from "#/util/config";
import { Separator, Skeleton, tv } from "@heroui/react";
import { defaultConfig, zConfig } from "@repo/shared/schema";
import { createFileRoute } from "@tanstack/react-router";
import { debounce, randomInt, range } from "es-toolkit";
import { Suspense, useState } from "react";

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

function toSelectItems(itemMap: Record<string | number, string>) {
  return Object.entries(itemMap).map(([id, name]) => ({ id, name }));
}

function FallbackSettingsPage() {
  const [skeletonCount] = useState(randomInt(6, 9));

  return (
    <div className="flex w-full max-w-7xl flex-col gap-12 px-4 pt-8 pb-16">
      {range(skeletonCount).map((_, i) => (
        <Skeleton key={i} className={`h-6 w-full rounded-lg`} />
      ))}
    </div>
  );
}

function SettingsPage() {
  return (
    <Suspense fallback={<FallbackSettingsPage />}>
      <SettingsForm />
    </Suspense>
  );
}

function SettingsForm() {
  const { toast } = useServices();
  const { header, groupSection, groupInput } = settingsTv();
  const { data: config } = useConfig$();
  const { mutate: updateConfig } = useSetConfig();

  const form = useAppForm({
    defaultValues: { ...config },
    validators: { onChange: zConfig },
    onSubmit: async ({ value }) => {
      const newValue = zConfig.parse(value);
      updateConfig(newValue, {
        onSuccess() {
          toast.success("Config has been updated");
        },
      });
    },
  });

  const submitD = debounce(() => form.handleSubmit(), 2000);

  return (
    <div className="w-full max-w-7xl p-4 pb-32">
      <form
        onChange={() => {
          submitD();
        }}
        onBlur={() => {
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
              name="obsWebSocketPassword"
              children={(field) => (
                <field.TextFieldSet
                  label="WebSocket Password"
                  type="password"
                  placeholder={defaultConfig.obsWebSocketPassword ?? ""}
                  defaultValue={defaultConfig.obsWebSocketPassword ?? ""}
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

        <div className={groupSection()}>
          <h3 className={header()}>Text Hooker</h3>
          <div className={groupInput()}>
            <form.AppField
              name="textHookerWebSocketAddress"
              children={(field) => (
                <field.TextFieldSet
                  label="WebSocket Address"
                  placeholder={defaultConfig.textHookerWebSocketAddress}
                  defaultValue={defaultConfig.textHookerWebSocketAddress}
                />
              )}
            />
          </div>
          <Separator />
        </div>

        <div className={groupSection()}>
          <h3 className={header()}>FFmpeg</h3>
          <div className={groupInput()}>
            <form.AppField
              name="ffmpegPictureFormat"
              children={(field) => (
                <field.SelectSet
                  items={toSelectItems(ffmpegPictureFormatMap)}
                  label="Picture Format"
                  placeholder={ffmpegPictureFormatMap[defaultConfig.ffmpegPictureFormat]}
                  defaultValue={defaultConfig.ffmpegPictureFormat}
                />
              )}
            />
            <form.AppField
              name="ffmpegPictureQuality"
              children={(field) => (
                <field.SelectSet
                  items={toSelectItems(ffmpegPictureQualityMap)}
                  label="Picture Quality"
                  placeholder={ffmpegPictureQualityMap[defaultConfig.ffmpegPictureQuality]}
                  defaultValue={defaultConfig.ffmpegPictureQuality}
                />
              )}
            />
            <form.AppField
              name="ffmpegMaxPictureResolution"
              children={(field) => (
                <field.SelectSet
                  items={toSelectItems(ffmpegMaxPictureResolutionMap)}
                  isNumber
                  label="Picture Resolution"
                  placeholder={
                    ffmpegMaxPictureResolutionMap[defaultConfig.ffmpegMaxPictureResolution]
                  }
                  defaultValue={defaultConfig.ffmpegMaxPictureResolution}
                />
              )}
            />
            <form.AppField
              name="ffmpegPictureFrameCount"
              children={(field) => (
                <field.TextFieldSet
                  label="Picture Frame Count"
                  type="number"
                  min={1}
                  max={99}
                  placeholder={defaultConfig.ffmpegPictureFrameCount.toString()}
                  defaultValue={defaultConfig.ffmpegPictureFrameCount}
                />
              )}
            />
            <form.AppField
              name="ffmpegAudioFormat"
              children={(field) => (
                <field.SelectSet
                  items={toSelectItems(ffmpegAudioFormatMap)}
                  label="Audio Format"
                  placeholder={ffmpegAudioFormatMap[defaultConfig.ffmpegAudioFormat]}
                  defaultValue={defaultConfig.ffmpegAudioFormat}
                />
              )}
            />
            <form.AppField
              name="ffmpegAudioQuality"
              children={(field) => (
                <field.SelectSet
                  items={toSelectItems(ffmpegAudioQualityMap)}
                  label="Audio Quality"
                  placeholder={ffmpegAudioQualityMap[defaultConfig.ffmpegAudioQuality]}
                  defaultValue={defaultConfig.ffmpegAudioQuality}
                />
              )}
            />
            <form.AppField
              name="ffmpegAudioOffsetStart"
              children={(field) => (
                <field.TextFieldSet
                  label="Audio Offset Start (ms)"
                  type="number"
                  max={0}
                  placeholder={defaultConfig.ffmpegAudioOffsetStart.toString()}
                  defaultValue={defaultConfig.ffmpegAudioOffsetStart}
                />
              )}
            />
            <form.AppField
              name="ffmpegAudioOffsetEnd"
              children={(field) => (
                <field.TextFieldSet
                  label="Audio Offset End (ms)"
                  type="number"
                  min={0}
                  placeholder={defaultConfig.ffmpegAudioOffsetEnd.toString()}
                  defaultValue={defaultConfig.ffmpegAudioOffsetEnd}
                />
              )}
            />
          </div>
          <Separator />
        </div>
      </form>
    </div>
  );
}
