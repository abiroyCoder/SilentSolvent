import '../polyfills';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { CompiledContract } from '@midnight-ntwrk/compact-js';
import { createUnprovenCallTx, submitTxAsync } from '@midnight-ntwrk/midnight-js-contracts';
import { Contract, ledger } from '../managed/contract/index.js';
import { useWallet } from '../contexts/WalletContext';
import { getContractAddress, getExplorerTxUrl } from '../config';
import { fromHex, toHex, waitForSuccessfulTransactionAndState } from '../lib/midnight';
import {
  getOrCreatePersistentFirmCredential,
  saveFirmCredential,
  checkAttestationStatus,
  deriveFirmCommitment,
  type FirmCredential,
} from '../lib/credentials';
import {
  fetchFreshCustodianAttestation,
  type AuthenticatedBalanceResult,
} from '../lib/balanceSources';
import { useContractState } from '../hooks/useContractState';
import {
  AlertCircle,
  ArrowRight,
  Check,
  CheckCircle2,
  Clock,
  Copy,
  ExternalLink,
  FileCheck,
  Fingerprint,
  Lock,
  RefreshCw,
  ShieldAlert,
} from 'lucide-react';

const TWO_248 = 2n ** 248n;

function getCompiledContract(customWitnesses: Record<string, any>) {
  return CompiledContract.make('SilentSolventContract', Contract).pipe(
    CompiledContract.withWitnesses(customWitnesses),
    CompiledContract.withCompiledFileAssets(new URL('/managed', window.location.origin).toString()),
  ) as any;
}

function circuitAttestation(attestation: AuthenticatedBalanceResult['attestation']) {
  return {
    asset_id: fromHex(attestation.assetId),
    issuer_id: fromHex(attestation.issuerId),
    session_id: fromHex(attestation.sessionId),
    firm_commitment: fromHex(attestation.firmCommitment),
    balance: BigInt(attestation.balance),
    issued_at: BigInt(attestation.issuedAt),
    expires_at: BigInt(attestation.expiresAt),
    nonce: fromHex(attestation.nonce),
    signature: {
      announcement: {
        x: BigInt(attestation.signature.announcement.x),
        y: BigInt(attestation.signature.announcement.y),
      },
      response: BigInt(attestation.signature.response),
    },
  };
}

