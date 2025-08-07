import { ethers } from 'ethers';
import { CONTRACTS } from './contracts';
import { RPC_URL } from './constants';

/**
 * Batch fetch the level and faction for a list of ShipSBT token IDs.
 * This helper attempts to call the core game contract for each
 * token.  If the contract exposes a batched view (e.g.
 * `getLevelsAndFactions(ids[])`) then it should be used instead.
 * Otherwise the helper falls back to calling per‑token getters.
 * If a call fails the level defaults to 0 and faction to 'UNKNOWN'.
 *
 * @param owner Not currently used; reserved for future optimisation
 * @param tokenIds Array of ship token IDs
 */
export async function batchLevelAndFaction(
  owner: string,
  tokenIds: bigint[],
) {
  const provider = new ethers.JsonRpcProvider(RPC_URL);
  const coreGame = new ethers.Contract(
    CONTRACTS.coreGameV2.address,
    CONTRACTS.coreGameV2.abi,
    provider,
  ) as any;
  const levels: number[] = [];
  const factions: string[] = [];
  for (const id of tokenIds) {
    try {
      // Try a hypothetical batched method first
      if (typeof coreGame.getLevelsAndFactions === 'function') {
        const { levels: lvlArr, factions: facArr } = await coreGame.getLevelsAndFactions(
          tokenIds,
        );
        return { levels: lvlArr.map((n: any) => Number(n)), factions: facArr as string[] };
      }
      // Fallback to per‑token getters.  These method names are
      // guesses based on common naming conventions.  Adjust when
      // ABIs are finalised.
      let level: number = 0;
      let faction: string = 'UNKNOWN';
      if (typeof coreGame.getLevel === 'function') {
        level = Number(await coreGame.getLevel(id));
      }
      if (typeof coreGame.getFaction === 'function') {
        faction = await coreGame.getFaction(id);
      }
      levels.push(level);
      factions.push(faction);
    } catch {
      levels.push(0);
      factions.push('UNKNOWN');
    }
  }
  return { levels, factions };
}