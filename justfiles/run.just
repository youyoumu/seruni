desktop +ARGS:
    pnpm run --filter desktop {{ ARGS }}

renderer +ARGS:
    pnpm run --filter @repo/renderer {{ ARGS }}

preload +ARGS:
    pnpm run --filter @repo/preload {{ ARGS }}
