# Security policy

## How to report a vulnerability

**Do not open a public issue** to report a security problem.

Use the [repository's GitHub Security Advisories](https://github.com/vilaslautaro/ecom-toolkit/security/advisories/new): that channel is private and only the project maintainers can see it.

Include in the report, as far as you have it:

- A description of the problem and its impact.
- Steps to reproduce it (browser and version, example URL, bookmarklet configuration).
- A proof of concept, if you have one.
- Any mitigation you can think of.

You will get a reply within **7 days**. If the report is confirmed, we coordinate the release of the fix and the advisory before making the details public. If you would like credit in the advisory, say so in the report.

While reporting, do not access third-party data, do not degrade anyone's service, and do not test against accounts that are not your own.

## Supported versions

Only the currently published version is supported: the one on `main`, which is what production serves. There are no maintenance branches and no backports.

## Threat model: what the bookmarklet does and does not do

This matters for sizing up any report:

- **Everything runs in the user's browser.** The bookmarklet is a `javascript:` URL that executes in the tab you already have open, with the session you already had. There is no backend of our own.
- **Nothing is sent to any server.** No telemetry, no analytics, no remote logs, no endpoints of our own. The only network traffic it generates is requests to the page you are standing on (Meta Ad Library or the Shopify store) and downloads of the files that same page already exposes.
- **It only reads public data.** Ad Library ads are public by design, and from Shopify it reads the store's public endpoints. It does not read cookies, tokens, credentials or account data.
- **It persists nothing sensitive.** No credentials and no personal data are stored.
- **The `ecom-toolkit` page is static.** It is served from Vercel, with no sessions and no database.

Things that **do** count as a vulnerability here: any path through which the bookmarklet or the page leaks user data to a third party, executes unintended code (XSS on the page, or injection into the generated `javascript:` URL), or touches data outside the scope described above. If you find something like that, report it through the channel above.

Things that **do not** count: the tool downloading public ad creatives (that is what it does), automated scanner reports with no demonstrated impact, or problems specific to Meta or Shopify that have nothing to do with this code.
