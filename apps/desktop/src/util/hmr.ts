type Signal = (value?: any) => any;
type Module = Record<string, Signal>;
type Cleanup = (() => Promise<void>) | (() => void);
type Effect = (() => Promise<Cleanup>) | (() => Cleanup);

import "./setEnv";
import chalk from "chalk";
import { Roarr as log } from "roarr";

class HMR {
  store = new Map<string, Module>();
  effects = new Map<string, Cleanup[]>();

  m<M extends Module>(url: string) {
    return this.store.get(url) as M;
  }

  log(url: string) {
    log.trace({ namespace: "HMR" }, chalk.blue(`Importing ${url}`));
  }

  async register(url: string) {
    if (this.store.has(url)) return;
    const module = await import(
      /* @vite-ignore */
      url
    );
    this.update(url, module);
  }

  update(url: string, module: Module | undefined) {
    if (!module) return;
    const stored = this.store.get(url);

    if (!stored) {
      // validate & store initial
      for (const key of Object.keys(module)) {
        if (typeof module[key] !== "function") {
          //TODO: use logger
          log.error(`Exported module ${key} from ${url} is not a signal`);
          process.exit(1);
        }
      }
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
          if (stored[key]) stored[key](undefined);
        }
      }
      // update existing
      for (const key of Object.keys(module)) {
        if (stored[key] && module[key]) {
          if (typeof module[key] !== "function") {
            //TODO: use logger
            log.warn(`Exported module ${key} from ${url} is not a signal`);
            stored[key](module[key]);
          } else {
            stored[key](module[key]());
          }
        }
      }
      return stored;
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
