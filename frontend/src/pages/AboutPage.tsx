import { Shield, EyeOff, Lock, Network, Database } from 'lucide-react';

export default function AboutPage() {
  return (
    <div className="page">
      <div className="mb-32">
        <div className="card-title mb-12 text-[18px] text-text-0">Privacy Architecture</div>
        <p className="text-secondary text-[13px] leading-relaxed max-w-[700px]">
          Midnight zero-knowledge model separating client witness data from public consensus commitments.
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
              <li>Liquid account balance</li>
              <li>Firm identity seed</li>
              <li>Custodian wallet addresses</li>
              <li>Portfolio composition</li>
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
              Balance accessed strictly via `witness get_liquid_balance()`. Evaluation occurs entirely inside the client ZK circuit without on-chain argument disclosure.
            </p>
          </div>
          <div>
            <div className="font-semibold text-[14px] flex items-center gap-8 mb-8 text-text-0"><Shield size={14} /> Sybil Resistance</div>
            <p className="text-secondary text-[13px] leading-relaxed">
              Emits deterministic session nullifier `make_nullifier(firm_secret, session_id)` preventing duplicate attestations from the same firm.
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
