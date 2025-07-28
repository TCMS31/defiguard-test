/**
 * Human-readable names for the EVM chains this interface is expected to run on.
 *
 * The wallet never picks a chain itself -- the chain is whatever the injected
 * provider is currently connected to. Showing it prominently is a safety
 * feature: sending mainnet ETH while believing you are on a testnet (or the
 * reverse) is the most common way funds are lost in a UI like this one.
 */
const KNOWN_CHAINS = {
  1: { name: 'Ethereum Mainnet', testnet: false },
  5: { name: 'Goerli', testnet: true },
  11155111: { name: 'Sepolia', testnet: true },
  17000: { name: 'Holesky', testnet: true },
  1337: { name: 'Localhost', testnet: true },
  31337: { name: 'Hardhat', testnet: true },
};

/**
 * Normalise a chain id that may arrive as a hex string ("0x1"), a decimal
 * string, a number or a BigInt (web3 v4 returns BigInt).
 *
 * @param {string|number|bigint|null|undefined} chainId
 * @returns {number|null} the chain id as a number, or null if unparseable
 */
export function normaliseChainId(chainId) {
  if (chainId === null || chainId === undefined || chainId === '') return null;
  if (typeof chainId === 'bigint') return Number(chainId);
  if (typeof chainId === 'number') return Number.isFinite(chainId) ? chainId : null;

  const text = String(chainId).trim();
  const parsed = text.toLowerCase().startsWith('0x')
    ? Number.parseInt(text, 16)
    : Number.parseInt(text, 10);

  return Number.isFinite(parsed) ? parsed : null;
}

/**
 * Describe a chain for display.
 *
 * @param {string|number|bigint|null} chainId
 * @returns {{ id: number|null, name: string, testnet: boolean, known: boolean }}
 */
export function describeChain(chainId) {
  const id = normaliseChainId(chainId);

  if (id === null) {
    return { id: null, name: 'Unknown network', testnet: false, known: false };
  }

  const known = KNOWN_CHAINS[id];

  return known
    ? { id, name: known.name, testnet: known.testnet, known: true }
    : { id, name: `Chain ${id}`, testnet: false, known: false };
}

export { KNOWN_CHAINS };
