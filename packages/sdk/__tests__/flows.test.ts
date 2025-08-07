import { describe, it, expect, vi } from 'vitest';
import { ethers } from 'ethers';
import { buyShipFlow, voyageFlow, upgradeFlow } from '../src/flows';

describe('SDK flows', () => {
  it('buyShipFlow calls sdk.buyShip and waits for receipt', async () => {
    // Arrange fake SDK
    const txResponse: any = {
      hash: '0x123',
      wait: vi.fn().mockResolvedValue({ status: 1 }),
    };
    const sdk = {
      buyShip: vi.fn().mockResolvedValue(txResponse),
    };
    // Create fake signer
    const signer = {
      getAddress: vi.fn().mockResolvedValue('0xowner'),
    } as unknown as ethers.Signer;
    // Act
    const result = await buyShipFlow(sdk, signer, 1, 1n);
    // Assert
    expect(sdk.buyShip).toHaveBeenCalledWith(signer, 1, 1n);
    expect(txResponse.wait).toHaveBeenCalled();
    expect(result.hash).toBe('0x123');
  });

  it('voyageFlow approves when allowance is insufficient', async () => {
    // Fake tx responses for approve and voyage
    const approveTx: any = {
      wait: vi.fn().mockResolvedValue({ status: 1 }),
    };
    const voyageTx: any = {
      hash: '0xabc',
      wait: vi.fn().mockResolvedValue({ status: 1 }),
    };
    // Fake sdk with allowance < enemyAmt
    const sdk = {
      gameToken: {
        allowance: vi.fn().mockResolvedValue(0n),
        approve: vi.fn().mockResolvedValue(approveTx),
      },
      voyage: vi.fn().mockResolvedValue(voyageTx),
    };
    // Fake signer
    const signer = {
      getAddress: vi.fn().mockResolvedValue('0xowner'),
    } as unknown as ethers.Signer;
    // Act
    const result = await voyageFlow(sdk, signer, 1n, 10n);
    // Assert approve was called
    expect(sdk.gameToken.allowance).toHaveBeenCalledWith('0xowner', expect.any(String));
    expect(sdk.gameToken.approve).toHaveBeenCalledWith(expect.any(String), 10n);
    expect(voyageTx.wait).toHaveBeenCalled();
    expect(result.hash).toBe('0xabc');
  });

  it('upgradeFlow calls sdk.upgradeShip', async () => {
    const upgradeTx: any = {
      hash: '0xupg',
      wait: vi.fn().mockResolvedValue({ status: 1 }),
    };
    const sdk = {
      upgradeShip: vi.fn().mockResolvedValue(upgradeTx),
    };
    const signer = {
      getAddress: vi.fn().mockResolvedValue('0xowner'),
    } as unknown as ethers.Signer;
    const result = await upgradeFlow(sdk, signer, 1n, 2n);
    expect(sdk.upgradeShip).toHaveBeenCalledWith(signer, 1n, 2n);
    expect(upgradeTx.wait).toHaveBeenCalled();
    expect(result.hash).toBe('0xupg');
  });
});