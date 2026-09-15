import '../polyfills';
import { useState, useCallback, useEffect } from 'react';
import { CompiledContract } from '@midnight-ntwrk/compact-js';
import { createUnprovenCallTx, submitTxAsync } from '@midnight-ntwrk/midnight-js-contracts';
import { Contract } from '../managed/contract/index.js';
import { useWallet } from '../contexts/WalletContext';
import { getContractAddress } from '../config';
import { fromHex, toHex } from '../lib/midnight';
import { Shield, ShieldAlert, Lock, ArrowRight, CheckCircle2, Clock, Activity, Fingerprint } from 'lucide-react';
import { useContractState } from '../hooks/useContractState';

function getCompiledContract() {
  return CompiledContract.make('SilentSolventContract', Contract).pipe(
    CompiledContract.withVacantWitnesses,
    CompiledContract.withCompiledFileAssets(new URL('/managed', window.location.origin).toString()),
  ) as any;
}

export default function VerifyPage() {
  const { session, isConnected, connect, isConnecting, walletStatus } = useWallet();
  const [balanceStr, setBalanceStr] = useState('5000000');
  const [firmSecret, setFirmSecret] = useState('');
  
  // UI State
  const [provingStep, setProvingStep] = useState(1);
  const [provingProgress, setProvingProgress] = useState(0);
  const [provingPhase, setProvingPhase] = useState('');
  const [txId, setTxId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // On-chain state
  const { ledgerState, isLoading: isLoadingLedger } = useContractState(3000);

  // Auto-generate a dummy secret on mount if none exists
  useEffect(() => {
    // Auto-generate a dummy secret if none exists
    setFirmSecret(Array.from(crypto.getRandomValues(new Uint8Array(32)))
      .map(b => b.toString(16).padStart(2, '0')).join(''));
  }, []);

  const handleProve = useCallback(async () => {
    const balance = BigInt(balanceStr.replace(/[^0-9]/g, ''));
    if (!ledgerState) return setErrorMsg('Failed to load session parameters.');
    if (!ledgerState.is_active) return setErrorMsg('This trade session has been paused by the administrator.');

    setProvingStep(2);
    setProvingProgress(10);
    setProvingPhase('Compiling witness data...');
    setErrorMsg(null);
    setTxId(null);

    const progressTimer = setInterval(() => {
      setProvingProgress(p => {
        if (p >= 85) return 85;
        if (p > 40) setProvingPhase('Generating zero-knowledge proof over BN254...');
        if (p > 70) setProvingPhase('Submitting transaction to Midnight...');
        return p + 5;
      });
    }, 500);

    try {
      if (session && isConnected) {
        const secretBytes = fromHex(firmSecret);
        
        const callTxData = await createUnprovenCallTx(session.providers as any, {
          compiledContract: getCompiledContract(),
          contractAddress: getContractAddress(),
          circuitId: 'verify_solvency',
          args: [],
          witnesses: {
            get_liquid_balance: () => balance,
            get_firm_secret: () => secretBytes,
          }
        });

        const id = await submitTxAsync(session.providers as any, {
          unprovenTx: callTxData.private.unprovenTx,
          circuitId: 'verify_solvency',
        });

        setTxId(typeof id === 'string' ? id : String(id));
      } else {
        // Simulation for UI testing without wallet
        await new Promise(r => setTimeout(r, 4000));
        setTxId('0x' + Array.from(crypto.getRandomValues(new Uint8Array(32)))
          .map(b => b.toString(16).padStart(2, '0')).join(''));
      }
      
      clearInterval(progressTimer);
      setProvingProgress(100);
      setProvingPhase('Attestation successful');
      setProvingStep(3);

    } catch (e: any) {
      clearInterval(progressTimer);
      setProvingStep(1);
      setErrorMsg(e.message || 'Proving failed');
      setProvingProgress(0);
    }
  }, [balanceStr, firmSecret, session, isConnected, ledgerState]);

  const threshold = ledgerState?.min_solvency_threshold ? Number(ledgerState.min_solvency_threshold) : 0;
  const currentBalance = parseInt(balanceStr.replace(/[^0-9]/g, '') || '0', 10);
  const isValid = currentBalance >= threshold;

  return (
    <div className="page page-wide">
      <div className="verify-layout">
        
        {/* LEFT PANEL: OTC DESK VIEW (PUBLIC) */}
        <div className="flex-col gap-16">
          <div className="card">
            <div className="card-header">
              <div className="card-title">Trade Session (Public)</div>
              {ledgerState?.is_active ? 
                <span className="status status-active">Active</span> : 
                <span className="status status-paused">Paused</span>
              }
            </div>
            
            {isLoadingLedger ? (
              <div className="text-muted"><div className="spinner mb-8"/> Loading on-chain state...</div>
            ) : !ledgerState ? (
              <div className="notice notice-error">Contract not found on indexer. Deploy first.</div>
            ) : (
              <div className="flex-col gap-12">
                <div className="data-row">
                  <span className="data-label">Threshold Required</span>
                  <span className="data-value text-accent">${(threshold / 100).toLocaleString()}</span>
                </div>
                <div className="data-row">
                  <span className="data-label">Session ID</span>
                  <span className="data-value hash hash-short" title={toHex(ledgerState.trade_session_id)}>
                    {toHex(ledgerState.trade_session_id).slice(0, 16)}...
                  </span>
                </div>
                <div className="data-row">
                  <span className="data-label">Attestations</span>
                  <span className="data-value">{ledgerState.total_attestations?.toString()} / {ledgerState.max_attestations?.toString()}</span>
                </div>
                <div className="data-row">
                  <span className="data-label">Deadline</span>
                  <span className="data-value flex items-center gap-4">
                    <Clock size={14}/> 
                    {new Date(Number(ledgerState.session_deadline) * 1000).toLocaleString()}
                  </span>
                </div>
              </div>
            )}
          </div>
          
          <div className="card mt-16">
            <div className="card-title mb-16 flex items-center gap-8"><Activity size={16}/> Privacy Visualizer</div>
            <div className="flex-col gap-8 text-[12px]">
              <div className="flex justify-between text-muted mb-8 pb-8 border-b border-[var(--border)]">
                <span>🔓 ON-CHAIN</span>
                <span>🔒 BROWSER ONLY</span>
              </div>
              <div className="flex justify-between">
                <span className="text-accent">Session Threshold</span>
                <span className="text-green">Your Balance</span>
              </div>
              <div className="flex justify-between">
                <span className="text-accent">Nullifier Hash</span>
                <span className="text-green">Firm Secret Key</span>
              </div>
              <div className="flex justify-between">
                <span className="text-accent">Attestation +1</span>
                <span className="text-green">Wallet Address</span>
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT PANEL: FUND VIEW (PRIVATE) */}
        <div className="card">
          <div className="card-header">
            <div className="card-title">Fund Attestation (Local)</div>
            <div className="privacy-strip">
              <Lock size={14} /> Zero data leaves this device
            </div>
          </div>

          <div className="steps mt-16">
            <div className={`step ${provingStep >= 1 ? 'done' : 'active'}`}>
              <div className="step-num">1</div> Connect
            </div>
            <div className={`step ${provingStep > 1 ? 'done' : provingStep === 1 ? 'active' : ''}`}>
              <div className="step-num">2</div> Input
            </div>
            <div className={`step ${provingStep === 3 ? 'done' : provingStep === 2 ? 'active' : ''}`}>
              <div className="step-num">3</div> Prove
            </div>
          </div>

          {errorMsg && (
            <div className="notice notice-error mb-16">
              <ShieldAlert size={16} /> {errorMsg}
            </div>
          )}

          {provingStep === 1 && (
            <div className="flex-col gap-16 mt-24">
              {!isConnected ? (
                <>
                  <p className="text-secondary text-[14px]">Connect your Midnight wallet to generate a proof locally.</p>
                  <button 
                    className="btn btn-primary" 
                    onClick={() => connect()} 
                    disabled={isConnecting || walletStatus === 'not-found'}
                  >
                    {isConnecting ? 'Connecting...' : walletStatus === 'not-found' ? 'No Wallet Detected' : 'Connect Wallet'}
                  </button>
                  {walletStatus === 'not-found' && (
                    <p className="text-muted text-[12px]">Install Midnight Lace or 1AM extension to continue.</p>
                  )}
                </>
              ) : (
                <>
                  <div className="notice notice-success">
                    Wallet connected successfully. Your identity will remain hidden.
                  </div>
                  <div className="input-group">
                    <label className="input-label">Private Firm Secret (Hex)</label>
                    <input 
                      type="text" 
                      className="input mono" 
                      value={firmSecret} 
                      onChange={(e) => setFirmSecret(e.target.value)} 
                    />
                    <div className="text-[11px] text-muted flex items-center gap-4 mt-4">
                      <Fingerprint size={12}/> Used to derive session nullifier. Does not link to wallet.
                    </div>
                  </div>
                  
                  <div className="divider"></div>
                  
                  <div className="input-group">
                    <label className="input-label flex justify-between">
                      Liquid Balance (Cents)
                      {isValid ? <span className="text-green text-[11px]">≥ Threshold</span> : <span className="text-red text-[11px]">&lt; Threshold</span>}
                    </label>
                    <input 
                      type="text" 
                      className="input input-lg mono" 
                      value={balanceStr} 
                      onChange={(e) => setBalanceStr(e.target.value)} 
                    />
                  </div>
                  
                  <button 
                    className="btn btn-primary mt-16 w-full" 
                    onClick={handleProve}
                    disabled={!isValid || !firmSecret}
                  >
                    Generate Solvency Proof <ArrowRight size={16}/>
                  </button>
                </>
              )}
            </div>
          )}

          {provingStep === 2 && (
            <div className="flex-col items-center justify-center gap-16 mt-32 mb-32 text-center">
              <div className="spinner" style={{ width: 40, height: 40, borderWidth: 3 }} />
              <div className="mono text-accent text-[18px]">{provingProgress}%</div>
              <p className="text-secondary">{provingPhase}</p>
              
              <div className="progress-track mt-16 w-full max-w-[300px]">
                <div className="progress-fill" style={{ width: `${provingProgress}%` }}></div>
              </div>
              <p className="text-[12px] text-muted mt-16 max-w-[300px]">
                Your balance is being converted into a cryptographic witness. No financial data is sent to the network.
              </p>
            </div>
          )}

          {provingStep === 3 && (
            <div className="flex-col items-center text-center gap-16 mt-24">
              <div className="text-green">
                <CheckCircle2 size={64} />
              </div>
              <h2 className="text-[24px] font-bold">Solvency Verified</h2>
              <p className="text-secondary mb-16">
                Your zero-knowledge proof has been verified and recorded by the network.
              </p>
              
              <div className="card w-full text-left bg-[var(--bg-0)]">
                <div className="data-row">
                  <span className="data-label">Transaction ID</span>
                  <span className="data-value hash hash-short text-green" title={txId || ''}>{txId}</span>
                </div>
                <div className="data-row">
                  <span className="data-label">Attested Amount</span>
                  <span className="data-value text-muted">Hidden (Witness)</span>
                </div>
                <div className="data-row">
                  <span className="data-label">Nullifier Hash</span>
                  <span className="data-value text-muted">Recorded</span>
                </div>
              </div>

              <button className="btn btn-ghost mt-16" onClick={() => { setProvingStep(1); setTxId(null); }}>
                Perform Another Attestation
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
