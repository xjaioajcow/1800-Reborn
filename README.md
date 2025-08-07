# 1800-Reborn

## 🛠 SDK Build & Frontend Scaffold

This monorepo is powered by **pnpm workspaces** and contains two
primary projects:

* **packages/sdk** – A TypeScript SDK for interacting with the BSC Testnet
  smart contracts. Types are generated via TypeChain based on the ABIs
  placed in `contracts/abis/`. The SDK exposes high‑level wrapper
  functions (e.g. `buyShip`, `stake`), a `createBscTestnetSdk` factory
  that bundles all contracts together, and a set of React hooks built
  on TanStack Query for easy data fetching and caching.

* **apps/web** – A Next.js 14 (App Router) application scaffolded with
  Tailwind CSS. It provides four routes (`/dashboard`, `/ships`,
  `/voyage`, `/fomo`) that currently render simple “Coming Soon” pages
  and sets up global providers for React Query and the SDK via
  `GameSdkProvider`. This app is ready to be extended with UI,
  animations and business logic.

### Building and testing the SDK

1. **Install dependencies** – run `pnpm install` from the repository
   root. This installs all workspace dependencies.
2. **Generate types** – place your contract ABI JSON files in
   `contracts/abis/` and run `pnpm typegen`. This invokes TypeChain
   and writes the typings into `packages/sdk/typechain`.
3. **Build the SDK** – run `pnpm --filter @cvf/sdk build` to compile
   the SDK into ESM/CJS outputs under `packages/sdk/dist`.
4. **Run tests** – run `pnpm --filter @cvf/sdk test`. Coverage is
   enforced at 80%+ and a report will be printed in the console.

### Running the web app

Ensure the SDK has been built (step 3 above), then run one of the
following from the repository root:

* `pnpm dev` – Starts a development server for the web application
  at <http://localhost:3000>.
* `pnpm --filter web build` – Creates an optimized production build of
  the app. The output can be served with `next start`.

The web app imports the SDK via the workspace dependency `@cvf/sdk` and
provides it to React components via `GameSdkProvider`. As more
functionality is added to the SDK and hooks, the front‑end pages can
consume them via the exported hooks (e.g. `useUserShips`, `useVoyage`,
`usePiratePool`, `useFomoStatus`).