import { ethers } from 'ethers';
import { BSC_TESTNET_ADDRESSES } from '../constants';

/**
 * Factory for the GameToken contract. Uses a generic empty ABI because
 * TypeChain typings may not be available yet. Replace the empty array
 * with the actual ABI definition or import from the generated typechain
 * package when available.
 */
export function createGameToken(provider: ethers.Provider, signer?: ethers.Signer) {
  const signerOrProvider: any = signer ?? provider;
  const contract = new ethers.Contract(
    BSC_TESTNET_ADDRESSES.GameToken,
    [],
    signerOrProvider,
  ) as any;
  return {
    /**
     * Returns the balance of a given address.
     */
    balanceOf(owner: string) {
      return contract.balanceOf(owner);
    },
    /**
     * Approve an allowance for a spender.
     */
    approve(spender: string, amount: bigint) {
      return contract.approve(spender, amount);
    },
    /**
     * Fetch the decimals used by the token.
     */
    decimals() {
      return contract.decimals();
    },
    /**
     * Check how much the owner has allowed the spender to transfer.
     */
    allowance(owner: string, spender: string) {
      return contract.allowance(owner, spender);
    },
  };
}