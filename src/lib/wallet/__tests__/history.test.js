import {
  clearHistory,
  historyKey,
  loadHistory,
  MAX_ENTRIES,
  recordTransaction,
  TX_STATUS,
  updateTransactionStatus,
} from '../history';
import { createMemoryStorage } from '../testing/memoryStorage';

const ACCOUNT = '0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAed';
const OTHER = '0xfB6916095ca1df60bB79Ce92cE3Ea74c37c5d359';

const scope = (storage, chainId = 11155111, account = ACCOUNT) => ({ storage, account, chainId });

describe('history', () => {
  let storage;

  beforeEach(() => {
    storage = createMemoryStorage();
  });

  it('starts empty', () => {
    expect(loadHistory(scope(storage))).toEqual([]);
  });

  it('records a send as pending, newest first', () => {
    recordTransaction(scope(storage), { hash: '0xaaa', to: OTHER, amountEth: '0.1' });
    const entries = recordTransaction(scope(storage), {
      hash: '0xbbb',
      to: OTHER,
      amountEth: '0.2',
    });

    expect(entries.map((entry) => entry.hash)).toEqual(['0xbbb', '0xaaa']);
    expect(entries[0]).toMatchObject({ status: TX_STATUS.PENDING, amountEth: '0.2' });
  });

  it('moves a transaction to confirmed without touching the others', () => {
    recordTransaction(scope(storage), { hash: '0xaaa', to: OTHER, amountEth: '0.1' });
    recordTransaction(scope(storage), { hash: '0xbbb', to: OTHER, amountEth: '0.2' });

    const entries = updateTransactionStatus(scope(storage), '0xaaa', TX_STATUS.CONFIRMED);

    expect(entries.find((entry) => entry.hash === '0xaaa').status).toBe(TX_STATUS.CONFIRMED);
    expect(entries.find((entry) => entry.hash === '0xbbb').status).toBe(TX_STATUS.PENDING);
  });

  it('keeps the list bounded', () => {
    for (let index = 0; index < MAX_ENTRIES + 10; index += 1) {
      recordTransaction(scope(storage), { hash: `0x${index}`, to: OTHER, amountEth: '0.1' });
    }

    expect(loadHistory(scope(storage))).toHaveLength(MAX_ENTRIES);
  });

  it('scopes history by chain, so a testnet send never shows under mainnet', () => {
    recordTransaction(scope(storage, 11155111), { hash: '0xaaa', to: OTHER, amountEth: '0.1' });

    expect(loadHistory(scope(storage, 11155111))).toHaveLength(1);
    expect(loadHistory(scope(storage, 1))).toHaveLength(0);
  });

  it('scopes history by account, case-insensitively', () => {
    recordTransaction(scope(storage), { hash: '0xaaa', to: OTHER, amountEth: '0.1' });

    expect(loadHistory(scope(storage, 11155111, ACCOUNT.toLowerCase()))).toHaveLength(1);
    expect(loadHistory(scope(storage, 11155111, OTHER))).toHaveLength(0);
    expect(historyKey(ACCOUNT, 1)).toBe(historyKey(ACCOUNT.toLowerCase(), 1));
  });

  it('clears one scope only', () => {
    recordTransaction(scope(storage, 1), { hash: '0xaaa', to: OTHER, amountEth: '0.1' });
    recordTransaction(scope(storage, 11155111), { hash: '0xbbb', to: OTHER, amountEth: '0.1' });

    clearHistory(scope(storage, 1));

    expect(loadHistory(scope(storage, 1))).toEqual([]);
    expect(loadHistory(scope(storage, 11155111))).toHaveLength(1);
  });

  it('degrades to an empty list when storage is unavailable', () => {
    expect(loadHistory(scope(null))).toEqual([]);
    expect(
      recordTransaction(scope(null), { hash: '0xaaa', to: OTHER, amountEth: '0.1' })
    ).toHaveLength(1);
  });

  it('survives corrupted stored data', () => {
    storage.setItem(historyKey(ACCOUNT, 11155111), '{not json');

    expect(loadHistory(scope(storage))).toEqual([]);
  });
});
