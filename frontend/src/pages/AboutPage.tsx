import { Shield, EyeOff, Lock, Network, Database } from 'lucide-react';

export default function AboutPage() {
  return (
    <div className="page">
      <div className="mb-32">
        <div className="card-title mb-16 text-[18px] text-accent">SilentSolvent Privacy Model</div>
        <p className="text-secondary leading-relaxed max-w-[800px]">
          SilentSolvent is built on the Midnight Network to solve the "pre-trade doxxing" problem in institutional crypto OTC trading. Below is the exact technical breakdown of what data is visible to whom.
        </p>
      </div>

      <div className="grid-2 mb-32">
        <div className="card border-red border-opacity-30">
          <div className="card-header border-b border-[var(--border)] pb-12">
            <div className="card-title flex items-center gap-8 text-red"><Network size={14}/> Public Ledger (On-Chain)</div>
          </div>
          <div className="mt-16 text-muted text-[13px] leading-relaxed">
            <p className="mb-8">This data is replicated across all Midnight nodes and is visible to the public, block explorers, and analytics firms.</p>
            <ul className="pl-16 list-disc space-y-2 mt-8">
              <li>The <strong>threshold requirement</strong> (e.g., $5,000,000)</li>
              <li>The <strong>session deadline</strong> (Unix timestamp)</li>
              <li>The <strong>total number</strong> of successful attestations</li>
              <li>The <strong>nullifier hashes</strong> of participants</li>
              <li>The fact that <strong>an attestation occurred</strong></li>
            </ul>
          </div>
        </div>

        <div className="card border-green border-opacity-30">
          <div className="card-header border-b border-[var(--border)] pb-12">
            <div className="card-title flex items-center gap-8 text-green"><Lock size={14}/> Local Witness (Private)</div>
          </div>
          <div className="mt-16 text-muted text-[13px] leading-relaxed">
            <p className="mb-8">This data never leaves the user's browser. It is processed locally inside a WebAssembly zero-knowledge prover.</p>
            <ul className="pl-16 list-disc space-y-2 mt-8 text-text-0">
              <li>The firm's <strong>actual liquid balance</strong></li>
              <li>The firm's <strong>secret identity key</strong></li>
              <li>The firm's <strong>wallet addresses</strong> or custodian data</li>
              <li>Asset <strong>composition</strong> (which tokens make up the balance)</li>
            </ul>
          </div>
        </div>
      </div>

      <div className="card mb-32">
        <div className="card-header">
          <div className="card-title">Cryptographic Guarantees</div>
        </div>
        <div className="grid-2 mt-16 gap-24">
          <div>
            <div className="font-semibold text-[14px] flex items-center gap-8 mb-8"><EyeOff size={14} className="text-accent"/> Zero Data Leakage</div>
            <p className="text-secondary text-[13px] leading-relaxed">
              In the Compact smart contract, the balance is accessed via `witness get_liquid_balance()`. It is never passed as a circuit argument (which would make it part of the public proof transcript). The assertion `balance &gt;= min_solvency_threshold` occurs entirely inside the ZK circuit.
            </p>
          </div>
          <div>
            <div className="font-semibold text-[14px] flex items-center gap-8 mb-8"><Shield size={14} className="text-accent"/> Sybil Resistance via Nullifiers</div>
            <p className="text-secondary text-[13px] leading-relaxed">
              To prevent a firm from attesting 100 times to simulate high liquidity demand, the circuit emits a session-scoped nullifier: `make_nullifier(firm_secret, session_id)`. If the same firm attests twice in the same session, the nullifier collides and the transaction is rejected by consensus.
            </p>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-header border-b border-[var(--border)] pb-16">
          <div className="card-title flex items-center gap-8"><Database size={14}/> Why Midnight over Ethereum or Solana?</div>
        </div>
        <div className="text-secondary text-[13px] leading-relaxed mt-16 max-w-[800px]">
          <p className="mb-12">On Ethereum or Solana, all state transitions are public. If a smart contract verifies your balance, your wallet address and the exact balance checked are permanently recorded on the public ledger for MEV bots and competitors to monitor.</p>
          <p>On Midnight, the execution of the state transition happens <strong>off-chain</strong> on the user's device. The network only verifies the mathematical proof that the execution was valid according to the contract's rules. This enables true confidentiality for institutional DeFi without relying on trusted centralized servers.</p>
        </div>
      </div>
    </div>
  );
}
