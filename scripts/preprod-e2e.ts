import { mnemonicToSeedSync } from '@scure/bip39';
import { fileURLToPath } from 'node:url';
import { HDWallet, Roles } from '@midnight-ntwrk/wallet-sdk/hd';
import { ShieldedWallet } from '@midnight-ntwrk/wallet-sdk/shielded';
import { UnshieldedWallet, createKeystore, PublicKey } from '@midnight-ntwrk/wallet-sdk/unshielded';
import { DustWallet } from '@midnight-ntwrk/wallet-sdk/dust';
import { WalletFacade } from '@midnight-ntwrk/wallet-sdk/facade';
import { NoOpTransactionHistoryStorage } from '@midnight-ntwrk/wallet-sdk-abstractions';
import * as walletLedger from '@midnight-ntwrk/ledger-v8';
import { CompiledContract } from '@midnight-ntwrk/midnight-js-protocol/compact-js';
import { ContractState } from '@midnight-ntwrk/midnight-js-protocol/compact-runtime';
import { createUnprovenCallTx, submitTxAsync } from '@midnight-ntwrk/midnight-js-contracts';
import { NodeZkConfigProvider } from '@midnight-ntwrk/midnight-js-node-zk-config-provider';
import { httpClientProofProvider } from '@midnight-ntwrk/midnight-js-http-client-proof-provider';
import { indexerPublicDataProvider } from '@midnight-ntwrk/midnight-js-indexer-public-data-provider';
import { setNetworkId } from '@midnight-ntwrk/midnight-js-network-id';
import { Contract, ledger, pureCircuits } from '../contracts/managed/silentsolvent/contract/index.js';
import { PREPROD_CONFIG } from '../src/config.js';

const TWO_248 = 2n ** 248n;

