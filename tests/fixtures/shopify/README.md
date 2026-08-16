# Shopify fixtures

Real responses from public Shopify storefronts. Nothing here is hand written: every
file is the answer a live store gave, trimmed to the fields the bookmarklet reads
(`id`, `title`, `handle`, `published_at`, `created_at`, `variants[].id`,
`variants[].price` and `images[].src`). Every variant is kept because the price range
reads all of them, and only the first 1 image survives because the panel only shows that one.

Captured on 2026-08-16 from:

- `/products.json?limit=250&page=N`, paginated the way the bookmarklet paginates it,
  then trimmed to 12 products: the ones the storefront ranks as best selling first,
  the head of the catalogue after that.
- `/collections/all?sort_by=best-selling`, an entire storefront page. Only the product handles it links to
  are kept, so `<slug>-best-selling.json` is a handle list and never raw HTML.

| Slug | Origin | Catalogue size | Products kept | Best selling handles | Handles also in the kept products |
| --- | --- | --- | --- | --- | --- |
| `allbirds` | https://www.allbirds.com | 291 | 12 | 5 | 5 |
| `hiutdenim` | https://www.hiutdenim.co.uk | 112 | 12 | 11 | 7 |

Regenerate with `npm run fixtures:refresh`. The output is key sorted and the selection
is deterministic, so a refresh that finds the same data produces no diff.
