# Contributing to Fantoche

Thanks for helping! Fantoche is early — the fastest way to help is to pick an
issue labeled `good first issue`, or to open an issue describing what you'd
like to build.

## Ways to contribute (no code required for the first two)

1. **Characters & art** — characters are data (see `docs/03-architecture.md`);
   SVG artists are as valuable as programmers here (from P2 onward).
2. **Docs & examples** — fixes, tutorials, example projects.
3. **TypeScript** — the monorepo (`packages/*`).
4. **C++** — rendering backend work happens upstream in ThorVG first
   (see `docs/adr/0003`), then in our backend seam (from P4 onward).

## Development setup

Node ≥ 22.12 required.

```bash
npm ci
npm install --no-save @ffmpeg-installer/ffmpeg @ffprobe-installer/ffprobe
npx puppeteer browsers install chrome
npx lerna run build --ignore @fantoche/docs
npx lerna run test          # unit tests
npm run e2e:test            # golden-frame tests (linux is the reference env)
npm run template:render     # end-to-end render smoke
```

## Rules of the road

- **Conventional commits** are enforced (commitlint): `feat: …`, `fix: …`,
  `docs: …`, `test: …`, `chore: …`. Breaking changes: `feat!: …`.
- Every PR must keep CI green (Linux + macOS build/test, render smoke,
  golden frames, no-telemetry guard).
- Golden-frame changes must be regenerated on Linux (CI) and explained in
  the PR description.
- Architecture-level changes need an ADR in `docs/adr/` (copy the format of
  the existing ones) — propose it in an issue first.
- No telemetry. The `no-telemetry` CI job enforces this permanently.
