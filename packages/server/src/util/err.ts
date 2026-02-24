import { err, Result } from "neverthrow";

export function errFrom(message: string, cause?: Error) {
  return err(new Error(message, { cause }));
}

export function toErr(fallbackMessage: string) {
  return (e: unknown) => {
    return e instanceof Error ? e : Error(fallbackMessage, { cause: e });
  };
}

export const safeJSONParse = Result.fromThrowable(JSON.parse, (e) =>
  e instanceof Error ? e : new Error("Error when parsing JSON"),
);
