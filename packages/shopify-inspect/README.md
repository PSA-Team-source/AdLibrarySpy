# shopify-inspect

See what any Shopify store publishes about itself: theme, best sellers, newest products, prices, apps and
tracking pixels. It needs no API key, no account and no dependencies.

```bash
npx shopify-inspect deathwishcoffee.com
```

```
Death Wish Coffee  deathwishcoffee.com
  myshopify     deathwishcoffee.myshopify.com
  theme         Dawn
  currency      USD
  locale        en
  products      147
  prices        $5.99 – $90.00, median $29.98 (147 sampled)
  traffic       213.4K/mo +4.7% (SimilarWeb · Aug 2026)
  live Meta ads 30
  niche         Food & Drink › Beverages › Coffee & Tea
  pixels        Google Tag Manager
  apps          Klaviyo, Postscript, Smile.io, Rebuy, Gorgias
  best sellers
     1. Dark Roast Coffee  $19.99
     2. Dark Roast Single-Serve Pods  $14.99
     3. Valhalla Java Odinforce Blend  $15.99
  newest
     1. White Chocolate Pistachio Ground Bundle  $48.99
     2. Hidden In Plain Sight Snapback  $25.00
  full report   https://adlibraryspy.com/store/deathwishcoffee.com
```
<sub>Output captured 2026-09-26, shortened.</sub>

## Options

```
npx shopify-inspect <domain> [<domain> ...] [--json] [--limit 1-50] [--offline]
```

- `--json` prints machine-readable output. Pass several domains to compare stores.
- `--offline` reads only the storefront and skips the [AdLibrarySpy](https://adlibraryspy.com) index lookup
  (traffic, live ads, niche).

## Library

```js
import { inspectStore } from 'shopify-inspect';

const store = await inspectStore('gymshark.com', { limit: 5 });
store.bestSelling; // [{ rank, title, handle, price, currency, createdAt, image, url }]
store.apps;        // ['Klaviyo', 'Gorgias', ...]
```

The pure parsers (`parseTheme`, `parseHandles`, `detectTech`, `normaliseDomain`…) are exported from
`shopify-inspect/parse`.

## Where each value comes from

| Field | Source |
|---|---|
| `myshopifyDomain`, `currency`, `productCount`, `name` | `/meta.json` |
| `theme`, `locale` | `Shopify.theme` / `Shopify.locale` in the homepage |
| `bestSelling`, `newest` | `/collections/all?sort_by=best-selling` and `created-descending`, in the store's own order |
| `prices` | `/products.json` (up to 250 products), in the store's own currency |
| `apps`, `pixels` | Vendor script hosts in the homepage HTML ([list](parse.js)) |

A store that hides a value gets `null` or `[]` for it; nothing is estimated. Apps loaded after the homepage
(lazily, or through a tag manager) aren't seen, so a missing app isn't proof the store doesn't use it.
Stores built headless (Hydrogen and the like) often have no best-seller order to read.

Requests use a descriptive User-Agent and fetch only public pages. Use this tool the way you'd browse a
store, not to crawl stores in bulk.

MIT
