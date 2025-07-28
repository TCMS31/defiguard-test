import detectEthereumProvider from '@metamask/detect-provider';

import { WalletClient } from './walletClient';

/**
 * Locate the injected MetaMask provider and wrap it in a {@link WalletClient}.
 *
 * Returns null rather than throwing when no wallet is installed: a visitor
 * without MetaMask should still get a working page that explains what to do.
 *
 * @param {{ detect?: () => Promise<object|null> }} [options] injection point for tests
 * @returns {Promise<WalletClient|null>}
 */
export async function connectMetaMask({ detect = detectEthereumProvider } = {}) {
  const provider = await detect();

  if (!provider) return null;

  return new WalletClient({ provider });
}
