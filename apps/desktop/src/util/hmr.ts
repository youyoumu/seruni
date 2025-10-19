import "./setEnv";

type AnyValue = any;
type HmrModule = Record<string, AnyValue>;

class HMR {
  #vault = new Map<symbol, AnyValue>();
  #modules = new Map<string, HmrModule>();
  #getters = new Set<() => void>();
  #key = Symbol();

  log(meta: ImportMeta) {
    if (import.meta.hot)
      console.log(`\x1b[36m[HMR]\x1b[0m: Importing \x1b[33m${meta.url}\x1b[0m`);
  }

  module<T>(initialValue: T): () => T {
    const key = Symbol();
    this.#vault.set(key, initialValue);
    const getter = (...args: [T] | []) => {
      if (args.length > 0) {
        //@ts-expect-error hmr check
        if (args[1] === this.#key) {
          const vault = this.#vault.set(key, args[0]);
          return vault.get(key);
        }
        throw new Error("Only HMR can update the module value");
      }
      return this.#vault.get(key) as T;
    };
    this.#getters.add(getter);
    return getter;
  }

  async register<M extends HmrModule>(meta: ImportMeta, module?: M) {
    if (!module) {
      module = (
        !this.#modules.has(meta.url)
          ? await import(
              /* @vite-ignore */
              meta.url
            )
          : this.#modules.get(meta.url)
      ) as M;
    }
    if (!this.#modules.has(meta.url)) {
      this.update(meta, module);
    }
    return module;
  }

  update(meta: ImportMeta, newModule: HmrModule | undefined) {
    if (!newModule) return;
    const module = this.#modules.get(meta.url);

    if (!module) {
      // module initial
      this.#modules.set(meta.url, newModule);
    } else {
      // merge new keys
      for (const key of Object.keys(newModule)) {
        if (!Object.hasOwn(module, key) && newModule[key]) {
          module[key] = newModule[key];
        }
      }
      // remove missing keys
      for (const key of Object.keys(module)) {
        if (
          module[key] &&
          !Object.hasOwn(newModule, key) &&
          this.#getters.has(module[key])
        ) {
          module[key](undefined, this.#key);
        }
      }
      // update existing
      for (const key of Object.keys(newModule)) {
        if (module[key] && newModule[key] && this.#getters.has(module[key])) {
          module[key](newModule[key](), this.#key);
        }
      }
    }
  }
}

declare global {
  var hmr: HMR;
}
global.hmr = new HMR();
hmr.log(import.meta);
