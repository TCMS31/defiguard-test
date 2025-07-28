import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import {
  connectMetaMask,
  describeChain,
  normaliseChainId,
  USER_REJECTED_REQUEST,
  validateTransfer,
  weiToEtherString,
} from '../lib/wallet';
import {
  loadHistory,
  recordTransaction,
  updateTransactionStatus,
  TX_STATUS,
} from '../lib/wallet/history';

/** Connection lifecycle, kept explicit so the view never has to infer it. */
export const WALLET_STATUS = {
  DETECTING: 'detecting',
  UNAVAILABLE: 'unavailable',
  DISCONNECTED: 'disconnected',
  CONNECTING: 'connecting',
  CONNECTED: 'connected',
};

const DEFAULT_POLL_INTERVAL_MS = 3000;
const MAX_RECEIPT_POLLS = 20;

/**
 * All wallet state and behaviour for the page, with no markup.
 *
 * The client is created once and held in a ref. The previous implementation
 * kept the web3 instance in React state and then read it from the same tick in
 * which it was set, so the reconnect-on-load path always saw `null` and the
 * balance silently stayed at zero.
 *
 * @param {object} [options]
 * @param {() => Promise<import('../lib/wallet').WalletClient|null>} [options.createClient]
 * @param {Storage|null} [options.storage] where transaction history is kept
 * @param {number} [options.pollIntervalMs] receipt poll cadence
 * @returns {object} state and actions consumed by the wallet page
 */
