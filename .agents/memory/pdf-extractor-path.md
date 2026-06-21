---
name: PDF Extractor Path Resolution
description: How to resolve the Python pdf_extract.py path from bundled ESM TypeScript code.
---

## Problem
After esbuild bundling, `__dirname` in `dist/index.mjs` points to `dist/` — NOT `src/lib/extractors/`. Using `resolve(__dirname, "pdf_extract.py")` finds nothing.

## Solution
Use `process.cwd()` with the same workspace-root logic used elsewhere in the codebase:

```typescript
const _workspaceRoot = process.cwd().endsWith(["artifacts", "api-server"].join("/"))
  || process.cwd().endsWith(["artifacts", "api-server"].join("\\"))
  ? resolve(process.cwd(), "../..")
  : process.cwd();

const PYTHON_SCRIPT = resolve(
  _workspaceRoot,
  "artifacts/api-server/src/lib/extractors/pdf_extract.py",
);
```

**Why:** `pnpm --filter @workspace/api-server run dev` sets `process.cwd()` to the workspace root `/home/runner/workspace`. The Python script stays in `src/lib/extractors/` (not copied to dist).
