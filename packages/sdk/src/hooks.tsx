import { createContext, useContext, useMemo } from 'react';
import { useQuery, QueryKey, useMutation, useQueryClient } from '@tanstack/react-query';
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
 * Fetch voyage information. Placeholder query hook. If your dApp
 * requires polling or caching voyage data, use this hook. Mutations
 * related to voyage (sending a ship on a voyage) are exposed via
 * useVoyageMutation.
 */
export function useVoyageQuery(params?: any) {
  const sdk = useGameSdk();
  return useQuery({
    queryKey: ['voyage', params] as QueryKey,
    queryFn: async () => sdk.coreGameV2.voyage(params),
  });
}

/**
 * Interact with the PiratePool contract. Returns result of claimReward.
 * For stake/unstake operations, consider using useMutation from
 * @tanstack/react-query. This hook is unchanged from earlier versions.
 */
export function usePiratePool() {
  const sdk = useGameSdk();
  return useQuery({
    queryKey: ['piratePool'] as QueryKey,
    queryFn: async () => sdk.piratePool.claimReward(),
  });
}

/**
 * Mutation hook for purchasing a ship. Requires a signer to be
 * provided when calling mutate(). Upon success it invalidates
 * ['userShips'] queries so that the UI refreshes the ship list.
 */
export function useBuyShip() {
  const sdk = useGameSdk();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ signer }: { signer: ethers.Signer }) => {
      return sdk.buyShip(signer);
    },
    onSuccess: () => {
      // Invalidate the userShips query so lists refresh. Use object
      // argument per TanStack Query v5 API.
      queryClient.invalidateQueries({ queryKey: ['userShips'] });
    },
  });
}

/**
 * Mutation hook for upgrading two ships. Expects a signer and the two
 * token IDs. Validates that the IDs are distinct inside the SDK
 * function. On success the user's ship list is refreshed.
 */
export function useUpgradeShip() {
  const sdk = useGameSdk();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      signer,
      idA,
      idB,
    }: {
      signer: ethers.Signer;
      idA: bigint;
      idB: bigint;
    }) => {
      return sdk.upgradeShip(signer, idA, idB);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['userShips'] });
    },
  });
}

/**
 * Mutation hook for sending a ship on a voyage. Requires a signer,
 * ship ID and DBL (distance). After a successful voyage the user's
 * ship list is invalidated to refresh any derived data such as runs
 * left. This hook returns the raw transaction result; applications
 * can parse rewards from the returned data.
 */
export function useVoyageMutation() {
  const sdk = useGameSdk();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      signer,
      shipId,
      dbl,
    }: {
      signer: ethers.Signer;
      shipId: bigint;
      dbl: bigint;
    }) => {
      return sdk.voyage(signer, shipId, dbl);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['userShips'] });
    },
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