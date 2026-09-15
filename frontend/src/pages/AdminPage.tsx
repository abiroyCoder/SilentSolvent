import { useState, useEffect } from 'react';
import { CompiledContract } from '@midnight-ntwrk/compact-js';
import { deployContract, submitCallTx } from '@midnight-ntwrk/midnight-js-contracts';
import { Contract, pureCircuits } from '../managed/contract/index.js';
import { useWallet } from '../contexts/WalletContext';
import { getContractAddress, setContractAddress } from '../config';
import { fromHex } from '../lib/midnight';
import { Settings, Shield, PlusCircle, PauseCircle, PlayCircle, RefreshCw } from 'lucide-react';
import { useContractState } from '../hooks/useContractState';

function getCompiledContract() {
  return CompiledContract.make('SilentSolventContract', Contract).pipe(
    CompiledContract.withVacantWitnesses,
    CompiledContract.withCompiledFileAssets(new URL('/managed', window.location.origin).toString()),
  ) as any;
}

export default function AdminPage() {
  const { session, isConnected, connect } = useWallet();
  const [adminSk, setAdminSk] = useState('');
  
  // Deploy State
  const [deployThreshold, setDeployThreshold] = useState('5000000');
  const [deployCap, setDeployCap] = useState('50');
  const [deployStatus, setDeployStatus] = useState('');
  const [isDeploying, setIsDeploying] = useState(false);

  // Live State
  const [activeContract, setActiveContract] = useState(getContractAddress());
  const { ledgerState, isLoading: isLoadingLedger, refetch } = useContractState(3000, activeContract);

  const generateRandomHex = () => Array.from(crypto.getRandomValues(new Uint8Array(32)))
    .map(b => b.toString(16).padStart(2, '0')).join('');

  useEffect(() => {
    setAdminSk(generateRandomHex());
  }, []);

  const handleDeploy = async () => {
    if (!session) return setDeployStatus('Connect wallet first.');
    setIsDeploying(true);
    setDeployStatus('Deploying contract to Midnight network...');
    
    try {
      const skBytes = fromHex(adminSk);
      const adminHash = (pureCircuits as any).admin_public_key(skBytes);
      const sessionId = fromHex(generateRandomHex());
      const brokerId = fromHex(generateRandomHex());
      const deadline = BigInt(Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60); // 7 days
      const threshold = BigInt(deployThreshold.replace(/[^0-9]/g, ''));
      const cap = BigInt(deployCap.replace(/[^0-9]/g, ''));

      const deployed = await deployContract(session.providers as any, {
        privateStateId: 'silentsolvent-admin',
        compiledContract: getCompiledContract(),
        initialPrivateState: {},
        args: [threshold, sessionId, deadline, brokerId, adminHash, cap]
      });

      const newAddress = deployed.deployTxData.public.contractAddress;
      setContractAddress(newAddress);
      setActiveContract(newAddress);
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
      await submitCallTx(session.providers as any, { contractAddress: activeContract } as any, {
        circuitId: circuit,
        witnesses: { admin_secret: () => fromHex(adminSk) },
        args: []
      });
      setDeployStatus(`Session ${isCurrentlyActive ? 'paused' : 'resumed'}.`);
      setTimeout(refetch, 3000);
    } catch (e: any) {
      setDeployStatus(`Failed: ${e.message}`);
    }
  };

  return (
    <div className="page page-wide">
      <div className="card-title mb-24 flex items-center gap-8 text-[16px]"><Settings size={18}/> Admin Controls</div>
      
      {!isConnected && (
        <div className="notice notice-info mb-24">
          Connect your wallet to deploy or manage trade sessions.
          <button className="btn btn-sm ml-auto" onClick={() => connect()}>Connect</button>
        </div>
      )}

      <div className="grid-2">
        {/* DEPLOY PANEL */}
        <div className="card">
          <div className="card-header border-b border-[var(--border)] pb-16">
            <div className="card-title flex items-center gap-8"><PlusCircle size={14}/> Deploy New Session</div>
          </div>
          
          <div className="flex-col gap-16 mt-16">
            <div className="input-group">
              <label className="input-label">Admin Secret Key (Hex)</label>
              <input type="text" className="input mono" value={adminSk} onChange={e => setAdminSk(e.target.value)} />
              <div className="text-[11px] text-muted">Save this key. It is required to pause or update the session later.</div>
            </div>
            
            <div className="grid-2">
              <div className="input-group">
                <label className="input-label">Threshold (Cents)</label>
                <input type="text" className="input mono" value={deployThreshold} onChange={e => setDeployThreshold(e.target.value)} />
              </div>
              <div className="input-group">
                <label className="input-label">Attestation Cap</label>
                <input type="text" className="input mono" value={deployCap} onChange={e => setDeployCap(e.target.value)} />
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
              </div>
            )}
          </div>
        </div>

        {/* MANAGE PANEL */}
        <div className="card">
          <div className="card-header border-b border-[var(--border)] pb-16">
            <div className="card-title flex items-center gap-8 justify-between w-full">
              <span className="flex items-center gap-8"><Shield size={14}/> Manage Active Session</span>
              <button className="btn btn-ghost btn-sm p-0" onClick={() => refetch()}><RefreshCw size={14}/></button>
            </div>
          </div>

          <div className="flex-col gap-16 mt-16">
            <div className="input-group">
              <label className="input-label">Active Contract Address</label>
              <div className="flex gap-8">
                <input type="text" className="input mono flex-1 text-accent" value={activeContract} onChange={e => setActiveContract(e.target.value)} />
                <button className="btn" onClick={() => setContractAddress(activeContract)}>Save</button>
              </div>
            </div>

            {isLoadingLedger ? (
              <div className="flex items-center gap-8 text-muted mt-16"><div className="spinner"/> Reading chain state...</div>
            ) : ledgerState ? (
              <div className="card bg-[var(--bg-0)] mt-8">
                <div className="data-row">
                  <span className="data-label">Status</span>
                  {ledgerState.is_active ? <span className="status status-active">Active</span> : <span className="status status-paused">Paused</span>}
                </div>
                <div className="data-row">
                  <span className="data-label">Threshold</span>
                  <span className="data-value">${(Number(ledgerState.min_solvency_threshold)/100).toLocaleString()}</span>
                </div>
                <div className="data-row">
                  <span className="data-label">Attestations</span>
                  <span className="data-value">{ledgerState.total_attestations?.toString()} / {ledgerState.max_attestations?.toString()}</span>
                </div>
                
                <div className="flex gap-12 mt-16">
                  {ledgerState.is_active ? (
                    <button className="btn btn-danger flex-1" onClick={handleTogglePause} disabled={!isConnected}>
                      <PauseCircle size={14}/> Pause Session
                    </button>
                  ) : (
                    <button className="btn btn-success flex-1" onClick={handleTogglePause} disabled={!isConnected}>
                      <PlayCircle size={14}/> Resume Session
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
