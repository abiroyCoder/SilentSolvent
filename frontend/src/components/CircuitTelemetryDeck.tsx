import React, { useState } from 'react';
import { Terminal, Play, RotateCcw, Shield, CheckCircle2 } from 'lucide-react';

interface CircuitLog {
  timestamp: string;
  type: 'INFO' | 'ZKIR' | 'PROOF' | 'SUCCESS';
  message: string;
}

export default function CircuitTelemetryDeck() {
  const [selectedCircuit, setSelectedCircuit] = useState<'verify_solvency' | 'update_session' | 'pause_session'>('verify_solvency');
  const [isSimulating, setIsSimulating] = useState(false);
  const [simulatedLogs, setSimulatedLogs] = useState<CircuitLog[]>([
    { timestamp: '00:00.012', type: 'INFO', message: 'Ready for client-side proving simulation.' },
    { timestamp: '00:00.045', type: 'ZKIR', message: 'WASM Runtime loaded: @midnight-ntwrk/compact-runtime v0.16.0' }
  ]);

  const runSimulation = () => {
    setIsSimulating(true);
    setSimulatedLogs([
      { timestamp: '00:00.010', type: 'INFO', message: `Initializing circuit invocation: ${selectedCircuit}()` },
    ]);

    setTimeout(() => {
      setSimulatedLogs(prev => [
        ...prev,
        { timestamp: '00:00.320', type: 'ZKIR', message: 'Evaluating private witness parameters inside WASM memory enclave...' },
      ]);
    }, 300);

    setTimeout(() => {
      setSimulatedLogs(prev => [
        ...prev,
        { timestamp: '00:00.850', type: 'ZKIR', message: 'Generating BN254 zero-knowledge polynomial constraint system...' },
      ]);
    }, 700);

    setTimeout(() => {
      setSimulatedLogs(prev => [
        ...prev,
        { timestamp: '00:01.420', type: 'PROOF', message: 'Derived session nullifier: 0x9f83...4e1b (domain: ssolv:nullifier:v1)' },
      ]);
    }, 1100);

    setTimeout(() => {
      setSimulatedLogs(prev => [
        ...prev,
        { timestamp: '00:02.100', type: 'SUCCESS', message: 'Proof verified! Ledger transition committed in 2.10s.' },
      ]);
      setIsSimulating(false);
    }, 1500);
  };

  return (
    <section className="telemetry-section">
      <div className="section-header">
        <div className="section-tag">INTERACTIVE CIRCUIT RUNTIME</div>
        <h2 className="section-title">Compact Smart Contract Telemetry</h2>
        <p className="section-sub">
          Test the on-chain circuit logic and observe deterministic proof synthesis directly from the terminal console.
        </p>
      </div>

      <div className="terminal-deck">
        <div className="deck-toolbar">
          <div className="flex items-center gap-8">
            <Terminal size={14} className="text-accent" />
            <span className="mono text-[12px] font-semibold text-text-0">SIMULATED CONSOLE</span>
          </div>

          <div className="circuit-selector">
            <button
              className={`circuit-tab ${selectedCircuit === 'verify_solvency' ? 'active' : ''}`}
              onClick={() => setSelectedCircuit('verify_solvency')}
            >
              verify_solvency()
            </button>
            <button
              className={`circuit-tab ${selectedCircuit === 'update_session' ? 'active' : ''}`}
              onClick={() => setSelectedCircuit('update_session')}
            >
              update_session()
            </button>
            <button
              className={`circuit-tab ${selectedCircuit === 'pause_session' ? 'active' : ''}`}
              onClick={() => setSelectedCircuit('pause_session')}
            >
              pause_session()
            </button>
          </div>

          <button
            className="btn btn-primary btn-sm"
            onClick={runSimulation}
            disabled={isSimulating}
          >
            {isSimulating ? (
              <><div className="spinner" /> Synthesizing...</>
            ) : (
              <><Play size={12} /> Execute Circuit</>
            )}
          </button>
        </div>

        <div className="deck-terminal-screen">
          <div className="terminal-stdout">
            <div className="terminal-line text-text-2">
              <span className="text-accent">Midnight CLI //</span> silentsolvent.compact target v0.31.0
            </div>
            <div className="terminal-line text-text-2">
              <span className="text-accent">&gt;&gt;</span> Loaded circuit bindings: [verify_solvency, update_session, pause_session, resume_session]
            </div>

            {simulatedLogs.map((log, idx) => (
              <div key={idx} className="terminal-line">
                <span className="mono text-text-2 mr-8">[{log.timestamp}]</span>
                <span className={`mono font-semibold mr-8 ${
                  log.type === 'INFO' ? 'text-text-1' :
                  log.type === 'ZKIR' ? 'text-accent' :
                  log.type === 'PROOF' ? 'text-amber' : 'text-green'
                }`}>
                  [{log.type}]
                </span>
                <span className="mono text-text-0">{log.message}</span>
              </div>
            ))}
          </div>

          <div className="deck-code-preview">
            <div className="mono text-[11px] text-text-2 uppercase pb-6 border-b border-[var(--border)] mb-8">
              Active Circuit Definition
            </div>
            {selectedCircuit === 'verify_solvency' && (
              <pre className="mono text-[12px] text-text-1 leading-relaxed">
{`export circuit verify_solvency(): [] {
  assert(is_active, "Session is paused");
  assert(total_attestations < max_attestations);
  
  val balance = witness get_liquid_balance();
  val firm_sk = witness get_firm_secret();
  
  assert(balance >= min_solvency_threshold,
    "Insolvent counterparty");

  val nullifier = derive_nullifier(
    firm_sk, trade_session_id
  );
  assert(!nullifiers.member(nullifier),
    "Duplicate attestation rejected");

  nullifiers.insert(nullifier);
  total_attestations = total_attestations + 1;
}`}
              </pre>
            )}
            {selectedCircuit === 'update_session' && (
              <pre className="mono text-[12px] text-text-1 leading-relaxed">
{`export circuit update_session(
  new_threshold: Uint<32>,
  new_session: Bytes<32>,
  new_deadline: Uint<32>,
  new_broker: Bytes<32>,
  new_cap: Uint<32>
): [] {
  val sk = witness get_admin_secret();
  assert(admin_public_key(sk) == admin_pk,
    "Unauthorized admin configuration");

  min_solvency_threshold = disclose(new_threshold);
  max_attestations = disclose(new_cap);
}`}
              </pre>
            )}
            {selectedCircuit === 'pause_session' && (
              <pre className="mono text-[12px] text-text-1 leading-relaxed">
{`export circuit pause_session(): [] {
  val sk = witness get_admin_secret();
  assert(admin_public_key(sk) == admin_pk,
    "Unauthorized emergency pause");

  is_active = disclose(false);
}`}
              </pre>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
