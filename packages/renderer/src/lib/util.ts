import { getOwner, runWithOwner } from "solid-js";

export function useOwner<T>(fn: () => T): T {
  const owner = getOwner();
  return runWithOwner(owner, fn) as T;
}
