import crypto from "node:crypto";
import { createReadStream } from "node:fs";
import { pipeline } from "node:stream/promises";

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

export async function hashFile(
  filePath: string,
  algorithm: string,
): Promise<R.Result<string, Error>> {
  const hash = crypto.createHash(algorithm);
  try {
    await pipeline(createReadStream(filePath), hash);
    return R.succeed(hash.digest("hex"));
  } catch (error) {
    const cause = error instanceof Error ? error : new Error(String(error));
    return anyFail("Failed to hash file", cause);
  }
}

export const publicKey = `-----BEGIN PUBLIC KEY-----
MCowBQYDK2VwAyEA4BZ8lzAVK2Ne3F3PDzgX5lspV2q6gva2TO+8DiVqqF0=
-----END PUBLIC KEY-----`;

export async function verifySignature(hash: string, signature: string) {
  const verified = crypto.verify(null, Buffer.from(hash), publicKey, Buffer.from(signature, "hex"));
  if (!verified) return anyFail("Signature mismatch");
  return R.succeed();
}
