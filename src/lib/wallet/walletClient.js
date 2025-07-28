import Web3 from 'web3';

import { normaliseChainId } from './networks';

/**
 * A thin, fully injectable client over an EIP-1193 provider.
 *
 * This is the seam of the application. Everything above it (the hook, the page)
 * talks to this interface only, so swapping MetaMask for WalletConnect, a
 * Ledger bridge or an in-memory fake means supplying a different provider
 * object -- no component changes. The tests drive it with
 * `createFakeProvider()`, which is why the suite needs neither a browser
 * extension nor chain access.
 *
 * RPC goes through the raw `provider.request` interface rather than web3's call
 * machinery: it is exactly what MetaMask speaks, it keeps the fake provider
 * honest (one method, one JSON-RPC name), and it keeps web3.js on the one job
 * it is genuinely needed for here -- keccak-based address checksums.
 */

/** Gas units required by a plain value transfer between externally owned accounts. */
export const BASE_TRANSFER_GAS = 21000n;

/** Thrown when the provider rejects a request; carries the EIP-1193 error code. */
export class WalletClientError extends Error {
  constructor(message, { code = null, cause = null } = {}) {
    super(message);
    this.name = 'WalletClientError';
    this.code = code;
    this.cause = cause;
  }
}

/** EIP-1193: the user dismissed the MetaMask prompt. */
export const USER_REJECTED_REQUEST = 4001;

/**
 * @param {string|number|bigint} value
 * @returns {string} a 0x-prefixed hex quantity, as JSON-RPC requires
 */
export function toHexQuantity(value) {
  const asBigInt = typeof value === 'bigint' ? value : BigInt(String(value));

  return `0x${asBigInt.toString(16)}`;
}

/**
 * @param {string|null|undefined} value a hex quantity from a JSON-RPC result
 * @returns {bigint}
 */
export function fromHexQuantity(value) {
  if (value === null || value === undefined || value === '') return 0n;

  return BigInt(value);
}

export class WalletClient {
  /**
   * @param {object} options
   * @param {{ request: Function, on?: Function, removeListener?: Function }} options.provider
   */
  constructor({ provider }) {
    if (!provider || typeof provider.request !== 'function') {
      throw new WalletClientError('A provider exposing request() is required.');
    }

    this.provider = provider;
  }

  /**
   * @param {string} method JSON-RPC method name
   * @param {Array<unknown>} [params]
   * @returns {Promise<unknown>}
   */
  async request(method, params = []) {
    try {
      return await this.provider.request({ method, params });
    } catch (error) {
      throw new WalletClientError(error?.message || `RPC call ${method} failed.`, {
        code: error?.code ?? null,
        cause: error,
      });
    }
  }

  /** Accounts already shared with this site; does not prompt. */
  async getAccounts() {
    const accounts = await this.request('eth_accounts');

    return Array.isArray(accounts) ? accounts : [];
  }

  /** Prompts the user to connect. */
  async requestAccounts() {
    const accounts = await this.request('eth_requestAccounts');

    return Array.isArray(accounts) ? accounts : [];
  }

  /** @returns {Promise<number|null>} */
  async getChainId() {
    return normaliseChainId(await this.request('eth_chainId'));
  }

  /**
   * @param {string} address
   * @returns {Promise<bigint>} balance in wei
   */
  async getBalance(address) {
    return fromHexQuantity(await this.request('eth_getBalance', [address, 'latest']));
  }

  /**
   * Estimate what the transfer will cost in gas.
   *
   * Falls back to the 21000-gas base cost if the node will not estimate (for
   * example when the balance is too low to cover the call it is simulating),
   * so the form can still explain the shortfall instead of failing silently.
   *
   * @param {{ from: string, to: string, value: bigint }} tx
   * @returns {Promise<{ gas: bigint, gasPrice: bigint, feeWei: bigint, estimated: boolean }>}
   */
  async estimateFee({ from, to, value }) {
    const gasPrice = fromHexQuantity(await this.request('eth_gasPrice'));

    let gas = BASE_TRANSFER_GAS;
    let estimated = false;

    try {
      const result = await this.request('eth_estimateGas', [
        { from, to, value: toHexQuantity(value) },
      ]);
      const parsed = fromHexQuantity(result);

      if (parsed > 0n) {
        gas = parsed;
        estimated = true;
      }
    } catch {
      // Keep the base-cost fallback; the caller reports the shortfall instead.
    }

    return { gas, gasPrice, feeWei: gas * gasPrice, estimated };
  }

  /**
   * Ask the wallet to sign and broadcast a transfer.
   *
   * The private key never reaches this code: `eth_sendTransaction` hands an
   * unsigned transaction to the wallet, which signs it in the extension after
   * the user approves it.
   *
   * @param {{ from: string, to: string, value: bigint, gas?: bigint }} tx
   * @returns {Promise<string>} transaction hash
   */
  async sendTransaction({ from, to, value, gas = BASE_TRANSFER_GAS }) {
    const hash = await this.request('eth_sendTransaction', [
      { from, to, value: toHexQuantity(value), gas: toHexQuantity(gas) },
    ]);

    return String(hash);
  }

  /**
   * @param {string} hash
   * @returns {Promise<object|null>} null while the transaction is still pending
   */
  async getTransactionReceipt(hash) {
    return (await this.request('eth_getTransactionReceipt', [hash])) || null;
  }

  /**
   * Checksum-aware address validation.
   *
   * @param {string} address
   * @returns {boolean}
   */
  isAddress(address) {
    try {
      return Web3.utils.isAddress(address);
    } catch {
      return false;
    }
  }

  /**
   * Subscribe to a provider event (`accountsChanged`, `chainChanged`, ...).
   *
   * @param {string} event
   * @param {Function} handler
   * @returns {() => void} unsubscribe
   */
  on(event, handler) {
    if (typeof this.provider.on !== 'function') return () => {};

    this.provider.on(event, handler);

    return () => {
      if (typeof this.provider.removeListener === 'function') {
        this.provider.removeListener(event, handler);
      }
    };
  }
}
