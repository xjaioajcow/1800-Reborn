import { ethers } from 'ethers';
import { BSC_TESTNET_ADDRESSES } from '../constants';

/**
 * Factory for the PiratePool contract. Uses a generic empty ABI. Replace
 * the empty ABI with the real one when available.
 */
export function createPiratePool(provider: ethers.Provider, signer?: ethers.Signer) {
  const signerOrProvider: any = signer ?? provider;
  const contract = new ethers.Contract(
    BSC_TESTNET_ADDRESSES.PiratePool,
    [],
    signerOrProvider,
  ) as any;
  return {
    /**
     * Stake tokens into the pool.
     */
    stake(...args: any[]) {
      return contract.stake(...args);
    },
    /**
     * Unstake tokens from the pool.
     */
    unstake(...args: any[]) {
      return contract.unstake(...args);
    },
    /**
     * Claim accumulated rewards.
     */
    claimReward(...args: any[]) {
      return contract.claimReward(...args);
    },
  };
}