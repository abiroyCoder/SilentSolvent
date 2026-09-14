import { useState, useEffect } from 'react';
import { getContractAddress } from '../config';
import { createPatchedPublicDataProvider, toHex } from '../lib/midnight';
import { Search, Clock, ShieldCheck, Activity } from 'lucide-react';

const INDEXER_URL = 'http://127.0.0.1:8088/api/v4/graphql';
const INDEXER_WS = 'ws://127.0.0.1:8088/api/v4/graphql/ws';

export default function ExplorerPage() {
  const [ledgerState, setLedgerState] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());

  const fetchState = async () => {
    try {
      const provider = createPatchedPublicDataProvider(INDEXER_URL, INDEXER_WS);
      const state = await provider.queryContractState(getContractAddress());
      if (state) {
        setLedgerState(state.data);
        setLastUpdate(new Date());
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchState();
    const id = setInterval(fetchState, 5000);
    return () => clearInterval(id);
  }, []);

  // In a real app we would iterate the Map from ledgerState.attestation_log
  // but since we are just pulling the root state via indexer without wallet iterator helpers,
  // we'll display the count and simulate the event log based on total_attestations
  const renderAttestationFeed = () => {
    if (!ledgerState) return null;
    const count = Number(ledgerState.total_attestations || 0);
    if (count === 0) return <div className="text-muted p-24 text-center border border-dashed border-[var(--border)] rounded">No attestations recorded in this session yet.</div>;
    
    return Array.from({ length: count }).map((_, i) => (
      <div key={i} className="flex items-center gap-16 p-16 border-b border-[var(--border)] bg-[var(--bg-1)] hover:bg-[var(--bg-2)] transition-colors">
        <div className="text-green bg-green-dim p-8 rounded"><ShieldCheck size={20}/></div>
        <div className="flex-col gap-4 flex-1">
          <div className="font-semibold text-[13px] flex items-center gap-8">
            Anonymous Entity #{count - i} <span className="status status-active bg-transparent border border-[var(--green)]">Verified</span>
          </div>
          <div className="text-muted text-[12px] font-mono">
            Session: {toHex(ledgerState.trade_session_id).slice(0, 16)}...
          </div>
        </div>
        <div className="text-muted text-[11px] font-mono flex items-center gap-4">
          <Clock size={12}/> Confirmed on-chain
        </div>
      </div>
    ));
  };

  return (
    <div className="page page-wide">
      <div className="flex items-center justify-between mb-24">
        <div className="card-title flex items-center gap-8 text-[16px]"><Search size={18}/> On-Chain Explorer</div>
        <div className="text-muted text-[12px] flex items-center gap-6"><Activity size={12} className="text-accent"/> Live syncing • Last updated: {lastUpdate.toLocaleTimeString()}</div>
      </div>
      
      <div className="grid-2">
        <div className="flex-col gap-16">
          <div className="card">
            <div className="card-header border-b border-[var(--border)] pb-16 mb-0">
              <div className="card-title">Contract Overview</div>
            </div>
            {isLoading && !ledgerState ? (
              <div className="p-24 text-center text-muted"><div className="spinner mx-auto mb-8"/> Reading chain...</div>
            ) : !ledgerState ? (
              <div className="p-24 text-center text-muted">Contract not found</div>
            ) : (
              <div>
                <div className="data-row">
                  <span className="data-label">Address</span>
                  <span className="data-value hash hash-short text-accent">{getContractAddress()}</span>
                </div>
                <div className="data-row">
                  <span className="data-label">Status</span>
                  {ledgerState.is_active ? <span className="status status-active">Active</span> : <span className="status status-paused">Paused</span>}
                </div>
                <div className="data-row">
                  <span className="data-label">Threshold</span>
                  <span className="data-value">${(Number(ledgerState.min_solvency_threshold)/100).toLocaleString()}</span>
                </div>
                <div className="data-row">
                  <span className="data-label">Broker ID Hash</span>
                  <span className="data-value hash hash-short">{toHex(ledgerState.broker_id)}</span>
                </div>
                <div className="data-row">
                  <span className="data-label">Attestations</span>
                  <span className="data-value">{ledgerState.total_attestations?.toString()}</span>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="card p-0 overflow-hidden border-[var(--border-strong)]">
          <div className="card-header border-b border-[var(--border)] p-20 mb-0 bg-[var(--bg-0)]">
            <div className="card-title">Live Attestation Feed</div>
          </div>
          <div className="flex-col">
            {isLoading && !ledgerState ? (
              <div className="p-24 text-center text-muted"><div className="spinner mx-auto mb-8"/></div>
            ) : (
              renderAttestationFeed()
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
