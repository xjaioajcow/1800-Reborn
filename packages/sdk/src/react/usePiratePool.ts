// Re‑export the usePiratePool hook from the top‑level hooks module.  This
// wrapper exists to provide a stable import path for React projects
// consuming the SDK, mirroring the pattern used by other hooks in
// the package.  Without this file, consumers would need to import
// from '@cvf/sdk/hooks' directly, which couples them to internal
// file structure.

export { usePiratePool } from '../hooks';