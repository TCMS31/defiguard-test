/**
 * Display helpers for on-chain values.
 *
 * Everything here works on decimal *strings* and BigInt. Balances are routinely
 * larger than Number.MAX_SAFE_INTEGER in wei, and `parseFloat` on an ether
 * string silently loses precision, so no value on this path is ever turned into
 * a JavaScript number.
 */

const WEI_PER_ETH = 10n ** 18n;

/**
 * Convert a wei amount to a fixed-precision ether string without going through
 * a float.
 *
 * @param {string|bigint} wei
 * @param {number} [decimals=6] digits to keep after the point
 * @returns {string} e.g. "1.234500"
 */
export function formatWei(wei, decimals = 6) {
  const value = typeof wei === 'bigint' ? wei : BigInt(String(wei || '0'));
  const negative = value < 0n;
  const absolute = negative ? -value : value;

  const whole = absolute / WEI_PER_ETH;
  const fraction = (absolute % WEI_PER_ETH).toString().padStart(18, '0').slice(0, decimals);

  const rendered = decimals > 0 ? `${whole}.${fraction}` : String(whole);

  return negative ? `-${rendered}` : rendered;
}

/**
 * Format a balance for the account card.
 *
 * A dust balance must never be rendered as a flat "0.0000" -- a user who owns
 * something should not be told they own nothing.
 *
 * @param {string|bigint} wei
 * @param {number} [decimals=6]
 * @returns {string}
 */
export function formatBalance(wei, decimals = 6) {
  const value = typeof wei === 'bigint' ? wei : BigInt(String(wei || '0'));

  if (value === 0n) return formatWei(0n, decimals);

  const formatted = formatWei(value, decimals);
  const isTruncatedToZero = /^-?0\.?0*$/.test(formatted);

  if (!isTruncatedToZero) return formatted;

  // Smallest value this precision can express, e.g. "0.000001" at 6 decimals.
  const smallest = decimals > 0 ? `0.${'0'.repeat(decimals - 1)}1` : '1';

  return value < 0n ? `>-${smallest}` : `<${smallest}`;
}

/**
 * Shorten an address or transaction hash for display: 0x1234...cdef.
 *
 * @param {string} value
 * @param {number} [lead=6]
 * @param {number} [tail=4]
 * @returns {string}
 */
export function shorten(value, lead = 6, tail = 4) {
  if (!value) return '';
  if (value.length <= lead + tail + 3) return value;

  return `${value.slice(0, lead)}...${value.slice(-tail)}`;
}
