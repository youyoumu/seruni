import { cp, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { defineConfig } from "vite";
import circularDpendency from "vite-plugin-circular-dependency";

function hmrLogPlugin() {
  return {
    name: "hmr-log-injector",
    enforce: "pre", // run before other transforms
    transform(code: string, id: string) {
      // only affect your source files (skip node_modules, virtual files, etc.)
      if (!id.includes("/src/") || id.includes("node_modules")) return;

      // skip if already has it
      if (code.includes("hmr.log(import.meta)")) return;

      // inject at the very top
      return {
        code: `if (global.hmr) hmr.log(import.meta);\n${code}`,
        map: null,
      };
    },
  };
}

// https://vitejs.dev/config/
export default defineConfig(({ command }) => ({
  plugins: [
    hmrLogPlugin(),
    circularDpendency({
      outputFilePath: "./.circularDependency.json",
      circleImportThrowErr: true,
    }),
  ],
  resolve: {
    alias: {
      "#": resolve(import.meta.dirname, "./src"),
    },
  },
  appType: "custom",
  environments: {
    electron: {
      resolve: {
        builtins: ["electron", /^node:.*/],
        external: command === "build" ? true : undefined,
        noExternal: command === "build" ? true : undefined,
      },
      build: {
        lib: {
          entry: "src/main.ts",
          formats: ["es"], // output ESM for your target
        },
      },
    },
  },
  builder: {
    async buildApp(builder) {
      if (builder.environments.electron) {
        await builder.build(builder.environments.electron);

        const outDir = resolve(import.meta.dirname, "dist");
        await cp(
          resolve(import.meta.dirname, "../../packages/preload/dist/_preload/"),
          resolve(outDir, "_preload"),
          { recursive: true },
        );
        await cp(
          resolve(import.meta.dirname, "../../packages/renderer/dist/"),
          resolve(outDir, "renderer"),
          { recursive: true },
        );
        await cp(
          resolve(import.meta.dirname, "../../packages/python/src/"),
          resolve(outDir, "python/src/"),
          { recursive: true },
        );
        await cp(
          resolve(import.meta.dirname, "../../packages/python/pyproject.toml"),
          resolve(outDir, "python/pyproject.toml"),
          { recursive: true },
        );
        await cp(
          resolve(import.meta.dirname, "../../packages/python/uv.lock"),
          resolve(outDir, "python/uv.lock"),
          { recursive: true },
        );
        await cp(
          resolve(import.meta.dirname, "./drizzle/"),
          resolve(outDir, "drizzle/"),
          { recursive: true },
        );

        const packageJson = JSON.parse(
          await readFile(resolve(import.meta.dirname, "package.json"), "utf-8"),
        );
        const customPkg = {
          name: packageJson.name,
          productName: packageJson.productName,
          version: packageJson.version,
          main: "main.js",
          type: "module",
        };

        await writeFile(
          resolve(outDir, "package.json"),
          JSON.stringify(customPkg, null, 2),
        );
      }
    },
  },
}));
