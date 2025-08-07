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

// Create a default JSON RPC provider using the endpoint defined in
// NEXT_PUBLIC_RPC_URL.  If the environment variable is not set
// fallback to a public BSC Testnet node.  The signer is omitted
// here; components requiring write operations should supply a signer
// via GameSdkProvider.
const provider = new ethers.JsonRpcProvider(
  typeof process !== 'undefined' && process.env.NEXT_PUBLIC_RPC_URL
    ? (process.env.NEXT_PUBLIC_RPC_URL as string)
    : 'https://bsc-testnet.publicnode.com',
);

// Create a throwaway signer connected to the provider.  In a real
// application this would come from a wallet connector such as Wagmi.
const demoSigner = ethers.Wallet.createRandom().connect(provider);

// Mark this layout as a Client Component. This is necessary because it
// renders React context providers from the SDK, which depend on React
// client APIs such as createContext. Without this directive, Next.js
// treats the file as a Server Component by default and compilation will fail.
export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <QueryClientProvider client={queryClient}>
          <GameSdkProvider provider={provider} signer={demoSigner}>
            {children}
          </GameSdkProvider>
        </QueryClientProvider>
      </body>
    </html>
  );
}