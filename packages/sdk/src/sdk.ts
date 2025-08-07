import { ethers } from 'ethers';
import { createGameToken } from './contracts/gameToken';
// Factory for CoreGameV2 lives in coreGameV2Factory to avoid case‑sensitive name collisions
import { createCoreGameV2 } from './contracts/coreGameV2Factory';
import * as CoreGameV2 from './contracts/CoreGameV2';
import { createShipSBT } from './contracts/shipSBT';
import { createPiratePool } from './contracts/piratePool';

/**
 * Factory that creates an aggregated SDK for interacting with all
 * supported contracts on BSC Testnet. A provider must be supplied,
 * optionally accompanied by a signer for write operations.
 */
export function createBscTestnetSdk(provider: ethers.Provider, signer?: ethers.Signer) {
  const base = {
    gameToken: createGameToken(provider, signer),
    coreGameV2: createCoreGameV2(provider, signer),
    shipSBT: createShipSBT(provider, signer),
    piratePool: createPiratePool(provider, signer),
  };
  return {
    ...base,
    /**
     * Buy a ship using the provided signer. This helper wraps the
     * corresponding CoreGameV2 method. See CoreGameV2.buyShip for
     * details.
     */
    buyShip: (userSigner: ethers.Signer) => CoreGameV2.buyShip(userSigner),
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
  };
}