import {
  BASE_TRANSFER_GAS,
  fromHexQuantity,
  toHexQuantity,
  USER_REJECTED_REQUEST,
  WalletClient,
  WalletClientError,
} from '../walletClient';
import { createFakeProvider, DEFAULT_ACCOUNT } from '../testing/fakeProvider';

const RECIPIENT = '0xfB6916095ca1df60bB79Ce92cE3Ea74c37c5d359';

describe('hex quantity helpers', () => {
  it.each([
    [0n, '0x0'],
    [21000n, '0x5208'],
    ['1000000000000000000', '0xde0b6b3a7640000'],
  ])('encodes %p as %s', (input, expected) => {
    expect(toHexQuantity(input)).toBe(expected);
  });

  it('round-trips a value larger than Number.MAX_SAFE_INTEGER', () => {
    const wei = 123456789012345678901234n;

    expect(fromHexQuantity(toHexQuantity(wei))).toBe(wei);
  });

  it.each([null, undefined, ''])('decodes %p as zero', (input) => {
    expect(fromHexQuantity(input)).toBe(0n);
  });
});

describe('WalletClient', () => {
  let provider;
  let client;

  beforeEach(() => {
    provider = createFakeProvider();
    client = new WalletClient({ provider });
  });

  it('refuses to construct without a usable provider', () => {
    expect(() => new WalletClient({ provider: null })).toThrow(WalletClientError);
    expect(() => new WalletClient({ provider: {} })).toThrow(/request\(\)/);
  });

  it('reads already-authorised accounts without prompting', async () => {
    await expect(client.getAccounts()).resolves.toEqual([DEFAULT_ACCOUNT]);
  });

  it('returns an empty list when no account is shared', async () => {
    const empty = new WalletClient({ provider: createFakeProvider({ accounts: [] }) });

    await expect(empty.getAccounts()).resolves.toEqual([]);
  });

  it('surfaces a rejected connection with its EIP-1193 code', async () => {
    const rejecting = new WalletClient({ provider: createFakeProvider({ rejectConnect: true }) });

    await expect(rejecting.requestAccounts()).rejects.toMatchObject({
      name: 'WalletClientError',
      code: USER_REJECTED_REQUEST,
    });
  });

  it('normalises the chain id from the hex the provider returns', async () => {
    await expect(client.getChainId()).resolves.toBe(11155111);
  });

  it('reads a balance as an exact BigInt in wei', async () => {
    await expect(client.getBalance(DEFAULT_ACCOUNT)).resolves.toBe(2000000000000000000n);
  });

  it('prices a transfer as gas x gas price', async () => {
    const fee = await client.estimateFee({ from: DEFAULT_ACCOUNT, to: RECIPIENT, value: 0n });

    expect(fee.gas).toBe(21000n);
    expect(fee.gasPrice).toBe(20000000000n);
    expect(fee.feeWei).toBe(21000n * 20000000000n);
    expect(fee.estimated).toBe(true);
  });

  it('falls back to the base transfer cost when estimation fails', async () => {
    const flaky = {
      request: async ({ method }) => {
        if (method === 'eth_gasPrice') return '0x4a817c800';
        throw new Error('estimation unavailable');
      },
    };

    const fee = await new WalletClient({ provider: flaky }).estimateFee({
      from: DEFAULT_ACCOUNT,
      to: RECIPIENT,
      value: 0n,
    });

    expect(fee.gas).toBe(BASE_TRANSFER_GAS);
    expect(fee.estimated).toBe(false);
  });

  it('sends value as a hex quantity, which is what JSON-RPC requires', async () => {
    const seen = [];
    const recording = {
      request: async (payload) => {
        seen.push(payload);
        return payload.method === 'eth_sendTransaction' ? '0xhash' : '0x0';
      },
    };

    await new WalletClient({ provider: recording }).sendTransaction({
      from: DEFAULT_ACCOUNT,
      to: RECIPIENT,
      value: 10n ** 18n,
    });

    expect(seen[0].params[0]).toEqual({
      from: DEFAULT_ACCOUNT,
      to: RECIPIENT,
      value: '0xde0b6b3a7640000',
      gas: '0x5208',
    });
  });

  it('moves the balance when a transfer is broadcast', async () => {
    const hash = await client.sendTransaction({
      from: DEFAULT_ACCOUNT,
      to: RECIPIENT,
      value: 10n ** 18n,
    });

    expect(hash).toMatch(/^0x[0-9a-f]{64}$/);
    await expect(client.getBalance(DEFAULT_ACCOUNT)).resolves.toBe(10n ** 18n);
    await expect(client.getTransactionReceipt(hash)).resolves.toMatchObject({ status: '0x1' });
  });

  it('returns null for a receipt that does not exist yet', async () => {
    await expect(client.getTransactionReceipt('0xnope')).resolves.toBeNull();
  });

  it('validates addresses with the checksum, not just the shape', () => {
    // One character case-flipped: still valid hex, but the EIP-55 checksum
    // no longer holds, which is exactly the typo class this catches.
    const flipped = '0xFB6916095ca1df60bB79Ce92cE3Ea74c37c5d359';

    expect(client.isAddress(RECIPIENT)).toBe(true);
    expect(client.isAddress(flipped)).toBe(false);
    expect(client.isAddress('not-an-address')).toBe(false);
    expect(client.isAddress(undefined)).toBe(false);
  });

  it('accepts an all-lowercase address, which carries no checksum by design', () => {
    expect(client.isAddress(RECIPIENT.toLowerCase())).toBe(true);
  });

  it('subscribes and unsubscribes from provider events', () => {
    const handler = jest.fn();
    const off = client.on('accountsChanged', handler);

    provider.emitAccountsChanged([RECIPIENT]);
    expect(handler).toHaveBeenCalledWith([RECIPIENT]);

    off();
    provider.emitAccountsChanged([DEFAULT_ACCOUNT]);
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('tolerates a provider with no event support', () => {
    const silent = new WalletClient({ provider: { request: async () => '0x0' } });

    expect(() => silent.on('accountsChanged', jest.fn())()).not.toThrow();
  });

  it('wraps an unsupported RPC method in a WalletClientError', async () => {
    await expect(client.request('eth_signTypedData_v4')).rejects.toBeInstanceOf(WalletClientError);
  });
});
