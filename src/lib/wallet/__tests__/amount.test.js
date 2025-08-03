import Web3 from 'web3';

import { AmountError, etherToWei, validateTransfer, weiToEtherString } from '../amount';

const isAddress = (value) => Web3.utils.isAddress(value);

const ACCOUNT = '0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAed';
const RECIPIENT = '0xfB6916095ca1df60bB79Ce92cE3Ea74c37c5d359';

const ONE_ETH = 10n ** 18n;

describe('etherToWei', () => {
  it.each([
    ['1', 1000000000000000000n],
    ['0.5', 500000000000000000n],
    ['0.000000000000000001', 1n],
    ['12.34', 12340000000000000000n],
    ['.5', 500000000000000000n],
    ['3.', 3000000000000000000n],
  ])('converts %s ETH exactly', (input, expected) => {
    expect(etherToWei(input)).toBe(expected);
  });

  it('agrees with web3.utils.toWei on values web3 accepts', () => {
    ['1', '0.5', '12.34', '0.000000000000000001'].forEach((value) => {
      expect(etherToWei(value).toString()).toBe(Web3.utils.toWei(value, 'ether'));
    });
  });

  it('does not lose precision the way parseFloat does', () => {
    const value = '0.1234567890123456789'.slice(0, 20); // 18 decimal places
    expect(etherToWei(value)).toBe(123456789012345678n);
  });

  it.each(['', '   ', 'abc', '1.2.3', '-1', '1e18', '.'])('rejects %p', (input) => {
    expect(() => etherToWei(input)).toThrow(AmountError);
  });

  it('rejects more than 18 decimal places rather than silently truncating', () => {
    expect(() => etherToWei('0.0000000000000000001')).toThrow(/more than 18 decimal places/);
  });
});

describe('weiToEtherString', () => {
  it.each([
    [0n, '0'],
    [ONE_ETH, '1'],
    [1n, '0.000000000000000001'],
    [1500000000000000000n, '1.5'],
  ])('renders %s wei as %s', (wei, expected) => {
    expect(weiToEtherString(wei)).toBe(expected);
  });
});

describe('validateTransfer', () => {
  const base = { balanceWei: (2n * ONE_ETH).toString(), account: ACCOUNT, isAddress };

  it('accepts a well-formed transfer', () => {
    const result = validateTransfer({ ...base, recipient: RECIPIENT, amount: '1' });

    expect(result.valid).toBe(true);
    expect(result.amountWei).toBe(ONE_ETH);
    expect(result.error).toBeNull();
  });

  it('requires a recipient', () => {
    expect(validateTransfer({ ...base, recipient: '', amount: '1' }).error).toMatch(
      /Enter a recipient/
    );
  });

  it('rejects an address that fails the checksum', () => {
    // Same address, one character case-flipped: valid hex, invalid checksum.
    const badChecksum = '0xFB6916095ca1df60bB79Ce92cE3Ea74c37c5d359';

    expect(validateTransfer({ ...base, recipient: badChecksum, amount: '1' }).error).toBe(
      'Invalid recipient address.'
    );
  });

  it.each(['0', '0.0', '0.000000000000000000'])('rejects a zero amount (%s)', (amount) => {
    expect(validateTransfer({ ...base, recipient: RECIPIENT, amount }).error).toMatch(
      /greater than zero/
    );
  });

  it('rejects an amount larger than the balance', () => {
    expect(validateTransfer({ ...base, recipient: RECIPIENT, amount: '3' }).error).toBe(
      'Amount exceeds your balance.'
    );
  });

  it('rejects an amount that leaves nothing for gas, and says what is sendable', () => {
    const feeWei = 21000n * 20000000000n; // 21000 gas at 20 gwei = 0.00042 ETH
    const result = validateTransfer({
      ...base,
      recipient: RECIPIENT,
      amount: '2',
      feeWei,
    });

    expect(result.valid).toBe(false);
    expect(result.error).toBe(
      'Not enough ETH to cover the amount plus gas. You can send at most 1.99958 ETH.'
    );
    // The figure above is exactly balance - fee.
    expect(weiToEtherString(2n * ONE_ETH - feeWei)).toBe('1.99958');
  });

  it('allows the largest amount that still covers gas', () => {
    const feeWei = 21000n * 20000000000n;
    const result = validateTransfer({
      ...base,
      recipient: RECIPIENT,
      amount: weiToEtherString(2n * ONE_ETH - feeWei),
      feeWei,
    });

    expect(result.valid).toBe(true);
    expect(result.amountWei + feeWei).toBe(2n * ONE_ETH);
  });

  it('warns, but does not block, a send to your own address', () => {
    const result = validateTransfer({ ...base, recipient: ACCOUNT, amount: '0.1' });

    expect(result.valid).toBe(true);
    expect(result.warning).toMatch(/your own address/);
  });
});
