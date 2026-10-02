// Web app manifest: lets Android/Chrome and iOS "Add to Home Screen" install the app,
// opening straight on Home (signed-out visitors are sent to /login?next=/home).
import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: '/home',
    name: 'AdLibrarySpy',
    short_name: 'AdLibrarySpy',
    description: 'Find winning Shopify stores and the ads behind them.',
    start_url: '/home',
    scope: '/',
    display: 'standalone',
    background_color: '#ffffff',
    theme_color: '#a7f45a',
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
