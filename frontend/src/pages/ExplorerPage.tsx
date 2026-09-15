import { getContractAddress, getExplorerContractUrl } from '../config';
import { toHex } from '../lib/midnight';
import { Search, Clock, ShieldCheck, Activity, ExternalLink } from 'lucide-react';
import { useContractState } from '../hooks/useContractState';

export default function ExplorerPage() {
  const { ledgerState, isLoading, lastUpdate } = useContractState();

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

  const maxAttestations = Number(ledgerState?.max_attestations || 0);
  const totalAttestations = Number(ledgerState?.total_attestations || 0);
  const progressPercent = maxAttestations > 0 ? (totalAttestations / maxAttestations) * 100 : 0;

  return (
    <div className="page page-wide">
      <div className="flex items-center justify-between mb-24">
        <div className="card-title flex items-center gap-8 text-[16px]"><Search size={18}/> On-Chain Explorer</div>
        <div className="flex items-center gap-16">
          <a
            href={getExplorerContractUrl()}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[12px] mono text-text-1 hover:text-accent flex items-center gap-4 border border-[var(--border)] px-8 py-4 rounded bg-[var(--bg-1)]"
          >
            1AM Explorer <ExternalLink size={12} />
          </a>
          <div className="text-muted text-[12px] flex items-center gap-6"><Activity size={12} className="text-accent"/> Live syncing • Last updated: {lastUpdate.toLocaleTimeString()}</div>
        </div>
      </div>
      
      <div className="grid-2">
        <div className="flex-col gap-16">
          <div className="card">
            <div className="card-header border-b border-[var(--border)] pb-16 mb-0">
              <div className="card-title">Analytics Dashboard</div>
            </div>
            {isLoading && !ledgerState ? (
              <div className="p-24 text-center text-muted"><div className="spinner mx-auto mb-8"/> Reading chain...</div>
            ) : !ledgerState ? (
              <div className="p-24 text-center text-muted">Contract not found</div>
            ) : (
              <div>
                <div className="data-row">
                  <span className="data-label">Address</span>
                  <a
                    href={getExplorerContractUrl()}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="data-value hash hash-short text-accent hover:underline flex items-center gap-4"
                  >
                    {getContractAddress()} <ExternalLink size={11} />
                  </a>
                </div>
                <div className="data-row">
                  <span className="data-label">Status</span>
                  {ledgerState.is_active ? <span className="status status-active">Active</span> : <span className="status status-paused">Paused</span>}
                </div>
                <div className="data-row">
                  <span className="data-label">Min Solvency Threshold</span>
                  <span className="data-value font-bold">${(Number(ledgerState.min_solvency_threshold)/100).toLocaleString()}</span>
                </div>
                <div className="data-row">
                  <span className="data-label">Broker ID Hash</span>
                  <span className="data-value hash hash-short">{toHex(ledgerState.broker_id)}</span>
                </div>
                
                {/* Visual Progress Bar */}
                <div className="mt-24">
                  <div className="flex justify-between text-[12px] font-semibold mb-8">
                    <span>Participation Fill</span>
                    <span>{totalAttestations} / {maxAttestations}</span>
                  </div>
                  <div className="w-full bg-[var(--bg-0)] rounded-full h-8 overflow-hidden border border-[var(--border)]">
                    <div 
                      className="bg-[var(--accent)] h-full transition-all duration-500 ease-in-out"
                      style={{ width: `${progressPercent}%` }}
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="card p-0 overflow-hidden border-[var(--border-strong)]">
          <div className="card-header border-b border-[var(--border)] p-20 mb-0 bg-[var(--bg-0)]">
            <div className="card-title">Live Attestation Feed</div>
          </div>
          <div className="flex-col max-h-[500px] overflow-y-auto">
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

