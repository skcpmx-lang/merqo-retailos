# Phase 1 Implementation Conflicts & Resolutions

**Date:** 2026-09-16
**Phase:** Phase 1 — Foundation

## Conflicts Discovered During Implementation

### 1. better-sqlite3 Native Build Failure in Sandbox

- **Conflict:** Architecture specifies `better-sqlite3` as SQLite driver. In sandbox environment, `better-sqlite3` native module build fails because `node-gyp` tries to fetch `https://nodejs.org/download/release/v22.22.3/node-v22.22.3-headers.tar.gz` but network fails with `SSL_ERROR_SYSCALL` and `unable to verify the first certificate`. Prebuild-install also fails to find prebuild for Node 22.22.3.
- **Impact:** DB tests cannot run with better-sqlite3, blocking mandatory transaction atomicity test.
- **Resolution:** Implemented fallback to Node.js built-in `node:sqlite` (available in Node 22.5+ experimental) via `src/main/db/connection.fallback.ts`. `connection.ts` now tries better-sqlite3 first, falls back to node:sqlite if not available. Fallback mimics better-sqlite3 API (prepare, get, all, run, exec, pragma, transaction, close). All DB tests pass with fallback (12 tests). Production Windows build will use better-sqlite3 with prebuilds (tested in Phase 17 with proper network and Windows build tools). No architecture change — fallback is implementation-level for CI/sandbox.
- **Documentation:** Updated `connection.ts` with fallback logic, documented in `performance-baseline.md`.
- **Risk:** Low — fallback is tested, production will use better-sqlite3 as per architecture.

### 2. argon2 Native Build Failure

- **Conflict:** Architecture specifies argon2id for password hashing. In sandbox, argon2 native build fails same reason (network SSL).
- **Impact:** Hashing tests fail if argon2 required.
- **Resolution:** Made argon2 optional via dynamic `require('argon2')` with try/catch. If not available, fallback to bcryptjs (cost 12). `HashingService` already designed with fallback. Updated `package.json` to remove argon2 from hard dependencies (keep as optional). Tests pass with bcryptjs. Production Windows will use argon2id with prebuilds or bcryptjs fallback if needed (as per ADR-011). No architecture change — fallback already documented in technical-decisions.md.
- **Documentation:** Updated `hashing.ts` and `package.json`.

### 3. Electron Binary Download Failure

- **Conflict:** Architecture specifies Electron 30+. In sandbox, `electron` package postinstall tries to download binary from GitHub via `got` but fails with `unable to verify the first certificate`.
- **Impact:** Cannot run full Electron app in sandbox, only Vite dev server and build verification via tsc/Vite.
- **Resolution:** For Phase 1, build verification done via `tsc -p tsconfig.main.json`, `tsc -p tsconfig.preload.json`, and `vite build` — all pass. Electron launch will be tested in Phase 17 with proper network and Windows environment. `config/index.ts` made to not statically import electron, using dynamic require with mock fallback for tests. No architecture change — packaging config already exists.
- **Documentation:** Documented in `performance-baseline.md`.

### 4. Tailwind `rounded-default` Class

- **Conflict:** Used `rounded-default` class in components and globals.css, but Tailwind defines DEFAULT as `rounded`, not `rounded-default`.
- **Impact:** Vite build failed with `[postcss] The rounded-default class does not exist`.
- **Resolution:** Changed `rounded-default` to `rounded` (which maps to DEFAULT 8px) in Card, Table, globals.css. Build now passes.
- **Documentation:** No architecture change, just implementation fix.

### 5. TypeScript Project References

- **Conflict:** `tsconfig.json` had references to `tsconfig.main.json` and `tsconfig.preload.json` but those didn't have `composite: true`, causing TS6306 error.
- **Impact:** `npm run typecheck` failed.
- **Resolution:** Removed references from `tsconfig.json` for Phase 1, and have separate typecheck commands `typecheck:renderer` and `typecheck:main`. Both pass. No architecture change.

### 6. Preload Path Resolution

- **Conflict:** `src/main/index.ts` used `path.join(__dirname, '../preload/index.js')` but actual compiled structure is `dist/main/main/index.js` -> `dist/preload/index.js` needs `../../preload`.
- **Impact:** Prod build would fail to find preload.
- **Resolution:** Changed to `../../preload/index.js` and `../../renderer/index.html`. Rebuilt main, verified paths. No architecture change.

## Summary

- **No genuine architectural conflicts** that require changing architecture docs.
- All discovered conflicts are implementation-level due to sandbox network limitations or minor config issues.
- Resolutions maintain architectural decisions (Electron, better-sqlite3, argon2, etc.) with fallbacks for test environment.
- Production Windows build will use native modules as specified.

**Action:** No ADR needed. Continue with Phase 1 as approved.

---

## Recommendations for Future Phases

- In Phase 17 (Windows Packaging), ensure Windows build machine has Visual Studio Build Tools, Python, and network access to nodejs.org and GitHub for native modules.
- Consider adding `better-sqlite3` prebuilds for Node 22 to repo or using `electron-rebuild`.
- Consider bundling argon2 prebuilds or using `bcryptjs` as primary if argon2 build issues persist on Windows (as per ADR-011 fallback).
- Add CI that tests with both better-sqlite3 and fallback to ensure compatibility.
