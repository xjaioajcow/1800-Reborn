import { describe, it, expect } from 'vitest';
import { createBscTestnetSdk } from '../src/sdk';
import { ethers } from 'ethers';

describe('createBscTestnetSdk', () => {
  it('should return SDK with all contract groups', () => {
    // The provider URL can be anything; we do not make network requests in this test.
    const provider = new ethers.JsonRpcProvider('http://localhost:8545');
    const sdk = createBscTestnetSdk(provider);
    expect(sdk).toHaveProperty('gameToken');
    expect(sdk).toHaveProperty('coreGameV2');
    expect(sdk).toHaveProperty('shipSBT');
    expect(sdk).toHaveProperty('piratePool');
  });
});