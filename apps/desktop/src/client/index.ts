import { ankiClient } from "./anki";
import { obsClient } from "./obs";
import { textractorClient } from "./textractor";

export * from "./anki";
export * from "./obs";
export * from "./textractor";

export async function prepareAllClient() {
  await Promise.all([
    ankiClient().prepare(),
    obsClient().prepare(),
    textractorClient().prepare(),
  ]);

  ankiClient().monitor();
}
