# Alpha Custom Installer — Architecture

## Overview

The Windows setup is split into **two Electron applications**:

| Artifact | Role |
|----------|------|
| `Installer.exe` | Small branded shell (React UI) that copies files and creates shortcuts |
| `Alpha.exe` | The actual ERP desktop app (your existing Vite + Electron build) |

The classic NSIS wizard UI is **not** shown to users. NSIS may still be used internally by electron-builder for portable packaging of `Installer.exe`, but all user-facing steps are custom React screens.

## Layers

```
┌─────────────────────────────────────────┐
│  React UI (installer-app/src)           │
│  Splash → Welcome → Progress → Done     │
│  Framer Motion + Tailwind               │
└─────────────────┬───────────────────────┘
                  │ IPC (contextBridge)
┌─────────────────▼───────────────────────┐
│  Electron main (installer-app/electron) │
│  Window, dialogs, progress events       │
└─────────────────┬───────────────────────┘
                  │
┌─────────────────▼───────────────────────┐
│  installEngine.cjs                      │
│  Copy payload → shortcuts → metadata    │
└─────────────────┬───────────────────────┘
                  │
┌─────────────────▼───────────────────────┐
│  resources/payload/  (= win-unpacked)   │
│  Alpha.exe + runtime from main app build│
└─────────────────────────────────────────┘
```

## IPC channels

| Channel | Direction | Purpose |
|---------|-----------|---------|
| `installer:get-defaults` | invoke | Default path, version, payload location |
| `installer:browse-path` | invoke | Folder picker |
| `installer:start` | invoke | Run installation |
| `installer:cancel` | invoke | Abort copy |
| `installer:progress` | event | Stage + percent updates |
| `installer:launch` | invoke | Start Alpha.exe after install |
| `installer:quit` | invoke | Close installer |

## Install stages

1. **Preparing files** — validate payload, create target directory  
2. **Extracting packages** — recursive copy with byte progress  
3. **Installing components** — desktop / Start Menu shortcuts (PowerShell COM)  
4. **Finalizing installation** — write `.alpha-install.json` metadata  

## Build pipeline

```bash
npm run electron:build:installer
```

1. `installer:assets` — icons + NSIS bitmaps (legacy optional installer)  
2. `vite build` — main ERP app  
3. `electron-builder --config electron-builder.dir.json` → `release/win-unpacked`  
4. `prepare-installer-payload.mjs` → `installer-app/resources/payload`  
5. `vite build` (installer-app)  
6. `electron-builder --config electron-builder.installer.json` → `release/Installer.exe`  

## Development

```bash
# Terminal 1 — build main app unpacked once
npm run build
npx electron-builder --config electron-builder.dir.json --win

# Copy payload + run installer UI
npm run installer:prepare-payload
npm run installer:electron:dev
```

## NSIS note

`electron-builder.installer.json` uses the **portable** target so the output is a single `Installer.exe`. The NSIS engine only wraps the portable stub; it does **not** render the old welcome/finish wizard pages. For a fully silent wrapper, you can switch to `dir` + zip distribution later.
