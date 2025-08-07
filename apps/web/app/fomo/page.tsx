"use client";

import { useState } from 'react';
import { ethers } from 'ethers';
import { useFomoStatus, useGameSdk } from '@cvf/sdk';
import Skeleton from '../../src/components/common/Skeleton';
import ErrorBanner from '../../src/components/common/ErrorBanner';

/**
 * FOMO competition page.  Displays current key counts and jackpots for
 * both factions along with a countdown timer.  Allows the user to
 * purchase a single key via the SDK.  This implementation assumes
 * that a signer is available on the returned SDK; if not it will
 * throw an error.  After a purchase the FOMO status is refetched.
 */
export default function FomoPage() {
  const { data: status, isLoading, error, refetch } = useFomoStatus();
  const sdk = useGameSdk();
  const [buying, setBuying] = useState(false);

  const handleBuyKey = async () => {
    // Ensure sdk is available
    if (!sdk) return;
    setBuying(true);
    try {
      // In a real application, obtain the signer from the connected wallet.
      // Here we attempt to derive a default signer from the SDK.  If not
      // present, throw an error so the ErrorBanner can display it.
      const signer = (sdk as any).signer ?? (sdk as any).defaultSigner;
      if (!signer) {
        throw new Error('Wallet not connected');
      }
      // Call the high‑level buyKey helper exposed on the SDK.  Pass
      // faction and quantity; the signer is the first argument.
      await (sdk as any).buyKey(signer, 'Cargo', BigInt(1));
      await refetch();
    } catch (err) {
      console.error(err);
    } finally {
      setBuying(false);
    }
  };

  return (
    <div className="p-4 space-y-4">
      <h2 className="text-xl font-semibold">FOMO Competition</h2>
      {isLoading && <Skeleton className="h-32 w-full" />}
      {error && <ErrorBanner error={error} />}
      {status && (
        <div className="space-y-2">
          <div className="grid grid-cols-2 gap-4">
            <div className="p-3 border rounded">
              <div className="font-medium">Cargo Keys</div>
              <div>{String(status.cargoKeys)}</div>
            </div>
            <div className="p-3 border rounded">
              <div className="font-medium">Fort Keys</div>
              <div>{String(status.fortKeys)}</div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="p-3 border rounded">
              <div className="font-medium">Cargo Jackpot</div>
              <div>{ethers.formatEther(status.cargoJackpot)} DBL</div>
            </div>
            <div className="p-3 border rounded">
              <div className="font-medium">Fort Jackpot</div>
              <div>{ethers.formatEther(status.fortJackpot)} DBL</div>
            </div>
          </div>
          <div className="p-3 border rounded">
            <div className="font-medium">Time Remaining</div>
            <div>{status.remainingTime} s</div>
          </div>
          <button
            type="button"
            onClick={handleBuyKey}
            disabled={buying}
            className="px-4 py-2 bg-blue-500 text-white rounded disabled:opacity-50"
          >
            {buying ? 'Buying…' : 'Buy Key'}
          </button>
        </div>
      )}
    </div>
  );
}