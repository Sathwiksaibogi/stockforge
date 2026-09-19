# StockForge

**Market-aware launch infrastructure for tokenized asset demos on Solana.**

StockForge transforms real financial-market data into deterministic, asset-specific **Meteora Dynamic Bonding Curve (DBC)** launch configurations. It combines **Pyth** market intelligence, **Meteora** liquidity infrastructure, and **PreStocks** private-market Token-2022 intelligence in one end-to-end application.

> **Live app:** https://stockforge-liard.vercel.app/  
> **Repository:** https://github.com/Sathwiksaibogi/stockforge

---

## Why StockForge?

Most token launches begin with manually chosen pricing and liquidity parameters that are disconnected from the market the asset is meant to reference.

StockForge starts from the opposite direction:

1. Read a real external market reference.
2. Measure recent realized volatility.
3. Compile a deterministic launch profile.
4. Convert that profile into a Meteora DBC configuration.
5. Simulate the launch before deployment.
6. Deploy a real Solana Devnet market.
7. Monitor the live DBC against its external reference.
8. Quote and execute real swaps through Phantom.

The result is a launch workflow where the curve is informed by financial-market conditions instead of arbitrary token-launch defaults.

---

## Product Flow

```text
                     ┌──────────────────────┐
                     │     StockForge       │
                     └──────────┬───────────┘
                                │
                    Explore market context
                                │
             ┌──────────────────┴──────────────────┐
             │                                     │
             ▼                                     ▼
      Pyth public markets                  PreStocks assets
      TSLA / QQQ / VOO                OPENAI / ANTHROPIC /
             │                              ANDURIL
             │                                     │
 live price + 30D volatility        Solana mainnet Token-2022
             │                       read-only intelligence
             ▼
     StockForge Curve Compiler
             │
             ▼
     Discovery / Fair Value /
        Expansion regions
             │
             ▼
       Meteora calibration
             │
             ▼
       Pre-launch simulation
             │
             ▼
     Real Devnet DBC deployment
             │
             ▼
      Live market monitoring
             │
             ▼
       Phantom quote + swap
             │
             ▼
     Exact post-trade intelligence
```

---

## Core Features

### 1. Multi-Asset Pyth Market Intelligence

StockForge currently supports:

| Reference | Type | Pyth feed |
|---|---|---|
| TSLA | US equity | `Equity.US.TSLA/USD` |
| QQQ | US ETF | `Equity.US.QQQ/USD` |
| VOO | US ETF | `Equity.US.VOO/USD` |

For each supported market, StockForge reads:

- live reference price
- confidence information
- market session
- publisher count
- recent historical prices
- 30-day realized volatility
- volatility regime

The selected asset flows through the compiler and simulation pipeline instead of being hardcoded to one market.

---

### 2. Deterministic Curve Compiler

The StockForge Curve Compiler converts:

```text
reference price
+
annualized realized volatility
+
risk profile
+
target raise
+
graduation target
```

into an asset-specific launch profile.

The compiler produces:

- initial DBC price
- Discovery zone
- Fair Value zone
- Expansion zone
- liquidity weighting between regions
- base trading fee
- desired graduation target

Supported risk profiles:

- **Conservative**
- **Balanced**
- **Aggressive**

The same inputs always produce the same compiled profile.

---

### 3. Meteora DBC Calibration

The compiled StockForge profile is converted into parameters understood by the Meteora Dynamic Bonding Curve SDK.

The calibration layer handles:

- Q64.64 sqrt-price conversion
- custom curve points
- liquidity segment construction
- base fee configuration
- migration threshold calibration
- fixed token supply
- leftover-token accounting
- DAMM v2 migration configuration
- creator/permanent liquidity split

The calibration step is separate from the financial compiler so market logic and protocol-specific math remain independently testable.

---

### 4. Pre-Launch Simulation

Before spending SOL or signing deployment transactions, StockForge simulates the proposed market.

The simulation page shows:

- frozen market snapshot
- selected ticker
- reference price
- realized volatility
- generated curve
- calibrated graduation level
- scenario quotes
- estimated execution behavior
- comparison against the latest Pyth reference

This creates a clean separation between:

```text
design → simulate → deploy
```

rather than deploying first and reasoning about the curve afterward.

---

### 5. Real Meteora Devnet Deployment

StockForge creates real Solana accounts through Meteora DBC.

A deployment requires two wallet approvals:

