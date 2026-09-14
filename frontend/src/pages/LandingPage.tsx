import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Shield, ArrowRight, Activity, Lock, Database, FileDigit } from 'lucide-react';
import { getContractAddress } from '../config';
import { createPatchedPublicDataProvider } from '../lib/midnight';

const INDEXER_URL = 'http://127.0.0.1:8088/api/v4/graphql';
const INDEXER_WS = 'ws://127.0.0.1:8088/api/v4/graphql/ws';

export default function LandingPage() {
  const [stats, setStats] = useState<{ count: string; threshold: string }>({ count: '--', threshold: '--' });

  useEffect(() => {
    // Attempt to fetch real stats from indexer if running locally
    const fetchStats = async () => {
      try {
        const provider = createPatchedPublicDataProvider(INDEXER_URL, INDEXER_WS);
        const state = await provider.queryContractState(getContractAddress());
        if (state) {
          setStats({
            count: state.data.total_attestations?.toString() || '0',
            threshold: state.data.min_solvency_threshold ? 
              `$${(Number(state.data.min_solvency_threshold) / 100).toLocaleString()}` : '--'
          });
        }
      } catch (e) {
        // Silent fail on landing page if indexer not up
      }
    };
    fetchStats();
  }, []);

  return (
    <div className="page page-wide">
      <div className="hero">
        <div className="hero-tag">ZK OTC Solvency Protocol</div>
        <h1 className="hero-title">Prove Solvency.<br />Reveal Nothing.</h1>
        <p className="hero-sub">
          Institutional OTC block trades require proof of funds. Today, that means doxxing your custody addresses to front-runners. SilentSolvent uses zero-knowledge cryptography to mathematically prove liquidity without revealing wallet balances, asset composition, or identity.
        </p>
        <div className="hero-actions">
          <Link to="/verify" className="btn btn-primary">
            Verify Solvency <ArrowRight size={16} />
          </Link>
          <Link to="/admin" className="btn btn-ghost">
            Deploy Trade Session
          </Link>
        </div>
      </div>

      <div className="divider"></div>

      <div className="grid-3 mt-32 mb-32">
        <div className="feature-card">
          <div className="feature-icon"><Lock size={20} /></div>
          <h3 className="feature-title">Absolute Privacy</h3>
          <p className="feature-desc">Your balance is used as a private ZK witness entirely within your browser. It is never transmitted to the network or the OTC desk.</p>
        </div>
        <div className="feature-card">
          <div className="feature-icon"><Database size={20} /></div>
          <h3 className="feature-title">No Front-Running</h3>
          <p className="feature-desc">Because your wallet addresses remain completely hidden, predatory algorithms cannot track your collateral movements or short your holdings.</p>
        </div>
        <div className="feature-card">
          <div className="feature-icon"><FileDigit size={20} /></div>
          <h3 className="feature-title">Mathematical Attestation</h3>
          <p className="feature-desc">The broker receives an unforgeable cryptographic proof that your liquidity meets their threshold for the specific trade session.</p>
        </div>
      </div>

      <div className="card mt-32">
        <div className="card-header">
          <div className="card-title flex items-center gap-8">
            <Activity size={14} className="text-accent" /> Network Status
          </div>
        </div>
        <div className="grid-3">
          <div className="stat">
            <div className="stat-label">Total Attestations</div>
            <div className="stat-value text-green">{stats.count}</div>
          </div>
          <div className="stat">
            <div className="stat-label">Current Threshold</div>
            <div className="stat-value">{stats.threshold}</div>
          </div>
          <div className="stat">
            <div className="stat-label">Contract Address</div>
            <div className="stat-value hash hash-short">{getContractAddress()}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
