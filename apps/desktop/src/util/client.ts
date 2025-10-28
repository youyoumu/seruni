import { ankiClient } from "#/client/clientAnki";
import { obsClient } from "#/client/clientObs";
import { textractorClient } from "#/client/clientTextractor";

export async function prepareAllClient() {
  ankiClient().register();
  await Promise.all([
    ankiClient().connect(),
    obsClient().connect(),
    textractorClient().connect(),
  ]);
}
