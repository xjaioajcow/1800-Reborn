import { ethers } from 'ethers';
import { BSC_TESTNET_ADDRESSES } from '../constants';

/**
 * Factory for the CoreGameV2 contract. Uses a generic empty ABI. The
 * functions defined here mirror the expected on‑chain methods. When
 * TypeChain types are available, replace the empty ABI with the
 * generated ABI and adjust the return types accordingly.
 */
export function createCoreGameV2(provider: ethers.Provider, signer?: ethers.Signer) {
  const signerOrProvider: any = signer ?? provider;
  const contract = new ethers.Contract(
    BSC_TESTNET_ADDRESSES.CoreGameV2,
    [],
    signerOrProvider,
  ) as any;
  return {
    /**
     * Purchase a new ship. Parameters depend on the deployed contract.
     */
    buyShip(...args: any[]) {
      return contract.buyShip(...args);
    },
    /**
     * Start a voyage. Parameters depend on the deployed contract.
     */
    voyage(...args: any[]) {
      return contract.voyage(...args);
    },
    /**
     * Upgrade a ship. Parameters depend on the deployed contract.
     */
    upgradeShip(...args: any[]) {
      return contract.upgradeShip(...args);
    },
    /**
     * Get all ships owned by a user.
     */
    getUserShips(...args: any[]) {
      return contract.getUserShips(...args);
    },
    /**
     * Get FOMO status (placeholder method).
     */
    getFomoStatus(...args: any[]) {
      return contract.getFomoStatus?.(...args);
    },
  };
}