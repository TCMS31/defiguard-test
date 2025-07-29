/**
 * Parsing and validation for the "send ETH" form.
 *
 * Split out from the React component so the rules that decide whether real
 * money leaves an account can be unit tested exhaustively, with no provider, no
 * network and no chain access.
 */

const WEI_PER_ETH = 10n ** 18n;
const ETH_DECIMALS = 18;

/** Thrown for input the user can correct; the message is shown verbatim. */
export class AmountError extends Error {
  constructor(message) {
    super(message);
    this.name = 'AmountError';
  }
}

/**
 * Convert a decimal ether string to wei exactly.
 *
 * `web3.utils.toWei` throws an opaque error on more than 18 decimal places and
 * accepts values such as "1e-3" inconsistently, so the parse is done here with
 * integer arithmetic and an explicit grammar.
 *
 * @param {string|number} value
 * @returns {bigint} the amount in wei
 * @throws {AmountError} if the value is not a plain non-negative decimal
 */
export function etherToWei(value) {
  const text = String(value ?? '').trim();

  if (text === '') throw new AmountError('Enter an amount to send.');
  if (!/^\d*\.?\d*$/.test(text) || text === '.') {
    throw new AmountError('Amount must be a plain decimal number, e.g. 0.05.');
  }

  const [whole = '0', fraction = ''] = text.split('.');

  if (fraction.length > ETH_DECIMALS) {
    throw new AmountError(`Amount has more than ${ETH_DECIMALS} decimal places.`);
  }

  const padded = fraction.padEnd(ETH_DECIMALS, '0');

  return BigInt(whole || '0') * WEI_PER_ETH + BigInt(padded || '0');
}

/**
 * Decide whether a transfer can be attempted, and say precisely why not when it
 * cannot.
 *
 * The check that matters is `amount + fee <= balance`, not `amount <= balance`:
 * a user who types their whole balance into the amount field has enough ETH for
 * the transfer but not for the gas, and the transaction is rejected by the node
 * after they have already approved it in MetaMask.
 *
 * @param {object} input
 * @param {string} input.recipient           destination address as typed
 * @param {string} input.amount              ether amount as typed
 * @param {string|bigint} input.balanceWei   current account balance, in wei
 * @param {string|bigint} [input.feeWei=0n]  estimated total gas cost, in wei
 * @param {string} [input.account]           the sending address
 * @param {(address: string) => boolean} input.isAddress checksum-aware validator
 * @returns {{ valid: boolean, error: string|null, amountWei: bigint|null, warning: string|null }}
 */
export function validateTransfer({
  recipient,
  amount,
  balanceWei,
  feeWei = 0n,
  account = '',
  isAddress,
}) {
  const fail = (error) => ({ valid: false, error, amountWei: null, warning: null });

  const to = String(recipient ?? '').trim();

  if (!to) return fail('Enter a recipient address.');
  if (!isAddress(to)) return fail('Invalid recipient address.');

  let amountWei;
  try {
    amountWei = etherToWei(amount);
  } catch (error) {
    if (error instanceof AmountError) return fail(error.message);
    throw error;
  }

  if (amountWei === 0n) return fail('Amount must be greater than zero.');

  const balance = BigInt(String(balanceWei ?? '0'));
  const fee = BigInt(String(feeWei ?? '0'));

  if (amountWei > balance) {
    return fail('Amount exceeds your balance.');
  }

  if (amountWei + fee > balance) {
    const spendable = balance - fee;
    const max = spendable > 0n ? spendable : 0n;

    return fail(
      `Not enough ETH to cover the amount plus gas. You can send at most ${weiToEtherString(max)} ETH.`
    );
  }

  const warning =
    account && to.toLowerCase() === String(account).toLowerCase()
      ? 'This sends ETH to your own address; you will only pay the gas.'
      : null;

  return { valid: true, error: null, amountWei, warning };
}

/**
 * Exact wei -> ether string, trailing zeros trimmed. Used in error messages.
 *
 * @param {bigint} wei
 * @returns {string}
 */
export function weiToEtherString(wei) {
  const whole = wei / WEI_PER_ETH;
  const fraction = (wei % WEI_PER_ETH).toString().padStart(ETH_DECIMALS, '0').replace(/0+$/, '');

  return fraction ? `${whole}.${fraction}` : String(whole);
}

export { WEI_PER_ETH, ETH_DECIMALS };
