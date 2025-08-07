import { ethers } from 'ethers';
import { BSC_TESTNET_ADDRESSES } from '../constants';

/**
 * Factory for the ShipSBT contract. Uses a generic empty ABI. Once
 * ABIs are available, replace the empty ABI with the real one.
 */
export function createShipSBT(provider: ethers.Provider, signer?: ethers.Signer) {
  const signerOrProvider: any = signer ?? provider;
  const contract = new ethers.Contract(
    BSC_TESTNET_ADDRESSES.ShipSBT,
    [],
    signerOrProvider,
  ) as any;
  return {
    /**
     * List all ships owned by a user.
     */
    shipsOfOwner(...args: any[]) {
      return contract.shipsOfOwner(...args);
    },
    /**
     * Check whether the user has a pirate.
     */
    hasPirate(...args: any[]) {
      return contract.hasPirate(...args);
    },
  };
}