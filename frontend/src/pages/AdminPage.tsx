import '../polyfills';
import { useState, useEffect, useCallback } from 'react';
import { CompiledContract } from '@midnight-ntwrk/compact-js';
import { deployContract, submitCallTx } from '@midnight-ntwrk/midnight-js-contracts';
import { Contract, pureCircuits } from '../managed/contract/index.js';
import { useWallet } from '../contexts/WalletContext';
import { getContractAddress, setContractAddress, getExplorerContractUrl } from '../config';
import { fromHex, toHex } from '../lib/midnight';
import {
  Settings,
  Shield,
  PlusCircle,
  PauseCircle,
  PlayCircle,
  RefreshCw,
  ExternalLink,
  KeyRound,
  CheckCircle,
  AlertTriangle,
  Copy,
  Download,
} from 'lucide-react';
import { useContractState } from '../hooks/useContractState';

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

const STORAGE_ADMIN_SK = 'silentsolvent_admin_sk';

export default function AdminPage() {
  const { session, isConnected, connect } = useWallet();
  const [adminSk, setAdminSk] = useState('');
  const [copiedKey, setCopiedKey] = useState(false);

  // Deploy State
  const [deployThreshold, setDeployThreshold] = useState('5000000');
  const [deployCap, setDeployCap] = useState('50');
  const [deployStatus, setDeployStatus] = useState('');
  const [isDeploying, setIsDeploying] = useState(false);

  // Live State
  const [activeContract, setActiveContract] = useState(getContractAddress());
  const { ledgerState, isLoading: isLoadingLedger, refetch } = useContractState(3000, activeContract);

  const generateRandomHex = () =>
    Array.from(crypto.getRandomValues(new Uint8Array(32)))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');

  // Recover saved admin credential from secure storage on mount / contract change
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const contractSpecificKey = localStorage.getItem(`${STORAGE_ADMIN_SK}_${activeContract}`);
    const globalKey = localStorage.getItem(STORAGE_ADMIN_SK);

    if (contractSpecificKey && contractSpecificKey.length === 64) {
      setAdminSk(contractSpecificKey);
    } else if (globalKey && globalKey.length === 64) {
      setAdminSk(globalKey);
    } else {
      const newSk = generateRandomHex();
      setAdminSk(newSk);
      localStorage.setItem(STORAGE_ADMIN_SK, newSk);
      localStorage.setItem(`${STORAGE_ADMIN_SK}_${activeContract}`, newSk);
    }
  }, [activeContract]);

  const handleUpdateAdminSk = useCallback(
    (newKey: string) => {
      setAdminSk(newKey);
      if (typeof window !== 'undefined' && newKey.trim().length === 64) {
        localStorage.setItem(STORAGE_ADMIN_SK, newKey.trim());
        localStorage.setItem(`${STORAGE_ADMIN_SK}_${activeContract}`, newKey.trim());
      }
    },
    [activeContract],
  );

  const handleGenerateNewKey = () => {
    const newSk = generateRandomHex();
    handleUpdateAdminSk(newSk);
  };

  const handleCopyKey = () => {
    navigator.clipboard.writeText(adminSk);
    setCopiedKey(true);
    setTimeout(() => setCopiedKey(false), 2000);
  };

  const handleExportKey = () => {
    const payload = JSON.stringify(
      {
        contractAddress: activeContract,
        adminSecretKey: adminSk,
        exportedAt: new Date().toISOString(),
      },
      null,
      2,
    );
    const blob = new Blob([payload], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `silentsolvent-admin-key-${activeContract.slice(0, 8)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Derive admin public key hash from loaded secret key
  let currentAdminHash = '';
  try {
    if (adminSk && adminSk.trim().length === 64) {
      currentAdminHash = toHex((pureCircuits as any).admin_public_key(fromHex(adminSk.trim())));
    }
  } catch {}

  const onChainAdminHash = ledgerState?.admin ? toHex(ledgerState.admin) : '';
  const isAuthorized = Boolean(
    currentAdminHash &&
      onChainAdminHash &&
      currentAdminHash.toLowerCase() === onChainAdminHash.toLowerCase(),
  );

  const handleDeploy = async () => {
    if (!session) return setDeployStatus('Connect wallet first.');
    setIsDeploying(true);
    setDeployStatus('Deploying contract to Midnight network...');

    try {
      const skBytes = fromHex(adminSk.trim());
      const adminHash = (pureCircuits as any).admin_public_key(skBytes);
      const sessionId = fromHex(generateRandomHex());
      const brokerId = fromHex(generateRandomHex());
      const deadline = BigInt(Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60); // 7 days
      const threshold = BigInt(deployThreshold.replace(/[^0-9]/g, ''));
      const cap = BigInt(deployCap.replace(/[^0-9]/g, ''));

      const deployed = await deployContract(session.providers as any, {
        privateStateId: 'silentsolvent-admin',
        compiledContract: getCompiledContract({ admin_secret: (ctx: any) => [ctx.privateState, skBytes] }),
        initialPrivateState: {},
        args: [threshold, sessionId, deadline, brokerId, adminHash, cap],
      });

      const newAddress = deployed.deployTxData.public.contractAddress;
      setContractAddress(newAddress);
      setActiveContract(newAddress);

      // Persist admin secret key paired with the newly deployed contract address
      localStorage.setItem(STORAGE_ADMIN_SK, adminSk.trim());
      localStorage.setItem(`${STORAGE_ADMIN_SK}_${newAddress}`, adminSk.trim());

      setDeployStatus(`Deployed successfully at: ${newAddress}`);
      setTimeout(refetch, 3000); // Wait for indexer
    } catch (e: any) {
      setDeployStatus(`Deploy failed: ${e.message}`);
    } finally {
      setIsDeploying(false);
    }
  };

  const handleTogglePause = async () => {
    if (!session || !ledgerState) return;
    const isCurrentlyActive = ledgerState.is_active;
    const circuit = isCurrentlyActive ? 'pause_session' : 'resume_session';

    try {
      setDeployStatus(`${isCurrentlyActive ? 'Pausing' : 'Resuming'} session...`);
      const skBytes = fromHex(adminSk.trim());
      await submitCallTx(session.providers as any, {
        compiledContract: getCompiledContract({ admin_secret: (ctx: any) => [ctx.privateState, skBytes] }),
        contractAddress: activeContract,
        circuitId: circuit,
        witnesses: { admin_secret: (ctx: any) => [ctx.privateState, skBytes] },
        args: [],
      } as any);
      setDeployStatus(`Session ${isCurrentlyActive ? 'paused' : 'resumed'}.`);
      setTimeout(refetch, 3000);
    } catch (e: any) {
      setDeployStatus(`Failed: ${e.message}`);
    }
  };

  return (
    <div className="page page-wide">
      <div className="card-title mb-24 flex items-center gap-8 text-[16px]">
        <Settings size={18} /> Admin & Broker Desk Controls
      </div>

      {!isConnected && (
        <div className="notice notice-info mb-24">
          Connect your Midnight wallet via official DApp Connector to deploy or manage trade sessions.
          <button className="btn btn-sm ml-auto" onClick={() => connect()}>Connect</button>
        </div>
      )}

      <div className="grid-2">
        {/* DEPLOY PANEL */}
        <div className="card">
          <div className="card-header border-b border-[var(--border)] pb-16">
            <div className="card-title flex items-center gap-8">
              <PlusCircle size={14} /> Deploy New Session
            </div>
          </div>

          <div className="flex-col gap-16 mt-16">
            <div className="input-group">
              <div className="flex justify-between items-center mb-4">
                <label className="input-label flex items-center gap-4">
                  <KeyRound size={12} /> Admin Secret Key (Persistent)
                </label>
                <div className="flex gap-8">
                  <button className="text-[11px] text-accent hover:underline flex items-center gap-2" onClick={handleCopyKey}>
                    <Copy size={11} /> {copiedKey ? 'Copied' : 'Copy'}
                  </button>
                  <button className="text-[11px] text-accent hover:underline flex items-center gap-2" onClick={handleExportKey}>
                    <Download size={11} /> Backup
                  </button>
                  <button className="text-[11px] text-muted hover:text-white" onClick={handleGenerateNewKey}>
                    Regenerate
                  </button>
                </div>
              </div>
              <input
                type="text"
                className="input mono text-[12px]"
                value={adminSk}
                onChange={(e) => handleUpdateAdminSk(e.target.value)}
              />
              <div className="text-[11px] text-muted mt-4">
                ✓ Persisted securely in browser storage. Saved and linked to active contract address.
              </div>
            </div>

            <div className="grid-2">
              <div className="input-group">
                <label className="input-label">Threshold (Cents)</label>
                <input
                  type="text"
                  className="input mono"
                  value={deployThreshold}
                  onChange={(e) => setDeployThreshold(e.target.value)}
                />
              </div>
              <div className="input-group">
                <label className="input-label">Attestation Cap</label>
                <input
                  type="text"
                  className="input mono"
                  value={deployCap}
                  onChange={(e) => setDeployCap(e.target.value)}
                />
              </div>
            </div>

            <button
              className="btn btn-primary mt-8"
              onClick={handleDeploy}
              disabled={isDeploying || !isConnected}
            >
              {isDeploying ? 'Deploying...' : 'Deploy Contract'}
            </button>

            {deployStatus && (
              <div className="notice mt-8 text-[12px] mono break-all">
                {deployStatus}
                {deployStatus.startsWith('Deployed successfully') && (
                  <div className="mt-8">
                    <a
                      href={getExplorerContractUrl(activeContract)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-accent hover:underline inline-flex items-center gap-4 text-[12px]"
                    >
                      View on 1AM Explorer <ExternalLink size={12} />
                    </a>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* MANAGE PANEL */}
        <div className="card">
          <div className="card-header border-b border-[var(--border)] pb-16">
            <div className="card-title flex items-center gap-8 justify-between w-full">
              <span className="flex items-center gap-8">
                <Shield size={14} /> Manage Active Session
              </span>
              <button className="btn btn-ghost btn-sm p-0" onClick={() => refetch()}>
                <RefreshCw size={14} />
              </button>
            </div>
          </div>

          <div className="flex-col gap-16 mt-16">
            <div className="input-group">
              <label className="input-label">Active Contract Address</label>
              <div className="flex gap-8">
                <input
                  type="text"
                  className="input mono flex-1 text-accent text-[12px]"
                  value={activeContract}
                  onChange={(e) => setActiveContract(e.target.value)}
                />
                <button className="btn" onClick={() => setContractAddress(activeContract)}>
                  Save
                </button>
              </div>
            </div>

            {/* Authorization Status Badge */}
            {ledgerState && (
              <div
                className={`p-12 rounded border flex items-center gap-8 text-[12px] ${
                  isAuthorized
                    ? 'bg-green-dim border-[var(--green)] text-green'
                    : 'bg-red-dim border-red-500/30 text-amber-300'
                }`}
              >
                {isAuthorized ? (
                  <>
                    <CheckCircle size={16} />
                    <span>
                      <strong>Admin Authorized:</strong> Your active key matches the on-chain admin commitment.
                    </span>
                  </>
                ) : (
                  <>
                    <AlertTriangle size={16} />
                    <span>
                      <strong>Key Mismatch:</strong> Loaded admin key does not match on-chain contract admin. Import key used at deploy.
                    </span>
                  </>
                )}
              </div>
            )}

            {isLoadingLedger ? (
              <div className="flex items-center gap-8 text-muted mt-16">
                <div className="spinner" /> Reading chain state...
              </div>
            ) : ledgerState ? (
              <div className="card bg-[var(--bg-0)] mt-8">
                <div className="data-row">
                  <span className="data-label">Status</span>
                  {ledgerState.is_active ? (
                    <span className="status status-active">Active</span>
                  ) : (
                    <span className="status status-paused">Paused</span>
                  )}
                </div>
                <div className="data-row">
                  <span className="data-label">Threshold</span>
                  <span className="data-value">
                    ${(Number(ledgerState.min_solvency_threshold) / 100).toLocaleString()}
                  </span>
                </div>
                <div className="data-row">
                  <span className="data-label">Attestations</span>
                  <span className="data-value">
                    {ledgerState.total_attestations?.toString()} / {ledgerState.max_attestations?.toString()}
                  </span>
                </div>

                <div className="flex gap-12 mt-16">
                  {ledgerState.is_active ? (
                    <button
                      className="btn btn-danger flex-1"
                      onClick={handleTogglePause}
                      disabled={!isConnected || !isAuthorized}
                    >
                      <PauseCircle size={14} /> Pause Session
                    </button>
                  ) : (
                    <button
                      className="btn btn-success flex-1"
                      onClick={handleTogglePause}
                      disabled={!isConnected || !isAuthorized}
                    >
                      <PlayCircle size={14} /> Resume Session
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <div className="text-muted text-[13px] mt-16">No contract found at this address.</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
