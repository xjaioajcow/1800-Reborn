// Enable client-side rendering for this layout. Without this directive, Next
// treats the layout as a server component and disallows usage of React
// context providers and hooks.
'use client';

import './globals.css';
import { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { GameSdkProvider } from '@cvf/sdk';
import { ethers } from 'ethers';

// Instantiate a single query client for React Query
const queryClient = new QueryClient();

// Create a default JSON RPC provider. In a real application you might
// configure this with a BSC Testnet RPC endpoint. The signer is omitted
// here; components requiring write operations should supply a signer.
const provider = new ethers.JsonRpcProvider();

// Mark this layout as a Client Component. This is necessary because it
// renders React context providers from the SDK, which depend on React
// client APIs such as createContext. Without this directive, Next.js
// treats the file as a Server Component by default and compilation will fail.
export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <QueryClientProvider client={queryClient}>
          <GameSdkProvider provider={provider}>
            {children}
          </GameSdkProvider>
        </QueryClientProvider>
      </body>
    </html>
  );
}