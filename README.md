# SilentSolvent

> **Zero-Knowledge Pre-Trade Liquidity Attestation for Institutional OTC Desks**

SilentSolvent allows an institutional trading fund to prove they have sufficient capital to execute a block trade without ever revealing their wallet addresses, total capital, or token composition to the OTC desk (or the public).

**The Problem**: In institutional crypto, off-exchange block trades ($1M - $50M+) require proof of funds. Today, funds must either share their custody wallet addresses (exposing themselves to front-running algorithms by Arkham/Nansen) or share auditor statements (slow and forged).
**The Solution**: The broker deploys a session with a minimum threshold on the Midnight Network. The fund connects their wallet and generates a Zero-Knowledge proof locally in their browser. The blockchain verifies the math and records the attestation. Zero data leakage.

## Demo & Screenshots

**[📺 Watch the Demo Video on Google Drive](https://drive.google.com/file/d/15s4wkaOlXco3ur7x6DqAvf2jk8FsmTNR/view?usp=sharing)**

<div align="center">
  <img src="assets/ui1.png" width="800" alt="SilentSolvent Dashboard" />
  <br/><br/>
  <img src="assets/ui2.png" width="800" alt="Verify Solvency Page" />
  <br/><br/>
  <img src="assets/ui3.png" width="800" alt="Admin Controls" />
</div>

## Privacy Model

| Observer CAN See (On-Chain) | Observer CANNOT See (Your Browser) |
| :--- | :--- |
| That an attestation occurred | The firm's actual balance |
| Total attestation count | Wallet addresses or custodian identity |
| Session threshold & deadline | Which firm attested |
| The nullifier hash | Whether the firm has $5.1M or $500M |

## Quick Start (Local Development)

### 1. Prerequisites
- Node.js 22+
- Docker & Docker Compose
- Yarn

### 2. Install and Compile
```bash
yarn install
yarn compile
```

### 3. Run the Devnet & Tests
```bash
yarn env:up
yarn ts-node --esm scripts/wait-for-dust.ts
yarn test:local
```

### 4. Run the Web App
```bash
yarn copy:managed
cd frontend
yarn install
yarn dev
```

Visit `http://localhost:5173`. 
Note: To interact with the app, you need the [1AM Wallet extension](https://github.com/midnight-ntwrk/1am) installed in your browser.

## Contract Architecture

The `silentsolvent.compact` contract uses several advanced ZK patterns:
1. **Witness-bound identity**: The firm's identity and balance are NEVER passed as circuit arguments. They are fetched via `witness get_liquid_balance()`.
2. **Session-scoped nullifiers**: To prevent a single firm from inflating the attestation count, `verify_solvency` generates a nullifier hashed with the current `session_id`. Double-attestation in the same session fails consensus.
3. **Admin Auth**: Config circuits (`update_session`, `pause_session`) are guarded by an admin public key derived via a domain-separated hash: `persistentHash([pad(32, "ssolv:admin:v1"), secret_key])`.
4. **Time-based expiration**: Attestations fail after the `session_deadline` using `blockTimeLt()`.

## Deploying to Preprod

1. Copy `.env.preprod.example` to `.env` and add your 1AM wallet seed phrase.
2. Build the UI: `cd frontend && yarn build`
3. Deploy the `frontend/dist` directory to Vercel or Netlify (headers are pre-configured).

---
*Built for the Midnight Network "New Moon to Full" Builder Journey.*