```text
TX 1 → Create Meteora DBC config
TX 2 → Create token mint + DBC pool
```

The application:

- verifies the Solana Devnet genesis hash
- obtains a fresh blockhash before signing
- partially signs generated accounts
- lets Phantom sign as the wallet payer
- broadcasts through the verified Devnet connection
- confirms against the exact blockhash lifetime
- verifies the resulting config and pool accounts

Deployment is intentionally locked to **Solana Devnet** for the hackathon build.

---

## Multi-Market Architecture

StockForge is no longer limited to a single TSLA demo.

### Current status

| Asset | Compile | Simulate | Deploy | Live market | Real swap |
|---|:---:|:---:|:---:|:---:|:---:|
| TSLA-SF | ✅ | ✅ | ✅ | ✅ | ✅ |
| QQQ-SF | ✅ | ✅ | ✅ | ✅ | ✅ |
| VOO-SF | ✅ | ✅ | ✅ | On demand | — |

Each deployed asset has its own:

- token mint
- Meteora config
- DBC pool
- reserves
- curve boundaries
- graduation progress
- wallet balance
- quote path
- trading state

The market registry merges built-in confirmed deployments with browser-local deployments created by the current user.

---

## Confirmed Devnet Markets

### TSLA-SF

| Account | Address |
|---|---|
| Config | `AXbs14xKgSP7fjZi2xmzKqhoJBJTFcCHaKFCH1i3eBJN` |
| Base mint | `DGU7bwLvz2gMfR1XQTkmF5QzeLJerzbvdze4Vb2kkpa9` |
| DBC pool | `9HTtUh7LbwwteNrx3ApESmhbQdoxiswgjCCD9Te4nBei` |
| Quote mint | `4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU` |

### QQQ-SF

| Account | Address |
|---|---|
| Config | `EdmbxXvbp2atSf4ocAZeAnGMY6hNQuZ51UtCwWekxvmm` |
| Base mint | `HthfY4R3PeCn8Hz8s2R59KPeU9RVkvx3kp3JfoZwFH7S` |
| DBC pool | `4nWM5zVcqsKCUjtVd6dW7wmNKnTomng1vnUF7Y9DGaHZ` |
| Quote mint | `4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU` |

The quote mint is Circle's Devnet USDC mint used by the demo markets.

---

## Live Market Intelligence

The `/market/pool` interface combines Pyth and Meteora state.

For the selected deployed market, StockForge shows:

- external Pyth reference
- current DBC curve price
- premium / discount vs reference
- relationship to reference
- current curve zone
- Discovery / Fair Value / Expansion boundaries
- DBC reserves
- graduation progress
- wallet USDC balance
- wallet StockForge-token balance
- real Meteora quote
- minimum received
- trading fee
- all-in execution price
- exact quoted post-trade DBC price
- quoted price impact
- quoted post-trade curve zone
- estimated post-trade wallet balances

### Exact DBC Price

Meteora stores sqrt price using Q64.64 fixed-point representation.

For the current 6-decimal demo token pairs:

```text
price = (sqrtPrice / 2^64)^2
```

StockForge uses the live on-chain sqrt price for the current DBC price.

For post-trade intelligence, it uses Meteora's quoted `nextSqrtPrice`, so the displayed post-trade DBC price is not an approximation derived from average execution price.

---

## Real Phantom Trading

StockForge executes real Devnet swaps through Meteora.

Current buy flow:

```text
Devnet USDC
      ↓
Meteora DBC
      ↓
TSLA-SF / QQQ-SF
```

The application:

1. loads the selected pool
2. loads its config
3. resolves the current activation point
4. asks Meteora for an exact-in quote
5. computes slippage-protected minimum output
6. builds the real swap transaction
7. asks Phantom to sign
8. broadcasts and confirms it
9. refreshes reserves and wallet balances

Real browser swaps have been completed for both **TSLA-SF** and **QQQ-SF**.

---

## PreStocks Integration

StockForge also includes a private-market discovery layer using real **PreStocks Token-2022 assets on Solana mainnet**.

Current integrations:

- OpenAI PreStocks
- Anthropic PreStocks
- Anduril PreStocks

The `/api/prestocks` route performs read-only mainnet inspection and returns:

- real mint address
- Token-2022 program validation
- decimals
- current supply
- mint authority
- freeze authority
- embedded token metadata
- active Token-2022 extensions

