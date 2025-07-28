import React, { useState } from 'react';

import { useWallet, WALLET_STATUS } from '../../hooks/useWallet';
import { formatBalance, shorten } from '../../lib/wallet';
import { TX_STATUS } from '../../lib/wallet/history';

import './index.css';

/**
 * Copy text without assuming the async clipboard API exists.
 *
 * `navigator.clipboard` is undefined outside a secure context (and in jsdom),
 * where the original implementation threw an unhandled TypeError.
 *
 * @param {string} value
 * @returns {Promise<boolean>} whether the copy succeeded
 */
async function copyToClipboard(value) {
  if (!value) return false;

  try {
    if (navigator?.clipboard?.writeText) {
      await navigator.clipboard.writeText(value);
      return true;
    }
  } catch {
    // Fall through to the "select it yourself" message below.
  }

  return false;
}

/** @param {{ chain: { name: string, testnet: boolean, known: boolean } }} props */
function NetworkBadge({ chain }) {
  const tone = chain.testnet ? 'testnet' : chain.known ? 'mainnet' : 'unknown';

  return (
    <span className={`network-badge network-badge--${tone}`} data-testid="network-badge">
      <span className="network-badge__dot" aria-hidden="true" />
      {chain.name}
    </span>
  );
}

/** @param {{ entries: Array<object> }} props */
function TransactionHistory({ entries }) {
  if (entries.length === 0) {
    return (
      <p className="history-empty">No transactions sent from this account on this network yet.</p>
    );
  }

  return (
    <div className="history-table-wrap">
      <table className="history-table">
        <thead>
          <tr>
            <th scope="col">Transaction</th>
            <th scope="col">To</th>
            <th scope="col">Amount</th>
            <th scope="col">Status</th>
          </tr>
        </thead>
        <tbody>
          {entries.map((entry) => (
            <tr key={entry.hash}>
              <td>
                <code title={entry.hash}>{shorten(entry.hash, 10, 6)}</code>
              </td>
              <td>
                <code title={entry.to}>{shorten(entry.to)}</code>
              </td>
              <td className="history-amount">{entry.amountEth} ETH</td>
              <td>
                <span className={`status-pill status-pill--${entry.status}`}>
                  {entry.status === TX_STATUS.PENDING && 'Pending'}
                  {entry.status === TX_STATUS.CONFIRMED && 'Confirmed'}
                  {entry.status === TX_STATUS.FAILED && 'Failed'}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/**
 * The wallet screen.
 *
 * Presentation only: every decision about connecting, pricing and broadcasting
 * lives in `useWallet` and `src/lib/wallet`, which are unit tested against a
 * fake provider.
 *
 * @param {{ walletOptions?: object }} props `walletOptions` is an injection point for tests
 */
function Wallet({ walletOptions }) {
  const wallet = useWallet(walletOptions);
  const [recipient, setRecipient] = useState('');
  const [amount, setAmount] = useState('');
  const [copied, setCopied] = useState('');

  const handleCopy = async () => {
    const ok = await copyToClipboard(wallet.account);
    setCopied(ok ? 'Address copied to clipboard.' : 'Copy failed — select the address manually.');
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    const result = await wallet.send({ recipient, amount });

    if (result.ok) {
      setRecipient('');
      setAmount('');
    }
  };

  return (
    <div className="wallet-container">
      <header className="wallet-header">
        <h1>DeFiGuard Wallet</h1>
        <p>Send and receive ETH through your browser wallet.</p>
      </header>

      <main className="wallet-content">
        {wallet.error && (
          <div className="error-message" role="alert" data-testid="wallet-error">
            <span>{wallet.error}</span>
            <button type="button" className="dismiss-btn" onClick={wallet.dismiss}>
              Dismiss
            </button>
          </div>
        )}

        {wallet.notice && !wallet.error && (
          <div className="success-message" role="status" data-testid="wallet-notice">
            <span>{wallet.notice}</span>
            <button type="button" className="dismiss-btn" onClick={wallet.dismiss}>
              Dismiss
            </button>
          </div>
        )}

        {wallet.status === WALLET_STATUS.DETECTING && (
          <div className="connect-section" data-testid="detecting">
            <h2>Looking for a wallet…</h2>
            <p>Checking your browser for an Ethereum provider.</p>
          </div>
        )}

        {wallet.status === WALLET_STATUS.UNAVAILABLE && (
          <div className="connect-section" data-testid="unavailable">
            <h2>No Ethereum wallet found</h2>
            <p>
              This page needs an EIP-1193 wallet such as MetaMask. Install one, then reload this
              page.
            </p>
            <a
              className="connect-btn"
              href="https://metamask.io/download/"
              target="_blank"
              rel="noreferrer noopener"
            >
              Get MetaMask
            </a>
          </div>
        )}

        {(wallet.status === WALLET_STATUS.DISCONNECTED ||
          wallet.status === WALLET_STATUS.CONNECTING) && (
          <div className="connect-section">
            <h2>Connect your wallet</h2>
            <p>DeFiGuard never sees your private key. Transactions are signed in your wallet.</p>
            <button
              type="button"
              className="connect-btn"
              onClick={wallet.connect}
              disabled={wallet.status === WALLET_STATUS.CONNECTING}
            >
              {wallet.status === WALLET_STATUS.CONNECTING ? 'Connecting…' : 'Connect Wallet'}
            </button>
          </div>
        )}

        {wallet.isConnected && (
          <div className="wallet-interface">
            <section className="account-info" aria-labelledby="account-heading">
              <div className="section-head">
                <h2 id="account-heading">Account</h2>
                <NetworkBadge chain={wallet.chain} />
              </div>

              <div className="info-card">
                <div className="info-item">
                  <span className="info-label" id="address-label">
                    Address
                  </span>
                  <div className="address-container">
                    <span className="address" data-testid="account-address">
                      {wallet.account}
                    </span>
                    <button
                      type="button"
                      className="copy-btn"
                      onClick={handleCopy}
                      aria-describedby="address-label"
                    >
                      Copy
                    </button>
                  </div>
                </div>

                <div className="info-item">
                  <span className="info-label">Balance</span>
                  <span className="balance" data-testid="balance">
                    {formatBalance(wallet.balanceWei)} ETH
                  </span>
                </div>

                <div className="info-actions">
                  <button type="button" className="ghost-btn" onClick={wallet.refresh}>
                    Refresh
                  </button>
                  <button type="button" className="disconnect-btn" onClick={wallet.disconnect}>
                    Forget account
                  </button>
                </div>
              </div>
            </section>

            <section className="transaction-section" aria-labelledby="send-heading">
              <h2 id="send-heading">Send ETH</h2>
              <form className="transaction-form" onSubmit={handleSubmit} noValidate>
                <div className="form-group">
                  <label htmlFor="recipient">Recipient address</label>
                  <input
                    id="recipient"
                    name="recipient"
                    type="text"
                    value={recipient}
                    onChange={(event) => setRecipient(event.target.value)}
                    placeholder="0x…"
                    className="form-input"
                    autoComplete="off"
                    spellCheck="false"
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="amount">Amount (ETH)</label>
                  <input
                    id="amount"
                    name="amount"
                    type="text"
                    inputMode="decimal"
                    value={amount}
                    onChange={(event) => setAmount(event.target.value)}
                    placeholder="0.0"
                    className="form-input"
                    autoComplete="off"
                  />
                  <p className="field-hint">
                    Gas is estimated and checked against your balance before the wallet is asked to
                    sign.
                  </p>
                </div>

                <button type="submit" className="send-btn" disabled={wallet.sending}>
                  {wallet.sending ? 'Sending…' : 'Send ETH'}
                </button>
              </form>
            </section>

            <section className="receive-section" aria-labelledby="receive-heading">
              <h2 id="receive-heading">Receive ETH</h2>
              <div className="receive-card">
                <p>Share this address to receive ETH on {wallet.chain.name}.</p>
                <div className="address-display">
                  <span className="receive-address">{wallet.account}</span>
                  <button type="button" className="copy-btn" onClick={handleCopy}>
                    Copy
                  </button>
                </div>
                {copied && (
                  <p className="copy-feedback" role="status">
                    {copied}
                  </p>
                )}
              </div>
            </section>

            <section className="history-section" aria-labelledby="history-heading">
              <h2 id="history-heading">Transaction history</h2>
              <p className="section-note">
                Sends made from this browser, scoped to this account and network.
              </p>
              <TransactionHistory entries={wallet.history} />
            </section>
          </div>
        )}
      </main>
    </div>
  );
}

export default Wallet;
