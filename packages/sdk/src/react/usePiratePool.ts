// Re-export the usePiratePool hook from the main hooks module.
// Having this file in a dedicated react directory avoids pulling
// non-react code into the browser bundle and improves tree-shaking.
export { usePiratePool } from '../hooks';