Observed extensions include examples such as:

- Transfer Hook
- Transfer Fee Config
- Permanent Delegate
- Default Account State
- Confidential Transfer Mint
- Scaled UI Amount
- Metadata Pointer
- Pausable Config
- Token Metadata

This integration is deliberately **read-only on mainnet**.

StockForge does **not** mint replacement private-company tokens and does not treat its Devnet demo assets as equivalent to PreStocks positions.

---

## Network Boundary

StockForge intentionally separates production-like reads from hackathon transactions.

```text
PreStocks intelligence
        ↓
Solana MAINNET
READ ONLY


Pyth + StockForge compiler
        ↓
Meteora DBC deployment/trading
        ↓
Solana DEVNET
```

This prevents the private-market integration from weakening the Devnet safety boundary of the deployment demo.

---

## Tech Stack

### Frontend

- Next.js 16
- React 19
- TypeScript
- Tailwind CSS
- Lucide React
- Recharts
- Decimal.js

### Solana

- `@solana/web3.js`
- `@solana/spl-token`
- Solana Wallet Adapter
- Phantom / Wallet Standard
- Solflare support

### Market + Protocol Integrations

- Pyth Lazer / Pyth Pro market data
- Meteora Dynamic Bonding Curve SDK
- PreStocks Token-2022 assets
- Solana Devnet + Mainnet read-only RPC

### Deployment

- Vercel
- GitHub
- pnpm

---

## Repository Structure

```text
stockforge/
├── app/
│   ├── api/
│   │   ├── meteora/
│   │   ├── prestocks/
│   │   └── pyth/
│   ├── create/
│   ├── explore/
│   ├── market/
│   ├── simulate/
│   ├── layout.tsx
│   └── page.tsx
│
├── components/
│   ├── deployment/
│   ├── market/
│   ├── simulation/
│   ├── navbar.tsx
│   └── wallet-button.tsx
│
├── hooks/
│   ├── use-market-history.ts
│   ├── use-meteora-simulation.ts
│   └── use-pyth-price.ts
│
├── lib/
│   ├── curve-engine/
│   ├── market/
│   ├── meteora/
│   ├── prestocks/
│   ├── pyth/
│   ├── solana/
│   └── stockforge/
│
├── public/
│   └── metadata/
│       ├── tsla-sf.json
│       ├── qqq-sf.json
│       └── voo-sf.json
│
└── package.json
```

---

## Local Setup

### Requirements

- Node.js
- pnpm
- Phantom or another compatible Solana wallet

Clone:

```bash
git clone https://github.com/Sathwiksaibogi/stockforge.git
cd stockforge
pnpm install
```

Create `.env.local`:

```env
# Required for Pyth server routes.
PYTH_PRO_API_KEY=your_pyth_pro_api_key

# Public base URL used when creating StockForge token metadata URIs.
NEXT_PUBLIC_STOCKFORGE_METADATA_BASE_URL=http://localhost:3000

# Optional backward-compatible variable used by the original TSLA deployment.
# NEXT_PUBLIC_STOCKFORGE_METADATA_URI=https://your-domain/metadata/tsla-sf.json

# Recommended for reliable PreStocks mainnet reads.
# If omitted, the project falls back to Solana's public mainnet RPC.
PRESTOCKS_MAINNET_RPC_URL=https://your-solana-mainnet-rpc
```

Run:

```bash
pnpm dev
```

Open:

```text
http://localhost:3000
```

---

## Production Environment Variables

For the deployed Vercel application:

```env
PYTH_PRO_API_KEY=********

NEXT_PUBLIC_STOCKFORGE_METADATA_BASE_URL=https://stockforge-liard.vercel.app

# Kept for backward compatibility with the original TSLA metadata setup.
NEXT_PUBLIC_STOCKFORGE_METADATA_URI=https://stockforge-liard.vercel.app/metadata/tsla-sf.json

PRESTOCKS_MAINNET_RPC_URL=https://your-private-mainnet-rpc
```

`PYTH_PRO_API_KEY` and `PRESTOCKS_MAINNET_RPC_URL` are server-side configuration and should **not** use the `NEXT_PUBLIC_` prefix.

---

## Validation

The current build has been validated with:

```bash
pnpm exec tsc --noEmit
pnpm lint
pnpm build
```

The production Next.js build passes successfully.

A recurring message may appear from a bigint package:

