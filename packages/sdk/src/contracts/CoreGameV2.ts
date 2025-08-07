import { ethers } from 'ethers';
import { BSC_TESTNET_ADDRESSES } from '../constants';

/*
 * This module exposes high‑level functions for interacting with
 * the CoreGameV2 contract on BSC Testnet. Each function accepts
 * a signer to ensure the transaction is sent from the user’s
 * wallet. Parameter validation is performed where appropriate.
 */

// Create a contract instance once. The ABI is currently an empty
// array because we do not have the actual ABI file. When ABIs
// become available via TypeChain, replace the empty array with
// the generated ABI and adjust types accordingly.
const coreGameV2 = new ethers.Contract(
  BSC_TESTNET_ADDRESSES.CoreGameV2,
  [],
);

/**
 * Purchase a new ship. The signer must have sufficient GameToken
 * allowance and balance. This function simply forwards the call
 * to the on‑chain buyShip() method. Additional logic such as
 * price retrieval should be handled outside of this function.
 */
export async function buyShip(signer: ethers.Signer) {
  return coreGameV2.connect(signer).buyShip();
}

/**
 * Upgrade two ships to a higher level. Ships must have the same
 * level and faction according to the game whitepaper. Passing the
 * same token ID for both parameters is invalid and will throw an
 * error before the transaction is sent.
 *
 * @param signer Wallet used to sign the transaction
 * @param idA Token ID of the first ship
 * @param idB Token ID of the second ship
 */
export async function upgradeShip(
  signer: ethers.Signer,
  idA: bigint,
  idB: bigint,
) {
  if (idA === idB) {
    throw new Error('Cannot upgrade using the same ship twice');
  }
  return coreGameV2.connect(signer).upgradeShip(idA, idB);
}

/**
 * Send a ship on a voyage. The DBL (distance based limit) value
 * represents how far the ship will travel. Different distances may
 * result in different rewards or risks according to the whitepaper.
 *
 * @param signer Wallet used to sign the transaction
 * @param shipId Token ID of the ship
 * @param dbl Distance value encoded as bigint
 */
export async function voyage(
  signer: ethers.Signer,
  shipId: bigint,
  dbl: bigint,
) {
  return coreGameV2.connect(signer).voyage(shipId, dbl);
}

/**
 * Read the current ship price from the contract. The price may
 * change dynamically over time. This is a read‑only call and does
 * not require a signer. The provider is required to perform the
 * call. When the contract implements a getter named getShipPrice
 * (or similar), update the method name accordingly.
 */
export async function getShipPrice(provider: ethers.Provider) {
  // Connect the contract to the read‑only provider
  const connected = coreGameV2.connect(provider);
  if (typeof connected.getShipPrice !== 'function') {
    throw new Error('getShipPrice is not available on CoreGameV2');
  }
  return connected.getShipPrice();
}