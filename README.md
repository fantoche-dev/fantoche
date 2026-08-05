# Fantoche _(working title)_

**Anyone — or any agent — can make a vector character explain something on
video.** Open source (MIT), open document format, local-first, video-first.

> **Status: P0 — fork & foundation.** This is a community fork of
> [Revideo](https://github.com/midrender/revideo) (itself an MIT fork of
> [Motion Canvas](https://github.com/motion-canvas/motion-canvas)). At this
> stage it is Revideo with telemetry removed and a new identity; the product
> layers (declarative document, characters, narration timeline, editor) land in
> later phases — see [docs/05-roadmap.md](docs/05-roadmap.md).

## Why this exists

The design rationale, verified research, and founding decisions live in
[docs/](docs/): research (`01`), vision (`02`), architecture (`03`), roadmap
(`05`), and ADRs (`docs/adr/`).

## Development

Requires Node ≥ 22.12.

```bash
npm ci
npm install --no-save @ffmpeg-installer/ffmpeg @ffprobe-installer/ffprobe
npx puppeteer browsers install chrome     # for rendering/e2e
npx lerna run build --ignore @fantoche-dev/docs
npx lerna run test
npm run template:render                   # renders packages/template to mp4
```

## Attribution

Fantoche stands on two excellent MIT projects: **Motion Canvas** by Jacob
Bielecki and contributors, and **Revideo** by Haven Technologies (Justus
Mattern, Konstantin Höhne) and contributors. The original Revideo README is
preserved at [docs/UPSTREAM-REVIDEO-README.md](docs/UPSTREAM-REVIDEO-README.md).

## License

MIT — see [LICENSE](LICENSE).
