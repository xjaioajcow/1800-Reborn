import { ethers } from 'ethers';
import { createGameToken } from './contracts/gameToken';
import { createCoreGameV2 } from './contracts/coreGameV2';
import { createShipSBT } from './contracts/shipSBT';
import { createPiratePool } from './contracts/piratePool';

/**
 * Factory that creates an aggregated SDK for interacting with all
 * supported contracts on BSC Testnet. A provider must be supplied,
 * optionally accompanied by a signer for write operations.
 */
export function createBscTestnetSdk(provider: ethers.Provider, signer?: ethers.Signer) {
  return {
    gameToken: createGameToken(provider, signer),
    coreGameV2: createCoreGameV2(provider, signer),
    shipSBT: createShipSBT(provider, signer),
    piratePool: createPiratePool(provider, signer),
  };
}