```text
bigint: Failed to load bindings, pure JS will be used
```

The application falls back to the pure JavaScript implementation and the production build, deployment flow, quotes, and swaps remain functional.

---

## Demo Walkthrough

A concise judge demo can follow this path.

### 1. Explore

Open `/explore`.

Show:

- TSLA, QQQ, and VOO live Pyth references
- OpenAI, Anthropic, and Anduril PreStocks assets
- real mainnet Token-2022 extension data

### 2. Create

Open `/create`.

Select TSLA or QQQ and show:

- live reference price
- 30D annualized volatility
- volatility regime
- risk profile
- target raise
- graduation target
- generated Discovery / Fair Value / Expansion curve

### 3. Simulate

Continue to `/simulate`.

Show:

- frozen reference snapshot
- Meteora calibration
- expected graduation behavior
- scenario quotes

### 4. Market

Open `/market/pool`.

Switch between:

```text
TSLA-SF
QQQ-SF
VOO-SF
```

Show that TSLA and QQQ point to independent live pools.

### 5. Quote

Request a small Meteora quote.

Show:

- expected output
- minimum received
- fee
- current DBC price
- exact quoted post-trade DBC price
- price impact
- post-trade zone
- all-in execution price

### 6. Trade

If desired, execute a small Devnet swap through Phantom and show:

- confirmed transaction
- updated reserves
- updated wallet balances
- trading-active state

---

## Sponsor Integrations

### Pyth

Pyth is central to StockForge rather than a decorative data source.

It drives:

- live reference prices
- historical market observations
- realized volatility
- volatility regime
- compiler inputs
- live DBC/reference comparison

### Meteora

Meteora is the execution and liquidity layer.

StockForge uses the DBC SDK for:

- custom curve configuration
- graduation calibration
- simulation
- real Devnet config creation
- real token/pool creation
- real quotes
- real swaps
- live state inspection
- exact `nextSqrtPrice` post-trade intelligence

### PreStocks

PreStocks expands StockForge from public-market references into private-market discovery.

StockForge reads real PreStocks Token-2022 mints from Solana mainnet and exposes:

- mint metadata
- supply
- authorities
- extensions
- explorer links
- PreStocks product links

No fake PreStocks API is used and no replacement private-company tokens are created.

---

## What Makes StockForge Solana-Native?

StockForge is not a traditional stock dashboard with a wallet button added afterward.

Its core workflow depends on Solana:

- wallet-authorized deployment
- on-chain token mints
- Meteora DBC configs and pools
- Token-2022 private-market asset inspection
- real Devnet swap execution
- on-chain reserve state
- on-chain curve state
- exact Solana transaction confirmation
- multi-market registry built around deployed Solana accounts

The external market data determines the launch design; Solana executes and maintains the market.

---

## Current Limitations

- StockForge demo assets are **not tokenized legal equities**.
- TSLA-SF, QQQ-SF, and VOO-SF do not represent shares, ownership, voting rights, dividends, distributions, or legal claims on the referenced companies/funds.
- Deployment and trading are currently Devnet-only.
- No mainnet security audit has been performed.
- VOO is compiler/simulation-ready but does not need a deployed demo pool to prove the generic architecture.
- PreStocks integration is read-only and depends on Solana mainnet RPC availability.
- The project is a hackathon prototype and not investment infrastructure or financial advice.

---

## Disclaimer

StockForge is an educational and hackathon demonstration.

References to TSLA, QQQ, VOO, OpenAI, Anthropic, Anduril, PreStocks, Pyth, Meteora, and other products or organizations are used to demonstrate technical integrations.

StockForge demo tokens do not represent securities, equity ownership, fund ownership, dividends, distributions, voting rights, or legal claims on the referenced entities.

Nothing in this repository is investment, legal, tax, or financial advice.

---

## Author

**Sathwik Sai**

GitHub: https://github.com/Sathwiksaibogi

---

## Live Links

- **StockForge:** https://stockforge-liard.vercel.app/
- **Explore:** https://stockforge-liard.vercel.app/explore
- **Create:** https://stockforge-liard.vercel.app/create
- **Market:** https://stockforge-liard.vercel.app/market/pool
- **GitHub:** https://github.com/Sathwiksaibogi/stockforge

---

Built for the Solana ecosystem with Pyth market intelligence, Meteora DBC infrastructure, and PreStocks private-market Token-2022 discovery.
