// Definitions related to ships. These types make it easier for
// both the SDK and the frontend to share a common representation
// of a ship. As more properties become available on-chain, extend
// this interface accordingly.

/**
 * Minimal information about a ship owned by a user. The on‑chain
 * contracts return additional data (e.g. runs left, CID for
 * metadata). Those fields can be added here as optional properties
 * once their formats are known.
 */
export interface ShipInfo {
  /**
   * Unique identifier of the ship (token ID). BigInt is used
   * because solidity uint256 values can exceed the safe integer
   * range of JavaScript numbers.
   */
  id: bigint;
  /**
   * Current level of the ship. Level increases through the
   * upgrade mechanic when combining ships of the same level and
   * faction. The initial level is 1.
   */
  level: number;
  /**
   * Faction to which the ship belongs. In v0.1 of the whitepaper
   * there is a single faction, CARGO. In future versions this may
   * become a union of string literals when additional factions are
   * introduced.
   */
  faction: 'CARGO';
  /**
   * Number of voyages left before the ship needs to be upgraded
   * or repaired. This field is optional because older contracts
   * may not provide it. When present it enables UI filtering for
   * ships that can still voyage.
   */
  runsLeft?: number;
  /**
   * Optional content identifier for retrieving metadata or images
   * for the ship. When undefined the UI should display a skeleton
   * placeholder instead of an image.
   */
  imageCid?: string;
}