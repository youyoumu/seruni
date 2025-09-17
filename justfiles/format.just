# Formatting recipes

format:
    pnpm exec biome format --write

format-files +ARGS:
    pnpm exec biome format --write {{ ARGS }}
