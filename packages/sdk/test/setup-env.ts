// Global test setup for the SDK.  We define environment variables
// used by the SDK so that createBscTestnetSdk does not throw when
// contract addresses are missing.  These dummy addresses are
// deterministic and not used for on‑chain interactions in tests.

process.env.NEXT_PUBLIC_GAMETOKEN_ADDRESS =
  process.env.NEXT_PUBLIC_GAMETOKEN_ADDRESS ||
  '0x1111111111111111111111111111111111111111';
process.env.NEXT_PUBLIC_COREGAMEV2_ADDRESS =
  process.env.NEXT_PUBLIC_COREGAMEV2_ADDRESS ||
  '0x2222222222222222222222222222222222222222';
process.env.NEXT_PUBLIC_SHIPSBT_ADDRESS =
  process.env.NEXT_PUBLIC_SHIPSBT_ADDRESS ||
  '0x3333333333333333333333333333333333333333';
process.env.NEXT_PUBLIC_PIRATEPOOL_ADDRESS =
  process.env.NEXT_PUBLIC_PIRATEPOOL_ADDRESS ||
  '0x4444444444444444444444444444444444444444';
process.env.NEXT_PUBLIC_RPC_URL =
  process.env.NEXT_PUBLIC_RPC_URL ||
  'http://localhost:8545';