import { ethers } from 'ethers';
import type { ReturnType } from '../sdk';

/**
 * Helper to purchase ships.  The provided SDK instance must be
 * constructed with a signer.  The function will call the underlying
 * coreGameV2.buyShip method and wait for the transaction to be
 * confirmed.  In a full implementation this helper would also
 * automatically check allowances and approve tokens as necessary as
 * described in the project whitepaper.  Those steps are omitted here
 * because the actual contract ABIs are not available.
 *
 * @param sdk Aggregated SDK instance created via createBscTestnetSdk
 * @param level Ship level (typically 1 for new ships)
 * @param qty   Quantity to purchase
 * @returns The transaction hash and receipt
 */
export async function buyShipFlow(
  sdk: any,
  signer: ethers.Signer,
  level: number = 1,
  qty: bigint = 1n,
): Promise<{ hash: string; receipt: ethers.TransactionReceipt }> {
  // In a full implementation we would calculate the payment value and
  // approve any necessary token allowances.  For now we simply
  // execute the transaction.  Use the aggregated SDK's buyShip helper.
  const tx: ethers.TransactionResponse = await sdk.buyShip(signer, level, qty);
  const receipt = await tx.wait();
  return { hash: tx.hash, receipt };
}

/**
 * Helper to send a ship on a voyage.  Automatically waits for the
 * transaction to confirm and returns the receipt.  Additional
 * allowance checks and gas estimation should be implemented when
 * contract ABIs are available.
 *
 * @param sdk Aggregated SDK instance
 * @param shipId ID of the ship
 * @param enemyAmt Amount of enemy tokens (DBL) to wager
 */
export async function voyageFlow(
  sdk: any,
  signer: ethers.Signer,
  shipId: bigint,
  enemyAmt: bigint,
): Promise<{ hash: string; receipt: ethers.TransactionReceipt }> {
  // Before starting a voyage, ensure the user has approved enough DBL
  // (enemy tokens) for the CoreGameV2 contract.  We assume the DBL
  // token is represented by the GameToken interface in our SDK.
  // Determine the owner address from the signer.
  const owner = await signer.getAddress();
  // CoreGameV2 address is stored in constants.  Import lazily to
  // avoid circular dependency.
  const { BSC_TESTNET_ADDRESSES } = await import('../constants');
  const spender = BSC_TESTNET_ADDRESSES.CoreGameV2;
  // Check current allowance
  const currentAllowance: bigint = await sdk.gameToken.allowance(owner, spender);
  if (currentAllowance < enemyAmt) {
    const approveTx: ethers.TransactionResponse = await sdk.gameToken.approve(
      spender,
      enemyAmt,
    );
    await approveTx.wait();
  }
  // Send the voyage transaction via the aggregated helper
  const tx: ethers.TransactionResponse = await sdk.voyage(signer, shipId, enemyAmt);
  const receipt = await tx.wait();
  return { hash: tx.hash, receipt };
}

/**
 * Helper to upgrade two ships.  If the same IDs are provided the
 * underlying SDK will throw before sending the transaction.  The
 * helper waits for the transaction to confirm and returns the receipt.
 *
 * @param sdk Aggregated SDK instance
 * @param shipIdA First ship ID
 * @param shipIdB Second ship ID
 */
export async function upgradeFlow(
  sdk: any,
  signer: ethers.Signer,
  shipIdA: bigint,
  shipIdB: bigint,
): Promise<{ hash: string; receipt: ethers.TransactionReceipt }> {
  const tx: ethers.TransactionResponse = await sdk.upgradeShip(
    signer,
    shipIdA,
    shipIdB,
  );
  const receipt = await tx.wait();
  return { hash: tx.hash, receipt };
}