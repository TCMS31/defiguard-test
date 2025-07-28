import { describeChain, normaliseChainId } from '../networks';

describe('normaliseChainId', () => {
  it.each([
    ['0x1', 1],
    ['0xaa36a7', 11155111],
    [1, 1],
    ['11155111', 11155111],
    [11155111n, 11155111],
  ])('parses %p as %p', (input, expected) => {
    expect(normaliseChainId(input)).toBe(expected);
  });

  it.each([null, undefined, '', 'not-a-chain'])('returns null for %p', (input) => {
    expect(normaliseChainId(input)).toBeNull();
  });
});

describe('describeChain', () => {
  it('flags mainnet as a non-testnet', () => {
    expect(describeChain('0x1')).toEqual({
      id: 1,
      name: 'Ethereum Mainnet',
      testnet: false,
      known: true,
    });
  });

  it('flags Sepolia as a testnet', () => {
    expect(describeChain(11155111)).toMatchObject({ name: 'Sepolia', testnet: true });
  });

  it('degrades gracefully on an unrecognised chain', () => {
    expect(describeChain(42161)).toEqual({
      id: 42161,
      name: 'Chain 42161',
      testnet: false,
      known: false,
    });
  });

  it('reports an unknown network when the provider gives nothing', () => {
    expect(describeChain(null)).toMatchObject({ id: null, name: 'Unknown network' });
  });
});
