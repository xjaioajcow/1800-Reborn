"use client";

import { useState } from 'react';
import { ethers } from 'ethers';
import { usePiratePool, useGameSdk } from '@cvf/sdk';
import Skeleton from '../../src/components/common/Skeleton';
import ErrorBanner from '../../src/components/common/ErrorBanner';
import MaxButton from '../../src/components/common/MaxButton';

/**
 * Pirate Pool staking page.  Displays the user's staked amount,
 * pending rewards and APY, and provides controls to stake, unstake
 * and claim rewards.  The user's wallet address must be passed
 * explicitly; without it the info query will be disabled.  In this
 * example implementation we rely on a dummy address and signer
 * because wallet integration (e.g. via wagmi) is not included.  To
 * enable full functionality plug in your preferred wallet provider
 * and obtain the current user's address and signer.
 */
export default function PiratePoolPage() {
  // TODO: Replace with real wallet integration.  Without a valid
  // address the info query will be disabled and no data will be
  // fetched.  Developers should inject the user's address here.
  const [owner, setOwner] = useState<string>('');
  // Cast the return type of usePiratePool to any to avoid TS complaining
  const {
    info,
    isLoading,
    error,
    stake,
    unstake,
    claimReward,
    isStaking,
    isUnstaking,
    isClaiming,
  } = usePiratePool(owner) as any;
  const sdk = useGameSdk();
  const [stakeAmt, setStakeAmt] = useState<string>('');
  const [unstakeAmt, setUnstakeAmt] = useState<string>('');

  // Helper to parse the input into a bigint.  Accepts decimal
  // string representing token amount in wei.
  const parseAmount = (val: string): bigint => {
    try {
      return BigInt(val || '0');
    } catch {
      return BigInt(0);
    }
  };

  const handleStake = async () => {
    if (!owner) return;
    try {
      // Use a dummy signer for demonstration.  Replace with
      // provider.getSigner() from wallet integration.
      // Obtain a signer from the SDK.  The coreGame wrapper does not
      // expose `defaultSigner` in its TypeScript type, so cast via any.
      const signer = (sdk as any).coreGame?.defaultSigner as ethers.Signer | undefined;
      if (!signer) throw new Error('Wallet not connected');
      await stake({ signer, amount: parseAmount(stakeAmt) });
    } catch (err) {
      console.error(err);
    }
  };
  const handleUnstake = async () => {
    if (!owner) return;
    try {
      const signer = (sdk as any).coreGame?.defaultSigner as ethers.Signer | undefined;
      if (!signer) throw new Error('Wallet not connected');
      await unstake({ signer, amount: parseAmount(unstakeAmt) });
    } catch (err) {
      console.error(err);
    }
  };
  const handleClaim = async () => {
    if (!owner) return;
    try {
      const signer = (sdk as any).coreGame?.defaultSigner as ethers.Signer | undefined;
      if (!signer) throw new Error('Wallet not connected');
      await claimReward({ signer });
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="p-4 space-y-4">
      <h2 className="text-xl font-semibold">Pirate Pool</h2>
      <div className="space-y-2">
        <label className="block">
          <span className="text-sm">Your Address</span>
          <input
            type="text"
            value={owner}
            onChange={(e) => setOwner(e.target.value)}
            className="mt-1 w-full p-2 border rounded"
            placeholder="0x..."
          />
        </label>
      </div>
      {isLoading && <Skeleton className="h-24 w-full" />}
      {error && <ErrorBanner error={error} />}
      {info && (
        <div className="space-y-2">
          <div className="flex justify-between">
            <span>Staked:</span>
            <span>{String(info.staked)}</span>
          </div>
          <div className="flex justify-between">
            <span>Pending Rewards:</span>
            <span>{String(info.pendingRewards)}</span>
          </div>
          <div className="flex justify-between">
            <span>APY:</span>
            <span>{(info.apy * 100).toFixed(2)}%</span>
          </div>
        </div>
      )}
      {/* Stake form */}
      <div className="space-y-2 border-t pt-4">
        <h3 className="font-medium">Stake Tokens</h3>
        <div className="flex items-center">
          <input
            type="number"
            value={stakeAmt}
            onChange={(e) => setStakeAmt(e.target.value)}
            className="flex-1 p-2 border rounded"
            placeholder="Amount in wei"
          />
          <MaxButton onClick={() => setStakeAmt(info ? String(info.staked) : '0')} />
        </div>
        <button
          type="button"
          onClick={handleStake}
          disabled={isStaking || !owner}
          className="px-4 py-2 bg-green-500 text-white rounded disabled:opacity-50"
        >
          {isStaking ? 'Staking…' : 'Stake'}
        </button>
      </div>
      {/* Unstake form */}
      <div className="space-y-2 border-t pt-4">
        <h3 className="font-medium">Unstake Tokens</h3>
        <div className="flex items-center">
          <input
            type="number"
            value={unstakeAmt}
            onChange={(e) => setUnstakeAmt(e.target.value)}
            className="flex-1 p-2 border rounded"
            placeholder="Amount in wei"
          />
          <MaxButton onClick={() => setUnstakeAmt(info ? String(info.staked) : '0')} />
        </div>
        <button
          type="button"
          onClick={handleUnstake}
          disabled={isUnstaking || !owner}
          className="px-4 py-2 bg-yellow-500 text-white rounded disabled:opacity-50"
        >
          {isUnstaking ? 'Unstaking…' : 'Unstake'}
        </button>
      </div>
      {/* Claim rewards */}
      <div className="border-t pt-4">
        <button
          type="button"
          onClick={handleClaim}
          disabled={isClaiming || !owner}
          className="px-4 py-2 bg-indigo-500 text-white rounded disabled:opacity-50"
        >
          {isClaiming ? 'Claiming…' : 'Claim Rewards'}
        </button>
      </div>
    </div>
  );
}