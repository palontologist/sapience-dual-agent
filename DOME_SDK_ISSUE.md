# Dome SDK Module Resolution Issue - Context Save

## What We're Working On

Fixing a module resolution error in the `@dome-api/sdk` package that prevents the Dome SDK from loading.

## The Problem

```
Error: Cannot find module '/home/palontologist/Downloads/dev/sapience-dual-agent/node_modules/.pnpm/@dome-api+sdk@1.0.2_bufferutil@4.1.0_utf-8-validate@5.0.10_zod@3.23.8/node_modules/@polymarket/builder-relayer-client/dist/builder/derive' imported from .../dist/esm/utils/safe.js
Did you mean to import "@polymarket/builder-relayer-client/dist/builder/derive.js"?
```

The Dome SDK is trying to import `@polymarket/builder-relayer-client/dist/builder/derive` without the `.js` extension, which fails in ESM mode.

## Root Cause

- The Dome SDK at `node_modules/.pnpm/@dome-api+sdk@1.0.2_.../node_modules/@dome-api/sdk/dist/esm/utils/safe.js` has:
  ```js
  import { deriveSafe } from "@polymarket/builder-relayer-client/dist/builder/derive";
  ```
- This import without `.js` extension fails in Node.js ESM
- The actual file exists at `node_modules/.pnpm/@polymarket+builder-relayer-client@0.0.6_.../node_modules/@polymarket/builder-relayer-client/dist/builder/derive.js`

## What We've Tried

1. Added `"type": "module"` to package.json
2. Added import maps in package.json (didn't work)
3. Changed tsconfig `moduleResolution` from "bundler" to "node16"
4. Updated Dome SDK from 0.18.0 to 1.0.2 (same issue persists)
5. Attempted to patch safe.js with relative path (path depth was wrong)

## Current Status

We were attempting to patch the path depth. The last attempt was:

```js
// Original (broken):
import { deriveSafe } from "@polymarket/builder-relayer-client/dist/builder/derive";

// Attempted fix:
import { deriveSafe } from "../../../../@polymarket+builder-relayer-client@0.0.6_bufferutil@4.1.0_utf-8-validate@5.0.10_zod@3.23.8/node_modules/@polymarket/builder-relayer-client/dist/builder/derive.js";
```

The path `../../../../` goes:

1. `..` from `dist/esm/utils/` to `dist/esm/`
2. `..` from `dist/esm/` to `dist/`
3. `..` from `dist/` to root of sdk package
4. `..` from sdk root to .pnpm directory

But this is incorrect because we need to reach `node_modules/.pnpm/` which is at the root of the project, not inside the sdk's .pnpm folder.

## Correct Fix Options

### Option 1: Direct Patch (Recommended)

Edit `node_modules/.pnpm/@dome-api+sdk@1.0.2_.../node_modules/@dome-api/sdk/dist/esm/utils/safe.js`:

```js
// Use absolute path to the derive.js file
import { deriveSafe } from "/absolute/path/to/project/node_modules/.pnpm/@polymarket+builder-relayer-client@0.0.6_bufferutil@4.1.0_utf-8-validate@5.0.10_zod@3.23.8/node_modules/@polymarket/builder-relayer-client/dist/builder/derive.js";
```

### Option 2: Symlink

Create a symlink in the expected location:

```bash
ln -s node_modules/.pnpm/@polymarket+builder-relayer-client@0.0.6_.../node_modules/@polymarket/builder-relayer-client/dist/builder/derive \
      node_modules/.pnpm/@dome-api+sdk@1.0.2_.../node_modules/@polymarket/builder-relayer-client/dist/builder/derive
```

### Option 3: Use Wrapper Client

The existing `src/utils/dome-client.ts` already has a wrapper that uses Axios directly:

- It doesn't require the broken SDK import
- Uses REST API calls to Dome API
- Works independently of the SDK's internal dependencies

## Key Files

- Problem file: `node_modules/.pnpm/@dome-api+sdk@1.0.2_.../node_modules/@dome-api/sdk/dist/esm/utils/safe.js`
- Actual derive.js: `node_modules/.pnpm/@polymarket+builder-relayer-client@0.0.6_.../node_modules/@polymarket/builder-relayer-client/dist/builder/derive.js`
- Our wrapper: `src/utils/dome-client.ts`
- Test script: `src/test-dome-groq.ts`

## Test Command

```bash
pnpm test:dome
```

## Next Steps When Resuming

1. Fix the import path in safe.js with the correct absolute path
2. Run `pnpm test:dome` to verify
3. If that works, test the forecasting agent integration
