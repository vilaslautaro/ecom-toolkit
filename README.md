# Ecom Toolkit

A bookmarklet you drag to your bookmarks bar. It does two different things depending on where you click it:

- **Meta Ad Library** — downloads the creatives (video or image) behind a search, filtering by how many times the brand reuses the same ad, by type, by total count, and discarding the ones with low impressions.
- **Shopify stores** — shows the top 3 best sellers, how many products the store carries, its price range and how long it has been publishing; and downloads the images and videos on the page.

Everything runs in your browser against public data. There is no server, no account, and nothing is sent anywhere.

**[ecom-toolkit-script.vercel.app](https://ecom-toolkit-script.vercel.app)**

## How to use it

1. Open the page and drag the blue button to your bookmarks bar. If the bar is hidden: `Ctrl+Shift+B` on Windows and Linux, `Cmd+Shift+B` on macOS.
2. Go to a Shopify store or to the Ad Library and click the bookmark. The panel appears in the top right corner.

Before the first download, open your browser's **Downloads** settings, choose a destination folder and turn off the "ask where to save each file" option (`Preguntar dónde guardar cada archivo` in a Spanish browser). If the browser shows the `¿Permitir descargar varios archivos?` prompt — its multiple-downloads warning — accept it: otherwise the log will claim everything was downloaded and no file will show up.

## How files are named

```
4_ads_27_6_26_lamarca_1652452402393518.mp4
```

| Part | What it is |
| --- | --- |
| `4_ads` | how many ads use that same creative (how hard the brand is scaling it) |
| `27_6_26` | how long it has been in circulation |
| `lamarca` | the brand, inferred from the search term or from the advertiser |
| `1652452402393518` | the ad library ID |

## Development

You need Node >= 20.

```bash
npm install
npm run serve
```

### Tests

```bash
npm test
```

| Command | What it runs |
| --- | --- |
| `npm run test:unit` | Vitest over jsdom: unit tests per module, plus integration tests over the generated `index.html` |
| `npm run test:e2e` | Playwright: the generator page, and the bookmarklet running in Chromium against an intercepted Ad Library |
| `npm run test:adlib` | Smoke test against the **real** Ad Library. Opt-in, excluded from CI |
| `npm run test:visual` | Playwright screenshots: the generator page and both injected panels, compared against the committed baselines |
| `npm run test:visual:update` | Regenerates those baselines |

The e2e suite never touches Facebook: `page.route()` answers the Ad Library URL with a fixture, so the bookmarklet runs believing it is there. The only one that reaches the internet is `test:adlib`, which is off by default and exists for when Meta changes its DOM and you need to know whether the problem is ours or theirs.

### Visual regression

Four baselines live next to their specs in `tests/visual/`: the generator page at 1280x800 and at 375x812, the Ad Library panel, and the Shopify store panel. They are PNGs and they are committed.

A screenshot only matches the machine that took it, so **the baselines are rendered on Linux, inside the official Playwright image, never on your own machine**. Both npm commands do that for you — they need Docker running, and nothing else:

```bash
npm run test:visual          # compare against the baselines
npm run test:visual:update   # rewrite the baselines, then review the diff before committing
```

Both start `mcr.microsoft.com/playwright:v1.62.1-noble`, the image that matches the Playwright version in `package.json`, mount the repository at `/work` and install with `npm ci` inside the container. Your `node_modules` is deliberately left out of the mount: it holds native binaries built for your OS. CI runs the same suite in the same image, so a baseline that passes locally passes there.

The suite has its own Playwright project, `visual`, kept out of `npx playwright test` so the e2e run stays fast. Set `VISUAL_SNAPSHOTS=1` if you want to reach it by hand.

Screenshots go stale for real reasons and for silly ones. The silly ones are already handled: animations are off, the SHA-256 fingerprint at the foot of the page is masked because it changes with every code change, dates come from fixtures rendered in a fixed locale and timezone, and every capture waits for fonts and images. If a baseline changes after a UI change, that is the suite doing its job — regenerate it and look at the diff.

## Contributing

The project is MIT and accepts PRs. Read [CONTRIBUTING.md](CONTRIBUTING.md) before your first one: it covers the branch, commit and test conventions, and what falls inside the scope and what does not.

Two rules worth knowing up front:

- If you fix a bug, it ships with a regression test.
- Nobody deploys by hand. Merging to `main` is deploying.

## License

[MIT](LICENSE) — Lautaro Vilas
