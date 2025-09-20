renderer +ARGS:
    pnpm --filter @repo/renderer exec pnpm dlx {{ ARGS }}

renderer-add-components +ARGS:
    pnpm --filter @repo/renderer exec pnpm dlx @park-ui/cli components add {{ ARGS }}

desktop +ARGS:
    pnpm --filter desktop exec pnpm dlx {{ ARGS }}

preload +ARGS:
    pnpm --filter @repo/preload exec pnpm dlx {{ ARGS }}
