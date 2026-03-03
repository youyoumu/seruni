import { R } from "@praha/byethrow";

export class FetchError extends Error {
  response: Response;
  constructor(message: string, response: Response) {
    super(message);
    this.name = "FetchError";
    this.response = response;
  }
}

export function anyFail(message: string, cause?: Error) {
  return R.fail(new Error(message, { cause }));
}

export function anyCatch(fallbackMessage: string) {
  return (e: unknown) => {
    return e instanceof Error ? e : Error(fallbackMessage, { cause: e });
  };
}

export const safeJSONParse = R.fn({
  try: (text: string) => JSON.parse(text) as unknown,
  catch: (e) => (e instanceof Error ? e : new Error("Error when parsing JSON")),
});

export const safeFetch = R.fn({
  try: async (url: string) => {
    const response = await fetch(url);
    if (!response.ok) {
      throw new FetchError(`Failed to fetch: ${response.status} ${response.statusText}`, response);
    }
    return response;
  },
  catch: (e) => (e instanceof Error ? e : new Error("Error when fetching")) as Error | FetchError,
});
