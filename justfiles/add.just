desktop +ARGS:
    pnpm add --filter desktop {{ ARGS }}

renderer +ARGS:
    pnpm add --filter @repo/renderer {{ ARGS }}

preload +ARGS:
    pnpm add --filter @repo/preload {{ ARGS }}
