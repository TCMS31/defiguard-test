/**
 * An in-memory EIP-1193 provider.
 *
 * Used by the test suite and by the screenshot script. It answers the same
 * JSON-RPC methods MetaMask does, so the application code under test is the
 * real code: nothing in `src/lib/wallet` or `src/pages/wallet` knows it is not
 * talking to a wallet extension.
 *
 * It cannot sign anything and cannot reach a network. There is no key material
 * in this file and none is generated -- `sendTransaction` returns a synthetic
 * hash and mutates an in-memory balance.
 */

const DEFAULT_ACCOUNT = '0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAed';

/**
 * @param {object} [options]
 * @param {string[]} [options.accounts]        accounts already connected
 * @param {Record<string, bigint>} [options.balances] address -> wei
 * @param {number} [options.chainId]
 * @param {bigint} [options.gasPrice]          wei per gas unit
 * @param {boolean} [options.rejectConnect]    simulate the user dismissing the prompt
 * @param {Error|null} [options.sendError]     simulate a failed broadcast
 */
export function createFakeProvider({
  accounts = [DEFAULT_ACCOUNT],
  balances = {},
  chainId = 11155111,
  gasPrice = 20000000000n, // 20 gwei
  rejectConnect = false,
  sendError = null,
} = {}) {
  const listeners = new Map();
  const state = {
    accounts: [...accounts],
    chainId,
    balances: new Map(
      Object.entries({ [DEFAULT_ACCOUNT]: 2000000000000000000n, ...balances }).map(
        ([address, wei]) => [address.toLowerCase(), BigInt(wei)]
      )
    ),
    receipts: new Map(),
  };

  const hex = (value) => `0x${BigInt(value).toString(16)}`;
  const balanceOf = (address) => state.balances.get(String(address).toLowerCase()) ?? 0n;

  const emit = (event, payload) => {
    (listeners.get(event) || []).forEach((handler) => handler(payload));
  };

  let nonce = 0;

  const handlers = {
    eth_accounts: () => state.accounts,
    eth_requestAccounts: () => {
      if (rejectConnect) {
        const error = new Error('User rejected the request.');
        error.code = 4001;
        throw error;
      }

      return state.accounts;
    },
    eth_chainId: () => hex(state.chainId),
    eth_gasPrice: () => hex(gasPrice),
    eth_getBalance: ([address]) => hex(balanceOf(address)),
    eth_estimateGas: () => hex(21000n),
    eth_getTransactionReceipt: ([hash]) => state.receipts.get(hash) ?? null,
    eth_sendTransaction: ([tx]) => {
      if (sendError) throw sendError;

      const from = String(tx.from).toLowerCase();
      const to = String(tx.to).toLowerCase();
      const value = BigInt(tx.value);

      state.balances.set(from, balanceOf(from) - value);
      state.balances.set(to, balanceOf(to) + value);

      nonce += 1;
      const hash = `0x${nonce.toString(16).padStart(64, 'a')}`;
      state.receipts.set(hash, { transactionHash: hash, status: '0x1', blockNumber: hex(nonce) });

      return hash;
    },
  };

  return {
    isMetaMask: true,

    async request({ method, params = [] }) {
      const handler = handlers[method];

      if (!handler) {
        const error = new Error(`Unsupported method: ${method}`);
        error.code = -32601;
        throw error;
      }

      return handler(params);
    },

    on(event, handler) {
      listeners.set(event, [...(listeners.get(event) || []), handler]);
    },

    removeListener(event, handler) {
      listeners.set(
        event,
        (listeners.get(event) || []).filter((item) => item !== handler)
      );
    },

    /** Test hook: simulate the user switching account in MetaMask. */
    emitAccountsChanged(next) {
      state.accounts = [...next];
      emit('accountsChanged', state.accounts);
    },

    /** Test hook: simulate the user switching network in MetaMask. */
    emitChainChanged(next) {
      state.chainId = next;
      emit('chainChanged', hex(next));
    },

    /** Test hook: read the simulated balance. */
    balanceOf,
  };
}

export { DEFAULT_ACCOUNT };