export function useWallet({
  createClient = connectMetaMask,
  storage = typeof window !== 'undefined' ? window.localStorage : null,
  pollIntervalMs = DEFAULT_POLL_INTERVAL_MS,
} = {}) {
  const clientRef = useRef(null);
  const mountedRef = useRef(true);
  const timersRef = useRef(new Set());

  const [status, setStatus] = useState(WALLET_STATUS.DETECTING);
  const [account, setAccount] = useState('');
  const [chainId, setChainId] = useState(null);
  const [balanceWei, setBalanceWei] = useState('0');
  const [history, setHistory] = useState([]);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [sending, setSending] = useState(false);

  const scope = useMemo(() => ({ storage, account, chainId }), [storage, account, chainId]);

  const safeSet = useCallback((setter, value) => {
    if (mountedRef.current) setter(value);
  }, []);

  /** Pull balance and chain id for an account in one place. */
  const refresh = useCallback(
    async (address) => {
      const client = clientRef.current;
      if (!client || !address) return;

      try {
        const [wei, chain] = await Promise.all([client.getBalance(address), client.getChainId()]);

        safeSet(setBalanceWei, wei.toString());
        safeSet(setChainId, chain);
      } catch (cause) {
        safeSet(setError, `Could not read your balance: ${cause.message}`);
      }
    },
    [safeSet]
  );

  const adopt = useCallback(
    async (address) => {
      safeSet(setAccount, address);
      safeSet(setStatus, WALLET_STATUS.CONNECTED);
      await refresh(address);
    },
    [refresh, safeSet]
  );

  // Detect the wallet once, and adopt an account if the site is already trusted.
  useEffect(() => {
    mountedRef.current = true;
    const timers = timersRef.current;

    (async () => {
      try {
        const client = await createClient();

        if (!client) {
          safeSet(setStatus, WALLET_STATUS.UNAVAILABLE);
          return;
        }

        clientRef.current = client;

        const accounts = await client.getAccounts();

        if (accounts.length > 0) {
          await adopt(accounts[0]);
        } else {
          safeSet(setStatus, WALLET_STATUS.DISCONNECTED);
        }
      } catch (cause) {
        safeSet(setStatus, WALLET_STATUS.UNAVAILABLE);
        safeSet(setError, `Could not reach a wallet provider: ${cause.message}`);
      }
    })();

    return () => {
      mountedRef.current = false;
      timers.forEach((timer) => clearTimeout(timer));
      timers.clear();
    };
  }, [createClient, adopt, safeSet]);

  // Follow the wallet rather than caching what it said once. Without these the
  // page keeps showing the first account after the user switches in MetaMask,
  // and a send would be attempted from an account that is no longer selected.
  useEffect(() => {
    const client = clientRef.current;
    if (!client || status === WALLET_STATUS.DETECTING) return undefined;

    const offAccounts = client.on('accountsChanged', (accounts) => {
      const next = Array.isArray(accounts) ? accounts : [];

      if (next.length === 0) {
        safeSet(setAccount, '');
        safeSet(setBalanceWei, '0');
        safeSet(setStatus, WALLET_STATUS.DISCONNECTED);
        safeSet(setNotice, 'Wallet disconnected.');
        return;
      }

      safeSet(setNotice, 'Active account changed.');
      adopt(next[0]);
    });

    const offChain = client.on('chainChanged', (nextChainId) => {
      safeSet(setChainId, normaliseChainId(nextChainId));
      safeSet(setNotice, 'Network changed.');
      setAccount((current) => {
        if (current) refresh(current);
        return current;
      });
    });

    return () => {
      offAccounts();
      offChain();
    };
  }, [status, adopt, refresh, safeSet]);

  // History is scoped per account and per chain.
  useEffect(() => {
    if (!account) {
      safeSet(setHistory, []);
      return;
    }

    safeSet(setHistory, loadHistory(scope));
  }, [account, chainId, scope, safeSet]);

  const connect = useCallback(async () => {
    const client = clientRef.current;

    if (!client) {
      setError('No Ethereum wallet detected. Install MetaMask to continue.');
      return;
    }

    setError('');
    setNotice('');
    setStatus(WALLET_STATUS.CONNECTING);

    try {
      const accounts = await client.requestAccounts();

      if (accounts.length === 0) {
        setStatus(WALLET_STATUS.DISCONNECTED);
        setError('No account was shared by the wallet.');
        return;
      }

      await adopt(accounts[0]);
      setNotice('Wallet connected.');
    } catch (cause) {
      setStatus(WALLET_STATUS.DISCONNECTED);
      setError(
        cause.code === USER_REJECTED_REQUEST
          ? 'Connection request was rejected in your wallet.'
          : `Could not connect: ${cause.message}`
      );
    }
  }, [adopt]);

  /**
   * Forget the account locally.
   *
   * A dapp cannot revoke its own permission, so this clears local state only --
   * the page says as much rather than implying the wallet was disconnected.
   */
  const disconnect = useCallback(() => {
    setAccount('');
    setBalanceWei('0');
    setHistory([]);
    setStatus(WALLET_STATUS.DISCONNECTED);
    setError('');
    setNotice('Cleared locally. Revoke site access from MetaMask to fully disconnect.');
  }, []);

  /** Poll for a receipt so a sent transaction does not sit on "pending" forever. */
  const watchReceipt = useCallback(
    (hash, attempt = 0) => {
      const client = clientRef.current;
      if (!client || !mountedRef.current || attempt >= MAX_RECEIPT_POLLS) return;

      const timer = setTimeout(async () => {
        timersRef.current.delete(timer);

        try {
          const receipt = await client.getTransactionReceipt(hash);

          if (!receipt) {
            watchReceipt(hash, attempt + 1);
            return;
          }

          const confirmed = receipt.status === '0x1' || receipt.status === true;

          safeSet(
            setHistory,
            updateTransactionStatus(scope, hash, confirmed ? TX_STATUS.CONFIRMED : TX_STATUS.FAILED)
          );

          if (account) refresh(account);
        } catch {
          watchReceipt(hash, attempt + 1);
        }
      }, pollIntervalMs);

      timersRef.current.add(timer);
    },
    [account, pollIntervalMs, refresh, scope, safeSet]
  );

  /**
   * Validate, then ask the wallet to sign and broadcast a transfer.
   *
   * @param {{ recipient: string, amount: string }} form
   * @returns {Promise<{ ok: boolean, hash?: string, error?: string }>}
   */
  const send = useCallback(
    async ({ recipient, amount }) => {
      const client = clientRef.current;

      if (!client || !account) {
        const message = 'Connect your wallet first.';
        setError(message);
        return { ok: false, error: message };
      }

      setError('');
      setNotice('');
      setSending(true);

      try {
        // Price the transfer before validating: "amount <= balance" is not the
        // question, "amount + gas <= balance" is.
        let feeWei = 0n;
        let gas;

        if (client.isAddress(recipient)) {
          try {
            const fee = await client.estimateFee({
              from: account,
              to: recipient,
              value: 0n,
            });
            feeWei = fee.feeWei;
            gas = fee.gas;
          } catch {
            feeWei = 0n;
          }
        }

        const check = validateTransfer({
          recipient,
          amount,
          balanceWei,
          feeWei,
          account,
          isAddress: (value) => client.isAddress(value),
        });

        if (!check.valid) {
          setError(check.error);
          return { ok: false, error: check.error };
        }

        const hash = await client.sendTransaction({
          from: account,
          to: recipient,
          value: check.amountWei,
          ...(gas ? { gas } : {}),
        });

        safeSet(
          setHistory,
          recordTransaction(scope, {
            hash,
            to: recipient,
            amountEth: weiToEtherString(check.amountWei),
          })
        );
        setNotice(`Transaction submitted${check.warning ? ` — ${check.warning}` : ''}`);

        watchReceipt(hash);
        await refresh(account);

        return { ok: true, hash };
      } catch (cause) {
        const message =
          cause.code === USER_REJECTED_REQUEST
            ? 'Transaction was rejected in your wallet.'
            : `Transaction failed: ${cause.message}`;

        setError(message);
        return { ok: false, error: message };
      } finally {
        safeSet(setSending, false);
      }
    },
    [account, balanceWei, refresh, scope, safeSet, watchReceipt]
  );

  const dismiss = useCallback(() => {
    setError('');
    setNotice('');
  }, []);

  return {
    status,
    isConnected: status === WALLET_STATUS.CONNECTED && Boolean(account),
    account,
    chain: describeChain(chainId),
    balanceWei,
    history,
    error,
    notice,
    sending,
    connect,
    disconnect,
    send,
    refresh: () => refresh(account),
    dismiss,
  };
}

export default useWallet;
