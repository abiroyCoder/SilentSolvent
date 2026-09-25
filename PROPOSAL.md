# SilentSolvent: Product Proposal & Architecture Specification

> **Hackathon Submission Level 3 Deliverable**  
> **Project**: SilentSolvent — Zero-Knowledge OTC Pre-Trade Liquidity Attestation  
> **Target Network**: Midnight Network (Preprod Deployed & Mainnet Roadmap)  
> **Live Web dApp**: [https://silentsolvent.netlify.app](https://silentsolvent.netlify.app/)  
> **Contract Address (Preprod)**: [`79f20921e5ca2377260b4912892cb690f20afa14ccc86667e697724d6eb13268`](https://explorer.1am.xyz/contract/79f20921e5ca2377260b4912892cb690f20afa14ccc86667e697724d6eb13268?network=preprod)  

---

## 1. Product Statement, Problem, and Target Users

### 1.1 The Problem
In institutional digital asset markets, large over-the-counter (OTC) block trades ($1M to $50M+) require pre-trade proof of funds (PoF) before bilateral price negotiation can commence. Today, market participants face a destructive tradeoff:

1. **Custody Wallet Exposure**: Trading funds are forced to disclose public addresses of their cold storage, MPC custody (e.g., Fireblocks, Copper), or exchange vaults. Once shared, counterparties, analytics firms (Arkham, Nansen), and front-running algorithms permanently track their total treasury, position entries, and trading patterns.
2. **Auditor Letters / Bank Proof of Funds**: Funds rely on static CPA or auditor attestation letters. These take 24–72 hours to obtain, become stale immediately as market prices fluctuate, and are vulnerable to forgery.
3. **Data Leakage & Counterparty Risk**: Knowing that a hedge fund has $100M in liquid capital allows an OTC desk or market maker to front-run their order, adjust spreads against them, or leak flow information to competitors.

### 1.2 The Solution: SilentSolvent
**SilentSolvent** is a zero-knowledge pre-trade liquidity attestation protocol built on Midnight Network.

An OTC broker or trading desk creates a trade session on Midnight specifying a capital requirement (e.g., "Must hold $\ge$ $5,000,000 USD equivalent"). A participating fund connects their wallet and generates a Zero-Knowledge proof locally in their browser. The Compact circuit evaluates the solvency predicate in private:

$$\text{liquid\_balance} \ge \text{min\_solvency\_threshold}$$

If valid, an attestation receipt and a session-scoped nullifier are committed to the Midnight public ledger. **Zero information about the firm's total capital, custody addresses, or identity is ever disclosed to the broker or the public.**

### 1.3 Target Users
* **Institutional Crypto Hedge Funds**: Require proof of liquidity to enter OTC block negotiations without exposing their overall treasury or wallet graph.
* **OTC Desks & Prime Brokers**: Need instant, cryptographically verifiable proof of buyer solvency without bearing custody liability or storing sensitive client financial data.
* **Market Makers & Liquidity Providers**: Need to verify bilateral settlement capacity across institutional trading sessions with zero counterparty information leakage.

---

## 2. Public Ledger State vs. Private Witness Data Model

SilentSolvent enforces a strict architectural boundary between on-chain public ledger state and off-chain private client witness data, utilizing Midnight's Kachina model:

```
+-------------------------------------------------------------------------------+
|                             CLIENT PROVING SYSTEM                             |
|                                                                               |
|  [ Private Witnesses ]                                                        |
|  * get_liquid_balance: Uint<64> (e.g., $15,000,000)                           |
|  * get_firm_secret: Bytes<32>   (Firm's private identity seed)                |
|  * admin_secret: Bytes<32>      (Admin authorization key)                     |
|                                                                               |
|        │                                                                      |
|        ▼ (Evaluated inside Compact ZK Circuit)                                |
|  [ Circuit Predicates ]                                                       |
|  1. assert(is_active)                                                         |
|  2. assert(blockTimeLt(session_deadline))                                     |
|  3. assert(liquid_balance >= min_solvency_threshold)   <-- BALANCE HIDDEN     |
|  4. nullifier = persistentHash([firm_secret, session_id])                     |
|  5. assert(!nullifiers.member(nullifier))              <-- ANTI-SYBIL GATE    |
|                                                                               |
+───────────────────────────────────────┬───────────────────────────────────────+
                                        │ Generates ZK Proof (zkir + keys)
                                        ▼
+────────────────────────────────────────────────────────────────---------------+
|                             MIDNIGHT PUBLIC LEDGER                            |
|                                                                               |
|  [ Public On-Chain Ledger State ]                                             |
|  * min_solvency_threshold: Uint<64>   -> $5,000,000                           |
|  * trade_session_id: Bytes<32>        -> 0x1febba...                          |
|  * session_deadline: Uint<64>         -> Timestamp in seconds                 |
|  * broker_id: Bytes<32>               -> Broker identifier hash               |
|  * admin: Bytes<32>                   -> Admin public key commitment          |
|  * is_active: Boolean                 -> Session status flag                  |
|  * total_attestations: Uint<32>       -> Counter of verified participants     |
|  * max_attestations: Uint<32>         -> Session participant cap              |
|  * nullifiers: Set<Bytes<32>>         -> Prevents double-attestations         |
|  * attestation_log: Map<Bytes<32>, Bytes<32>> -> On-chain attestation log     |
|  * contract_version: Bytes<32>        -> "SilentSolvent:v1.0"                 |
+-------------------------------------------------------------------------------+
```

### Detailed Privacy Matrix

| Data Element | Layer | Storage Location | Cryptographic Guarantee |
| :--- | :--- | :--- | :--- |
| **Actual Liquid Balance** | Private Witness | Client Memory Only | **Never leaves client**. Evaluated purely inside the local zero-knowledge circuit. |
| **Firm Identity / Addresses** | Private Witness | Client Memory Only | **Unlinkable**. No wallet addresses or public keys are passed as arguments or recorded on-chain. |
| **Firm Secret** | Private Witness | Client Memory Only | Used solely to derive a session-scoped nullifier; cannot be inverted from the nullifier hash. |
| **Threshold Predicate** | Compact Circuit | Execution Constraint | Mathematical proof that `balance >= threshold` without revealing surplus margin. |
| **Session Nullifier** | Public Ledger | Midnight State Triew | Scoped to `(firm_secret, session_id)`. Prevents double-attestations while preventing cross-session tracking. |
| **Session Config & Status** | Public Ledger | Midnight State Trie | Publicly transparent so all parties agree on deadline, broker identity, and minimum threshold. |

---

## 3. Why Midnight Specifically?

### 3.1 Why Transparent Blockchains Fail at this Use Case
* **Ethereum / Solana / EVM L2s**: All storage state and transaction calldata are permanently public. Even if an Ethereum smart contract verifies a zero-knowledge proof, the contract must either know the user's address (linking proof to wallet) or rely on complex relayer infrastructures that leak metadata through IP addresses, gas sponsorship, and timing analysis.
* **Transparent DeFi Lending**: Protocols like Aave or Compound require 100% public overcollateralization. Institutional OTC traders cannot operate under public collateral visibility because front-runners will trade against their liquidation points.
* **Generic ZK Rollups**: ZK-Rollups use ZK for scalability (validity proofs), not for confidentiality. The state inside the rollup remains completely transparent to sequencers and observers.

### 3.2 Midnight's Architectural Fit
1. **The Kachina Private State Model**: Midnight implements the Kachina protocol, which formalizes zero-knowledge smart contract execution with dual-state updates. It allows SilentSolvent to execute circuits where private witnesses remain on the user's machine while public ledger state transitions update atomically on consensus.
2. **Compact Smart Contract Language**: Compact provides first-class language constructs for privacy:
   - `witness`: Seamlessly injects client secrets without writing lower-level R1CS or PLONK constraints manually.
   - `disclose()`: Enforces explicit intent when publishing computed values to the public ledger.
   - `persistentHash()` & `persistentCommit()`: Built-in Poseidon/Rescue-grade cryptographic primitives designed specifically for zero-knowledge nullifiers.
3. **Browser-Based Client Proving**: Through `@midnight-ntwrk/midnight-js-*` and the 1AM wallet connector, ZK proving occurs client-side in WebAssembly/Web Workers. The private key and financial witnesses never touch any server, cloud proof provider, or RPC endpoint.
4. **Selective Disclosure & Future Regulatory Compliance**: Midnight enables cryptographic selective disclosure. An institutional fund can prove solvency to an OTC desk today, and later produce a verifiable viewing key to an auditor or regulator (FinCEN, MiCA) without compromising their secrecy against the market.

---

## 4. Scope Feasibility for Mainnet by Level 6

SilentSolvent follows a phased delivery architecture designed for complete Mainnet launch by Level 6 of the Midnight Hackathon lifecycle:

```
[ Level 1: Core Contract ]  -->  [ Level 2: Frontend & Proving ]  -->  [ Level 3: Production dApp ]
   * silentsolvent.compact          * 1AM Wallet Integration              * CI/CD Automated Test Suite
   * Compiled ZK artifacts          * Client-Side Proving                 * Contract Address on Preprod
   * Preprod Deployment (DONE)      * Netlify Live App (DONE)             * Formal PROPOSAL.md (DONE)
                                                                                  │
                                                                                  ▼
[ Level 6: Mainnet Production ] <--  [ Level 5: Audits & Oracles ]  <-- [ Level 4: OTC Infrastructure ]
   * Midnight Mainnet Deployment       * Formal Compact Audit              * Multi-session Desk Portal
   * Institutional Broker Portal       * Schnorr Proof-of-Reserve Feeds    * Counterparty Negotiation HUD
   * Regulated Compliance Keys         * Multi-Asset ZSwap Bridging        * Settlement Escrow Hooks
```

### Detailed Roadmap Through Level 6

#### Level 1: New Moon — Smart Contract Foundation *(Completed)*
- Written and compiled [`contracts/silentsolvent.compact`](contracts/silentsolvent.compact) featuring 4 circuits: `verify_solvency`, `update_session`, `pause_session`, `resume_session`.
- Compiled with `compactc` producing ZKIR, prover keys, verifier keys, and TypeScript bindings.
- Successfully deployed to **Midnight Preprod Testnet** at [`79f20921e5ca2377260b4912892cb690f20afa14ccc86667e697724d6eb13268`](https://explorer.1am.xyz/contract/79f20921e5ca2377260b4912892cb690f20afa14ccc86667e697724d6eb13268?network=preprod).

#### Level 2: Waxing Crescent — Frontend & Client-Side Proving *(Completed)*
- Built high-performance Vite + React dApp with an institutional pure black terminal aesthetic.
- Integrated the **1AM Browser Wallet** via `@midnight-ntwrk/dapp-connector-api`.
- Client-side zero-knowledge proof generation wired via browser WASM proving provider.
- Hosted production application live on Netlify at [https://silentsolvent.netlify.app](https://silentsolvent.netlify.app/).

#### Level 3: First Quarter — Production dApp & Pipeline Hardening *(Current)*
- Fully automated CI/CD pipeline ([`.github/workflows/ci.yaml`](.github/workflows/ci.yaml)) running compiler checks, frontend builds, and a comprehensive 6-circuit automated test suite (`npm test`) using `@midnight-ntwrk/compact-runtime`.
- Production documentation: complete privacy model specification, verified contract deployment proof, and this `PROPOSAL.md`.

#### Level 4: Waxing Gibbous — Advanced OTC Session Management *(Target: Next Milestone)*
- **Bilateral Session Negotiation**: Allow brokers and trading funds to negotiate custom threshold brackets and multi-tier solvency ranges.
- **Dynamic Expiration & Grace Periods**: Time-locked session lifecycle with automatic cleanup and nullifier pruning.
- **Broker Telemetry Console**: Granular broker interface to export signed cryptographic attestation certificates for compliance records.

#### Level 5: Full Moon — Proof-of-Reserve & Multi-Asset Expansion
- **Off-Chain Proof-of-Reserve Oracles**: Implement Schnorr-attested witness signatures allowing funds to prove solvency across custodial exchanges (Binance, Coinbase Prime) and MPC custody without on-chain deposits.
- **Multi-Asset Portfolio Valuation**: Extend Compact circuits to support weighted multi-asset solvency checks (NIGHT, shielded native tokens, and wrapped stablecoins via ZSwap).
- **Comprehensive Circuit Security Audit**: Engage zero-knowledge cryptographers to verify circuit constraint completeness and nullifier collision resistance.

#### Level 6: Mainnet Launch — Enterprise Production
- **Midnight Mainnet Contract Deployment**: Formal deployment of audited SilentSolvent contracts to the Midnight Mainnet.
- **Institutional Broker SDK (`@silentsolvent/sdk`)**: TypeScript/Node.js SDK allowing institutional OTC desks to embed SilentSolvent solvency gates directly into their proprietary order management systems (OMS) and FIX protocol pipelines.
- **Regulatory Selective Viewing Keys**: Implement dual-key encryption enabling funds to selectively share proof receipts with regulatory bodies (FinCEN, FCA, MiCA) for AML/KYC audit trails without publishing balances to the open market.

---

## 5. Summary & Verification References

| Parameter | Value / Resource Link |
| :--- | :--- |
| **Contract Name** | `SilentSolventContract` |
| **Contract Address (Preprod)** | [`79f20921e5ca2377260b4912892cb690f20afa14ccc86667e697724d6eb13268`](https://explorer.1am.xyz/contract/79f20921e5ca2377260b4912892cb690f20afa14ccc86667e697724d6eb13268?network=preprod) |
| **Network** | **Midnight Preprod Testnet** |
| **Deployment Transaction** | [`efe5cfb2c7ae11a4fb63917eba5c1e39134956229e79d4b39f70ff6d9d108800`](https://explorer.1am.xyz/tx/efe5cfb2c7ae11a4fb63917eba5c1e39134956229e79d4b39f70ff6d9d108800?network=preprod) |
| **Live Web Application** | [https://silentsolvent.netlify.app](https://silentsolvent.netlify.app/) |
| **Source Code Repository** | [https://github.com/abiroyCoder/SilentSolvent](https://github.com/abiroyCoder/SilentSolvent) |
| **CI/CD Pipeline** | [GitHub Actions Workflow](https://github.com/abiroyCoder/SilentSolvent/actions) |
| **Demonstration Video** | [Watch Walkthrough on Google Drive](https://drive.google.com/file/d/15s4wkaOlXco3ur7x6DqAvf2jk8FsmTNR/view?usp=sharing) |
| **Official Announcement** | [Launch Post on X](https://x.com/silentsolvent) |
