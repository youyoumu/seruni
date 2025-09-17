# Check recipes

check:
    pnpm exec biome check --write

check-files +ARGS:
    pnpm exec biome check --write {{ ARGS }}
