import { formatBalance, formatWei, shorten } from '../format';

describe('formatWei', () => {
  it.each([
    ['0', '0.000000'],
    ['1000000000000000000', '1.000000'],
    ['1500000000000000000', '1.500000'],
    ['123456789012345678', '0.123456'],
  ])('renders %s wei as %s', (wei, expected) => {
    expect(formatWei(wei)).toBe(expected);
  });

  it('never routes the value through a float', () => {
    // 2^53 + 1 wei: unrepresentable as a JS number, and parseFloat on the
    // ether string would round the last digits away.
    expect(formatWei('9007199254740993', 18)).toBe('0.009007199254740993');
  });

  it('honours a requested precision', () => {
    expect(formatWei('1500000000000000000', 2)).toBe('1.50');
    expect(formatWei('1500000000000000000', 0)).toBe('1');
  });
});

describe('formatBalance', () => {
  it('shows a plain zero balance as zero', () => {
    expect(formatBalance('0')).toBe('0.000000');
  });

  it('does not tell a user with dust that they hold nothing', () => {
    // The old page did `parseFloat(balance).toFixed(4)`, which rendered
    // 1 wei as "0.0000".
    expect(formatBalance('1')).toBe('<0.000001');
  });

  it('renders ordinary balances normally', () => {
    expect(formatBalance('2500000000000000000')).toBe('2.500000');
  });
});

describe('shorten', () => {
  it('abbreviates a long value', () => {
    expect(shorten('0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAed')).toBe('0x5aAe...eAed');
  });

  it('leaves short values alone', () => {
    expect(shorten('0x1234')).toBe('0x1234');
  });

  it('tolerates an empty value', () => {
    expect(shorten('')).toBe('');
  });
});
