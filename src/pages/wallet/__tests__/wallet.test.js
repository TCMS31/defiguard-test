import React from 'react';
import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import Wallet from '..';
import { WalletClient } from '../../../lib/wallet';
import { createFakeProvider, DEFAULT_ACCOUNT } from '../../../lib/wallet/testing/fakeProvider';
import { createMemoryStorage } from '../../../lib/wallet/testing/memoryStorage';

const RECIPIENT = '0xfB6916095ca1df60bB79Ce92cE3Ea74c37c5d359';

/**
 * Render the real page against a fake EIP-1193 provider.
 *
 * Nothing is stubbed inside the application: the component, the hook and the
 * client all run unmodified. The provider is the only seam, which is the point
 * of the adapter.
 */
function renderWallet({ provider = createFakeProvider(), ...overrides } = {}) {
  const storage = createMemoryStorage();
  const walletOptions = {
    createClient: async () => (provider ? new WalletClient({ provider }) : null),
    storage,
    pollIntervalMs: 5,
    ...overrides,
  };

  return { provider, storage, ...render(<Wallet walletOptions={walletOptions} />) };
}

describe('Wallet page', () => {
  it('explains itself when no wallet is installed instead of rendering a dead button', async () => {
    renderWallet({ provider: null });

    expect(await screen.findByTestId('unavailable')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /get metamask/i })).toHaveAttribute(
      'href',
      'https://metamask.io/download/'
    );
  });

  it('adopts an already-authorised account on load, with a real balance', async () => {
    // The previous implementation read the web3 instance from state in the same
    // tick it was set, so this path threw and the balance stayed at 0.0000.
    renderWallet();

    expect(await screen.findByTestId('account-address')).toHaveTextContent(DEFAULT_ACCOUNT);
    expect(screen.getByTestId('balance')).toHaveTextContent('2.000000 ETH');
  });

  it('shows the connected network so mainnet is never mistaken for a testnet', async () => {
    renderWallet();

    expect(await screen.findByTestId('network-badge')).toHaveTextContent('Sepolia');
  });

  it('prompts for a connection when nothing is authorised yet', async () => {
    const provider = createFakeProvider({ accounts: [] });
    renderWallet({ provider });

    const button = await screen.findByRole('button', { name: /connect wallet/i });

    act(() => provider.emitAccountsChanged([DEFAULT_ACCOUNT]));
    await userEvent.click(button);

    expect(await screen.findByTestId('account-address')).toHaveTextContent(DEFAULT_ACCOUNT);
  });

  it('reports a rejected connection in plain language', async () => {
    renderWallet({ provider: createFakeProvider({ accounts: [], rejectConnect: true }) });

    await userEvent.click(await screen.findByRole('button', { name: /connect wallet/i }));

    expect(await screen.findByTestId('wallet-error')).toHaveTextContent(/rejected in your wallet/i);
  });

  it('rejects an invalid recipient before asking the wallet to sign anything', async () => {
    const { provider } = renderWallet();
    const spy = jest.spyOn(provider, 'request');

    await screen.findByTestId('account-address');
    await userEvent.type(screen.getByLabelText(/recipient address/i), '0xnot-an-address');
    await userEvent.type(screen.getByLabelText(/amount/i), '0.1');
    await userEvent.click(screen.getByRole('button', { name: /send eth/i }));

    expect(await screen.findByTestId('wallet-error')).toHaveTextContent(
      'Invalid recipient address.'
    );
    expect(spy.mock.calls.map(([call]) => call.method)).not.toContain('eth_sendTransaction');
  });

  it('refuses to spend the whole balance, because gas has to come from somewhere', async () => {
    renderWallet();

    await screen.findByTestId('account-address');
    await userEvent.type(screen.getByLabelText(/recipient address/i), RECIPIENT);
    await userEvent.type(screen.getByLabelText(/amount/i), '2');
    await userEvent.click(screen.getByRole('button', { name: /send eth/i }));

    expect(await screen.findByTestId('wallet-error')).toHaveTextContent(
      /You can send at most 1\.99958 ETH/
    );
  });

  it('sends a valid transfer, debits the balance and records it as pending', async () => {
    // A poll interval longer than the test keeps the entry in its "pending"
    // state, so this assertion is about the send path, not the receipt watcher.
    renderWallet({ pollIntervalMs: 60000 });

    await screen.findByTestId('account-address');
    await userEvent.type(screen.getByLabelText(/recipient address/i), RECIPIENT);
    await userEvent.type(screen.getByLabelText(/amount/i), '0.25');
    await userEvent.click(screen.getByRole('button', { name: /send eth/i }));

    expect(await screen.findByTestId('wallet-notice')).toHaveTextContent(/submitted/i);

    // The balance the page shows is the balance the provider reports afterwards.
    await waitFor(() => expect(screen.getByTestId('balance')).toHaveTextContent('1.750000 ETH'));

    const row = await screen.findByRole('row', { name: /0\.25 ETH/ });
    expect(within(row).getByText('Pending')).toBeInTheDocument();

    // The form is cleared so the same transfer cannot be fired twice by accident.
    expect(screen.getByLabelText(/recipient address/i)).toHaveValue('');
  });

  it('moves a sent transfer to confirmed once a receipt appears', async () => {
    renderWallet({ pollIntervalMs: 5 });

    await screen.findByTestId('account-address');
    await userEvent.type(screen.getByLabelText(/recipient address/i), RECIPIENT);
    await userEvent.type(screen.getByLabelText(/amount/i), '0.25');
    await userEvent.click(screen.getByRole('button', { name: /send eth/i }));

    await waitFor(() =>
      expect(
        within(screen.getByRole('row', { name: /0\.25 ETH/ })).getByText('Confirmed')
      ).toBeInTheDocument()
    );
  });

  it('follows the wallet when the user switches account', async () => {
    const { provider } = renderWallet({
      provider: createFakeProvider({ balances: { [RECIPIENT]: 5n * 10n ** 18n } }),
    });

    await screen.findByTestId('account-address');

    act(() => provider.emitAccountsChanged([RECIPIENT]));

    await waitFor(() => expect(screen.getByTestId('account-address')).toHaveTextContent(RECIPIENT));
    await waitFor(() => expect(screen.getByTestId('balance')).toHaveTextContent('5.000000 ETH'));
  });

  it('follows the wallet when the user switches network', async () => {
    const { provider } = renderWallet();

    await screen.findByTestId('network-badge');

    act(() => provider.emitChainChanged(1));

    await waitFor(() =>
      expect(screen.getByTestId('network-badge')).toHaveTextContent('Ethereum Mainnet')
    );
  });

  it('drops back to the connect screen when the wallet is locked', async () => {
    const { provider } = renderWallet();

    await screen.findByTestId('account-address');

    act(() => provider.emitAccountsChanged([]));

    expect(await screen.findByRole('button', { name: /connect wallet/i })).toBeInTheDocument();
  });

  it('surfaces a failed broadcast rather than silently clearing the form', async () => {
    const provider = createFakeProvider({ sendError: new Error('nonce too low') });
    renderWallet({ provider });

    await screen.findByTestId('account-address');
    await userEvent.type(screen.getByLabelText(/recipient address/i), RECIPIENT);
    await userEvent.type(screen.getByLabelText(/amount/i), '0.25');
    await userEvent.click(screen.getByRole('button', { name: /send eth/i }));

    expect(await screen.findByTestId('wallet-error')).toHaveTextContent(/nonce too low/);
    expect(screen.getByLabelText(/amount/i)).toHaveValue('0.25');
  });

  it('starts with an honest empty state for history', async () => {
    renderWallet();

    expect(await screen.findByText(/No transactions sent from this account/i)).toBeInTheDocument();
  });
});
