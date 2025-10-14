import { ankiClient } from "#/client/anki";
import { obsClient } from "#/client/obs";
import { textractorClient } from "#/client/textractor";

export async function prepareAllClient() {
  await Promise.all([
    ankiClient().prepare(),
    obsClient().prepare(),
    textractorClient().prepare(),
  ]);

  ankiClient().monitor();
}
