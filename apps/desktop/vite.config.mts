import { cp, readFile, writeFile } from "node:fs/promises";
import { builtinModules } from "node:module";
import { resolve } from "node:path";
import { execa } from "execa";
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
  server: {
    watch: {
      ignored: ["**/.userData/**"],
    },
  },
  appType: "custom",
  environments: {
    electron: {
      resolve: {
        builtins: ["electron", /^node:.*/],
        external: ["electron", ...builtinModules],
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
        const copyTasks: [string, string][] = [
          ["../../packages/preload/dist/_preload/", "_preload"],
          ["../../packages/renderer/dist/", "renderer"],
          ["../../packages/python/src/", "python/src/"],
          ["../../packages/python/pyproject.toml", "python/pyproject.toml"],
          ["../../packages/python/uv.lock", "python/uv.lock"],
          ["./drizzle/", "drizzle/"],
        ];
        for (const [src, dest] of copyTasks) {
          await cp(resolve(import.meta.dirname, src), resolve(outDir, dest), {
            recursive: true,
          });
        }

        const packageJson = JSON.parse(
          await readFile(resolve(import.meta.dirname, "package.json"), "utf-8"),
        );
        const customPkg = {
          name: packageJson.name,
          productName: packageJson.productName,
          version: packageJson.version,
          main: "main.js",
          type: "module",
          dependencies: {
            "@libsql/linux-x64-gnu": "0.5.22",
            "@libsql/win32-x64-msvc": "0.5.22",
            "@roarr/cli": "5.12.4",
          },
        };
        await writeFile(
          resolve(outDir, "package.json"),
          JSON.stringify(customPkg, null, 2),
        );

        await writeFile(resolve(outDir, ".npmrc"), "node-linker=hoisted");
        const cwd = process.cwd();
        process.chdir(outDir);
        await execa(
          "pnpm",
          ["install", "--prod", "--ignore-workspace", "--no-lockfile"],
          { stdio: "inherit" },
        );
        process.chdir(cwd);
      }
    },
  },
}));
