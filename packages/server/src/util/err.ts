import { R } from "@praha/byethrow";

export function errFrom(message: string, cause?: Error) {
  return R.fail(new Error(message, { cause }));
}

export function toErr(fallbackMessage: string) {
  return (e: unknown) => {
    return e instanceof Error ? e : Error(fallbackMessage, { cause: e });
  };
}

export const safeJSONParse = R.fn({
  try: (text: string) => JSON.parse(text) as unknown,
  catch: (e) => (e instanceof Error ? e : new Error("Error when parsing JSON")),
});
