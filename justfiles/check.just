# Check recipes

check:
    pnpm exec biome check --max-diagnostics 100

check-fix:
    pnpm exec biome check --write --max-diagnostics 100
