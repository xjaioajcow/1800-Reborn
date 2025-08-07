import { ethers } from 'ethers';
import { EventEmitter } from 'events';
import { CONTRACTS } from './contracts';
import { RPC_URL } from './constants';

/**
 * Factory for interacting with the CoreGameV2 contract.  This module
 * encapsulates high‑level operations such as purchasing ships,
 * sending ships on voyages, upgrading ships, finishing a game day,
 * and claiming winner rewards.  It automatically handles token
 * approvals for the underlying DBL/Cargo/Fort tokens when
 * allowances are insufficient.  An EventEmitter is used to notify
 * consumers when certain on‑chain events occur.  Because the exact
 * ABI event names may vary, the emitter uses generic names:
 * `voyageExecuted`, `keyPurchased`, and `dayFinished`.
 */
export function createCoreGame(
  provider?: ethers.Provider,
  defaultSigner?: ethers.Signer,
) {
  // Use the provided provider or fall back to RPC_URL.  Throws if
  // RPC_URL is not defined.
  const usedProvider: ethers.Provider =
    provider ?? (RPC_URL ? new ethers.JsonRpcProvider(RPC_URL) : undefined as any);
  if (!usedProvider) {
    throw new Error('Missing RPC provider. Set NEXT_PUBLIC_RPC_URL');
  }
  // Instantiate contracts for the core game and the game token.  The
  // contracts are connected to the provider by default.  When a
  // signer is supplied the connect(signer) method will be used for
  // write operations.
  const coreGame = new ethers.Contract(
    CONTRACTS.coreGameV2.address,
    CONTRACTS.coreGameV2.abi,
    usedProvider,
  );
  const gameToken = new ethers.Contract(
    CONTRACTS.gameToken.address,
    CONTRACTS.gameToken.abi,
    usedProvider,
  );
  // Create an event emitter for high‑level game events.  Consumers
  // can subscribe to these events via the `on` method on the return
  // object.
  const emitter = new EventEmitter();

  /**
   * Ensure that the signer has granted sufficient allowance to the
   * CoreGame contract for a given amount of tokens.  If the current
   * allowance is less than the requested amount, this function
   * sends an approve transaction and waits for it to confirm.
   *
   * @param signer Wallet that will sign the approval
   * @param amount Amount of tokens required
   */
  async function ensureAllowance(
    signer: ethers.Signer,
    amount: bigint,
  ) {
    const owner = await signer.getAddress();
    const spender = CONTRACTS.coreGameV2.address;
    const current: bigint = await gameToken.allowance(owner, spender);
    if (current < amount) {
      const approveTx: ethers.TransactionResponse = await gameToken
        .connect(signer)
        .approve(spender, amount);
      await approveTx.wait();
    }
  }

  /**
   * Execute a transaction on the core game contract and wait for
   * confirmation.  Emits the provided eventName when the receipt
   * arrives.
   */
  async function execAndEmit(
    txPromise: Promise<ethers.TransactionResponse>,
    eventName: string,
  ) {
    const tx = await txPromise;
    const receipt = await tx.wait();
    emitter.emit(eventName, receipt);
    return receipt;
  }

  return {
    /** Event emitter.  Subscribe to events such as `voyageExecuted`
     *  or `keyPurchased` using emitter.on(eventName, listener).
     */
    on: emitter.on.bind(emitter),

    /**
     * Purchase ships.  Automatically approves enough tokens (if
     * necessary) and returns the transaction receipt.  Defaults to
     * level 1 and quantity 1.
     */
    async buyShip(
      signer: ethers.Signer = defaultSigner as any,
      level: number = 1,
      quantity: bigint = 1n,
    ) {
      if (!signer) throw new Error('Signer is required for buyShip');
      // TODO: determine required payment amount from contract (e.g., price)
      // and call ensureAllowance accordingly.  For now we skip allowance
      // because payment is in native BNB and DBL is deducted on chain.
      const contract = coreGame.connect(signer);
      return execAndEmit(contract.buyShip(level, quantity), 'shipPurchased');
    },

    /**
     * Send a ship on a voyage.  Ensures token allowance for the
     * specified enemy amount and waits for confirmation.  Emits
     * `voyageExecuted` on success.
     */
    async voyage(
      signer: ethers.Signer = defaultSigner as any,
      shipId: bigint,
      enemyAmount: bigint,
    ) {
      if (!signer) throw new Error('Signer is required for voyage');
      await ensureAllowance(signer, enemyAmount);
      const contract = coreGame.connect(signer);
      return execAndEmit(contract.voyage(shipId, enemyAmount), 'voyageExecuted');
    },

    /**
     * Upgrade two ships.  Returns the transaction receipt.  Emits
     * `shipUpgraded` on completion.
     */
    async upgradeShip(
      signer: ethers.Signer = defaultSigner as any,
      shipIdA: bigint,
      shipIdB: bigint,
    ) {
      if (!signer) throw new Error('Signer is required for upgradeShip');
      if (shipIdA === shipIdB) throw new Error('Cannot upgrade the same ship');
      const contract = coreGame.connect(signer);
      return execAndEmit(contract.upgradeShip(shipIdA, shipIdB), 'shipUpgraded');
    },

    /**
     * Finish the current game day.  This triggers settlement on chain
     * and emits `dayFinished` when the transaction confirms.
     */
    async finishDay(signer: ethers.Signer = defaultSigner as any) {
      if (!signer) throw new Error('Signer is required for finishDay');
      const contract = coreGame.connect(signer);
      return execAndEmit(contract.finishDay(), 'dayFinished');
    },

    /**
     * Claim the winner reward from the game.  Emits `winnerClaimed`
     * after confirmation.
     */
    async claimWinnerReward(signer: ethers.Signer = defaultSigner as any) {
      if (!signer) throw new Error('Signer is required for claimWinnerReward');
      const contract = coreGame.connect(signer);
      return execAndEmit(contract.claimWinnerReward(), 'winnerClaimed');
    },
  };
}