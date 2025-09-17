# Linting recipes

lint:
    pnpm exec biome lint --write

lint-files +ARGS:
    pnpm exec biome lint --write {{ ARGS }}
