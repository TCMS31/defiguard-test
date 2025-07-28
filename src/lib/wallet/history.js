/**
 * Local transaction history.
 *
 * WALLET_README lists "view transaction hashes and status" as a feature, but
 * the page only ever showed the hash of the most recent send inside a success
 * banner, which the next action cleared. This module keeps a bounded, per
 * account-and-chain list.
 *
 * Only public data is stored: hash, recipient, amount and status. Nothing here
 * is a secret, and nothing here is authoritative -- the chain is. It is a
 * convenience log, and it is scoped by chain so a testnet send never appears
 * under a mainnet account.
 */

const STORAGE_PREFIX = 'defiguard.wallet.history';

/** Keeping the list bounded stops a heavy user growing an unbounded blob. */
export const MAX_ENTRIES = 25;

export const TX_STATUS = {
  PENDING: 'pending',
  CONFIRMED: 'confirmed',
  FAILED: 'failed',
};

/**
 * @param {string} account
 * @param {number|null} chainId
 * @returns {string} storage key scoped to one account on one chain
 */
export function historyKey(account, chainId) {
  return `${STORAGE_PREFIX}.${String(account || '').toLowerCase()}.${chainId ?? 'unknown'}`;
}

/**
 * Browser storage is unavailable in private windows and throws on quota, so
 * every access is guarded and failure degrades to "no history" rather than a
 * broken page.
 *
 * @param {Storage|null} storage
 * @param {string} key
 * @returns {Array<object>}
 */
function read(storage, key) {
  if (!storage) return [];

  try {
    const raw = storage.getItem(key);
    const parsed = raw ? JSON.parse(raw) : [];

    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/**
 * @param {Storage|null} storage
 * @param {string} key
 * @param {Array<object>} entries
 * @returns {Array<object>} the entries, so callers can use the return value as state
 */
function write(storage, key, entries) {
  if (storage) {
    try {
      storage.setItem(key, JSON.stringify(entries));
    } catch {
      // Storage full or blocked: the in-memory list returned below still works.
    }
  }

  return entries;
}

/**
 * @param {{ storage: Storage|null, account: string, chainId: number|null }} scope
 * @returns {Array<object>} newest first
 */
export function loadHistory({ storage, account, chainId }) {
  return read(storage, historyKey(account, chainId));
}

/**
 * Prepend a newly broadcast transaction.
 *
 * @param {{ storage: Storage|null, account: string, chainId: number|null }} scope
 * @param {{ hash: string, to: string, amountEth: string, timestamp?: number }} entry
 * @returns {Array<object>} the updated list
 */
export function recordTransaction({ storage, account, chainId }, entry) {
  const key = historyKey(account, chainId);
  const record = {
    hash: entry.hash,
    to: entry.to,
    amountEth: entry.amountEth,
    status: TX_STATUS.PENDING,
    timestamp: entry.timestamp ?? Date.now(),
  };

  return write(storage, key, [record, ...read(storage, key)].slice(0, MAX_ENTRIES));
}

/**
 * Move a transaction out of "pending" once a receipt is seen.
 *
 * @param {{ storage: Storage|null, account: string, chainId: number|null }} scope
 * @param {string} hash
 * @param {string} status one of {@link TX_STATUS}
 * @returns {Array<object>} the updated list
 */
export function updateTransactionStatus({ storage, account, chainId }, hash, status) {
  const key = historyKey(account, chainId);
  const updated = read(storage, key).map((entry) =>
    entry.hash === hash ? { ...entry, status } : entry
  );

  return write(storage, key, updated);
}

/**
 * @param {{ storage: Storage|null, account: string, chainId: number|null }} scope
 * @returns {Array<object>} an empty list
 */
export function clearHistory({ storage, account, chainId }) {
  return write(storage, historyKey(account, chainId), []);
}
