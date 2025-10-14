import { ankiClient } from "#/client/anki";
import { obsClient } from "#/client/obs";
import { textractorClient } from "#/client/textractor";

hmr.log(import.meta);

export async function prepareAllClient() {
  await Promise.all([
    ankiClient().connect(),
    obsClient().connect(),
    textractorClient().connect(),
  ]);
}
