import { createContext, useContext, useMemo } from 'react';
import { useQuery, QueryKey } from '@tanstack/react-query';
import { ethers } from 'ethers';
import { createBscTestnetSdk } from './sdk';

// Define the shape of the SDK instance using the return type of our factory
type GameSdkInstance = ReturnType<typeof createBscTestnetSdk>;

// Context to provide the SDK instance throughout a React component tree.
const GameSdkContext = createContext<GameSdkInstance | null>(null);

interface GameSdkProviderProps {
  /** Provider from ethers.js to read blockchain state */
  provider: ethers.Provider;
  /** Optional signer for write operations */
  signer?: ethers.Signer;
  /** Children React nodes */
  children: React.ReactNode;
}

/**
 * Provides an instance of the SDK to descendant components. The SDK is
 * memoized based on the provider and signer. Wrap your application in
 * this provider when you need to access contract helpers via hooks.
 */
export function GameSdkProvider({ provider, signer, children }: GameSdkProviderProps) {
  const sdk = useMemo(() => createBscTestnetSdk(provider, signer), [provider, signer]);
  return <GameSdkContext.Provider value={sdk}>{children}</GameSdkContext.Provider>;
}

/**
 * Access the current SDK instance from context. Throws if accessed outside
 * of a provider. Useful when building your own hooks on top of the SDK.
 */
export function useGameSdk(): GameSdkInstance {
  const ctx = useContext(GameSdkContext);
  if (!ctx) {
    throw new Error('useGameSdk must be used within a GameSdkProvider');
  }
  return ctx;
}

/**
 * Fetch the ships belonging to a user. Uses TanStack Query for caching.
 *
 * @param userAddress Wallet address whose ships should be queried.
 */
export function useUserShips(userAddress: string) {
  const sdk = useGameSdk();
  return useQuery({
    queryKey: ['userShips', userAddress] as QueryKey,
    queryFn: async () => sdk.coreGameV2.getUserShips(userAddress),
    enabled: !!userAddress,
  });
}

/**
 * Fetch voyage information. Placeholder implementation until the contract
 * interface is finalized. Pass whatever parameters your contract expects.
 */
export function useVoyage(params?: any) {
  const sdk = useGameSdk();
  return useQuery({
    queryKey: ['voyage', params] as QueryKey,
    queryFn: async () => sdk.coreGameV2.voyage(params),
  });
}

/**
 * Interact with the PiratePool contract. Returns result of claimReward.
 * For stake/unstake operations, consider using useMutation from
 * @tanstack/react-query.
 */
export function usePiratePool() {
  const sdk = useGameSdk();
  return useQuery({
    queryKey: ['piratePool'] as QueryKey,
    queryFn: async () => sdk.piratePool.claimReward(),
  });
}

/**
 * Fetch the current FOMO status. Placeholder implementation until the
 * contract interface is finalized.
 */
export function useFomoStatus() {
  const sdk = useGameSdk();
  return useQuery({
    queryKey: ['fomoStatus'] as QueryKey,
    queryFn: async () => sdk.coreGameV2.getFomoStatus?.(),
  });
}