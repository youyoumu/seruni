import { formatRelative } from "date-fns";
import { Show, Suspense } from "solid-js";
import { cva } from "styled-system/css";
import { HStack, Stack } from "styled-system/jsx";
import type { RecipeVariantProps } from "styled-system/types";
import { Button } from "#/components/ui/button";
import { Text } from "#/components/ui/text";
import { GeneralQuery } from "#/lib/query/general";
import { AudioButton } from "./AudioButton";
import { useNoteContext } from "./Context";
import { EditButton } from "./EditButton";
import { PicturePreview } from "./PicturePreview";

const expressionVariant = cva({
  base: {
    lineClamp: "1",
  },
  variants: {
    wordLength: {
      1: { fontSize: "6xl" },
      2: { fontSize: "6xl" },
      3: { fontSize: "6xl" },
      4: { fontSize: "6xl" },
      5: { fontSize: "6xl" },
      6: { fontSize: "5xl" },
      7: { fontSize: "5xl" },
      8: { fontSize: "5xl" },
      9: { fontSize: "4xl" },
      10: { fontSize: "4xl" },
      11: { fontSize: "4xl" },
      12: { fontSize: "3xl" },
      13: { fontSize: "3xl" },
      14: { fontSize: "3xl" },
      15: { fontSize: "3xl" },
      16: { fontSize: "2xl" },
      17: { fontSize: "2xl" },
      18: { fontSize: "xl" },
      19: { fontSize: "xl" },
      20: { fontSize: "xl" },
      21: { fontSize: "lg" },
      22: { fontSize: "lg" },
      23: { fontSize: "lg" },
      default: { fontSize: "md" },
    },
  },
});

export function AnkiCard() {
  const { HttpServerUrlQuery } = GeneralQuery;
  const note = useNoteContext();
  const time = () => formatRelative(new Date(note.id), new Date());
  type TextVariant = RecipeVariantProps<typeof expressionVariant>;
  const mediaUrlQuery = HttpServerUrlQuery.mediaUrl.use(
    () => note.sentenceAudio,
    () => "anki",
  );
  const sentenceAudioSrc = () => mediaUrlQuery.data ?? "";

  return (
    <Stack
      borderColor="border.default"
      borderWidth="thin"
      p="4"
      rounded="md"
      bg="bg.muted"
      shadow="sm"
      w="full"
      maxW="4xl"
    >
      <HStack gap="4">
        <Stack
          flex="1"
          alignItems="center"
          p="2"
          rounded="md"
          bg="bg.subtle"
          h="full"
          justifyContent="center"
        >
          <Text
            class={expressionVariant({
              wordLength: note.expression.length.toString(),
            } as TextVariant)}
          >
            {note.expression}
          </Text>
          <Show when={note.sentenceAudio}>
            <Suspense>
              <AudioButton src={sentenceAudioSrc()} />
            </Suspense>
          </Show>
        </Stack>
        <Show when={note.picture}>
          <PicturePreview />
        </Show>
      </HStack>
      <Stack>
        <HStack gap="4" justifyContent="space-between" alignItems="end">
          <HStack>
            <Button size="sm">Open in Anki</Button>
            <EditButton />
          </HStack>

          <Text size="xs" color="fg.muted">
            {time()}
          </Text>
        </HStack>
      </Stack>
    </Stack>
  );
}