export default function VerifyPage() {
  const { session, isConnected, connect, isConnecting, walletStatus, address } = useWallet();
  const [firmCredential, setFirmCredential] = useState<FirmCredential>(() => getOrCreatePersistentFirmCredential());
  const [inputSk, setInputSk] = useState(firmCredential.secretKey);
  const [isEditingCredential, setIsEditingCredential] = useState(false);
  const [copiedFirmId, setCopiedFirmId] = useState(false);
  const [authBalance, setAuthBalance] = useState<AuthenticatedBalanceResult | null>(null);
  const [isLoadingAttestation, setIsLoadingAttestation] = useState(false);
  const [provingStep, setProvingStep] = useState(1);
  const [provingPhase, setProvingPhase] = useState('');
  const [txId, setTxId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const { ledgerState, isLoading: isLoadingLedger, refetch } = useContractState(3000);

  const attestationCheck = checkAttestationStatus(firmCredential.secretKey, ledgerState);
  const hasAlreadyAttested = attestationCheck.hasAttested;
  const threshold = BigInt(ledgerState?.min_solvency_threshold ?? 0);
  const balance = authBalance?.balanceCents ?? 0n;
  const hasEnoughBalance = Boolean(authBalance?.isVerified && balance >= threshold);

  useEffect(() => {
    // A fresh page load has no attestation by design.  Do not reuse a stale
    // browser payload or manufacture a balance while the indexer is offline.
    setAuthBalance(null);
    setTxId(null);
    setProvingStep(1);
  }, [ledgerState?.trade_session_id && toHex(ledgerState.trade_session_id), firmCredential.firmIdCommitment]);

  const refreshAttestation = useCallback(async () => {
    if (!ledgerState) return setErrorMsg('Waiting for the active session state.');
    setIsLoadingAttestation(true);
    setErrorMsg(null);
    try {
      const result = await fetchFreshCustodianAttestation({
        assetId: toHex(ledgerState.asset_id),
        issuerId: toHex(ledgerState.attestation_issuer_id),
        sessionId: toHex(ledgerState.trade_session_id),
        firmCommitment: firmCredential.firmIdCommitment,
      });
      setAuthBalance(result);
      setProvingStep(1);
    } catch (error: any) {
      setAuthBalance(null);
      setErrorMsg(error.message || 'The custodian did not return a fresh signed attestation.');
    } finally {
      setIsLoadingAttestation(false);
    }
  }, [ledgerState, firmCredential.firmIdCommitment]);

  const handleSaveCredential = () => {
    try {
      const updated: FirmCredential = {
        secretKey: inputSk.trim().toLowerCase(),
        firmIdCommitment: deriveFirmCommitment(inputSk.trim().toLowerCase()),
        label: 'In-memory imported credential',
        createdAt: Date.now(),
      };
      saveFirmCredential(updated);
      setFirmCredential(updated);
      setIsEditingCredential(false);
      setAuthBalance(null);
      setErrorMsg(null);
    } catch (error: any) {
      setErrorMsg(error.message);
    }
  };

  const handleCopyFirmId = async () => {
    await navigator.clipboard.writeText(firmCredential.firmIdCommitment);
    setCopiedFirmId(true);
    setTimeout(() => setCopiedFirmId(false), 2000);
  };

  const handleProve = useCallback(async () => {
    if (!session || !isConnected) return setErrorMsg('Connect a Midnight Preprod wallet first.');
    if (!ledgerState) return setErrorMsg('Failed to load the active session from the indexer.');
    if (!ledgerState.is_active) return setErrorMsg('This trade session is paused.');
    if (hasAlreadyAttested) return setErrorMsg('This in-memory firm credential already attested in the active session.');
    if (!authBalance?.attestation || !authBalance.isVerified) {
      return setErrorMsg('Fetch a fresh signed custodian attestation before proving.');
    }
    if (!hasEnoughBalance) {
      return setErrorMsg('The signed custodian balance does not meet the session threshold.');
    }

    const contractAddress = getContractAddress();
    const expectedCount = BigInt(ledgerState.total_attestations ?? 0) + 1n;
    const firmSecret = fromHex(firmCredential.secretKey);
    const signedAttestation = circuitAttestation(authBalance.attestation);
    const witnesses = {
      get_balance_attestation: () => [{}, signedAttestation],
      get_firm_secret: () => [{}, firmSecret],
      admin_secret: () => [{}, new Uint8Array(32)],
      getSchnorrReduction: (_ctx: any, challengeHash: bigint) => {
        const challenge = BigInt(challengeHash);
        return [{}, [challenge / TWO_248, challenge % TWO_248]];
      },
    };

    setProvingStep(2);
    setProvingPhase('Generating proof over the fresh custodian signature...');
    setErrorMsg(null);
    setTxId(null);
    try {
      const callTxData = await createUnprovenCallTx(session.providers as any, {
        compiledContract: getCompiledContract(witnesses),
        contractAddress,
        circuitId: 'verify_solvency',
        args: [],
      } as any);
      const submitted = await submitTxAsync(session.providers as any, {
        unprovenTx: callTxData.private.unprovenTx,
        circuitId: 'verify_solvency',
      } as any);
      const submittedTxId = typeof submitted === 'string' ? submitted : '';
      if (!submittedTxId) throw new Error('Wallet submission did not return a transaction id.');
      setProvingPhase('Waiting for Preprod indexer finality...');

      await waitForSuccessfulTransactionAndState(
        session.providers.publicDataProvider,
        submittedTxId,
        async () => {
          const state = await session.providers.publicDataProvider.queryContractState(contractAddress);
          return state?.data ? ledger(state.data) : null;
        },
        (state) => BigInt(state?.total_attestations ?? 0) >= expectedCount,
      );
      setTxId(submittedTxId);
      setProvingPhase('Attestation confirmed by the Preprod indexer.');
      setProvingStep(3);
      await refetch();
    } catch (error: any) {
      setProvingStep(1);
      setProvingPhase('');
      setErrorMsg(error.message || 'Proof generation or indexed transaction confirmation failed.');
    }
  }, [session, isConnected, ledgerState, hasAlreadyAttested, authBalance, hasEnoughBalance, firmCredential, refetch]);

  const formattedThreshold = useMemo(() => threshold.toString(), [threshold]);

  return (
    <div className="page page-wide">
      <div className="verify-layout">
        <div className="flex-col gap-16">
          <div className="card">
            <div className="card-header">
              <div className="card-title">Trade Session (Public Ledger)</div>
              {ledgerState?.is_active ? <span className="status status-active">Active</span> : <span className="status status-paused">Paused</span>}
            </div>
            {isLoadingLedger ? <div className="text-muted"><div className="spinner mb-8" /> Loading indexed state...</div> : !ledgerState ? (
              <div className="notice notice-error">Contract state is unavailable. No proof can be generated.</div>
            ) : (
              <div className="flex-col gap-12">
                <div className="data-row"><span className="data-label">Asset</span><span className="data-value hash hash-short">{toHex(ledgerState.asset_id)}</span></div>
                <div className="data-row"><span className="data-label">Threshold (asset units)</span><span className="data-value text-accent font-bold">{formattedThreshold}</span></div>
                <div className="data-row"><span className="data-label">Session ID</span><span className="data-value hash hash-short">{toHex(ledgerState.trade_session_id).slice(0, 16)}...</span></div>
                <div className="data-row"><span className="data-label">Attestations</span><span className="data-value">{ledgerState.total_attestations?.toString()} / {ledgerState.max_attestations?.toString()}</span></div>
                <div className="data-row"><span className="data-label">Deadline</span><span className="data-value flex items-center gap-4"><Clock size={14} />{new Date(Number(ledgerState.session_deadline) * 1000).toLocaleString()}</span></div>
              </div>
            )}
          </div>

          <div className="card">
            <div className="card-title mb-12 flex items-center gap-8 text-[14px]"><Fingerprint size={16} /> Credential Solvency Status</div>
            {hasAlreadyAttested ? (
              <div className="p-12 rounded border bg-green-dim border-[var(--green)] flex-col gap-6 text-[12px] text-green">
                <div className="flex items-center gap-8 font-bold"><CheckCircle2 size={16} /> Attestation recorded on chain</div>
                <div className="text-muted text-[11px] font-mono break-all">Session nullifier: {attestationCheck.nullifierHex.slice(0, 24)}...</div>
              </div>
            ) : <div className="p-12 rounded border border-[var(--border)] text-[12px] text-muted"><AlertCircle size={14} className="text-accent" /> Ready for one fresh attestation.</div>}
          </div>

          <div className="card">
            <div className="card-title mb-16 flex items-center gap-8 text-[14px]"><Lock size={16} /> Privacy and trust boundary</div>
            <div className="flex-col gap-8 text-[12px]">
              <div className="flex justify-between text-muted mb-8 pb-8 border-b border-[var(--border)]"><span>PUBLIC LEDGER</span><span>PRIVATE PROOF INPUT</span></div>
              <div className="flex justify-between"><span className="text-accent">Asset, issuer, threshold, session</span><span className="text-green font-medium">Signed balance snapshot</span></div>
              <div className="flex justify-between"><span className="text-accent">Attestation nullifier + counter</span><span className="text-green font-medium">Firm secret + Schnorr signature</span></div>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-header"><div className="card-title">Fresh Custodian Attestation</div><div className="privacy-strip"><Lock size={14} /> No fallback balance</div></div>
          <div className="steps mt-16"><div className={`step ${provingStep >= 1 ? 'done' : ''}`}><div className="step-num">1</div> Authenticate</div><div className={`step ${provingStep > 1 ? 'done' : provingStep === 1 ? 'active' : ''}`}><div className="step-num">2</div> Prove</div><div className={`step ${provingStep === 3 ? 'done' : ''}`}><div className="step-num">3</div> Confirm</div></div>
          {errorMsg && <div className="notice notice-error mb-16 mt-16"><ShieldAlert size={16} /> {errorMsg}</div>}

          <div className="flex-col gap-20 mt-20">
            {!isConnected ? (
              <div className="flex-col gap-12 p-16 border border-[var(--border)] rounded bg-[var(--bg-0)]"><div className="font-semibold text-[14px]">Connect Midnight Preprod wallet</div><p className="text-secondary text-[13px]">A wallet connection is required for proving and submitting the transaction.</p><button className="btn btn-primary" onClick={() => connect()} disabled={isConnecting || walletStatus === 'not-found'}>{isConnecting ? 'Connecting...' : walletStatus === 'not-found' ? 'No Wallet Detected' : 'Connect Wallet'}</button></div>
            ) : <div className="flex justify-between items-center p-12 rounded border border-[var(--border)] bg-green-dim/30 text-[13px]"><span><CheckCircle2 size={16} className="text-green inline mr-8" />Connected: {address?.slice(0, 16)}...</span><span className="badge badge-success text-[11px]">Preprod</span></div>}

            <div className="p-16 border border-[var(--border)] rounded bg-[var(--bg-0)] flex-col gap-12">
              <div className="flex justify-between items-center"><div className="font-semibold text-[14px] flex items-center gap-6"><Fingerprint size={16} className="text-accent" /> In-memory firm credential</div><div className="flex gap-8"><button className="text-[11px] text-accent hover:underline flex items-center gap-2" onClick={handleCopyFirmId}>{copiedFirmId ? <Check size={12} /> : <Copy size={12} />}{copiedFirmId ? 'Copied' : 'Copy commitment'}</button><button className="text-[11px] text-muted hover:text-white" onClick={() => setIsEditingCredential(!isEditingCredential)}>{isEditingCredential ? 'Cancel' : 'Rotate / import'}</button></div></div>
              <div className="data-row py-4"><span className="data-label text-[12px]">Firm commitment</span><span className="data-value hash hash-short text-[12px] mono">{firmCredential.firmIdCommitment.slice(0, 20)}...</span></div>
              {isEditingCredential && <div className="flex-col gap-8 mt-8 pt-8 border-t border-[var(--border)]"><label className="text-[11px] text-muted">32-byte secret (held only in memory):</label><input type="text" className="input mono text-[12px]" value={inputSk} onChange={(e) => setInputSk(e.target.value)} /><button className="btn btn-sm btn-primary self-end" onClick={handleSaveCredential}>Apply in memory</button></div>}
              <div className="text-[11px] text-muted">The secret is not written to localStorage, sessionStorage, downloads, or deployment records.</div>
            </div>

            <div className="p-16 border border-[var(--border)] rounded bg-[var(--bg-0)] flex-col gap-12">
              <div className="flex justify-between items-center"><div className="font-semibold text-[14px] flex items-center gap-6"><FileCheck size={16} className="text-accent" /> Signed asset snapshot</div><button className="btn btn-sm" onClick={refreshAttestation} disabled={isLoadingAttestation || !ledgerState || hasAlreadyAttested}><RefreshCw size={13} className={isLoadingAttestation ? 'animate-spin' : ''} /> {isLoadingAttestation ? 'Fetching...' : 'Fetch fresh attestation'}</button></div>
              {!authBalance ? <div className="p-12 rounded border border-dashed border-[var(--border)] text-[12px] text-muted">No balance is loaded. The custodian gateway must return a fresh signed snapshot for this exact asset, session, and firm commitment.</div> : <div className="p-12 rounded border border-green-500/30 bg-green-dim/20 flex-col gap-6"><div className="flex justify-between items-center"><span className="text-[12px] text-muted">Attested asset balance</span><span className="text-[17px] font-bold text-green font-mono">{authBalance.formattedBalance}</span></div><div className="text-[11px] text-muted">{authBalance.verificationDetails}</div><div className="text-[10px] font-mono text-muted">Expires: {new Date(authBalance.attestation.expiresAt * 1000).toLocaleString()}</div></div>}
            </div>

            <button className="btn btn-primary mt-8 w-full" onClick={handleProve} disabled={!isConnected || !hasEnoughBalance || hasAlreadyAttested || !authBalance}>{hasAlreadyAttested ? 'Already attested in this session' : !authBalance ? 'Fetch signed attestation first' : !hasEnoughBalance ? 'Signed balance below threshold' : provingStep === 2 ? 'Waiting for confirmation...' : 'Prove and submit solvency attestation'}<ArrowRight size={16} /></button>
            {provingPhase && <div className="text-muted text-[12px] mono mt-8">{provingPhase}</div>}
            {txId && <div className="notice notice-success mt-12"><CheckCircle2 size={16} /> Confirmed transaction: <a href={getExplorerTxUrl(txId)} target="_blank" rel="noreferrer" className="text-accent hover:underline">{txId.slice(0, 18)}... <ExternalLink size={12} /></a></div>}
          </div>
        </div>
      </div>
    </div>
  );
}
