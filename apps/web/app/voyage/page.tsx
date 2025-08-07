"use client";

import { useState } from 'react';
import { ethers } from 'ethers';
// Import hooks directly from package root; subpath imports are not exported
import { useGameSdk, useUserShips, useVoyageMutation } from '@cvf/sdk';

export default function VoyagePage() {
  const sdk = useGameSdk();
  // Create a dummy signer for demonstration. Replace with wallet signer.
  const [dummySigner] = useState(() => {
    // Use a throwaway provider for demonstration. Replace with real signer in production.
    const provider = new ethers.JsonRpcProvider();
    return ethers.Wallet.createRandom().connect(provider);
  });
  const userAddress = dummySigner.address;
  const { data: ships } = useUserShips(userAddress);
  const voyageMutation = useVoyageMutation();
  const [selectedId, setSelectedId] = useState<bigint | null>(null);
  const [dblInput, setDblInput] = useState('1');
  const [result, setResult] = useState<string | null>(null);

  const availableShips = ships?.filter((s: any) => s.runsLeft === undefined || s.runsLeft > 0) ?? [];

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedId) return;
    try {
      const txResult = await voyageMutation.mutateAsync({
        signer: dummySigner,
        shipId: selectedId,
        dbl: BigInt(dblInput),
      });
      // Parse reward from transaction receipt if available. Here we just
      // stringify the result for demo purposes.
      setResult(JSON.stringify(txResult));
    } catch (err: any) {
      setResult(err?.message ?? 'Error');
    }
  }

  return (
    <div className="p-4 space-y-4">
      <h2 className="text-lg font-semibold">出航</h2>
      <form onSubmit={handleSubmit} className="space-y-4 max-w-sm">
        <div>
          <label className="block text-sm mb-1" htmlFor="ship-select">
            选择船只
          </label>
          <select
            id="ship-select"
            value={selectedId ? selectedId.toString() : ''}
            onChange={(e) => setSelectedId(BigInt(e.target.value))}
            className="w-full p-2 border rounded"
          >
            <option value="" disabled>
              请选择…
            </option>
            {availableShips.map((ship: any) => (
              <option key={ship.id.toString()} value={ship.id.toString()}>
                ID {ship.id.toString()} – Lv.{ship.level}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm mb-1" htmlFor="dbl-input">
            DBL（距离）
          </label>
          <input
            id="dbl-input"
            type="number"
            min="1"
            step="1"
            value={dblInput}
            onChange={(e) => setDblInput(e.target.value)}
            className="w-full p-2 border rounded"
          />
        </div>
        <button
          type="submit"
          className="px-4 py-2 rounded text-white"
          style={{ backgroundColor: '#0057B8' }}
          disabled={!selectedId || voyageMutation.isPending}
        >
          {voyageMutation.isPending ? '执行中…' : '出航'}
        </button>
      </form>
      {voyageMutation.isError && (
        <p className="text-red-600">出航失败：{(voyageMutation.error as Error).message}</p>
      )}
      {voyageMutation.isSuccess && result && (
        <p className="text-green-600">出航完成，结果：{result}</p>
      )}
    </div>
  );
}