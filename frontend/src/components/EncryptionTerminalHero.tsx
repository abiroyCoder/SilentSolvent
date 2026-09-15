import React from 'react';
import { Link } from 'react-router-dom';
import { Shield, ArrowRight, Lock, Cpu, CheckCircle2, Terminal } from 'lucide-react';

interface HeroProps {
  stats: {
    count: string;
    threshold: string;
    contractAddress: string;
  };
}

export default function EncryptionTerminalHero({ stats }: HeroProps) {
  return (
    <section className="terminal-hero">
      <div className="terminal-badge">
        <span className="terminal-badge-dot"></span>
        <span className="terminal-badge-text">MIDNIGHT NETWORK // TESTNET PREPROD // COMPACT ZKIR ENGINE</span>
      </div>

      <div className="terminal-hero-grid">
        <div className="terminal-hero-main">
          <h1 className="terminal-title">
            INSTITUTIONAL LIQUIDITY.
            <br />
            <span className="text-accent">ZERO EXPOSURE.</span>
          </h1>
          <p className="terminal-sub">
            Bilateral OTC block trades ($1M – $50M) mandate Proof of Funds. Traditional audits and wallet shares expose custody addresses to predatory MEV front-runners and Arkham tracking. 
            SilentSolvent executes zero-knowledge solvency assertions locally inside your browser—proving capitalization without disclosing balances, custodians, or addresses.
          </p>

          <div className="terminal-hero-actions">
            <Link to="/verify" className="btn btn-primary btn-lg">
              <Lock size={16} />
              Generate Solvency Proof
              <ArrowRight size={16} />
            </Link>
            <Link to="/explorer" className="btn btn-ghost btn-lg">
              <Terminal size={16} />
              View Active Sessions
            </Link>
          </div>
        </div>

        <div className="terminal-telemetry-box">
          <div className="telemetry-header">
            <div className="flex items-center gap-8">
              <Cpu size={14} className="text-accent" />
              <span className="mono text-[12px] font-semibold text-text-0">PROTOCOL TELEMETRY</span>
            </div>
            <span className="mono text-[11px] text-green flex items-center gap-4">
              <span className="nav-dot"></span> SYNCHRONIZED
            </span>
          </div>

          <div className="telemetry-body">
            <div className="telemetry-item">
              <span className="telemetry-label">Session Threshold</span>
              <span className="telemetry-val text-accent">{stats.threshold}</span>
            </div>
            <div className="telemetry-item">
              <span className="telemetry-label">Verified Attestations</span>
              <span className="telemetry-val text-green">{stats.count}</span>
            </div>
            <div className="telemetry-item">
              <span className="telemetry-label">Proving Architecture</span>
              <span className="telemetry-val mono text-[12px]">WASM / BN254 zk-SNARK</span>
            </div>
            <div className="telemetry-item">
              <span className="telemetry-label">Data Disclosure Rate</span>
              <span className="telemetry-val text-green">0.00% (Pure Witness)</span>
            </div>
          </div>

          <div className="telemetry-footer">
            <span className="text-muted text-[11px] mono">CONTRACT:</span>
            <span className="mono text-[11px] text-text-1 hash" title={stats.contractAddress}>
              {stats.contractAddress.slice(0, 18)}...{stats.contractAddress.slice(-6)}
            </span>
          </div>
        </div>
      </div>

      <div className="terminal-kpi-bar">
        <div className="kpi-item">
          <div className="kpi-icon"><Shield size={18} /></div>
          <div>
            <div className="kpi-val">100% Client-Side</div>
            <div className="kpi-sub">Witness evaluation inside browser WASM</div>
          </div>
        </div>
        <div className="kpi-item">
          <div className="kpi-icon"><Lock size={18} /></div>
          <div>
            <div className="kpi-val">$0.00 Front-Running</div>
            <div className="kpi-sub">Custody wallet addresses never broadcast</div>
          </div>
        </div>
        <div className="kpi-item">
          <div className="kpi-icon"><Cpu size={18} /></div>
          <div>
            <div className="kpi-val">&lt; 3.0s Settlement</div>
            <div className="kpi-sub">Instant zero-knowledge proof verification</div>
          </div>
        </div>
        <div className="kpi-item">
          <div className="kpi-icon"><CheckCircle2 size={18} /></div>
          <div>
            <div className="kpi-val">Session Nullifiers</div>
            <div className="kpi-sub">Mathematical anti-replay protection</div>
          </div>
        </div>
      </div>
    </section>
  );
}
