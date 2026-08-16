# Architecture

Orientation for anyone — human or agent — who needs working context fast.

## What this is

A static page that generates a **bookmarklet**: a `javascript:` URL the user drags onto their
browser bookmarks bar. Clicking it on a supported page injects a floating panel.

The bookmarklet detects where it is and behaves accordingly:

- **Meta Ad Library** (`facebook.com/ads/library`) — scans ad cards and downloads their creatives
  (video or image), filtered by how many ads reuse the creative, by media type, by a download cap,
  and optionally skipping low-impression ads.
- **Any other page** — treats it as a possible Shopify store: reads the public product feed and
  shows best sellers, product count, price range and publishing dates, plus buttons to download the
  page's images and videos.

Everything runs in the user's browser against public data. There is no backend, no account, and
nothing is sent anywhere.

## Repository map

```
index.html              generated artifact — never edit by hand
src/
  page/
    index.html          markup, with build markers
    styles.css
    main.ts             reads the core template, builds the javascript: URL, wires the buttons
    bookmarklet-config.ts
  bookmarklet/
    main.ts             composition root: picks a panel based on location.href
    domain/             types, brand naming, file naming, wire config
    ad-library/         card locator, card reader, scanner, filters, session, panel
    downloads/          blob fetching, saving, error messages, creative download
    shopify/            store API, insights, page media, panel, brand
scripts/
  build.ts              bundles src/ into index.html
  serve.ts              zero-dependency static server for dev and e2e
tests/
  unit/                 one file per source module
  integration/          asserts on the generated index.html
  e2e/                  Playwright
  support/              fixtures and jsdom harness
docs/
```

## The one mechanic worth understanding first

A bookmarklet is a single URL. It cannot fetch files, import modules, or depend on anything on the
page. Whatever it needs must travel inside that URL.

So the build inlines the entire bookmarklet bundle into the page as **inert text**:

```html
<script type="text/plain" id="mald-core"> ...bundle... </script>
```

`type="text/plain"` stops the browser from executing it on the generator page. `src/page/main.ts`
reads it with `textContent`, substitutes the `__CFG__` and `__AUTOSTART__` placeholders with the
user's chosen settings, wraps it in an IIFE, percent-encodes it, and assigns the result as the
`href` of the draggable button.

Two consequences follow from this, and both have already caused outages:

- **The core bundle must be self-contained.** The build fails if it finds a stray `import`,
  `require`, or `export` in the output.
- **Bundle size is a product constraint, not a nitpick.** The whole thing becomes a URL stored in a
  bookmark. Only the bookmarklet core is minified; the page's own script stays readable.

## Dependency direction

```
main.ts  ->  ad-library/ , shopify/  ->  downloads/  ->  domain/
```

`domain/` is the floor: pure types and pure functions, no DOM and no network. Nothing in `domain/`
imports from a layer above it.

Two seams exist specifically so behaviour can be tested without a browser:

- **`DownloadSession`** receives every dependency through its constructor — `scanAds`,
  `downloadCreatives`, `scroller`, `wait`. It never constructs them. Its loop can therefore be
  driven with plain test doubles, no DOM and no network stubbing.
- **`store-insights.ts`** is pure. Best sellers, price range, publishing dates and add-on filtering
  are computed from data that someone else fetched.

Panels are the only modules that touch the DOM directly, and they contain no business rules.

## Build

```bash
npm run build        # regenerate index.html from src/
npm run build:check  # rebuild into a temp file and diff against the committed index.html
```

`build.ts` bundles `src/bookmarklet/main.ts` and `src/page/main.ts` with esbuild (IIFE, es2020).
Only the bookmarklet core is minified — it becomes a URL, so its size is a product constraint; the
page's own script stays readable. Each bundle is checked for stray module syntax, then the CSS, the
core, the page script and the fingerprint go into the four markers in `src/page/index.html`.

`build:check` runs in CI. If a pull request edits `index.html` by hand, or changes `src/` without
rebuilding, CI fails. That is what keeps the generated file honest.

## Verifiable distribution

A bookmarklet is the distribution format with the weakest guarantees there is: the user pastes tens
of thousands of unreadable characters into their browser and has no way to tell whether it matches
the source they were shown. Open sourcing the code does not by itself close that gap.

So the build computes the SHA-256 of the exact `javascript:` URL the page hands out, writes it to
`bookmarklet.sha256`, and prints it on the page. A user compares the two; if they agree, what they
are about to save is the audited code. `build:check` fails when the committed digest disagrees with
the freshly built one, and an integration test recomputes it from the published `index.html`.

