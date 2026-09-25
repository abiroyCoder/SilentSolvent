import { useState, useEffect, useMemo } from 'react';
import { getContractAddress, getExplorerContractUrl, getExplorerTxUrl, INDEXER_URL } from '../config';
import { toHex } from '../lib/midnight';
import { Search, Clock, ShieldCheck, Activity, ExternalLink, Hash, CheckCircle2 } from 'lucide-react';
import { useContractState } from '../hooks/useContractState';

interface IndexedAttestationEvent {
  nullifierHex: string;
  sessionIdHex: string;
  txHash?: string;
  blockHeight?: number;
  timestamp?: number;
}

export default function ExplorerPage() {
  const { ledgerState, isLoading, lastUpdate } = useContractState();
  const [latestTxInfo, setLatestTxInfo] = useState<{
    hash: string;
    blockHeight?: number;
    timestamp?: number;
  } | null>(null);

  const contractAddress = getContractAddress();

  // Query actual indexer contract action telemetry
  useEffect(() => {
    if (!contractAddress) return;
    const fetchTelemetry = async () => {
      try {
        const query = `
          query GetContractActionHistory($address: HexEncoded!) {
            contractAction(address: $address) {
              __typename
              address
              transaction {
                hash
                block {
                  height
                  timestamp
                }
              }
            }
          }
        `;
        const res = await fetch(INDEXER_URL, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ query, variables: { address: contractAddress } }),
        });
        if (res.ok) {
          const data = await res.json();
          const tx = data?.data?.contractAction?.transaction;
          if (tx && tx.hash) {
            setLatestTxInfo({
              hash: tx.hash,
              blockHeight: tx.block?.height,
              timestamp: tx.block?.timestamp,
            });
          }
        }
      } catch (e) {
        console.warn('Indexer telemetry fetch error:', e);
      }
    };
    fetchTelemetry();
  }, [contractAddress, lastUpdate]);

  // Extract actual indexed attestations from on-chain ledgerState
  const indexedAttestations: IndexedAttestationEvent[] = useMemo(() => {
    if (!ledgerState) return [];
    const list: IndexedAttestationEvent[] = [];
    const defaultSessionHex = ledgerState.trade_session_id ? toHex(ledgerState.trade_session_id) : '';

    // 1. Extract from on-chain attestation_log
    if (ledgerState.attestation_log && typeof ledgerState.attestation_log[Symbol.iterator] === 'function') {
      try {
        for (const entry of ledgerState.attestation_log) {
          if (Array.isArray(entry) && entry.length >= 2) {
            const nulHex = toHex(entry[0]);
            const sessHex = toHex(entry[1]) || defaultSessionHex;
            if (nulHex) {
              list.push({
                nullifierHex: nulHex,
                sessionIdHex: sessHex,
              });
            }
          }
        }
      } catch (err) {
        console.warn('Error reading attestation_log iterable:', err);
      }
    }

    // 2. Fallback to nullifiers set if attestation_log didn't yield items
    if (list.length === 0 && ledgerState.nullifiers && typeof ledgerState.nullifiers[Symbol.iterator] === 'function') {
      try {
        for (const nul of ledgerState.nullifiers) {
          const nulHex = toHex(nul);
          if (nulHex) {
            list.push({
              nullifierHex: nulHex,
              sessionIdHex: defaultSessionHex,
            });
          }
        }
      } catch (err) {
        console.warn('Error reading nullifiers iterable:', err);
      }
    }

    // Attach latest tx info to the most recent entry if available
    if (list.length > 0 && latestTxInfo) {
      list[list.length - 1].txHash = latestTxInfo.hash;
      list[list.length - 1].blockHeight = latestTxInfo.blockHeight;
      list[list.length - 1].timestamp = latestTxInfo.timestamp;
    }

    return list.reverse(); // Most recent first
  }, [ledgerState, latestTxInfo]);

  const renderAttestationFeed = () => {
    if (!ledgerState) return null;
    const totalCount = Number(ledgerState.total_attestations || 0);

    if (totalCount === 0 || indexedAttestations.length === 0) {
      return (
        <div className="text-muted p-32 text-center border border-dashed border-[var(--border)] rounded m-16">
          No attestations recorded in this session yet. Waiting for participant zero-knowledge proofs.
        </div>
      );
    }

    return indexedAttestations.map((att, i) => (
      <div
        key={att.nullifierHex || i}
        className="flex items-start gap-16 p-16 border-b border-[var(--border)] bg-[var(--bg-1)] hover:bg-[var(--bg-2)] transition-colors"
      >
        <div className="text-green bg-green-dim p-8 rounded mt-2">
          <ShieldCheck size={20} />
        </div>
        <div className="flex-col gap-6 flex-1">
          <div className="font-semibold text-[13px] flex items-center gap-8 justify-between">
            <span className="flex items-center gap-6">
              Verified Attestation #{indexedAttestations.length - i}
              <span className="badge badge-success text-[10px]">ZK Proof Verified</span>
            </span>
            {att.timestamp ? (
              <span className="text-muted text-[11px] font-mono flex items-center gap-4">
                <Clock size={12} /> {new Date(att.timestamp).toLocaleTimeString()}
              </span>
            ) : (
              <span className="text-muted text-[11px] font-mono flex items-center gap-4">
                <CheckCircle2 size={12} className="text-green" /> Consensus Finalized
              </span>
            )}
          </div>

          <div className="flex-col gap-3 text-[11px] font-mono">
            <div className="text-muted flex items-center gap-6">
              <Hash size={12} />
              <span className="text-secondary">Nullifier:</span>
              <span className="text-text-1 break-all" title={att.nullifierHex}>
                0x{att.nullifierHex.slice(0, 24)}...{att.nullifierHex.slice(-8)}
              </span>
            </div>
            <div className="text-muted flex items-center gap-6">
              <span className="text-secondary">Session:</span>
              <span className="text-text-1" title={att.sessionIdHex}>
                0x{att.sessionIdHex.slice(0, 16)}...
              </span>
            </div>
            {att.txHash && (
              <div className="text-muted flex items-center gap-6 mt-2">
                <span className="text-secondary">Tx:</span>
                <a
                  href={getExplorerTxUrl(att.txHash)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-accent hover:underline flex items-center gap-4"
                >
                  {att.txHash.slice(0, 18)}... <ExternalLink size={10} />
                </a>
                {att.blockHeight && (
                  <span className="text-muted ml-auto">Block #{att.blockHeight}</span>
                )}
              </div>
            )}
          </div>
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
        <div className="card-title flex items-center gap-8 text-[16px]">
          <Search size={18} /> On-Chain Explorer & Indexed Events
        </div>
        <div className="flex items-center gap-16">
          <a
            href={getExplorerContractUrl()}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[12px] mono text-text-1 hover:text-accent flex items-center gap-4 border border-[var(--border)] px-8 py-4 rounded bg-[var(--bg-1)]"
          >
            1AM Explorer <ExternalLink size={12} />
          </a>
          <div className="text-muted text-[12px] flex items-center gap-6">
            <Activity size={12} className="text-accent" /> Live Indexer Sync • {lastUpdate.toLocaleTimeString()}
          </div>
        </div>
      </div>

      <div className="grid-2">
        <div className="flex-col gap-16">
          <div className="card">
            <div className="card-header border-b border-[var(--border)] pb-16 mb-0">
              <div className="card-title">Contract Analytics Dashboard</div>
            </div>
            {isLoading && !ledgerState ? (
              <div className="p-24 text-center text-muted">
                <div className="spinner mx-auto mb-8" /> Reading chain state via Indexer...
              </div>
            ) : !ledgerState ? (
              <div className="p-24 text-center text-muted">Contract not found</div>
            ) : (
              <div>
                <div className="data-row">
                  <span className="data-label">Contract Address</span>
                  <a
                    href={getExplorerContractUrl()}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="data-value hash hash-short text-accent hover:underline flex items-center gap-4"
                  >
                    {contractAddress} <ExternalLink size={11} />
                  </a>
                </div>
                <div className="data-row">
                  <span className="data-label">Session Status</span>
                  {ledgerState.is_active ? (
                    <span className="status status-active">Active</span>
                  ) : (
                    <span className="status status-paused">Paused</span>
                  )}
                </div>
                <div className="data-row">
                  <span className="data-label">Solvency Threshold</span>
                  <span className="data-value font-bold text-accent">
                    ${(Number(ledgerState.min_solvency_threshold) / 100).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </span>
                </div>
                <div className="data-row">
                  <span className="data-label">Broker Identity Hash</span>
                  <span className="data-value hash hash-short mono">{toHex(ledgerState.broker_id)}</span>
                </div>
                <div className="data-row">
                  <span className="data-label">Admin Commitment</span>
                  <span className="data-value hash hash-short mono">{toHex(ledgerState.admin)}</span>
                </div>

                {/* Visual Progress Bar */}
                <div className="mt-24">
                  <div className="flex justify-between text-[12px] font-semibold mb-8">
                    <span>Attestation Quota Fill</span>
                    <span className="mono">
                      {totalAttestations} / {maxAttestations}
                    </span>
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
            <div className="card-title flex justify-between items-center w-full">
              <span>Live Indexed Attestation Events</span>
              <span className="badge badge-success text-[10px]">
                {indexedAttestations.length} On-Chain Records
              </span>
            </div>
          </div>
          <div className="flex-col max-h-[500px] overflow-y-auto">
            {isLoading && !ledgerState ? (
              <div className="p-24 text-center text-muted">
                <div className="spinner mx-auto mb-8" />
              </div>
            ) : (
              renderAttestationFeed()
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
