import React from 'react';
// Import ShipInfo type from package root; subpath imports are not exported
import { ShipInfo } from '@cvf/sdk';
import { colors } from '../src/styles/colors';

interface ShipCardProps {
  ship: ShipInfo;
  /**
   * Whether the card should display a selectable checkbox. Useful for
   * choosing ships to upgrade.
   */
  selectable?: boolean;
  /**
   * Whether this card is currently selected. Used to toggle the
   * checkbox state and highlight the card.
   */
  selected?: boolean;
  /** Called when the user selects or deselects the ship. */
  onSelect?: (id: bigint) => void;
}

export default function ShipCard({
  ship,
  selectable = false,
  selected = false,
  onSelect,
}: ShipCardProps) {
  const handleClick = () => {
    if (selectable && onSelect) {
      onSelect(ship.id);
    }
  };

  // Resolve image source. If an IPFS CID is provided use a gateway;
  // otherwise return undefined so that the <img> tag falls back on
  // the skeleton.
  const imgSrc = ship.imageCid
    ? `https://ipfs.io/ipfs/${ship.imageCid}`
    : undefined;

  return (
    <div
      className={`border rounded-lg p-4 shadow-sm flex flex-col items-center cursor-pointer ${selected ? 'ring-2 ring-offset-2' : ''}`}
      style={{ borderColor: colors.primary }}
      onClick={handleClick}
    >
      {selectable && (
        <input
          type="checkbox"
          checked={selected}
          readOnly
          className="self-end mb-2"
        />
      )}
      <div className="w-24 h-24 flex items-center justify-center mb-4 bg-gray-100 rounded">
        {imgSrc ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={imgSrc} alt={`Ship ${ship.id.toString()}`} className="w-full h-full object-cover rounded" />
        ) : (
          <div className="w-full h-full bg-gray-300 animate-pulse rounded" />
        )}
      </div>
      <div className="text-center space-y-1">
        <p className="text-sm" style={{ color: colors.text }}>
          ID: {ship.id.toString()}
        </p>
        <p className="text-sm" style={{ color: colors.text }}>
          Level: {ship.level}
        </p>
        <p className="text-sm" style={{ color: colors.text }}>
          Faction: {ship.faction}
        </p>
        {ship.runsLeft !== undefined && (
          <p className="text-sm" style={{ color: colors.text }}>
            Runs Left: {ship.runsLeft}
          </p>
        )}
      </div>
    </div>
  );
}