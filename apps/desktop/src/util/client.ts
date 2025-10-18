import { ankiClient } from "#/client/anki";
import { obsClient } from "#/client/obs";
import { textractorClient } from "#/client/textractor";

export async function prepareAllClient() {
  ankiClient().register();
  await Promise.all([
    ankiClient().connect(),
    obsClient().connect(),
    textractorClient().connect(),
  ]);
}
