import { createEffect } from "solid-js";

export const inspect = (accessor: () => unknown) => {
  createEffect(() => {
    console.log(accessor());
  });
};

export function parseAnkiMediaPath(fieldValue: string) {
  const imageRegex = /<img\s+[^>]*src=["']([^"']+)["']/i;
  const soundRegex = /\[sound:([^\]]+)\]/i;

  const imageMatch = fieldValue.match(imageRegex);
  const soundMatch = fieldValue.match(soundRegex);

  return imageMatch?.[1] ?? soundMatch?.[1] ?? "";
}
