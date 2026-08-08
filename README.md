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

The e2e suite never touches Facebook: `page.route()` answers the Ad Library URL with a fixture, so the bookmarklet runs believing it is there. The only one that reaches the internet is `test:adlib`, which is off by default and exists for when Meta changes its DOM and you need to know whether the problem is ours or theirs.

## Contributing

The project is MIT and accepts PRs. Read [CONTRIBUTING.md](CONTRIBUTING.md) before your first one: it covers the branch, commit and test conventions, and what falls inside the scope and what does not.

Two rules worth knowing up front:

- If you fix a bug, it ships with a regression test.
- Nobody deploys by hand. Merging to `main` is deploying.

## License

[MIT](LICENSE) — Lautaro Vilas
