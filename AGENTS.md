# AGENTS

## Project conventions
- Package manager: `bun`
- Frontend stack: `React + TypeScript + Vite`
- Build command: `bun run build`
- Dev command: `bun run dev`
- Lint command: `bun run lint`

## Runtime requirements
- Chart rendering requires `scattergl` support.
- Keep Plotly integration compatible with browser runtime; avoid Node-only globals in client bundles.

## Release pipeline
- Tag push triggers GitHub Actions workflow at `.github/workflows/release-www.yml`.
- The workflow builds static files, packages `dist` as `www.zip`, and uploads it to the GitHub Release.

## Notes for future edits
- Prefer minimal, targeted diffs.
- Preserve existing static output behavior expected by cpp-httplib.
- Keep gzip artifact generation enabled in the build pipeline.
