# Copilot instructions for DoILikeThisSong

This file contains repository-specific guidance for Copilot sessions so assistants can act correctly and efficiently.

## Build, run, and packaging commands
- Install dependencies: `npm install`
- Run app (development): `npm start` (runs `electron .`)
- Package for macOS: `npm run dist` (uses `electron-builder` — configured in package.json; targets: dmg, zip)

Notes:
- There are no automated tests or lint scripts in this repository.
- To run a specific JS file for quick checks, run `node <path>` from the repo root (no test harness available).

## High-level architecture
- Electron desktop app (macOS-focused).
- main.js: main process — creates BrowserWindow, handles IPC, reads directories, moves files, and fetches metadata.
- preload.js: exposes a small safe API on `window.api` (selectFolder, readAudioFiles, getMetadata, moveRatedFiles) using contextBridge.
- src/: renderer assets (index.html, renderer.js, styles.css). Renderer talks to the main process via `window.api`.
- package.json: declares `main: main.js`, runtime `dependencies` (music-metadata) and devDependencies (`electron`, `electron-builder`). `build` section configures packaging.

## Key conventions and project-specific patterns
- IPC API surface is intentionally minimal and namespaced under `window.api` in preload.js. Use those exact method names in renderer code.
- Audio files are discovered by main.js using this regex: `\.(mp3|m4a|flac|wav|ogg|aac|opus)$` (case-insensitive). Keep changes consistent if extending support.
- Ratings are stored as an object keyed by absolute file path and values `"up"` or `"down"`. Confirmed ratings are moved into subfolders named `liked` and `disliked` inside the chosen music folder.
- Cover art/cache: main process writes cached covers under Electron's `app.getPath('userData')/cover-cache` and returns either inline data URLs or `coverPath` file URIs.
- Metadata: uses `music-metadata` first; if no embedded artwork, falls back to iTunes Search API lookup and saves a cached image when found.
- Security: BrowserWindow is created with `contextIsolation: true` and `nodeIntegration: false`. Prefers `preload.js` for safe IPC bridging — follow this pattern for new renderer <-> main interactions.

## Files to inspect first when changing behavior
- main.js — core file IO, metadata, and IPC handlers.
- preload.js — API surface exported to renderer.
- src/renderer.js — UI logic, playback, rating UI, and use of `window.api`.
- package.json — scripts and electron-builder configuration.

## Other assistant/CI files
- No CLAUDE.md, AGENTS.md, .cursorrules, .windsurfrules, CONVENTIONS.md, or other AI-assistant config files were found.

