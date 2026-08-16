# Working on this repository

Read [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) first. It explains what this project is, how the
bookmarklet mechanism works, why the layers are split the way they are, and which constraints have
already broken production.

## Rules

**Never edit `index.html` or `bookmarklet.sha256`.** Both are generated. Edit `src/`, then run
`npm run build` and commit all three together. CI runs `build:check` and fails if they disagree.

**Never build DOM from HTML strings.** Panels use `createElement` and `textContent`. Interpolating a
value into markup once shipped a real `onerror` attribute from a product image URL.

**No comments in code.** Naming and small functions carry the *what*; a test name carries the *why*.

**Code in English, user-facing strings in Spanish.** Strings that match Meta's or Shopify's own
markup are external data — match them verbatim in both languages, do not translate them.

**Never write invisible Unicode characters.** Use escapes such as `\u0300-\u036f`. Literal combining
marks in a regex once shipped a blank page that still returned HTTP 200. A test scans for them.

**Every bug fix ships with a regression test.** Confirm the test fails without the fix. A test that
passes either way documents nothing.

**Never deploy by hand.** Merging to `main` deploys.

## Commands

```bash
npm test             # unit + integration + e2e
npm run test:unit    # fast, no browser
npm run typecheck
npm run build
npm run serve
```

`npm run test:adlib` hits the real Ad Library. It is opt-in, excluded from CI, and only useful for
diagnosing whether Meta changed its DOM.

## Before you finish

Run `npm run typecheck`, `npm test` and `npm run build`. If `index.html` changed, commit it.
