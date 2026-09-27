// The homepage FAQ, shared by the page, its FAQPage JSON-LD and /llms.txt so the
// three can never say different things.
import { REPO_URL, SITE_URL } from './site';

export const HOME_FAQS: [string, string][] = [
  ['Is AdLibrarySpy really free?', 'Yes. Every feature — shop search, the ads library, Brandtracker, team workspaces, the weekly report and AI access — is free. There is no card, no trial and no usage tier — the API just has fair-use rate limits so it stays free for everyone.'],
  ['Where does the data come from?', 'Stores come from the PlatformDTC market index, traffic is measured by SimilarWeb for the exact store host, ads come from the Meta Ad Library, and products are read from each store\'s public Shopify feed. Every figure shows its source and month.'],
  ['Does AdLibrarySpy estimate missing numbers?', 'No. When a store has no measured traffic or an ad has no media, the value is left out rather than invented. There are no modelled revenue, spend or rating figures.'],
  ['Which ad networks are covered?', 'Meta (Facebook and Instagram). TikTok and Google ads are not covered today, and we say so on the comparison page.'],
  ['Can my team use it together?', 'Yes. Invite teammates to your workspace for free and share saved shops, ads and tracked brands.'],
  ['Is AdLibrarySpy open source?', 'Yes. The whole app, the Chrome extension, the MCP server and the CLI are MIT-licensed on GitHub. Read the code, open an issue or send a pull request.'],
  ['Can I use it from ChatGPT or Claude?', 'Yes. The built-in MCP connection lets compatible AI assistants search shops and ads and manage tracked brands with your workspace access.'],
];

export const SITE_DESCRIPTION = '100% free ecommerce intelligence, built for the community: search millions of stores by traffic, platform, category and tech, study real Meta ad creatives, track competitors and get a weekly report. No card, no trial.';

/** schema.org graph for the homepage. */
export function siteJsonLd() {
  const org = `${SITE_URL}/#organization`;
  return {
    '@context': 'https://schema.org',
    '@graph': [
      { '@type': 'Organization', '@id': org, name: 'AdLibrarySpy', url: SITE_URL, logo: `${SITE_URL}/icon.svg`, sameAs: [REPO_URL] },
      { '@type': 'WebSite', '@id': `${SITE_URL}/#website`, name: 'AdLibrarySpy', url: SITE_URL, description: SITE_DESCRIPTION, publisher: { '@id': org } },
      {
        '@type': 'SoftwareApplication', name: 'AdLibrarySpy', url: SITE_URL, description: SITE_DESCRIPTION,
        applicationCategory: 'BusinessApplication', operatingSystem: 'Web', isAccessibleForFree: true,
        publisher: { '@id': org }, sameAs: [REPO_URL], license: 'https://opensource.org/licenses/MIT',
        offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
      },
      {
        '@type': 'FAQPage', '@id': `${SITE_URL}/#faq`,
        mainEntity: HOME_FAQS.map(([q, a]) => ({ '@type': 'Question', name: q, acceptedAnswer: { '@type': 'Answer', text: a } })),
      },
    ],
  };
}
