import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? '';
  return {
    id: `${basePath || ''}/`,
    name: 'Tax Solutions',
    short_name: 'TaxSolutions',
    description: 'Accounting and tax services in Latvian, English and Russian.',
    start_url: `${basePath}/lv/`,
    scope: `${basePath || ''}/`,
    display: 'standalone',
    display_override: ['standalone', 'minimal-ui'],
    orientation: 'any',
    background_color: '#ffffff',
    theme_color: '#123b70',
    icons: [
      { src: `${basePath}/icons/taxsolutions-192.png`, sizes: '192x192', type: 'image/png' },
      { src: `${basePath}/icons/taxsolutions-512.png`, sizes: '512x512', type: 'image/png' },
      { src: `${basePath}/icons/taxsolutions-maskable-512.png`, sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
