type ModuleValue = any;
type HmrModule = Record<string, ModuleValue>;
type Cleanup = (() => Promise<void>) | (() => void);
type Effect = (() => Promise<Cleanup>) | (() => Cleanup);

import "./setEnv";
import { Roarr as log } from "roarr";

class HMR {
  vault = new Map<symbol, ModuleValue>();
  store = new Map<string, HmrModule>();
  accessors = new Map<() => void, true>();
  effects = new Map<string, Cleanup[]>();

  module<T>(initialValue: T): {
    (): T;
    (value: T): void;
  };

  module<T>(initialValue: T) {
    const key = Symbol();
    this.vault.set(key, initialValue);
    const accessor = (...args: [T] | []) => {
      if (args.length > 0) {
        this.vault.set(key, args[0]);
        return;
      }
      return this.vault.get(key) as T;
    };
    this.accessors.set(accessor, true);
    return accessor;
  }

  m<M extends Record<string, ModuleValue>>(meta: ImportMeta) {
    return this.store.get(meta.url) as M;
  }

  log(meta: ImportMeta) {
    log.trace({ namespace: "HMR" }, `Importing ${meta.url}`);
  }

  async register<M extends Record<string, any>>(
    meta: ImportMeta,
    module?: HmrModule,
  ) {
    if (!module) {
      module = (
        !this.store.has(meta.url)
          ? await import(
              /* @vite-ignore */
              meta.url
            )
          : this.store.get(meta.url)
      ) as M;
    }
    if (!this.store.has(meta.url)) {
      this.update(meta, module);
    }
    return module;
  }

  update(meta: ImportMeta, module: HmrModule | undefined) {
    if (!module) return;
    const stored = this.store.get(meta.url);

    if (!stored) {
      // store initial
      this.store.set(meta.url, module);
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
          if (stored[key] && this.accessors.has(stored[key]))
            stored[key](undefined);
        }
      }
      // update existing
      for (const key of Object.keys(module)) {
        if (stored[key] && module[key]) {
          if (this.accessors.has(stored[key])) {
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
hmr.log(import.meta);
