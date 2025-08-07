import { ethers } from 'ethers';
import { CONTRACTS } from '../contracts';

/**
 * Factory for interacting with the PiratePool contract.  Uses the full
 * ABI imported from contracts/abis/PiratePool.json and the deployed
 * address supplied via the BSC_TESTNET_ADDRESSES configuration.  In
 * addition to the basic stake/unstake/claim methods, this wrapper
 * exposes a helper for fetching aggregate pool information for a
 * particular user (staked amount, pending rewards and an estimated
 * APY) based on the on‑chain data returned by getUserOverview() and
 * getPoolsOverview().  Note that the pool exposes separate values
 * for Cargo and Fort pools; here we sum the values to return a
 * simpler aggregate.
 */
export function createPiratePool(
  provider: ethers.Provider,
  signer?: ethers.Signer,
) {
  const { address, abi } = CONTRACTS.piratePool;
  const signerOrProvider: any = signer ?? provider;
  const contract: any = new ethers.Contract(address, abi, signerOrProvider);
  return {
    /**
     * Stake tokens into the pool.  Accepts the amount of tokens to
     * stake and forwards the call directly to the underlying contract.
     */
    stake(amount: bigint) {
      return contract.stake(amount);
    },
    /**
     * Unstake tokens from the pool.  Accepts the amount of tokens to
     * withdraw and forwards the call directly to the contract.
     */
    unstake(amount: bigint) {
      return contract.unstake(amount);
    },
    /**
     * Claim accumulated rewards.  The on‑chain function is named
     * `claim` in the current ABI, so we map `claimReward` to it for
     * backwards compatibility with earlier versions of the SDK.
     */
    claimReward() {
      return contract.claim();
    },
    /**
     * Fetch summary information about a user's staking position and
     * pool performance.  Returns an object with the total staked
     * tokens, the total pending reward tokens and an estimated APY
     * derived from the Cargo/Fort APR values.  If the contract calls
     * revert or the wallet address is invalid, the promise will
     * reject.  Consumers should handle thrown errors accordingly.
     *
     * @param owner Address of the wallet to query
     */
    async getPiratePoolInfo(owner: string) {
      if (!owner || !ethers.isAddress(owner)) {
        throw new Error('Invalid address supplied to getPiratePoolInfo');
      }
      // getUserOverview returns four values: cargoStaked, fortStaked,
      // cargoPending, fortPending.  We sum staked/pending pairs.
      const [cargoStaked, fortStaked, cargoPending, fortPending]: [bigint, bigint, bigint, bigint] =
        await contract.getUserOverview(owner);
      const staked: bigint = cargoStaked + fortStaked;
      const pendingRewards: bigint = cargoPending + fortPending;
      // getPoolsOverview returns cargoTotalStake, fortTotalStake, cargoAPR, fortAPR
      const [_, __, cargoAPR, fortAPR]: [bigint, bigint, bigint, bigint] = await contract.getPoolsOverview();
      // Estimate APY as the average of the APR values.  Note: APR is
      // returned in basis points (e.g. 500 = 5%).  Convert to a plain
      // rate by dividing by 1e4.  Multiply by 100 to convert to
      // percent; return as a number rather than bigint for ease of use.
      const avgAPR: bigint = (cargoAPR + fortAPR) / 2n;
      const apy: number = Number(avgAPR) / 10000;
      return { staked, pendingRewards, apy } as const;
    },
  };
}