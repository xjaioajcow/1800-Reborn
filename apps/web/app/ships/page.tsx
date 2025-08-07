"use client";

import { useState, useMemo } from 'react';
import { ethers } from 'ethers';
// Import hooks directly from package root; subpath imports are not exported
import { useGameSdk, useUserShips, useBuyShip, useUpgradeShip } from '@cvf/sdk';
import TxModal from '../../components/TxModal';
import ShipCard from '../../components/ShipCard';
import { useQuery } from '@tanstack/react-query';

export default function ShipsPage() {
  const sdk = useGameSdk();
  // For demonstration we assume the connected user address is available in the signer.
  // In a real application this would come from a wallet connector such as Wagmi.
  const [dummySigner] = useState(() => {
    // Create a throwaway provider and wallet. Replace with real signer in production.
    const provider = new ethers.JsonRpcProvider();
    return ethers.Wallet.createRandom().connect(provider);
  });
  const [selected, setSelected] = useState<bigint[]>([]);
  const [buyModalOpen, setBuyModalOpen] = useState(false);
  const [upgradeModalOpen, setUpgradeModalOpen] = useState(false);

  // Replace with actual user address when integrating with a wallet. When
  // undefined the useUserShips hook will be disabled.
  const userAddress = dummySigner.address;
  const { data: ships, isLoading } = useUserShips(userAddress);

  // Query current ship price from the contract. Wrap in React Query for
  // caching and automatic refresh.
  const { data: shipPrice } = useQuery({
    queryKey: ['shipPrice'],
    queryFn: async () => {
      // Use the same provider as the dummy signer
      return sdk.getShipPrice(dummySigner.provider);
    },
  });

  const buyMutation = useBuyShip();
  const upgradeMutation = useUpgradeShip();

  const handleSelect = (id: bigint) => {
    setSelected((prev) => {
      const exists = prev.find((x) => x === id);
      if (exists) {
        return prev.filter((x) => x !== id);
      }
      return prev.length < 2 ? [...prev, id] : prev;
    });
  };

  const handleBuy = async () => {
    // For now purchase one level‑1 ship.  Extend this to accept quantity
    // from user input when implementing the full modal UI.
    await buyMutation.mutateAsync({ signer: dummySigner, level: 1, qty: BigInt(1) });
    setBuyModalOpen(false);
  };

  const handleUpgrade = async () => {
    if (selected.length === 2) {
      const [idA, idB] = selected;
      await upgradeMutation.mutateAsync({ signer: dummySigner, idA, idB });
    }
    setUpgradeModalOpen(false);
    setSelected([]);
  };

  const shipsContent = () => {
    if (isLoading) {
      return <p>加载中…</p>;
    }
    if (!ships || ships.length === 0) {
      return <p>暂无船只</p>;
    }
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
        {ships.map((ship: any) => (
          <ShipCard
            key={ship.id.toString()}
            ship={ship}
            selectable
            selected={selected.includes(ship.id)}
            onSelect={handleSelect}
          />
        ))}
      </div>
    );
  };

  return (
    <div className="p-4 space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-semibold">我的船只</h2>
        <button
          className="px-4 py-2 rounded text-white"
          style={{ backgroundColor: '#0057B8' }}
          onClick={() => setBuyModalOpen(true)}
        >
          买船
        </button>
      </div>
      {shipsContent()}
      {selected.length === 2 && (
        <div className="flex justify-end">
          <button
            className="mt-4 px-4 py-2 rounded text-white"
            style={{ backgroundColor: '#0057B8' }}
            onClick={() => setUpgradeModalOpen(true)}
          >
            升级
          </button>
        </div>
      )}
      {/* Buy ship modal */}
      <TxModal
        open={buyModalOpen}
        onClose={() => setBuyModalOpen(false)}
        title="确认买船"
        price={shipPrice}
        onConfirm={handleBuy}
      />
      {/* Upgrade ship modal */}
      <TxModal
        open={upgradeModalOpen}
        onClose={() => setUpgradeModalOpen(false)}
        title="确认升级"
        onConfirm={handleUpgrade}
      />
    </div>
  );
}