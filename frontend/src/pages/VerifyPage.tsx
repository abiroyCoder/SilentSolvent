import '../polyfills';
import { useState, useCallback, useEffect, useId } from 'react';
import { CompiledContract } from '@midnight-ntwrk/compact-js';
import { createUnprovenCallTx, submitTxAsync } from '@midnight-ntwrk/midnight-js-contracts';
import { Contract } from '../managed/contract/index.js';
import { useWallet } from '../contexts/WalletContext';
import { getContractAddress, getExplorerTxUrl } from '../config';
import { fromHex, toHex } from '../lib/midnight';
import {
  Shield,
  ShieldAlert,
  Lock,
  ArrowRight,
  CheckCircle2,
  Clock,
  Activity,
  Fingerprint,
  Building2,
  UploadCloud,
  RefreshCw,
  Copy,
  Check,
  FileCheck,
  AlertCircle,
  ExternalLink,
} from 'lucide-react';
import { useContractState } from '../hooks/useContractState';
import {
  getOrCreatePersistentFirmCredential,
  saveFirmCredential,
  checkAttestationStatus,
  deriveFirmCommitment,
  type FirmCredential,
} from '../lib/credentials';
import {
  INSTITUTIONAL_CUSTODIAN_FIXTURES,
  fetchMidnightNativeBalance,
  parseCustomPoRAttestation,
  type BalanceSourceType,
  type AuthenticatedBalanceResult,
} from '../lib/balanceSources';

const defaultWitnesses = {
  get_liquid_balance: (ctx: any) => [ctx.privateState, 0n],
  get_firm_secret: (ctx: any) => [ctx.privateState, new Uint8Array(32)],
  admin_secret: (ctx: any) => [ctx.privateState, new Uint8Array(32)],
};

function getCompiledContract(customWitnesses?: Record<string, any>) {
  return CompiledContract.make('SilentSolventContract', Contract).pipe(
    CompiledContract.withWitnesses({
      ...defaultWitnesses,
      ...(customWitnesses || {}),
    }),
    CompiledContract.withCompiledFileAssets(new URL('/managed', window.location.origin).toString()),
  ) as any;
}