The URL is assembled in exactly one place, `src/page/bookmarklet-url.ts`, imported by the page, the
build and the tests. A second implementation would be a second thing to drift, and the fingerprint
would then be attesting to something nobody actually ships.

The digest covers the URL and nothing else, which makes the obvious verification command wrong:

```bash
tr -d '\n' < bookmarklet.txt | sha256sum   # correct
sha256sum bookmarklet.txt                  # includes the newline your editor added
```

Both digests are 64 hex characters and they share nothing, so the second one reads exactly like
evidence of tampering. A verification step that fails for honest users is worse than none, so the
README documents the working command rather than leaving people to guess it.

Two limits are worth stating plainly, because a fingerprint invites more confidence than it earns.
It proves that what a user copied matches what this repository publishes; it proves nothing about
whether this repository is trustworthy. And the digest shown on the page is generated by that same
page, so a compromised deployment would print one that agrees with its own malicious bundle — the
comparison only means something against the copy committed here, which is why the page links to it.

Build provenance attestation would be the reflex at this point, and it does not fit. Attestation
answers "did this artifact come from that source" for artifacts a consumer cannot rebuild: compiled
binaries, container images, published packages. Here the artifact is committed, readable, and
`build:check` reproduces it byte for byte in seconds. Signing it would add ceremony on top of a
stronger guarantee that already exists.

## Testing

Four layers, each answering a different question.

| Layer | Question it answers | Cost |
| --- | --- | --- |
| `tests/unit` | does this module do its job? | milliseconds |
| `tests/integration` | is the generated `index.html` well-formed? | fast, no browser |
| `tests/e2e` | does the real bookmarklet work in a real browser? | seconds |
| `tests/e2e/ad-library.spec.ts` | does Meta's DOM still look like we think? | slow, opt-in |

The e2e suite never touches Facebook. `page.route()` intercepts the Ad Library URL and serves a
fixture, so `location.href` is genuinely a Meta URL and the core takes the right branch, while the
creatives resolve to synthetic bytes. Downloads are captured through Playwright's `download` event,
which means filenames are asserted end to end.

Only `ad-library.spec.ts` reaches the real site. It is disabled unless `ADLIB_LIVE=1` and never runs
in CI: a third-party site that changes without notice would produce failures unrelated to the change
under review, and a suite that cries wolf gets ignored. Its purpose is diagnostic — when the
bookmarklet stops finding cards, it tells you whether the DOM moved.

## Conventions

**Language.** Code is English — file names, folder names, identifiers, test names. Strings the end
user reads are Spanish, because the audience is Spanish-speaking. Strings that match Meta's or
Shopify's own markup (`Identificador de la biblioteca`, `Started running on`) are neither: they are
external data and are matched verbatim in both languages.

**No comments.** Not a style preference: a comment is not executed, so nothing keeps it true, and it
drifts into describing code that has since changed. Naming and small functions carry the *what*; a
test name carries the *why*. If something seems to need a comment, that is usually a badly named
symbol or a function waiting to be extracted.

## Constraints that have already broken production

Each of these cost real downtime or silent data loss. They are the reason the corresponding tests
exist.

**Invisible characters.** The accent-stripping regex was once written with literal combining marks
(U+0300–U+036F). They were mangled in transit, the `javascript:` URL became invalid, and the site
served a blank page for days while still returning HTTP 200. Always use Unicode escapes. An
integration test scans the generated artifact for characters in the invisible ranges.

**Skipped ads consuming the download cap.** The download limit once counted a deduplication set that
also received skipped low-impression ads. With a cap of 1 and two skipped ads at the top of the
page, the run ended having downloaded nothing. The cap counts real download attempts, and a
regression test pins it.

**Unloaded media stealing a neighbour's creative.** `findAdCard` climbs the DOM from the library-ID
label looking for a container that also holds media. A card whose creative had not lazy-loaded yet
had no media of its own, so the climb continued to the grid — which does have media, belonging to a
different ad. The result was a correct ID paired with the wrong file. The locator now stops as soon
as a container spans more than one library ID.

**Locale-dependent parsing.** Meta writes the circulation date with a different field order per
language: `En circulación desde el 17 mar 2026` versus `Started running on Mar 17, 2026`. Parsing
only Spanish silently dropped the date from filenames; parsing English carelessly would swap day and
month and produce a wrong but plausible date. Each format declares its own group positions.

## Deployment

Vercel builds from `main`. Merging to `main` is deploying. There is no manual deploy step, and
running one by hand is how the blank-page outage above happened.
