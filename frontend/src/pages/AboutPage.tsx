import { Shield, EyeOff, Lock, Network, Database } from 'lucide-react';

export default function AboutPage() {
  return (
    <div className="page">
      <div className="mb-32">
        <div className="card-title mb-12 text-[18px] text-text-0">Privacy Architecture</div>
        <p className="text-secondary text-[13px] leading-relaxed max-w-[700px]">
          Midnight zero-knowledge model separating private proof inputs from public consensus commitments. SilentSolvent is a prototype and does not by itself establish production-grade solvency.
        </p>
      </div>

      <div className="grid-2 mb-32">
        <div className="card border-red border-opacity-30">
          <div className="card-header border-b border-[var(--border)] pb-12">
            <div className="card-title flex items-center gap-8 text-red"><Network size={14}/> Public Ledger (On-Chain)</div>
          </div>
          <div className="mt-16 text-muted text-[13px] leading-relaxed">
            <ul className="pl-16 list-disc space-y-2 mt-8">
              <li>Threshold requirement ($)</li>
              <li>Session deadline (timestamp)</li>
              <li>Attestation counter</li>
              <li>Session nullifier hashes</li>
            </ul>
          </div>
        </div>

        <div className="card border-green border-opacity-30">
          <div className="card-header border-b border-[var(--border)] pb-12">
            <div className="card-title flex items-center gap-8 text-green"><Lock size={14}/> Local Witness (Private)</div>
          </div>
          <div className="mt-16 text-muted text-[13px] leading-relaxed">
            <ul className="pl-16 list-disc space-y-2 mt-8 text-text-0">
              <li>Signed custodian balance snapshot</li>
              <li>Firm identity seed</li>
              <li>Attestation signature and nonce</li>
              <li>Portfolio/account details held by the custodian</li>
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
            <div className="font-semibold text-[14px] flex items-center gap-8 mb-8 text-text-0"><EyeOff size={14} /> Zero Data Leakage</div>
            <p className="text-secondary text-[13px] leading-relaxed">
              A fresh asset/session/firm-bound custodian attestation is supplied as a private witness. The Compact circuit verifies its Jubjub Schnorr signature and freshness before evaluating the threshold.
            </p>
          </div>
          <div>
            <div className="font-semibold text-[14px] flex items-center gap-8 mb-8 text-text-0"><Shield size={14} /> Sybil Resistance</div>
            <p className="text-secondary text-[13px] leading-relaxed">
              Emits a session-scoped nullifier `make_nullifier(firm_secret, session_id)` preventing duplicate attestations from the same in-memory firm credential.
            </p>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-header border-b border-[var(--border)] pb-16">
          <div className="card-title flex items-center gap-8"><Database size={14}/> Consensus Model</div>
        </div>
        <div className="text-secondary text-[13px] leading-relaxed mt-16 max-w-[700px]">
          <p>
            Unlike public blockchains where state transitions expose balances and addresses, Midnight verifies mathematical proofs of validity generated client-side in WebAssembly.
          </p>
        </div>
      </div>
    </div>
  );
}