function fromHex(hex: string): Uint8Array {
  const value = hex.replace(/^0x/i, '');
  if (!/^[0-9a-fA-F]{64}$/.test(value)) throw new Error('Expected a 32-byte hexadecimal value');
  return Uint8Array.from(Buffer.from(value, 'hex'));
}
function toHex(value: Uint8Array): string {
  return Buffer.from(value).toString('hex');
}
const zkPath = fileURLToPath(new URL('../contracts/managed/silentsolvent', import.meta.url));

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required for the genuine Preprod E2E`);
  return value;
}

function memoryState() {
  const states = new Map<string, unknown>();
  return {
    setContractAddress: () => undefined,
    set: async (id: string, state: unknown) => states.set(id, state),
    get: async (id: string) => states.get(id) ?? null,
    remove: async (id: string) => states.delete(id),
    clear: async () => states.clear(),
    setSigningKey: async () => undefined,
    getSigningKey: async () => null,
    removeSigningKey: async () => undefined,
    clearSigningKeys: async () => undefined,
  };
}

async function latestState(indexer: string, address: string) {
  const response = await fetch(indexer, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      query: 'query Latest($address: HexEncoded!) { contractAction(address: $address) { state } }',
      variables: { address },
    }),
  });
  const payload = await response.json();
  if (!response.ok || payload.errors?.length) throw new Error(payload.errors?.[0]?.message || `Indexer HTTP ${response.status}`);
  return payload.data?.contractAction?.state ? ledger(ContractState.deserialize(fromHex(payload.data.contractAction.state)).data) : null;
}

export async function runPreprodAttestationE2E() {
  const mnemonic = requireEnv('MIDNIGHT_PREPROD_MNEMONIC');
  const proofServer = requireEnv('MIDNIGHT_PROOF_SERVER');
  const attestationApi = requireEnv('ATTESTATION_API_URL').replace(/\/$/, '');
  const contractAddress = requireEnv('PREPROD_CONTRACT_ADDRESS');
  const firmSecret = fromHex(requireEnv('PREPROD_FIRM_SECRET_HEX'));
  const networkId: any = 'preprod';
  setNetworkId(networkId);

  const provider = indexerPublicDataProvider(PREPROD_CONFIG.indexer, PREPROD_CONFIG.indexerWS);
  const before = await latestState(PREPROD_CONFIG.indexer, contractAddress);
  if (!before) throw new Error('Preprod contract is not indexed');
  const firmCommitment = toHex(pureCircuits.derive_firm_commitment(firmSecret));
  const attestationResponse = await fetch(`${attestationApi}/attest`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      assetId: toHex(before.asset_id),
      issuerId: toHex(before.attestation_issuer_id),
      sessionId: toHex(before.trade_session_id),
      firmCommitment,
    }),
  });
  const attestation = await attestationResponse.json();
  if (!attestationResponse.ok) throw new Error(attestation.error || 'Attestation API rejected the E2E request');

  const hd = HDWallet.fromSeed(mnemonicToSeedSync(mnemonic));
  if (hd.type !== 'seedOk') throw new Error('Invalid Preprod mnemonic');
  const derived = hd.hdWallet.selectAccount(0).selectRoles([Roles.Zswap, Roles.NightExternal, Roles.Dust]).deriveKeysAt(0);
  if (derived.type !== 'keysDerived') throw new Error('Could not derive Preprod wallet keys');
  const keys = derived.keys;
  const shieldedSecretKeys: any = walletLedger.ZswapSecretKeys.fromSeed(keys[Roles.Zswap]);
  const dustSecretKey: any = walletLedger.DustSecretKey.fromSeed(keys[Roles.Dust]);
  const keystore = createKeystore(keys[Roles.NightExternal], networkId);
  const configuration: any = {
    networkId,
    indexerClientConnection: { indexerHttpUrl: PREPROD_CONFIG.indexer, indexerWsUrl: PREPROD_CONFIG.indexerWS },
    provingServerUrl: new URL(proofServer),
    relayURL: new URL(PREPROD_CONFIG.nodeWS),
    txHistoryStorage: new NoOpTransactionHistoryStorage(),
    costParameters: { additionalFeeOverhead: 300_000_000_000_000n, feeBlocksMargin: 5 },
  };
  const shielded = ShieldedWallet(configuration).startWithSecretKeys(shieldedSecretKeys);
  const unshielded = UnshieldedWallet(configuration).startWithPublicKey(PublicKey.fromKeyStore(keystore));
  const dust = DustWallet(configuration).startWithSecretKey(dustSecretKey, walletLedger.LedgerParameters.initialParameters().dust);
  const wallet = await WalletFacade.init({ configuration, shielded: () => shielded, unshielded: () => unshielded, dust: () => dust });
  await wallet.start(shieldedSecretKeys, dustSecretKey);
  try {
    const synced = await wallet.waitForSyncedState();
    if (!synced.isSynced) throw new Error('Preprod wallet did not sync');
    const walletProvider = {
      getCoinPublicKey: () => synced.shielded.coinPublicKey.toHexString(),
      getEncryptionPublicKey: () => synced.shielded.encryptionPublicKey.toHexString(),
      balanceTx: async (tx: any) => {
        const recipe = await wallet.balanceUnboundTransaction(tx, { shieldedSecretKeys, dustSecretKey }, { ttl: new Date(Date.now() + 1_800_000) });
        const signed = await wallet.signRecipe(recipe, (data) => keystore.signData(data));
        return wallet.finalizeRecipe(signed);
      },
    };
    const zkConfigProvider = new NodeZkConfigProvider(zkPath);
    const adminSecret = new Uint8Array(32);
    const attestationWitness = {
      asset_id: fromHex(attestation.assetId),
      issuer_id: fromHex(attestation.issuerId),
      session_id: fromHex(attestation.sessionId),
      firm_commitment: fromHex(attestation.firmCommitment),
      balance: BigInt(attestation.balance),
      issued_at: BigInt(attestation.issuedAt),
      expires_at: BigInt(attestation.expiresAt),
      nonce: fromHex(attestation.nonce),
      signature: {
        announcement: { x: BigInt(attestation.signature.announcement.x), y: BigInt(attestation.signature.announcement.y) },
        response: BigInt(attestation.signature.response),
      },
    };
    const compiled = CompiledContract.make('SilentSolventContract', Contract).pipe(
      CompiledContract.withWitnesses({
        get_balance_attestation: () => [{}, attestationWitness],
        get_firm_secret: () => [{}, firmSecret],
        admin_secret: () => [{}, adminSecret],
        getSchnorrReduction: (_ctx: any, hash: bigint) => [{}, [BigInt(hash) / TWO_248, BigInt(hash) % TWO_248]],
      } as any),
      CompiledContract.withCompiledFileAssets(zkPath),
    ) as any;
    const providers: any = {
      privateStateProvider: memoryState(),
      publicDataProvider: provider,
      zkConfigProvider,
      proofProvider: httpClientProofProvider(proofServer, zkConfigProvider),
      walletProvider,
      midnightProvider: { submitTx: async (tx: any) => wallet.submitTransaction(tx) },
    };
    const call = await createUnprovenCallTx(providers, { compiledContract: compiled, contractAddress, circuitId: 'verify_solvency', args: [] } as any);
    const txId = await submitTxAsync(providers, { unprovenTx: call.private.unprovenTx, circuitId: 'verify_solvency' } as any);
    const finalized = await provider.watchForTxData(txId);
    if (finalized.status !== 'SucceedEntirely') throw new Error(`Attestation transaction failed: ${String(finalized.status)}`);
    for (let i = 0; i < 60; i += 1) {
      const after = await latestState(PREPROD_CONFIG.indexer, contractAddress);
      if (BigInt(after?.total_attestations ?? 0) > BigInt(before.total_attestations ?? 0)) return { txId, status: finalized.status };
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }
    throw new Error('Transaction finalized but the attestation counter did not change');
  } finally {
    hd.hdWallet.clear();
    await wallet.stop();
  }
}

if (process.argv[1]?.endsWith('preprod-e2e.ts')) {
  runPreprodAttestationE2E().then((result) => console.log(JSON.stringify(result, null, 2))).catch((error) => { console.error(error); process.exitCode = 1; });
}
