import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import fs from "fs-extra";
import { defineConfig } from "vite";

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [],
  resolve: {
    alias: {
      "#": resolve(__dirname, "./src"),
    },
  },
  appType: "custom",
  environments: {
    electron: {
      resolve: {
        builtins: ["electron", /^node:.*/],
        external: true,
        noExternal: true,
      },
      build: {
        lib: {
          entry: "src/main.ts",
          formats: ["es"], // output ESM for your target
        },
      },
      //TODO: this already the default, try createFetchableDevEnvironment later
      // dev: {
      //   createEnvironment(name, config) {
      //     return createRunnableDevEnvironment(name, config);
      //   },
      // },
    },
  },
  builder: {
    async buildApp(builder) {
      if (builder.environments.electron) {
        await builder.build(builder.environments.electron);

        const outDir = resolve(__dirname, "dist");
        await fs.copy(
          resolve(__dirname, "../../packages/preload/dist/_preload/"),
          resolve(outDir, "_preload"),
        );
        await fs.copy(
          resolve(__dirname, "../../packages/renderer/dist"),
          resolve(outDir, "renderer"),
        );
        await fs.copy(
          resolve(__dirname, "../../packages/python/src"),
          resolve(outDir, "python"),
        );

        const packageJson = JSON.parse(
          readFileSync(resolve(__dirname, "package.json"), "utf-8"),
        );
        const customPkg = {
          name: packageJson.name,
          productName: packageJson.productName,
          version: packageJson.version,
          main: "main.js",
          type: "module",
        };

        await fs.writeJSON(resolve(outDir, "package.json"), customPkg, {
          spaces: 2,
        });
      }
    },
  },
});
