type ModuleValue = {
  __isHMR: true;
};
type ModuleAccessor = (value?: ModuleValue) => ModuleValue;
type HmrModule = Record<string, ModuleAccessor>;
type Cleanup = (() => Promise<void>) | (() => void);
type Effect = (() => Promise<Cleanup>) | (() => Cleanup);

import "./setEnv";
import { Roarr as log } from "roarr";

class HMR {
  vault = new Map<symbol, ModuleValue>();
  store = new Map<string, HmrModule>();
  effects = new Map<string, Cleanup[]>();

  module<T>(initialValue: T): {
    (): T;
    (value: T): void;
  };

  module<T>(initialValue: T) {
    const key = Symbol();
    (initialValue as ModuleValue).__isHMR = true;
    this.vault.set(key, initialValue as ModuleValue);
    return (...args: [T] | []) => {
      if (args.length > 0) {
        (args[0] as ModuleValue).__isHMR = true;
        this.vault.set(key, args[0] as ModuleValue);
        return;
      }
      return this.vault.get(key) as T;
    };
  }

  log(url: string) {
    log.trace({ namespace: "HMR" }, `Importing ${url}`);
  }

  async register<M extends Record<string, any>>(meta: ImportMeta) {
    const url = meta.url;
    const module = (
      !this.store.has(url)
        ? await import(
            /* @vite-ignore */
            url
          )
        : this.store.get(url)
    ) as M;
    if (!this.store.has(url)) {
      this.update(meta, module);
    }
    return module;
  }

  update(meta: ImportMeta, module: HmrModule | undefined) {
    const url = typeof meta === "string" ? meta : meta.url;
    if (!module) return;
    const stored = this.store.get(url);

    if (!stored) {
      // store initial
      this.store.set(url, module);
    } else {
      // merge new keys
      for (const key of Object.keys(module)) {
        if (!Object.hasOwn(stored, key) && module[key]) {
          stored[key] = module[key];
        }
      }
      // remove missing keys
      for (const key of Object.keys(stored)) {
        if (!Object.hasOwn(module, key)) {
          if (stored[key] && (stored[key] as unknown as ModuleValue).__isHMR)
            stored[key](undefined);
        }
      }
      // update existing
      for (const key of Object.keys(module)) {
        if (stored[key] && module[key]) {
          if (module.__isHMR) {
            stored[key](module[key]());
          }
        }
      }
    }
  }

  async runEffect(url: string, effect: Effect) {
    // dispose previous effects for this url before re-running
    this.dispose(url);

    const cleanups: Cleanup[] = [];
    const cleanup = await effect();
    if (cleanup) cleanups.push(cleanup);

    this.effects.set(url, cleanups);
  }

  async dispose(url: string) {
    for (const cleanup of this.effects.get(url) || []) {
      await cleanup();
    }

    this.effects.delete(url);
  }
}

declare global {
  var hmr: HMR;
}
global.hmr = new HMR();
hmr.log(import.meta.url);
