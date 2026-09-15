import React, { useState, useRef, useEffect } from 'react';
import { Terminal, Play, ShieldCheck, Activity, Database, Cpu, Check, AlertCircle } from 'lucide-react';
import { getContractAddress } from '../config';

interface ConsoleLine {
  id: number;
  type: 'in' | 'out' | 'err' | 'zkir';
  text: string;
}

/**
 * Direct implementation inspired by pulkitxm/claude-directory (components-ui/terminal-cli-control-deck)
 * Interactive zsh/Midnight terminal console with live command execution and cryptographic log feed.
 */
export default function InteractiveConsoleDeck() {
  const [value, setValue] = useState('');
  const [history, setHistory] = useState<ConsoleLine[]>([
    { id: 0, type: 'out', text: 'Midnight ZK Console v0.31.0 initialized on Preprod network.' },
    { id: 1, type: 'out', text: "Type 'help' for available commands, or click the quick-run chips below." },
  ]);
  const idRef = useRef(2);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [history]);

  const runCommand = (raw: string): string[] => {
    const cmd = raw.trim().toLowerCase();
    if (!cmd) return [];
    if (cmd === 'clear') return ['__CLEAR__'];

    if (cmd === 'help') {
      return [
        'AVAILABLE COMMANDS:',
        '  status             - Query Midnight Preprod connection & session parameters',
        '  prove <amount>     - Simulate client-side witness evaluation (e.g. prove 10000000)',
        '  inspect            - Output contract state and active session parameters',
        '  nullifier          - Print session nullifier derivation formula',
        '  clear              - Clear console output',
      ];
    }

    if (cmd === 'status') {
      return [
        '● NETWORK: Midnight Preprod (Testnet)',
        '  INDEXER: https://indexer.preprod.midnight.network/api/v4/graphql',
        `  CONTRACT: ${getContractAddress()}`,
        '  ZK PROVER ENGINE: BN254 / WASM Active',
        '  SESSION STATE: ACTIVE (Consensus synchronized)',
      ];
    }

    if (cmd.startsWith('prove')) {
      const parts = cmd.split(' ');
      const amount = parts[1] ? parseInt(parts[1], 10) : 10000000;
      if (isNaN(amount) || amount <= 0) {
        return ['__ERR__', 'Usage: prove <amount_in_cents> (e.g. prove 10000000)'];
      }
      const isSolvent = amount >= 5000000;
      return [
        `[ZKIR] Ingesting private liquid balance witness: $${(amount / 100).toLocaleString()}`,
        '[ZKIR] Evaluating assertion: balance >= min_solvency_threshold (5,000,000 cents)...',
        isSolvent
          ? '[OK] Assertion PASSED. Counterparty is mathematically solvent.'
          : '__ERR__',
        isSolvent
          ? '[PROOF] BN254 elliptic curve proof synthesized in 1.42s.'
          : 'Assertion FAILED: Insufficient liquid funds for OTC trade session.',
        isSolvent
          ? '[LEDGER] Session nullifier derived & verified. Zero identity revealed.'
          : 'Execution reverted locally. No transaction sent to network.',
      ];
    }

    if (cmd === 'inspect') {
      return [
        '{',
        '  "min_solvency_threshold": 5000000,',
        '  "max_attestations": 50,',
        '  "is_active": true,',
        '  "privacy_model": "Witness-only evaluation; non-disclosing nullifiers",',
        '  "consensus_verification": "Midnight Substrate Pallet-Midnight"',
        '}',
      ];
    }

    if (cmd === 'nullifier') {
      return [
        'NULLIFIER FORMULA:',
        '  persistentHash([',
        '    pad(32, "ssolv:nullifier:v1"),',
        '    witness get_firm_secret(),',
        '    ledger.trade_session_id',
        '  ])',
        '  -> Prevents Sybil double-attestation without exposing firm_secret.',
      ];
    }

    return ['__ERR__', `zsh: command not found: ${raw}. Type 'help' for command list.`];
  };

  const exec = (raw: string) => {
    const out = runCommand(raw);
    setValue('');
    setHistory((prev) => {
      const next = [...prev, { id: idRef.current++, type: 'in' as const, text: raw || ' ' }];
      if (out[0] === '__CLEAR__') return [];
      let isErr = false;
      for (const line of out) {
        if (line === '__ERR__') {
          isErr = true;
          continue;
        }
        next.push({
          id: idRef.current++,
          type: isErr ? 'err' : line.startsWith('[ZKIR]') ? 'zkir' : 'out',
          text: line,
        });
        isErr = false;
      }
      return next.slice(-50);
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    exec(value);
  };

  return (
    <section className="terminal-deck-section">
      <div className="section-header">
        <div className="section-tag">OPERATOR CONTROL DECK // INTERACTIVE CONSOLE</div>
        <h2 className="section-title">Institutional Terminal & Telemetry Feed</h2>
        <p className="section-sub">
          Directly execute smart contract verification routines and observe live zero-knowledge circuit telemetry.
        </p>
      </div>

      <div className="deck-grid">
        {/* INTERACTIVE CONSOLE WINDOW */}
        <div className="ascii-window">
          <div className="window-header">
            <span className="mono text-[11px] font-bold uppercase text-accent">
              ZSH — OPERATOR INTERFACE
            </span>
            <span className="mono text-[10px] text-text-2">--TTY --LIVE</span>
          </div>

          <div className="window-stdout">
            {history.map((line) => (
              <div
                key={line.id}
                className={`stdout-line ${
                  line.type === 'in'
                    ? 'line-in'
                    : line.type === 'err'
                    ? 'line-err'
                    : line.type === 'zkir'
                    ? 'line-zkir'
                    : 'line-out'
                }`}
              >
                {line.type === 'in' ? (
                  <>
                    <span className="text-accent mr-6">fund@midnight:~$</span>
                    <span className="text-text-0">{line.text}</span>
                  </>
                ) : (
                  <span>{line.text}</span>
                )}
              </div>
            ))}
            <div ref={bottomRef} />
          </div>

          <form onSubmit={handleSubmit} className="window-prompt-row">
            <span className="text-accent mono text-[12px]">fund@midnight:~$</span>
            <input
              type="text"
              className="window-input mono"
              placeholder="type a command, e.g. prove 10000000"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              autoComplete="off"
              spellCheck={false}
            />
          </form>

          <div className="window-chips">
            {['status', 'prove 10000000', 'prove 1000000', 'inspect', 'nullifier', 'clear'].map((chip) => (
              <button
                key={chip}
                type="button"
                className="chip-bracket-btn"
                onClick={() => exec(chip)}
              >
                [ {chip} ]
              </button>
            ))}
          </div>
        </div>

        {/* LOG FEED / CIRCUIT AUDIT TELEMETRY */}
        <div className="ascii-window">
          <div className="window-header">
            <span className="mono text-[11px] font-bold uppercase text-green">
              TELEMETRY LOG FEED
            </span>
            <span className="mono text-[10px] text-green flex items-center gap-4">
              <span className="hero-status-dot" /> STREAMING
            </span>
          </div>

          <div className="window-stdout text-[12px]">
            <div className="telemetry-log-row">
              <span className="text-text-2 mono">14:28:01</span>
              <span className="mono font-bold text-accent">[INIT]</span>
              <span className="text-text-1">Session scoped nullifier tree active</span>
            </div>
            <div className="telemetry-log-row">
              <span className="text-text-2 mono">14:28:09</span>
              <span className="mono font-bold text-green">[OK]</span>
              <span className="text-text-1">WASM prover memory isolation verified</span>
            </div>
            <div className="telemetry-log-row">
              <span className="text-text-2 mono">14:28:22</span>
              <span className="mono font-bold text-amber">[ZKIR]</span>
              <span className="text-text-1">Curve BN254 constraints evaluated: 4,096 gates</span>
            </div>
            <div className="telemetry-log-row">
              <span className="text-text-2 mono">14:28:34</span>
              <span className="mono font-bold text-green">[OK]</span>
              <span className="text-text-1">Proof verified by block indexer</span>
            </div>
            <div className="telemetry-log-row">
              <span className="text-text-2 mono">14:28:49</span>
              <span className="mono font-bold text-accent">[NULL]</span>
              <span className="text-text-1">Nullifier 0x3e18... recorded on-chain</span>
            </div>
            <div className="telemetry-log-row">
              <span className="text-text-2 mono">14:29:02</span>
              <span className="mono font-bold text-green">[OK]</span>
              <span className="text-text-1">Attestation +1 incremented on ledger</span>
            </div>
          </div>

          <div className="window-footer-bar">
            <span className="mono text-[11px] text-text-2">
              AUDIT TRAIL // ZERO IDENTITY DISCLOSED // EXIT 0
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}
