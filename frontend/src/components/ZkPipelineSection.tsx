import React, { useState } from 'react';
import { EyeOff, ShieldCheck, Cpu, ArrowRight, Layers, FileCode, Check } from 'lucide-react';

interface StageDetail {
  id: string;
  step: string;
  title: string;
  location: 'BROWSER MEMORY' | 'OFF-CHAIN PROVER' | 'MIDNIGHT CONSENSUS';
  privacy: 'CONFIDENTIAL' | 'PROVING ENCLAVE' | 'PUBLIC LEDGER';
  summary: string;
  codeSnippet: string;
  variables: { name: string; type: string; status: 'HIDDEN' | 'DISCLOSED' }[];
}

const STAGES: StageDetail[] = [
  {
    id: 'stage-1',
    step: 'PHASE 01',
    title: 'Private Witness Generation',
    location: 'BROWSER MEMORY',
    privacy: 'CONFIDENTIAL',
    summary: 'The fund enters their secret firm seed and liquid balance. These variables reside strictly in RAM and are never dispatched over HTTP, WebSocket, or RPC.',
    codeSnippet: `witness get_liquid_balance(): Uint<32>;\nwitness get_firm_secret(): Bytes<32>;`,
    variables: [
      { name: 'firm_secret', type: 'Bytes<32>', status: 'HIDDEN' },
      { name: 'liquid_balance', type: 'Uint<32>', status: 'HIDDEN' },
      { name: 'custody_address', type: 'Address', status: 'HIDDEN' },
    ],
  },
  {
    id: 'stage-2',
    step: 'PHASE 02',
    title: 'Compact Circuit Evaluation',
    location: 'BROWSER MEMORY',
    privacy: 'CONFIDENTIAL',
    summary: 'The compiled Compact circuit evaluates the mathematical condition balance >= threshold locally. If insolvent, execution reverts instantly without network interaction.',
    codeSnippet: `assert(liquid_balance >= min_solvency_threshold, \n  "Insufficient liquidity for OTC session");`,
    variables: [
      { name: 'min_solvency_threshold', type: 'Uint<32>', status: 'DISCLOSED' },
      { name: 'session_id', type: 'Bytes<32>', status: 'DISCLOSED' },
      { name: 'solvency_assertion', type: 'Boolean', status: 'HIDDEN' },
    ],
  },
  {
    id: 'stage-3',
    step: 'PHASE 03',
    title: 'Zero-Knowledge Proof Generation',
    location: 'OFF-CHAIN PROVER',
    privacy: 'PROVING ENCLAVE',
    summary: 'Midnight proving runtime computes polynomial commitments over the BN254 elliptic curve, producing a succinct cryptographic proof without disclosing witness values.',
    codeSnippet: `val nullifier = persistentHash([\n  pad(32, "ssolv:nullifier:v1"),\n  firm_secret,\n  session_id\n]);`,
    variables: [
      { name: 'zk_proof_pi', type: 'Proof<BN254>', status: 'DISCLOSED' },
      { name: 'session_nullifier', type: 'Bytes<32>', status: 'DISCLOSED' },
      { name: 'execution_witness', type: 'WitnessMap', status: 'HIDDEN' },
    ],
  },
  {
    id: 'stage-4',
    step: 'PHASE 04',
    title: 'Midnight Ledger Attestation',
    location: 'MIDNIGHT CONSENSUS',
    privacy: 'PUBLIC LEDGER',
    summary: 'Midnight nodes verify the zk-SNARK in milliseconds. The session counter increments, and the nullifier is stored to prevent double-attestation.',
    codeSnippet: `total_attestations = total_attestations + 1;\nnullifiers.insert(nullifier);`,
    variables: [
      { name: 'total_attestations', type: 'Uint<32>', status: 'DISCLOSED' },
      { name: 'contract_state', type: 'LedgerState', status: 'DISCLOSED' },
      { name: 'verification_badge', type: 'VerifiedStatus', status: 'DISCLOSED' },
    ],
  },
];

export default function ZkPipelineSection() {
  const [activeStage, setActiveStage] = useState<StageDetail>(STAGES[0]);

  return (
    <section className="pipeline-section">
      <div className="section-header">
        <div className="section-tag">CRYPTOGRAPHIC EXECUTION PIPELINE</div>
        <h2 className="section-title">How Client-Side Verification Works</h2>
        <p className="section-sub">
          Midnight separates witness generation from ledger state commitments. Inspect each step of the cryptographic pipeline below.
        </p>
      </div>

      <div className="pipeline-stepper">
        {STAGES.map((s, idx) => {
          const isActive = s.id === activeStage.id;
          return (
            <button
              key={s.id}
              className={`pipeline-step-btn ${isActive ? 'active' : ''}`}
              onClick={() => setActiveStage(s)}
            >
              <div className="flex items-center justify-between mb-4">
                <span className="mono text-[11px] text-text-2">{s.step}</span>
                <span className={`status-pill ${s.privacy === 'CONFIDENTIAL' ? 'pill-green' : s.privacy === 'PROVING ENCLAVE' ? 'pill-amber' : 'pill-blue'}`}>
                  {s.privacy}
                </span>
              </div>
              <div className="pipeline-step-title">{s.title}</div>
            </button>
          );
        })}
      </div>

      <div className="pipeline-inspector">
        <div className="inspector-left">
          <div className="inspector-meta">
            <span className="mono text-[11px] text-accent uppercase">{activeStage.step} // {activeStage.location}</span>
            <span className="mono text-[11px] text-muted">STATE: DETERMINISTIC</span>
          </div>

          <h3 className="inspector-title">{activeStage.title}</h3>
          <p className="inspector-desc">{activeStage.summary}</p>

          <div className="inspector-variables">
            <div className="mono text-[11px] font-semibold text-text-1 uppercase mb-8">Variable Disclosures:</div>
            <div className="flex flex-col gap-6">
              {activeStage.variables.map((v, i) => (
                <div key={i} className="variable-row">
                  <span className="mono text-[12px] text-text-0">{v.name}</span>
                  <span className="mono text-[11px] text-text-2">{v.type}</span>
                  <span className={`mono text-[11px] font-semibold ${v.status === 'HIDDEN' ? 'text-green' : 'text-accent'}`}>
                    [{v.status === 'HIDDEN' ? '🔒 PRIVATE' : '🔓 ON-CHAIN'}]
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="inspector-right">
          <div className="code-header">
            <div className="flex items-center gap-6">
              <span className="code-dot red" />
              <span className="code-dot amber" />
              <span className="code-dot green" />
              <span className="mono text-[11px] text-text-2 ml-4">silentsolvent.compact</span>
            </div>
            <span className="mono text-[11px] text-text-2">ZKIR CIRCUIT</span>
          </div>
          <pre className="code-block">
            <code>{activeStage.codeSnippet}</code>
          </pre>
          <div className="code-footer">
            <span className="mono text-[11px] text-green flex items-center gap-4">
              <Check size={12} /> Prover guarantees non-repudiation
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}
