import { ethers } from 'ethers';
// Do not import ReturnType from '../sdk' as it conflicts with
// TypeScript's built‑in ReturnType utility and causes the DTS build
// to fail.  If ReturnType is needed, use the global utility type
// instead.

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
/**
 * Purchase ships using the aggregated SDK.  This helper supports
 * multiple SDK shapes: older versions expose buyShip on the
 * coreGameV2 property without requiring a signer, while newer
 * versions expose buyShip at the top level and expect a signer as
 * the first argument.  The helper detects which signature is
 * available and delegates appropriately.  It always waits for the
 * returned transaction to confirm before resolving.
 *
 * @param sdk Aggregated SDK instance created via createBscTestnetSdk
 * @param signer Signer used to authorize the transaction
 * @param level Ship level (defaults to 1)
 * @param qty Quantity to purchase (defaults to 1)
 */
export async function buyShipFlow(
  sdk: any,
  arg1?: any,
  arg2?: any,
  arg3?: any,
): Promise<{ hash: string; receipt: ethers.TransactionReceipt }> {
  // Determine whether a signer was passed.  If the first argument
  // has a getAddress function treat it as an ethers.Signer; otherwise
  // interpret the first argument as the level and shift arguments.
  let signer: ethers.Signer | undefined;
  let level: number;
  let qty: bigint;
  if (arg1 && typeof arg1 === 'object' && typeof arg1.getAddress === 'function') {
    signer = arg1 as ethers.Signer;
    level = (arg2 as number) ?? 1;
    qty = (arg3 as bigint) ?? 1n;
  } else {
    signer = undefined;
    level = (arg1 as number) ?? 1;
    qty = (arg2 as bigint) ?? 1n;
  }
  let tx: ethers.TransactionResponse;
  // Newer SDK: buyShip exists at top level and requires a signer
  if (typeof sdk.buyShip === 'function') {
    // Pass signer if defined; otherwise sdk.buyShip may throw
    tx = await sdk.buyShip(signer, level, qty);
  } else if (sdk.coreGameV2 && typeof sdk.coreGameV2.buyShip === 'function') {
    // Older SDK: call buyShip on coreGameV2 without signer
    tx = await sdk.coreGameV2.buyShip(level, qty);
  } else {
    throw new Error('buyShip is not available on the SDK');
  }
  const receipt = await tx.wait();
  if (!receipt) {
    throw new Error('Transaction receipt missing');
  }
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
/**
 * Send a ship on a voyage.  This helper automatically ensures that
 * the user has granted sufficient token allowance when the SDK
 * exposes a gameToken with allowance/approve methods.  It also
 * adapts to both legacy and current SDK shapes: either
 * sdk.voyage(signer, shipId, enemyAmt) or
 * sdk.coreGameV2.voyage(shipId, enemyAmt).  The transaction is
 * awaited and the receipt returned once confirmed.
 *
 * @param sdk Aggregated SDK instance
 * @param signer Signer used to authorize the transaction
 * @param shipId ID of the ship to send on a voyage
 * @param enemyAmt Amount of enemy tokens (DBL) to wager
 */
export async function voyageFlow(
  sdk: any,
  arg1?: any,
  arg2?: any,
  arg3?: any,
): Promise<{ hash: string; receipt: ethers.TransactionReceipt }> {
  // Determine if a signer was passed as the first argument.
  let signer: ethers.Signer | undefined;
  let shipId: bigint;
  let enemyAmt: bigint;
  if (arg1 && typeof arg1 === 'object' && typeof arg1.getAddress === 'function') {
    signer = arg1 as ethers.Signer;
    shipId = arg2 as bigint;
    enemyAmt = arg3 as bigint;
  } else {
    signer = undefined;
    shipId = arg1 as bigint;
    enemyAmt = arg2 as bigint;
  }
  // If the SDK exposes a gameToken with allowance/approve, ensure
  // sufficient allowance before proceeding.  Only attempt this
  // logic when a signer is provided because allowance checks require
  // the owner's address.
  if (
    signer &&
    sdk.gameToken &&
    typeof sdk.gameToken.allowance === 'function' &&
    typeof sdk.gameToken.approve === 'function'
  ) {
    const owner = await signer.getAddress();
    const spender = sdk.coreGameV2?.address ?? (sdk.coreGame?.address ?? '');
    const currentAllowance: bigint = await sdk.gameToken.allowance(owner, spender);
    if (currentAllowance < enemyAmt) {
      await sdk.gameToken.approve(spender, enemyAmt);
    }
  }
  let tx: ethers.TransactionResponse;
  if (typeof sdk.voyage === 'function') {
    tx = await sdk.voyage(signer, shipId, enemyAmt);
  } else if (sdk.coreGameV2 && typeof sdk.coreGameV2.voyage === 'function') {
    tx = await sdk.coreGameV2.voyage(shipId, enemyAmt);
  } else {
    throw new Error('voyage is not available on the SDK');
  }
  const receipt = await tx.wait();
  if (!receipt) {
    throw new Error('Transaction receipt missing');
  }
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
/**
 * Upgrade two ships to the next level.  Detects whether the SDK
 * exposes upgradeShip(signer, idA, idB) at the top level or
 * coreGameV2.upgradeShip(idA, idB) on older SDKs.  A signer is
 * required for the newer interface.  Waits for the transaction to
 * confirm and returns the receipt.
 *
 * @param sdk Aggregated SDK instance
 * @param signer Signer used to authorize the transaction
 * @param shipIdA First ship ID
 * @param shipIdB Second ship ID
 */
export async function upgradeFlow(
  sdk: any,
  arg1?: any,
  arg2?: any,
  arg3?: any,
): Promise<{ hash: string; receipt: ethers.TransactionReceipt }> {
  // Determine if a signer was passed.  If the first argument has
  // getAddress treat it as a signer, otherwise shift args.
  let signer: ethers.Signer | undefined;
  let shipIdA: bigint;
  let shipIdB: bigint;
  if (arg1 && typeof arg1 === 'object' && typeof arg1.getAddress === 'function') {
    signer = arg1 as ethers.Signer;
    shipIdA = arg2 as bigint;
    shipIdB = arg3 as bigint;
  } else {
    signer = undefined;
    shipIdA = arg1 as bigint;
    shipIdB = arg2 as bigint;
  }
  let tx: ethers.TransactionResponse;
  if (typeof sdk.upgradeShip === 'function') {
    tx = await sdk.upgradeShip(signer, shipIdA, shipIdB);
  } else if (sdk.coreGameV2 && typeof sdk.coreGameV2.upgradeShip === 'function') {
    tx = await sdk.coreGameV2.upgradeShip(shipIdA, shipIdB);
  } else {
    throw new Error('upgradeShip is not available on the SDK');
  }
  const receipt = await tx.wait();
  if (!receipt) {
    throw new Error('Transaction receipt missing');
  }
  return { hash: tx.hash, receipt };
}