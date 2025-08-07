/**
 * Addresses for contracts deployed on BSC Testnet.
 *
 * Replace the zero addresses below with the real deployment
 * addresses once they are known. Keeping them here centralizes
 * configuration for the SDK.
 */
/**
 * Resolves an environment variable from `process.env`.  When building
 * the SDK for the browser these values will be replaced by the bundler
 * (e.g. Next.js) with the actual values from `.env.local` prefaced
 * with `NEXT_PUBLIC_`.  When running under Node the variables are read
 * directly from `process.env`.  If a variable is undefined an empty
 * string is returned so that validation can occur in the SDK factory.
 */
function getEnv(key: string): string {
  if (typeof process !== 'undefined' && process.env) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const value = (process.env as any)[key];
    return typeof value === 'string' ? value : '';
  }
  return '';
}

/**
 * Addresses for contracts deployed on BSC Testnet.  These values are
 * resolved from environment variables.  If a value is missing the
 * corresponding entry will be an empty string.  Consumers should
 * validate that all required addresses are present before sending
 * transactions.
 */
export const BSC_TESTNET_ADDRESSES = {
  GameToken: getEnv('NEXT_PUBLIC_GAMETOKEN_ADDRESS') || '0x0000000000000000000000000000000000000000',
  CoreGameV2: getEnv('NEXT_PUBLIC_COREGAMEV2_ADDRESS') || '0x0000000000000000000000000000000000000000',
  ShipSBT: getEnv('NEXT_PUBLIC_SHIPSBT_ADDRESS') || '0x0000000000000000000000000000000000000000',
  PiratePool: getEnv('NEXT_PUBLIC_PIRATEPOOL_ADDRESS') || '0x0000000000000000000000000000000000000000',
} as const;

/**
 * RPC URL for BSC Testnet.  Read from NEXT_PUBLIC_RPC_URL so that
 * applications can override the default provider when instantiating
 * the SDK.  If undefined this value will be an empty string and
 * createBscTestnetSdk will throw at runtime.
 */
export const RPC_URL: string = getEnv('NEXT_PUBLIC_RPC_URL') || '';