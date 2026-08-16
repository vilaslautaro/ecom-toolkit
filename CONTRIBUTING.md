# How to contribute

Thanks for giving Ecom Toolkit a hand. This guide is short on purpose: read it end to end before you send your first PR.

For how the project is put together — the bookmarklet mechanism, the layering, and the constraints that have already broken production — see [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).

## Language

There is a single rule and it is easy to remember: **code in English, whatever the user reads in Spanish**.

| What | Language |
| --- | --- |
| File and folder names | English |
| Variables, functions, types, test names | English |
| Interface strings and panel messages | **Spanish** (the product's audience is Spanish-speaking) |
| Documentation, issues, pull requests and commit messages | English |

The Spanish strings that live inside the code are not an exception to the rule: they are the contract with the user. If you change one, check the tests, because several of them assert it verbatim.

Then there are Spanish strings that are **not** part of the interface and are not translated either: the ones that match Meta's or Shopify's own markup (`Identificador de la biblioteca`, `anuncios usan este contenido`, `Número de impresiones bajo`, `Started running on`). They are neither code nor interface — they are external data, matched verbatim in both languages.

## No comments

The code carries no comments. No `//`, no `/* */`, no JSDoc.

This is not minimalist posturing: a comment is never executed, so nothing verifies that it is still true, and it ends up describing code that has already changed. If something feels like it needs explaining, it almost always means a name is badly chosen or there is a function waiting to be extracted.

```ts
if (countLibraryIds(text) > 1) return null;
```

That reads on its own. And when the reason really is subtle — the why, not the what — the place where it belongs is a test, with a name that says it:

```ts
it('does not attach a neighbour creative to an ad whose media has not loaded', ...)
```

That one does run, and it fails when someone breaks the premise.

## Getting the project running

You need **Node >= 20**.

```bash
git clone https://github.com/vilaslautaro/ecom-toolkit.git
cd ecom-toolkit
npm install
npm run serve    # serves the page locally
npm test         # unit + integration (Vitest) + e2e (Playwright)
```

Install the browsers before running the e2e suite for the first time:

```bash
npx playwright install --with-deps chromium
```

Useful scripts:

| Script | What it does |
| --- | --- |
| `npm run build` | Regenerates `index.html` from `src/` |
| `npm run build:check` | Fails if `index.html` does not match `src/` |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run serve` | Serves the static page locally |
| `npm run test:unit` | Unit and integration tests (Vitest + jsdom) |
| `npm run test:watch` | Vitest in watch mode |
| `npm run test:e2e` | e2e tests (Playwright) |
| `npm run test:adlib` | Test against the **real** Ad Library, with `ADLIB_LIVE=1` and a visible browser |
| `npm run test:visual` | Screenshot regression, in Docker (needs Docker running) |
| `npm run test:visual:update` | Rewrites the screenshot baselines, in Docker |
| `npm test` | Unit + integration + e2e |

`test:adlib` hits Meta for real, so it is slow and brittle. It does not run in CI and you do not need it for an ordinary PR: use it only when you are touching Ad Library scraping.

### The screenshot baselines are Linux, always

`tests/visual/` compares the generator page and both injected panels against four committed PNGs. Screenshots do not survive a change of operating system: antialiasing, font hinting and emoji all differ, so a baseline taken on Windows or macOS fails on CI forever, and a suite that always fails is a suite everybody ignores.

So the baselines are never taken on your machine. Both scripts run the suite inside `mcr.microsoft.com/playwright:v1.62.1-noble` — the image matching the Playwright version this repo pins — mount the repository at `/work` and install with `npm ci` in the container, leaving your own `node_modules` out of the mount because its native binaries are built for your OS. CI runs the visual job in that very same image.

If your change moves pixels on purpose, run `npm run test:visual:update`, **look at the four PNGs in the diff**, and commit them with the change. If it moves pixels you did not intend, you just found a bug.

Two things are deliberately neutralised so the baselines only fail for real reasons: the SHA-256 fingerprint at the foot of the page is masked, since it changes on every code change, and the dates in the store panel come from fixtures rendered in a fixed locale and timezone.

## Non-negotiable rules

### 1. `index.html` is never edited by hand

The `index.html` at the root is a **generated artifact**. `npm run build` produces it from `src/`, and it is what Vercel publishes.

```
src/
  page/
    index.html          page markup
    styles.css
    main.ts             builds the javascript: URL for the bookmark
  bookmarklet/
    main.ts             composition root: picks the panel based on the page
    domain/             types, file naming, brand, serialized config
    ad-library/         locator, reader, scanner, filters, session, panel
    downloads/          fetch, saving, errors, creative downloads
    shopify/            API, insights, media, panel, brand
```

You edit `src/`, run `npm run build`, and commit the result together with your change. The build writes two generated files: `index.html` and `bookmarklet.sha256`, the fingerprint users compare against to prove the bookmarklet they copied is the code in this repository. CI runs `npm run build:check`, which rebuilds and compares both: if either disagrees with what comes out of `src/`, the PR goes red.

Two bookmarklet constraints worth understanding before you touch the build:

- **The core travels inline and has to be self-contained.** A bookmarklet is a single `javascript:` URL; it cannot ask anyone for files. That is why the bundle ends up inside `<script type="text/plain" id="mald-core">` and the build fails if it spots a stray `import`, `require` or `export`. The CSS and the page's own script are separate files, and that is fine.
- **No invisible characters.** The accent-stripping regex used to be written with literal combining marks, U+0300-U+036F. They were mangled in transit, the `javascript:` URL broke, and the site served a blank page for days while still returning 200. Always use Unicode escapes (`\u0300-\u036f`). There is a test that checks for this.

### 2. Nobody deploys by hand

Deployment is automatic: Vercel publishes whatever is on `main`. Merging to `main` **is** deploying. There is no manual `vercel deploy`, no FTP upload, nothing to run after the merge.

### 3. Every PR passes the tests

CI runs on every pull request against Node 20 and 22. If it is red, the PR does not get merged.

And most important of all: **if you fix a bug, add the regression test**. A `fix:` without a test that fails before the fix and passes after it does not get in. Check that it fails without the fix: a test that passes either way documents nothing.

Where each thing goes:

| Folder | What it covers |
| --- | --- |
| `tests/unit/` | one file per module in `src/`, imported directly |
| `tests/integration/` | the generated `index.html` and the bookmarklet that comes out of it |
| `tests/e2e/` | the page and the bookmarklet running in Chromium |
| `tests/visual/` | screenshot baselines for the page and both panels, rendered in Docker |
| `tests/support/` | fixtures and the jsdom harness |

## Branches

Always off `main`, up to date:

```bash
git switch main
git pull
git switch -c fix/adlib-download-cap
```

Prefixes:

- `feat/` — new functionality
- `fix/` — bug fix
- `docs/` — documentation
- `chore/` — maintenance, dependencies, config
- `test/` — tests
- `refactor/` — rewrite with no behaviour change
- `ci/` — pipeline

## Commits

We use [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/): `type(scope): lowercase description in the imperative`.

Types: `feat`, `fix`, `docs`, `chore`, `test`, `refactor`, `ci`.

Common scopes: `adlib`, `shopify`, `bookmarklet`, `ui`, `build`, `deps`.

Real examples from the project:

```
fix(adlib): count only attempted downloads against the cap
feat(adlib): allow discarding ads with low impressions
fix(shopify): handle stores with no published_at field in products.json
feat(shopify): show the price range in the panel
refactor(bookmarklet): extract placeholder substitution into its own module
test(adlib): add a regression for the minimum repeated ads filter
docs(readme): clarify the browser's multiple downloads prompt
chore(deps): update playwright to 1.62
ci: stop running the live ad library e2e tests in the pipeline
```

One commit, one change. If you need an "and" in the title, it is probably two commits.

## Testing the bookmarklet by hand

Tests do not replace manual testing: the bookmarklet runs against real pages that change on their own.

1. Start the page with `npm run serve` and open it in the browser.
2. Adjust the configuration if your change affects it.
3. Drag the bookmarklet button to the bookmarks bar (if the bar is hidden: `Ctrl+Shift+B` on Windows/Linux, `Cmd+Shift+B` on macOS).
4. Try it in both modes:
   - **Ad Library**: go to `facebook.com/ads/library`, run a search that returns results and click the bookmark.
   - **Shopify**: go to any public Shopify store and click the bookmark.
5. Read the panel log and write down in the PR what you tested and what you saw.

If the log shows `✓` but no files appear, the browser is blocking multiple downloads: accept the `¿Permitir descargar varios archivos?` prompt.

## Project scope

This is a small tool, with no heavy build and no framework, that runs entirely in the user's browser. That is the whole point and we do not want to lose it.

**Yes:**

- Fixes for when Meta or Shopify change their DOM or their responses and something stops working.
- Improvements to the download filters and to the data the Shopify panel shows.
- Usability and accessibility improvements to the page that generates the bookmarklet.
- Tests, documentation and clearer error messages.
- Performance, and less fragility in the face of changes to the source pages.

**No:**

- Backends, databases, user accounts or anything that sends data to a server.
- UI frameworks, heavy bundlers or runtime dependencies. It stays vanilla.
- Scraping private data, or bypassing logins, rate limits or bot detection.
- Translating the interface into other languages (for now).
- Sweeping style or formatting changes that fix nothing.

If your idea is large, or you are not sure which side of the line it falls on, open an issue before writing the code. Discussing it there is faster than redoing an entire PR.

## Before opening the PR

- [ ] Branch off `main` with the right prefix.
- [ ] `npm test` green.
- [ ] Regression test added if the PR is a `fix`.
- [ ] If you touched `src/`, you ran `npm run build` and committed the regenerated `index.html` and `bookmarklet.sha256`.
- [ ] No comments in the code, and everything that is not interface text is in English.
- [ ] No DOM built from HTML strings: `createElement` and `textContent`.
- [ ] You tested the bookmarklet by hand in the affected mode.
- [ ] You filled in the PR template.

Review is done by hand and merges are squashed. Thanks.
