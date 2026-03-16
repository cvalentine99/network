# Task Completion Checklist

When a task is completed, run these steps:

1. npx tsc --noEmit — Verify TypeScript compiles clean
2. pnpm test — Run full Vitest test suite (2720+ tests across 40 files)
3. Verify no regressions in existing slice tests
4. Update todo.md — Mark completed items as [x]
5. Write truth receipt (SLICE-NN-RECEIPT.md) if slice work
6. Save checkpoint via webdev_save_checkpoint