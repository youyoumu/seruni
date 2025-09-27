type Signal = (value?: any) => any;
type Module = Record<string, Signal>;

class HMR {
  store = new Map<string, Module>();

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
      for (const key of Object.keys(module)) {
        if (typeof module[key] !== "function") {
          //TODO: use logger
          console.error(`Exported module ${key} from ${url} is not a signal`);
          process.exit(1);
        }
      }
      this.store.set(url, module);
    } else {
      for (const key of Object.keys(module)) {
        if (!Object.hasOwn(stored, key) && module[key]) {
          stored[key] = module[key];
        }
      }
      for (const key of Object.keys(stored)) {
        if (!Object.hasOwn(module, key)) {
          if (stored[key]) stored[key](undefined);
        }
      }
      for (const key of Object.keys(module)) {
        if (stored[key] && module[key]) {
          if (typeof module[key] !== "function") {
            //TODO: use logger
            console.warn(`Exported module ${key} from ${url} is not a signal`);
            stored[key](module[key]);
          } else {
            stored[key](module[key]());
          }
        }
      }
    }
  }
}

export const hmr = new HMR();
