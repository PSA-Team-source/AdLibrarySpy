# Data honesty

Most "store spy" tools make up their numbers. They draw a smooth traffic curve through two data points,
estimate visits from follower counts, and show the result as if it were measured. We've seen this in
production code, including an earlier version of our own. This project follows five rules instead, and every
PR is reviewed against them.

1. **A number is shown only if something measured it.** Every traffic figure carries its source and period,
   for example *SimilarWeb · Aug 2026*. When the only figure is an index estimate, it is labelled as one.
   There is no fallback estimator.
2. **History is only real, named months.** A chart needs two real points or it isn't drawn. Measured months
   from two different sources are never joined into one line.
3. **Absent data renders nothing.** There are no `—` placeholders, grey boxes or `href="#"` links. The CLI
   leaves out a row it has no value for.
4. **`null` ≠ `0`.** An unmeasured value is `null` in JSON. The MCP tool descriptions tell assistants this
   explicitly, because a model that reads a missing measurement as zero will draw a false conclusion.
5. **A model's judgment is labelled as one.** AI creative labels (hook, angle, offer…) are classifications of
   ad text with a confidence score. When a label is missing, the model wasn't sure. It doesn't mean the ad
   lacks that trait.

## Where each figure comes from

| Figure | Source |
|---|---|
| Theme, currency, locale, product count, best sellers, newest, prices | The store's own public storefront (`/meta.json`, collection pages, `/products.json`), read live |
| Product thumbnails and product count on the Shops list, directory and store cards | The same public `/products.json` (newest pictured products) and `/meta.json` (`published_products_count`), read by the index at most every 30 days. A store with no public feed (headless, password-protected, bot-walled, not Shopify) shows no products |
| Apps and pixels | Vendor script hosts in the store's homepage HTML. Something loaded later isn't seen, so a missing app isn't proof the store doesn't use it |
| Monthly visits, growth, traffic history | SimilarWeb's measurement of the exact store host, or the index's estimate, labelled as one |
| Live Meta ads, ad peaks | Meta Ad Library counts recorded by the AdLibrarySpy index, with the recording date |
| AI creative labels | A classifier over ad text, returned with its confidence |
