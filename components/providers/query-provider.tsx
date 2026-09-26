'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState } from 'react';

// Cached rows render immediately and revalidate in the background, kept for a
// whole session of moving between screens.
function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 60 * 1000,
        gcTime: 30 * 60 * 1000,
        refetchOnWindowFocus: true,
        retry: 1,
      },
      mutations: { retry: 0 },
    },
  });
}

export function QueryProvider({ children }: { children: React.ReactNode }) {
  // One client per browser tab; useState keeps it stable across re-renders
  // and never shares one between server requests.
  const [client] = useState(makeQueryClient);
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
