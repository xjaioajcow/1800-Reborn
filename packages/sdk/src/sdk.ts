import { ethers } from 'ethers';
import { createGameToken } from './contracts/gameToken';
// Factory for CoreGameV2 lives in coreGameV2Factory to avoid case‑sensitive name collisions
import { createCoreGameV2 } from './contracts/coreGameV2Factory';
import { createCoreGame } from './coreGame';
import * as CoreGameV2 from './contracts/CoreGameV2';
import { createShipSBT } from './contracts/shipSBT';
import { createPiratePool } from './contracts/piratePool';
import { RPC_URL, BSC_TESTNET_ADDRESSES } from './constants';

/**
 * Factory that creates an aggregated SDK for interacting with all
 * supported contracts on BSC Testnet. A provider must be supplied,
 * optionally accompanied by a signer for write operations.
 */
export function createBscTestnetSdk(
  provider?: ethers.Provider,
  signer?: ethers.Signer,
) {
  // Lazily resolve the default provider from the environment if none
  // was supplied.  If RPC_URL is empty the developer has not
  // configured the SDK properly.
  const usedProvider: ethers.Provider =
    provider ?? (RPC_URL ? new ethers.JsonRpcProvider(RPC_URL) : undefined as any);
  if (!usedProvider) {
    throw new Error('Missing env: NEXT_PUBLIC_RPC_URL must be defined');
  }
  // Validate that all contract addresses have been configured.  If any
  // address is the zero address or an empty string then throw an error
  // so that consumers can fail fast rather than send transactions to
  // address(0).
  const addrVals = Object.values(BSC_TESTNET_ADDRESSES);
  const missing = addrVals.some(
    (a) => !a || /^0x0{40}$/i.test(a as string),
  );
  if (missing) {
    throw new Error('Missing env: contract address(es) must be configured');
  }

  const base = {
    gameToken: createGameToken(usedProvider, signer),
    // Low‑level contract interfaces for backwards compatibility
    coreGameV2: createCoreGameV2(usedProvider, signer),
    shipSBT: createShipSBT(usedProvider, signer),
    piratePool: createPiratePool(usedProvider, signer),
    // High‑level core game wrapper implementing buy/voyage/upgrade
    coreGame: createCoreGame(usedProvider, signer),
  };
  return {
    ...base,
    /**
     * Buy a ship using the provided signer. Accepts the desired
     * level and quantity. See CoreGameV2.buyShip for details.
     */
    buyShip: (
      userSigner: ethers.Signer,
      level: number = 1,
      qty: bigint = 1n,
    ) => CoreGameV2.buyShip(userSigner, level, qty),
    /**
     * Upgrade two ships to the next level. Validates that the IDs
     * differ. See CoreGameV2.upgradeShip for details.
     */
    upgradeShip: (
      userSigner: ethers.Signer,
      idA: bigint,
      idB: bigint,
    ) => CoreGameV2.upgradeShip(userSigner, idA, idB),
    /**
     * Send a ship on a voyage. See CoreGameV2.voyage for details.
     */
    voyage: (
      userSigner: ethers.Signer,
      shipId: bigint,
      dbl: bigint,
    ) => CoreGameV2.voyage(userSigner, shipId, dbl),
    /**
     * Read the current ship price. A provider must be supplied. See
     * CoreGameV2.getShipPrice for details.
     */
    getShipPrice: (readProvider: ethers.Provider) => CoreGameV2.getShipPrice(readProvider),

    /**
     * Read the current FOMO status from the contract. A provider
     * must be supplied. See CoreGameV2.getFomoStatus for details.
     */
    getFomoStatus: (readProvider: ethers.Provider) => CoreGameV2.getFomoStatus(readProvider),

    /**
     * Purchase a FOMO key via the high‑level coreGame wrapper.  See
     * coreGame.buyKey for details.  The `faction` argument is
     * currently unused but reserved for future versions of the
     * contract.  Quantity defaults to 1 key.
     */
    buyKey: (
      userSigner: ethers.Signer,
      faction: string = 'Cargo',
      qty: bigint = 1n,
    ) => base.coreGame.buyKey(userSigner, faction, qty),
  };
}