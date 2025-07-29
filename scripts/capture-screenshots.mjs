/**
 * Capture the README screenshots.
 *
 * Usage:
 *   npm run start-front                       # in one terminal (PORT=8650)
 *   node scripts/capture-screenshots.mjs      # in another
 *
 * A browser wallet cannot be installed in a headless browser, so the page is
 * given a fake EIP-1193 provider on `window.ethereum` before any application
 * code runs. Everything above that provider -- the page, the hook, the wallet
 * client, the validation, the history -- is the real shipped code, and the
 * transaction in the screenshots is produced by actually driving the form.
 *
 * The provider signs nothing, reaches no network and contains no key material.
 */
import { mkdir } from 'node:fs/promises';
import path from 'node:path';

import { chromium } from 'playwright';

const BASE_URL = process.env.SCREENSHOT_BASE_URL ?? 'http://localhost:8650';
const OUT_DIR = path.resolve('docs/screenshots');
const VIEWPORT = { width: 1440, height: 900 };

const ACCOUNT = '0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAed';
const RECIPIENT = '0xfB6916095ca1df60bB79Ce92cE3Ea74c37c5d359';

/** Installed into the page before the app boots. */
function installFakeWallet({ account, chainId, balanceWei, gasPrice }) {
  const balances = new Map([[account.toLowerCase(), BigInt(balanceWei)]]);
  const receipts = new Map();
  const hex = (value) => `0x${BigInt(value).toString(16)}`;
  let nonce = 0;

  const handlers = {
    eth_accounts: () => [account],
    eth_requestAccounts: () => [account],
    eth_chainId: () => hex(chainId),
    eth_gasPrice: () => hex(gasPrice),
    eth_getBalance: ([address]) => hex(balances.get(String(address).toLowerCase()) ?? 0n),
    eth_estimateGas: () => hex(21000n),
    eth_getTransactionReceipt: ([hash]) => receipts.get(hash) ?? null,
    eth_sendTransaction: ([tx]) => {
      const from = String(tx.from).toLowerCase();
      balances.set(from, (balances.get(from) ?? 0n) - BigInt(tx.value));

      nonce += 1;
      const hash = `0x${nonce.toString(16).padStart(64, 'c7e3f1a9b2d4')}`;
      receipts.set(hash, { transactionHash: hash, status: '0x1' });

      return hash;
    },
  };

  window.ethereum = {
    isMetaMask: true,
    request: async ({ method, params = [] }) => {
      const handler = handlers[method];

      if (!handler) {
        const error = new Error(`Unsupported method: ${method}`);
        error.code = -32601;
        throw error;
      }

      return handler(params);
    },
    on: () => {},
    removeListener: () => {},
  };
}

/**
 * Fill the send form and submit it, exactly as a user would.
 *
 * @param {import('playwright').Page} page
 * @param {string} to
 * @param {string} amount
 */
async function send(page, to, amount) {
  await page.fill('#recipient', to);
  await page.fill('#amount', amount);
  await page.click('.send-btn');
  await page.waitForSelector('[data-testid="wallet-notice"]');
}

async function capture(page, name) {
  const file = path.join(OUT_DIR, `${name}.png`);

  await page.screenshot({ path: file });
  console.info('wrote %s', path.relative(process.cwd(), file));
}

async function main() {
  await mkdir(OUT_DIR, { recursive: true });

  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: VIEWPORT, deviceScaleFactor: 1 });

  await context.addInitScript(installFakeWallet, {
    account: ACCOUNT,
    chainId: 11155111, // Sepolia
    balanceWei: '4218500000000000000', // 4.2185 ETH
    gasPrice: '24000000000', // 24 gwei
  });

  const page = await context.newPage();

  // --- Landing page -------------------------------------------------------
  await page.goto(`${BASE_URL}/`, { waitUntil: 'networkidle' });
  await page.waitForSelector('.banner_taital');
  await capture(page, 'home');

  // --- Wallet: connected, with real sends driven through the form ---------
  await page.goto(`${BASE_URL}/wallet`, { waitUntil: 'networkidle' });
  await page.waitForSelector('[data-testid="account-address"]');

  // First send, allowed to confirm from its receipt.
  await send(page, RECIPIENT, '0.35');
  await page.waitForSelector('.status-pill--confirmed', { timeout: 15000 });

  // Second send, captured while it is still pending.
  await send(page, RECIPIENT, '0.12');
  await page.waitForSelector('.history-table tbody tr:nth-child(2)');

  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(400);
  await capture(page, 'wallet-connected');

  await page.evaluate(() => {
    document.querySelector('.history-section').scrollIntoView({ block: 'center' });
  });
  await page.waitForTimeout(400);
  await capture(page, 'wallet-history');

  // --- The validation that stops a balance-emptying send ------------------
  // 4.2185 - 0.35 - 0.12 = 3.7485, i.e. exactly the remaining balance: enough
  // for the transfer, not enough for the transfer plus gas.
  await page.fill('#recipient', RECIPIENT);
  await page.fill('#amount', '3.7485');
  await page.click('.send-btn');
  await page.waitForSelector('[data-testid="wallet-error"]');
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(400);
  await capture(page, 'wallet-gas-check');

  await browser.close();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
