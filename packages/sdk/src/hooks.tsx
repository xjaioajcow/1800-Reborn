import { createContext, useContext, useMemo } from 'react';
import { useQuery, QueryKey, useMutation, useQueryClient } from '@tanstack/react-query';
import { ethers } from 'ethers';
import { createBscTestnetSdk } from './sdk';
import { buyShipFlow, voyageFlow, upgradeFlow } from './flows';

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
    queryFn: async () => {
      // Prefer the optimized shipsOfOwner call if available.  Fall
      // back to the CoreGameV2 getUserShips method for backwards
      // compatibility.  When ABIs are provided this will return an
      // array of ShipInfo objects; currently we return whatever the
      // contract returns.
      if (sdk.shipSBT && typeof sdk.shipSBT.shipsOfOwnerOptimized === 'function') {
        return sdk.shipSBT.shipsOfOwnerOptimized(userAddress);
      }
      return sdk.coreGameV2.getUserShips(userAddress);
    },
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
    mutationFn: async ({ signer, level = 1, qty = 1n }: { signer: ethers.Signer; level?: number; qty?: bigint }) => {
      // Delegate to the high‑level coreGame wrapper which handles
      // allowances and emits events
      return sdk.coreGame.buyShip(signer, level, qty);
    },
    onSuccess: () => {
      // Invalidate queries related to ships and ship price so that dependent
      // UI refreshes when new ships are minted or price changes.  Note:
      // use object argument per TanStack Query v5 API.
      queryClient.invalidateQueries({ queryKey: ['userShips'] });
      queryClient.invalidateQueries({ queryKey: ['shipPrice'] });
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
    mutationFn: async ({ signer, idA, idB }: { signer: ethers.Signer; idA: bigint; idB: bigint }) => {
      return sdk.coreGame.upgradeShip(signer, idA, idB);
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
    mutationFn: async ({ signer, shipId, dbl }: { signer: ethers.Signer; shipId: bigint; dbl: bigint }) => {
      return sdk.coreGame.voyage(signer, shipId, dbl);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['userShips'] });
      queryClient.invalidateQueries({ queryKey: ['fomoStatus'] });
    },
  });
}

/**
 * Hook to query a token allowance and optionally approve additional
 * allowance.  Use this in situations where a user needs to grant
 * permission to spend their tokens (e.g. DBL) before interacting
 * with a contract.  When called, the hook will read the current
 * allowance for the given owner/spender pair and expose an `approve`
 * function that can be used to increase the allowance.  After a
 * successful approval the allowance query will be invalidated so
 * consumers see the updated value.
 *
 * @param owner Wallet address of the token holder
 * @param tokenAddress ERC‑20 token contract address (ignored in current impl)
 * @param spender Address of the contract that will spend the tokens
 */
export function useTokenAllowance(
  owner: string,
  tokenAddress: string,
  spender: string,
) {
  const sdk = useGameSdk();
  const queryClient = useQueryClient();
  const allowanceQuery = useQuery({
    queryKey: ['allowance', owner, tokenAddress, spender],
    queryFn: async () => {
      if (!owner || !spender) return 0n;
      // Currently we assume the token is GameToken; when multiple tokens
      // are supported this can be dispatched based on tokenAddress.
      return sdk.gameToken.allowance(owner, spender);
    },
    enabled: !!owner && !!spender,
  });
  const approveMutation = useMutation({
    mutationFn: async (amount: bigint) => {
      // Approve the spender for the given amount.  This will create a
      // transaction that must be signed by the user.  The SDK
      // instance must have been created with a signer.
      return sdk.gameToken.approve(spender, amount);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['allowance', owner, tokenAddress, spender] });
    },
  });
  return {
    allowance: allowanceQuery.data as bigint | undefined,
    isLoading: allowanceQuery.isLoading,
    approve: approveMutation.mutateAsync,
    isApproving: approveMutation.isLoading,
  };
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