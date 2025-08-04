# Wallet requirements and status

The original `WALLET_README.md` in commit `7ec60cb` ("Eth wallet adapter") is the only
statement of intent this repository carries — there is no separate brief. This file keeps
that feature list and records, honestly, which items the first commit delivered and which
were written down but never built.

Usage and troubleshooting now live in the [README](README.md).

## Feature list, as originally stated

| Stated feature | Status in commit `7ec60cb` | Status now |
| --- | --- | --- |
| **MetaMask integration** — connect a wallet to interact with Ethereum | Implemented | Implemented, behind an EIP-1193 adapter so any injected provider works |
| **Send ETH** — send to any address with transaction status | Implemented | Implemented, with gas priced and checked before the wallet is opened |
| **Receive ETH** — display the address for receiving | Implemented | Implemented; the empty "QR Code" placeholder box was removed |
| **Balance display** — real-time ETH balance updates | Partially working: the reconnect-on-load path read the web3 instance from state in the tick it was set, so it threw and the balance stayed at `0.0000`; `parseFloat(...).toFixed(4)` also rendered a dust balance as zero | Implemented; balance is read through the client and formatted from wei with BigInt |
| **Transaction history** — view transaction hashes and status | **Not implemented.** Only the most recent hash appeared inside a success banner, which the next action cleared. The same document listed "Transaction history display" under *Future Enhancements*, contradicting its own feature list | Implemented: a bounded local log per account and chain, with pending/confirmed/failed resolved from the receipt |
| **Responsive design** — works on desktop and mobile | Implemented (one `max-width: 768px` breakpoint) | Kept, and extended to the elements added since |
| **Address validation before sending** | Implemented (`web3.utils.isAddress`) | Implemented, plus amount grammar, zero-amount and amount-plus-gas checks |
| **MetaMask signing; no private key storage** | Implemented — no key material has ever been in this repository | Unchanged, and asserted in the tests |
| **Network support** — mainnet, Goerli, Sepolia, any EVM chain | **Not implemented.** The page never read or displayed the chain id, so there was no way to tell which network a transfer would go to | Implemented: the connected chain is named on screen and `chainChanged` is followed |

## Explicitly deferred in the original document, and still deferred

- QR code generation for addresses
- Gas price optimisation (EIP-1559 fee selection)
- Multi-token support
- Hardware wallet integration

## What was added beyond the stated list

Only items needed to make the stated list correct:

- `accountsChanged` handling — without it the page kept showing the first account after
  the user switched in MetaMask, and the next transfer would have been sent `from` an
  account that was no longer selected.
- Receipt polling, which is what turns "view transaction status" into something that
  actually changes.

No product features were invented. This is an assessment-style project, and it is kept
focused on what it said it did.
