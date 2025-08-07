import { describe, it, expect, vi } from 'vitest';
import { buyShipFlow, voyageFlow, upgradeFlow } from '../src/flows';

// Mock ethers.TransactionResponse to satisfy TypeScript type checks.
interface MockTx {
  hash: string;
  wait: () => Promise<any>;
}

describe('SDK flows', () => {
  it('buyShipFlow calls buyShip and waits for receipt', async () => {
    const tx: MockTx = { hash: '0xabc', wait: vi.fn().mockResolvedValue({ status: 1 }) };
    const sdk = {
      coreGameV2: {
        buyShip: vi.fn().mockResolvedValue(tx),
      },
    } as any;
    const result = await buyShipFlow(sdk, 1, 2n);
    expect(sdk.coreGameV2.buyShip).toHaveBeenCalledWith(1, 2n);
    expect((tx.wait as any)).toHaveBeenCalled();
    expect(result.hash).toBe('0xabc');
  });

  it('buyShipFlow propagates errors', async () => {
    const sdk = {
      coreGameV2: {
        buyShip: vi.fn().mockRejectedValue(new Error('buy failed')),
      },
    } as any;
    await expect(buyShipFlow(sdk, 1, 1n)).rejects.toThrow('buy failed');
  });

  it('voyageFlow calls voyage and waits for receipt', async () => {
    const tx: MockTx = { hash: '0xdef', wait: vi.fn().mockResolvedValue({ status: 1 }) };
    const sdk = {
      coreGameV2: {
        voyage: vi.fn().mockResolvedValue(tx),
      },
    } as any;
    const result = await voyageFlow(sdk, 10n, 5n);
    expect(sdk.coreGameV2.voyage).toHaveBeenCalledWith(10n, 5n);
    expect((tx.wait as any)).toHaveBeenCalled();
    expect(result.hash).toBe('0xdef');
  });

  it('voyageFlow propagates errors', async () => {
    const sdk = {
      coreGameV2: {
        voyage: vi.fn().mockRejectedValue(new Error('voyage failed')),
      },
    } as any;
    await expect(voyageFlow(sdk, 1n, 1n)).rejects.toThrow('voyage failed');
  });

  it('upgradeFlow calls upgradeShip and waits for receipt', async () => {
    const tx: MockTx = { hash: '0x123', wait: vi.fn().mockResolvedValue({ status: 1 }) };
    const sdk = {
      coreGameV2: {
        upgradeShip: vi.fn().mockResolvedValue(tx),
      },
    } as any;
    const result = await upgradeFlow(sdk, 7n, 8n);
    expect(sdk.coreGameV2.upgradeShip).toHaveBeenCalledWith(7n, 8n);
    expect((tx.wait as any)).toHaveBeenCalled();
    expect(result.hash).toBe('0x123');
  });

  it('upgradeFlow propagates errors', async () => {
    const sdk = {
      coreGameV2: {
        upgradeShip: vi.fn().mockRejectedValue(new Error('upgrade failed')),
      },
    } as any;
    await expect(upgradeFlow(sdk, 1n, 1n)).rejects.toThrow('upgrade failed');
  });
});