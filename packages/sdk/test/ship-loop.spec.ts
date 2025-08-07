import { describe, it, expect } from 'vitest';
import { ethers } from 'ethers';
import {
  buyShip,
  upgradeShip,
  voyage,
  getShipPrice,
} from '../src/contracts/CoreGameV2';
import { createBscTestnetSdk } from '../src/sdk';

describe('Ship loop SDK helpers', () => {
  it('upgradeShip throws when using the same token ID', async () => {
    const provider = new ethers.JsonRpcProvider();
    const signer = ethers.Wallet.createRandom().connect(provider);
    // When idA === idB the function should throw synchronously
    await expect(upgradeShip(signer, 1n, 1n)).rejects.toThrow(
      /same ship/i,
    );
  });

  it('createBscTestnetSdk exposes buyShip, upgradeShip, voyage and getShipPrice', () => {
    const provider = new ethers.JsonRpcProvider();
    const sdk = createBscTestnetSdk(provider);
    expect(typeof sdk.buyShip).toBe('function');
    expect(typeof sdk.upgradeShip).toBe('function');
    expect(typeof sdk.voyage).toBe('function');
    expect(typeof sdk.getShipPrice).toBe('function');
  });

  it('buyShip returns a promise when invoked and rejects when contract function is missing', async () => {
    const provider = new ethers.JsonRpcProvider();
    const signer = ethers.Wallet.createRandom().connect(provider);
    const sdk = createBscTestnetSdk(provider);
    const p = sdk.buyShip(signer);
    expect(p).toBeInstanceOf(Promise);
    await expect(p).rejects.toThrow();
  });

  it('voyage returns a promise when invoked and rejects when contract function is missing', async () => {
    const provider = new ethers.JsonRpcProvider();
    const signer = ethers.Wallet.createRandom().connect(provider);
    const sdk = createBscTestnetSdk(provider);
    const p = sdk.voyage(signer, 1n, 1n);
    expect(p).toBeInstanceOf(Promise);
    await expect(p).rejects.toThrow();
  });

  it('upgradeShip returns a promise when IDs are distinct and rejects when contract function is missing', async () => {
    const provider = new ethers.JsonRpcProvider();
    const signer = ethers.Wallet.createRandom().connect(provider);
    const sdk = createBscTestnetSdk(provider);
    const p = sdk.upgradeShip(signer, 1n, 2n);
    expect(p).toBeInstanceOf(Promise);
    await expect(p).rejects.toThrow();
  });

  it('getShipPrice throws when method is unavailable', async () => {
    const provider = new ethers.JsonRpcProvider();
    // Without an ABI, getShipPrice is undefined and should reject
    await expect(getShipPrice(provider)).rejects.toThrow();
  });
});