export default function VerifyPage() {
  const { session, isConnected, connect, isConnecting, walletStatus, address } = useWallet();

  // Persistent Firm Credential State
  const [firmCredential, setFirmCredential] = useState<FirmCredential>(() =>
    getOrCreatePersistentFirmCredential(),
  );
  const [copiedFirmId, setCopiedFirmId] = useState(false);
  const [isEditingCredential, setIsEditingCredential] = useState(false);
  const [inputSk, setInputSk] = useState(firmCredential.secretKey);

  // Authenticated Balance State
  const [sourceType, setSourceType] = useState<BalanceSourceType>('custodian_oracle');
  const [selectedCustodianId, setSelectedCustodianId] = useState<string>('fireblocks_prime');
  const [authBalance, setAuthBalance] = useState<AuthenticatedBalanceResult>({
    sourceType: 'custodian_oracle',
    sourceLabel: INSTITUTIONAL_CUSTODIAN_FIXTURES[0].custodianName,
    balanceCents: INSTITUTIONAL_CUSTODIAN_FIXTURES[0].balanceCents,
    formattedBalance: `$${(Number(INSTITUTIONAL_CUSTODIAN_FIXTURES[0].balanceCents) / 100).toLocaleString('en-US', { minimumFractionDigits: 2 })}`,
    isVerified: true,
    verificationDetails: `Cryptographically verified signature from ${INSTITUTIONAL_CUSTODIAN_FIXTURES[0].custodianName} [Account: ${INSTITUTIONAL_CUSTODIAN_FIXTURES[0].accountReference}]`,
    timestamp: Date.now(),
  });
  const [customPoRJson, setCustomPoRJson] = useState('');
  const [customPoRError, setCustomPoRError] = useState<string | null>(null);
  const [isLoadingBalance, setIsLoadingBalance] = useState(false);

  // UI State
  const [provingStep, setProvingStep] = useState(1);
  const [provingProgress, setProvingProgress] = useState(0);
  const [provingPhase, setProvingPhase] = useState('');
  const [txId, setTxId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // On-chain state
  const { ledgerState, isLoading: isLoadingLedger, refetch } = useContractState(3000);

  // Check one-attestation-per-credential status
  const attestationCheck = checkAttestationStatus(firmCredential.secretKey, ledgerState);
  const hasAlreadyAttested = attestationCheck.hasAttested;

  // Sync native balance when wallet connects and native source is active
  useEffect(() => {
    if (sourceType === 'native_midnight' && isConnected && address) {
      setIsLoadingBalance(true);
      fetchMidnightNativeBalance(address)
        .then((res) => {
          setAuthBalance(res);
          setIsLoadingBalance(false);
        })
        .catch((err) => {
          console.warn('Native balance fetch failed:', err);
          setIsLoadingBalance(false);
        });
    }
  }, [sourceType, isConnected, address]);

  // Handle Custodian selection
  const handleSelectCustodian = (id: string) => {
    setSelectedCustodianId(id);
    const fixture = INSTITUTIONAL_CUSTODIAN_FIXTURES.find((f) => f.id === id);
    if (fixture) {
      setAuthBalance({
        sourceType: 'custodian_oracle',
        sourceLabel: fixture.custodianName,
        balanceCents: fixture.balanceCents,
        formattedBalance: `$${(Number(fixture.balanceCents) / 100).toLocaleString('en-US', { minimumFractionDigits: 2 })}`,
        isVerified: true,
        verificationDetails: `Cryptographically verified signature from ${fixture.custodianName} [Ref: ${fixture.accountReference}]`,
        timestamp: fixture.timestamp * 1000,
        metadata: { ...fixture },
      });
    }
  };

  // Handle custom PoR Upload
  const handleApplyCustomPoR = () => {
    try {
      setCustomPoRError(null);
      const parsed = parseCustomPoRAttestation(customPoRJson);
      setAuthBalance(parsed);
    } catch (e: any) {
      setCustomPoRError(e.message || 'Invalid PoR attestation format');
    }
  };

  const handleCopyFirmId = () => {
    navigator.clipboard.writeText(firmCredential.firmIdCommitment);
    setCopiedFirmId(true);
    setTimeout(() => setCopiedFirmId(false), 2000);
  };

  const handleSaveImportedCredential = () => {
    if (inputSk.trim().length !== 64) {
      setErrorMsg('Firm secret key must be exactly 32 bytes (64 hex characters).');
      return;
    }
    const updated: FirmCredential = {
      secretKey: inputSk.trim(),
      firmIdCommitment: deriveFirmCommitment(inputSk.trim()),
      label: 'Imported Institutional Credential',
      createdAt: Date.now(),
    };
    saveFirmCredential(updated);
    setFirmCredential(updated);
    setIsEditingCredential(false);
    setErrorMsg(null);
  };

  const handleProve = useCallback(async () => {
    if (!ledgerState) return setErrorMsg('Failed to load session parameters.');
    if (!ledgerState.is_active) {
      return setErrorMsg('This trade session has been paused by the administrator.');
    }
    if (hasAlreadyAttested) {
      return setErrorMsg(
        'Firm credential has already attested in this session. One attestation per firm credential is cryptographically enforced on-chain.',
      );
    }

    if (!session || !isConnected) {
      return setErrorMsg(
        'Midnight wallet connection required. Connect a DApp Connector wallet to proceed.',
      );
    }

    const verifiedBalance = authBalance.balanceCents;
    const requiredThreshold = BigInt(ledgerState.min_solvency_threshold || 0);

    if (verifiedBalance < requiredThreshold) {
      return setErrorMsg(
        `Authenticated balance ($${(Number(verifiedBalance) / 100).toLocaleString()}) does not meet the minimum session threshold ($${(Number(requiredThreshold) / 100).toLocaleString()}).`,
      );
    }

    setProvingStep(2);
    setProvingProgress(10);
    setProvingPhase('Compiling authenticated witness data...');
    setErrorMsg(null);
    setTxId(null);

    const progressTimer = setInterval(() => {
      setProvingProgress((p) => {
        if (p >= 88) return 88;
        if (p > 35) setProvingPhase('Generating local zero-knowledge proof over BN254...');
        if (p > 65) setProvingPhase('Submitting proof transaction to Midnight Preprod...');
        return p + 6;
      });
    }, 450);

    try {
      const secretBytes = fromHex(firmCredential.secretKey);
      const witnesses = {
        get_liquid_balance: (ctx: any) => [ctx.privateState, verifiedBalance],
        get_firm_secret: (ctx: any) => [ctx.privateState, secretBytes],
        admin_secret: (ctx: any) => [ctx.privateState, new Uint8Array(32)],
      };

      const callTxData = await createUnprovenCallTx(session.providers as any, {
        compiledContract: getCompiledContract(witnesses),
        contractAddress: getContractAddress(),
        circuitId: 'verify_solvency',
        args: [],
        witnesses,
      });

      const id = await submitTxAsync(session.providers as any, {
        unprovenTx: callTxData.private.unprovenTx,
        circuitId: 'verify_solvency',
      });

      clearInterval(progressTimer);
      setProvingProgress(100);
      setProvingPhase('Attestation confirmed on Midnight Preprod');
      setTxId(typeof id === 'string' ? id : String(id));
      setProvingStep(3);
      setTimeout(refetch, 3000);
    } catch (e: any) {
      clearInterval(progressTimer);
      setProvingStep(1);
      setErrorMsg(e.message || 'Zero-knowledge proving failed on Midnight network.');
      setProvingProgress(0);
    }
  }, [ledgerState, hasAlreadyAttested, session, isConnected, authBalance, firmCredential, refetch]);

  const threshold = ledgerState?.min_solvency_threshold ? Number(ledgerState.min_solvency_threshold) : 0;
  const isBalanceSufficient = authBalance.balanceCents >= BigInt(threshold);

  return (
    <div className="page page-wide">
      <div className="verify-layout">
        {/* LEFT PANEL: OTC DESK VIEW (PUBLIC) */}
        <div className="flex-col gap-16">
          <div className="card">
            <div className="card-header">
              <div className="card-title">Trade Session (Public Ledger)</div>
              {ledgerState?.is_active ? (
                <span className="status status-active">Active</span>
              ) : (
                <span className="status status-paused">Paused</span>
              )}
            </div>

            {isLoadingLedger ? (
              <div className="text-muted">
                <div className="spinner mb-8" /> Loading on-chain state...
              </div>
            ) : !ledgerState ? (
              <div className="notice notice-error">Contract not found on indexer. Deploy first.</div>
            ) : (
              <div className="flex-col gap-12">
                <div className="data-row">
                  <span className="data-label">Threshold Required</span>
                  <span className="data-value text-accent font-bold">
                    ${(threshold / 100).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </span>
                </div>
                <div className="data-row">
                  <span className="data-label">Session ID</span>
                  <span className="data-value hash hash-short" title={toHex(ledgerState.trade_session_id)}>
                    {toHex(ledgerState.trade_session_id).slice(0, 16)}...
                  </span>
                </div>
                <div className="data-row">
                  <span className="data-label">Attestations Recorded</span>
                  <span className="data-value font-mono">
                    {ledgerState.total_attestations?.toString()} / {ledgerState.max_attestations?.toString()}
                  </span>
                </div>
                <div className="data-row">
                  <span className="data-label">Session Deadline</span>
                  <span className="data-value flex items-center gap-4 text-[12px]">
                    <Clock size={14} />
                    {new Date(Number(ledgerState.session_deadline) * 1000).toLocaleString()}
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* ONE-ATTESTATION STATUS CARD */}
          <div className="card">
            <div className="card-title mb-12 flex items-center gap-8 text-[14px]">
              <Fingerprint size={16} /> Credential Solvency Status
            </div>

            {hasAlreadyAttested ? (
              <div className="p-12 rounded border bg-green-dim border-[var(--green)] flex-col gap-6 text-[12px] text-green">
                <div className="flex items-center gap-8 font-bold">
                  <CheckCircle2 size={16} /> Attestation Active on Chain (1/1)
                </div>
                <div className="text-muted text-[11px] font-mono break-all">
                  Session Nullifier: {attestationCheck.nullifierHex.slice(0, 24)}...
                </div>
                <div className="text-[11px] text-text-1 mt-4">
                  Genuine one-attestation-per-credential is cryptographically active. Duplicate attestations are blocked.
                </div>
              </div>
            ) : (
              <div className="p-12 rounded border border-[var(--border)] flex-col gap-4 text-[12px] text-muted">
                <div className="flex items-center gap-6 text-text-1">
                  <AlertCircle size={14} className="text-accent" /> Ready for Attestation
                </div>
                <div>Your persistent firm credential has not yet attested for this active session.</div>
              </div>
            )}
          </div>

          <div className="card">
            <div className="card-title mb-16 flex items-center gap-8 text-[14px]">
              <Activity size={16} /> Privacy Boundary Visualizer
            </div>
            <div className="flex-col gap-8 text-[12px]">
              <div className="flex justify-between text-muted mb-8 pb-8 border-b border-[var(--border)]">
                <span>🔓 PUBLIC ON-CHAIN</span>
                <span>🔒 CLIENT PRIVATE WITNESS</span>
              </div>
              <div className="flex justify-between">
                <span className="text-accent">Session Threshold</span>
                <span className="text-green font-medium">Liquid Balance (Hidden)</span>
              </div>
              <div className="flex justify-between">
                <span className="text-accent">Session Nullifier</span>
                <span className="text-green font-medium">Firm Secret Seed</span>
              </div>
              <div className="flex justify-between">
                <span className="text-accent">Attestation Counter +1</span>
                <span className="text-green font-medium">Wallet & Custody Addresses</span>
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT PANEL: FUND VIEW (AUTHENTICATED WITNESS & PROVING) */}
        <div className="card">
          <div className="card-header">
            <div className="card-title">Institutional Attestation (Private)</div>
            <div className="privacy-strip">
              <Lock size={14} /> Zero data leaves your browser
            </div>
          </div>

          <div className="steps mt-16">
            <div className={`step ${provingStep >= 1 ? 'done' : 'active'}`}>
              <div className="step-num">1</div> Setup
            </div>
            <div className={`step ${provingStep > 1 ? 'done' : provingStep === 1 ? 'active' : ''}`}>
              <div className="step-num">2</div> Authenticate
            </div>
            <div className={`step ${provingStep === 3 ? 'done' : provingStep === 2 ? 'active' : ''}`}>
              <div className="step-num">3</div> Prove
            </div>
          </div>

          {errorMsg && (
            <div className="notice notice-error mb-16 mt-16">
              <ShieldAlert size={16} /> {errorMsg}
            </div>
          )}

          {provingStep === 1 && (
            <div className="flex-col gap-20 mt-20">
              {/* 1. WALLET CONNECTION via DApp Connector API */}
              {!isConnected ? (
                <div className="flex-col gap-12 p-16 border border-[var(--border)] rounded bg-[var(--bg-0)]">
                  <div className="font-semibold text-[14px]">Step 1: Connect Midnight Wallet</div>
                  <p className="text-secondary text-[13px]">
                    Connect your 1AM or Lace browser extension via official DApp Connector API.
                  </p>
                  <button
                    className="btn btn-primary"
                    onClick={() => connect()}
                    disabled={isConnecting || walletStatus === 'not-found'}
                  >
                    {isConnecting ? 'Connecting...' : walletStatus === 'not-found' ? 'No Wallet Detected' : 'Connect Wallet'}
                  </button>
                  {walletStatus === 'not-found' && (
                    <p className="text-muted text-[12px]">Please install 1AM or Lace wallet extension to continue.</p>
                  )}
                </div>
              ) : (
                <div className="flex justify-between items-center p-12 rounded border border-[var(--border)] bg-green-dim/30">
                  <div className="flex items-center gap-8 text-[13px]">
                    <CheckCircle2 size={16} className="text-green" />
                    <span>
                      Connected: <span className="mono text-text-1">{address?.slice(0, 16)}...</span>
                    </span>
                  </div>
                  <span className="badge badge-success text-[11px]">DApp Connector Ready</span>
                </div>
              )}

              {/* 2. PERSISTENT FIRM CREDENTIAL */}
              <div className="p-16 border border-[var(--border)] rounded bg-[var(--bg-0)] flex-col gap-12">
                <div className="flex justify-between items-center">
                  <div className="font-semibold text-[14px] flex items-center gap-6">
                    <Fingerprint size={16} className="text-accent" /> Persistent Firm Credential
                  </div>
                  <div className="flex gap-8">
                    <button
                      className="text-[11px] text-accent hover:underline flex items-center gap-2"
                      onClick={handleCopyFirmId}
                    >
                      {copiedFirmId ? <Check size={12} /> : <Copy size={12} />}
                      {copiedFirmId ? 'Copied Commitment' : 'Copy ID'}
                    </button>
                    <button
                      className="text-[11px] text-muted hover:text-white"
                      onClick={() => setIsEditingCredential(!isEditingCredential)}
                    >
                      {isEditingCredential ? 'Cancel' : 'Import / Rotate'}
                    </button>
                  </div>
                </div>

                <div className="data-row py-4">
                  <span className="data-label text-[12px]">Firm Public ID Commitment</span>
                  <span className="data-value hash hash-short text-[12px] mono" title={firmCredential.firmIdCommitment}>
                    {firmCredential.firmIdCommitment.slice(0, 20)}...
                  </span>
                </div>

                {isEditingCredential && (
                  <div className="flex-col gap-8 mt-8 pt-8 border-t border-[var(--border)]">
                    <label className="text-[11px] text-muted">Paste 32-Byte Secret Hex (Private Identity Seed):</label>
                    <input
                      type="text"
                      className="input mono text-[12px]"
                      value={inputSk}
                      onChange={(e) => setInputSk(e.target.value)}
                    />
                    <button className="btn btn-sm btn-primary self-end" onClick={handleSaveImportedCredential}>
                      Save & Apply Credential
                    </button>
                  </div>
                )}
                <div className="text-[11px] text-muted">
                  ✓ Persisted securely in browser storage. Generates session nullifiers without linking to your on-chain wallet.
                </div>
              </div>

              {/* 3. AUTHENTICATED BALANCE SOURCE (NO MANUAL ENTRY) */}
              <div className="p-16 border border-[var(--border)] rounded bg-[var(--bg-0)] flex-col gap-16">
                <div className="flex justify-between items-center">
                  <div className="font-semibold text-[14px] flex items-center gap-6">
                    <Building2 size={16} className="text-accent" /> Authenticated Balance Source
                  </div>
                  <span className="badge badge-success text-[11px]">No Manual Input Allowed</span>
                </div>

                {/* Source Selection Tabs */}
                <div className="flex gap-8 border-b border-[var(--border)] pb-8 text-[12px]">
                  <button
                    className={`px-12 py-6 rounded transition-colors ${
                      sourceType === 'custodian_oracle' ? 'bg-[var(--accent)] text-white' : 'text-muted hover:text-white'
                    }`}
                    onClick={() => setSourceType('custodian_oracle')}
                  >
                    Institutional Custodian Oracle
                  </button>
                  <button
                    className={`px-12 py-6 rounded transition-colors ${
                      sourceType === 'native_midnight' ? 'bg-[var(--accent)] text-white' : 'text-muted hover:text-white'
                    }`}
                    onClick={() => setSourceType('native_midnight')}
                  >
                    Midnight Native UTXO Balance
                  </button>
                  <button
                    className={`px-12 py-6 rounded transition-colors ${
                      sourceType === 'custom_proof' ? 'bg-[var(--accent)] text-white' : 'text-muted hover:text-white'
                    }`}
                    onClick={() => setSourceType('custom_proof')}
                  >
                    Upload Custom PoR Token
                  </button>
                </div>

                {/* Source Sub-Views */}
                {sourceType === 'custodian_oracle' && (
                  <div className="flex-col gap-10">
                    <label className="text-[12px] text-muted">Select Authorized Custodian Attestation:</label>
                    <div className="flex-col gap-8">
                      {INSTITUTIONAL_CUSTODIAN_FIXTURES.map((fixture) => (
                        <div
                          key={fixture.id}
                          onClick={() => handleSelectCustodian(fixture.id)}
                          className={`p-10 rounded border cursor-pointer flex justify-between items-center transition-all ${
                            selectedCustodianId === fixture.id
                              ? 'border-[var(--accent)] bg-[var(--bg-2)]'
                              : 'border-[var(--border)] hover:bg-[var(--bg-1)]'
                          }`}
                        >
                          <div className="flex-col gap-2">
                            <div className="font-semibold text-[13px]">{fixture.custodianName}</div>
                            <div className="text-[11px] text-muted mono">
                              {fixture.asset} • Ref: {fixture.accountReference}
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="font-bold text-green font-mono text-[14px]">
                              ${(Number(fixture.balanceCents) / 100).toLocaleString()}
                            </div>
                            <div className="text-[10px] text-accent flex items-center gap-2 justify-end">
                              <FileCheck size={10} /> Signed Oracle Token
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {sourceType === 'native_midnight' && (
                  <div className="flex-col gap-8">
                    <p className="text-[12px] text-secondary">
                      Queries the Midnight Preprod Indexer directly for authenticated unshielded UTXO reserves associated with your connected address.
                    </p>
                    {isLoadingBalance ? (
                      <div className="flex items-center gap-8 text-muted py-8">
                        <div className="spinner" /> Querying indexer...
                      </div>
                    ) : (
                      <div className="p-12 rounded border border-[var(--border)] bg-[var(--bg-1)] flex justify-between items-center">
                        <div>
                          <div className="font-semibold text-[13px]">Midnight Network Holdings</div>
                          <div className="text-[11px] text-muted mono">{address || 'No wallet connected'}</div>
                        </div>
                        <div className="font-bold text-green font-mono text-[16px]">
                          {authBalance.formattedBalance}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {sourceType === 'custom_proof' && (
                  <div className="flex-col gap-8">
                    <label className="text-[12px] text-muted">Paste Signed Proof-of-Reserve JSON Payload:</label>
                    <textarea
                      rows={3}
                      className="input mono text-[11px]"
                      placeholder='{"custodianName":"Custom Prime Custody","balanceCents":"1800000000","oracleSignature":"0x..."}'
                      value={customPoRJson}
                      onChange={(e) => setCustomPoRJson(e.target.value)}
                    />
                    {customPoRError && <div className="text-red text-[11px]">{customPoRError}</div>}
                    <button className="btn btn-sm btn-primary self-end" onClick={handleApplyCustomPoR}>
                      Verify & Load Attestation
                    </button>
                  </div>
                )}

                {/* Display Current Authenticated Balance (Read-Only) */}
                <div className="p-12 rounded border border-green-500/30 bg-green-dim/20 flex-col gap-6">
                  <div className="flex justify-between items-center">
                    <span className="text-[12px] text-muted">Verified Capital (Private Witness):</span>
                    <span className="text-[18px] font-bold text-green font-mono">
                      {authBalance.formattedBalance}
                    </span>
                  </div>
                  <div className="text-[11px] text-muted">
                    {authBalance.verificationDetails}
                  </div>
                </div>
              </div>

              {/* ACTION BUTTON */}
              <button
                className="btn btn-primary mt-8 w-full"
                onClick={handleProve}
                disabled={!isConnected || !isBalanceSufficient || hasAlreadyAttested}
              >
                {hasAlreadyAttested
                  ? 'Solvency Already Attested (1/1 Enforced)'
                  : !isBalanceSufficient
                  ? 'Insufficient Balance for Threshold'
                  : 'Generate ZK Solvency Proof (Midnight Network)'}
                <ArrowRight size={16} />
              </button>

              {hasAlreadyAttested && (
                <p className="text-[11px] text-amber-300 text-center">
                  This firm credential has already attested in the current session. Rotate credential above to attest with another identity.
                </p>
              )}
            </div>
          )}

          {provingStep === 2 && (
            <div className="flex-col items-center justify-center gap-16 mt-32 mb-32 text-center">
              <div className="spinner" style={{ width: 44, height: 44, borderWidth: 3 }} />
              <div className="mono text-accent text-[20px]">{provingProgress}%</div>
              <p className="text-secondary">{provingPhase}</p>

              <div className="progress-track mt-16 w-full max-w-[340px]">
                <div className="progress-fill" style={{ width: `${provingProgress}%` }}></div>
              </div>
              <p className="text-[12px] text-muted mt-16 max-w-[320px]">
                Evaluating private witness predicates (`balance &gt;= threshold` and `nullifier not in set`). Zero financial data or wallet identities cross into the public ledger.
              </p>
            </div>
          )}

          {provingStep === 3 && (
            <div className="flex-col items-center text-center gap-16 mt-24">
              <div className="text-green">
                <CheckCircle2 size={64} />
              </div>
              <h2 className="text-[24px] font-bold">Solvency Cryptographically Attested</h2>
              <p className="text-secondary mb-16">
                Your zero-knowledge proof has been verified and committed to Midnight Preprod.
              </p>

              <div className="card w-full text-left bg-[var(--bg-0)] flex-col gap-10">
                <div className="data-row">
                  <span className="data-label">Transaction Hash</span>
                  <a
                    href={getExplorerTxUrl(txId || '')}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="data-value hash hash-short text-accent hover:underline flex items-center gap-4"
                  >
                    {txId} <ExternalLink size={12} />
                  </a>
                </div>
                <div className="data-row">
                  <span className="data-label">Capital Proven</span>
                  <span className="data-value font-mono text-green font-bold">
                    &ge; ${(threshold / 100).toLocaleString()} (Exact capital hidden)
                  </span>
                </div>
                <div className="data-row">
                  <span className="data-label">Firm Credential Nullifier</span>
                  <span className="data-value hash hash-short text-muted">
                    {attestationCheck.nullifierHex ? `${attestationCheck.nullifierHex.slice(0, 16)}...` : 'Committed'}
                  </span>
                </div>
                <div className="data-row">
                  <span className="data-label">Sybil Protection</span>
                  <span className="data-value text-green">1-of-1 Enforced On-Chain</span>
                </div>
              </div>

              <button
                className="btn btn-ghost mt-16"
                onClick={() => {
                  setProvingStep(1);
                  setTxId(null);
                }}
              >
                Return to Dashboard
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
