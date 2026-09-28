import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { WebSocket } from 'ws';
import { mnemonicToSeedSync } from '@scure/bip39';
import { HDWallet, Roles } from '@midnight-ntwrk/wallet-sdk/hd';
import { ShieldedWallet } from '@midnight-ntwrk/wallet-sdk/shielded';
import { UnshieldedWallet, createKeystore, PublicKey } from '@midnight-ntwrk/wallet-sdk/unshielded';
import { DustWallet } from '@midnight-ntwrk/wallet-sdk/dust';
import { WalletFacade } from '@midnight-ntwrk/wallet-sdk/facade';
import { NoOpTransactionHistoryStorage } from '@midnight-ntwrk/wallet-sdk-abstractions';
import * as ledger from '@midnight-ntwrk/midnight-js-protocol/ledger';
import { CompiledContract } from '@midnight-ntwrk/midnight-js-protocol/compact-js';
import { sampleSigningKey } from '@midnight-ntwrk/midnight-js-protocol/compact-runtime';
import { createUnprovenDeployTx, submitTxAsync } from '@midnight-ntwrk/midnight-js-contracts';
import { NodeZkConfigProvider } from '@midnight-ntwrk/midnight-js-node-zk-config-provider';
import { httpClientProofProvider } from '@midnight-ntwrk/midnight-js-http-client-proof-provider';
import { indexerPublicDataProvider } from '@midnight-ntwrk/midnight-js-indexer-public-data-provider';
import { setNetworkId } from '@midnight-ntwrk/midnight-js-network-id';
import { Contract, ledger as decodeLedger } from '../contracts/managed/silentsolvent/contract/index.js';
import { PREPROD_CONFIG } from '../src/config.js';

const PRIVATE_STATE_ID = 'silentsolvent-deployment-state';
const ZK_PATH = fileURLToPath(new URL('../contracts/managed/silentsolvent', import.meta.url));
const TTL_MS = 30 * 60 * 1000;

function bytes32(value: string | undefined, name: string): Uint8Array {
  if (!value || !/^(?:0x)?[0-9a-fA-F]{64}$/.test(value)) {
    throw new Error(`${name} must be supplied as exactly 32 bytes of hex`);
  }
  return Uint8Array.from(Buffer.from(value.replace(/^0x/i, ''), 'hex'));
}

function randomBytes32(): Uint8Array {
  return new Uint8Array(crypto.randomBytes(32));
}

function memoryPrivateStateProvider() {
  const states = new Map<string, unknown>();
  const signingKeys = new Map<string, unknown>();
  return {
    setContractAddress: (_address: string) => undefined,
    set: async (id: string, value: unknown) => { states.set(id, value); },
    get: async (id: string) => states.get(id) ?? null,
    remove: async (id: string) => { states.delete(id); },
    clear: async () => { states.clear(); signingKeys.clear(); },
    setSigningKey: async (address: string, key: unknown) => { signingKeys.set(address, key); },
    getSigningKey: async (address: string) => signingKeys.get(address) ?? null,
    removeSigningKey: async (address: string) => { signingKeys.delete(address); },
    clearSigningKeys: async () => { signingKeys.clear(); },
  };
}

async function providerInfo(): Promise<any> {
  const api = process.env.ATTESTATION_API_URL;
  if (!api) throw new Error('ATTESTATION_API_URL is required; deployment must pin a registered provider');
  const response = await fetch(`${api.replace(/\/$/, '')}/provider-info`, { cache: 'no-store' });
  const info = await response.json();
  if (!response.ok || !info.publicKey || !info.assetId || !info.issuerId) {
    throw new Error(info.error || 'Attestation provider identity could not be loaded');
  }
  return info;
}

function buildCompiledContract(adminSecret: Uint8Array, zkConfigPath: string) {
  const witnesses = {
    get_balance_attestation: () => [{}, undefined],
    get_firm_secret: () => [{}, new Uint8Array(32)],
    admin_secret: () => [{}, adminSecret],
    getSchnorrReduction: () => [{}, [0n, 0n]],
  };
  return CompiledContract.make('SilentSolventContract', Contract).pipe(
    CompiledContract.withWitnesses(witnesses as any),
    CompiledContract.withCompiledFileAssets(zkConfigPath),
  ) as any;
}

export async function deploySilentSolventPreprod() {
  const mnemonic = process.env.MIDNIGHT_PREPROD_MNEMONIC;
  if (!mnemonic) throw new Error('MIDNIGHT_PREPROD_MNEMONIC is required and is read only from the environment');
  if (!process.env.MIDNIGHT_PROOF_SERVER) throw new Error('MIDNIGHT_PROOF_SERVER must point to a real Preprod proof server');

  const info = await providerInfo();
  const adminSecret = bytes32(process.env.SILENTSOLVENT_ADMIN_SECRET_HEX, 'SILENTSOLVENT_ADMIN_SECRET_HEX');
  const adminHash = (await import('../contracts/managed/silentsolvent/contract/index.js')).pureCircuits.admin_public_key(adminSecret);
  const sessionId = randomBytes32();
  const brokerId = randomBytes32();
  const threshold = BigInt(process.env.SILENTSOLVENT_THRESHOLD ?? '5000000');
  const cap = BigInt(process.env.SILENTSOLVENT_ATTESTATION_CAP ?? '50');
  const deadline = BigInt(Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60);
  const providerKey = { x: BigInt(info.publicKey.x), y: BigInt(info.publicKey.y) };
  const networkId = 'preprod' as any;

  setNetworkId(networkId);
  globalThis.WebSocket = WebSocket as any;
  const seed = mnemonicToSeedSync(mnemonic);
  const hd = HDWallet.fromSeed(seed);
  if (hd.type !== 'seedOk') throw new Error('Invalid Preprod mnemonic');
  const derived = hd.hdWallet.selectAccount(0)
    .selectRoles([Roles.Zswap, Roles.NightExternal, Roles.Dust])
    .deriveKeysAt(0);
  if (derived.type !== 'keysDerived') throw new Error('Could not derive wallet keys');

  const keys = derived.keys;
  const shieldedSecretKeys: any = ledger.ZswapSecretKeys.fromSeed(keys[Roles.Zswap]);
  const dustSecretKey: any = ledger.DustSecretKey.fromSeed(keys[Roles.Dust]);
  const configuration: any = {
    networkId,
    indexerClientConnection: { indexerHttpUrl: PREPROD_CONFIG.indexer, indexerWsUrl: PREPROD_CONFIG.indexerWS },
    provingServerUrl: new URL(process.env.MIDNIGHT_PROOF_SERVER),
    relayURL: new URL(PREPROD_CONFIG.nodeWS),
    txHistoryStorage: new NoOpTransactionHistoryStorage(),
    costParameters: { additionalFeeOverhead: 300_000_000_000_000n, feeBlocksMargin: 5 },
  };
  const unshieldedKeystore = createKeystore(keys[Roles.NightExternal], networkId);
  const shielded = ShieldedWallet(configuration).startWithSecretKeys(shieldedSecretKeys);
  const unshielded = UnshieldedWallet(configuration).startWithPublicKey(PublicKey.fromKeyStore(unshieldedKeystore));
  const dust = DustWallet(configuration).startWithSecretKey(dustSecretKey, ledger.LedgerParameters.initialParameters().dust);
  const wallet = await WalletFacade.init({
    configuration,
    shielded: () => shielded,
    unshielded: () => unshielded,
    dust: () => dust,
  });

  try {
    await wallet.start(shieldedSecretKeys, dustSecretKey);
    const state = await wallet.waitForSyncedState();
    if (!state.isSynced) throw new Error('Preprod wallet did not reach a synced state');
    const walletProvider = {
      getCoinPublicKey: () => state.shielded.coinPublicKey.toHexString(),
      getEncryptionPublicKey: () => state.shielded.encryptionPublicKey.toHexString(),
      balanceTx: async (tx: any) => {
        const recipe = await wallet.balanceUnboundTransaction(tx, {
          shieldedSecretKeys,
          dustSecretKey,
        }, { ttl: new Date(Date.now() + TTL_MS) });
        const signedRecipe = await wallet.signRecipe(recipe, (data) => unshieldedKeystore.signData(data));
        return wallet.finalizeRecipe(signedRecipe);
      },
    };
    const midnightProvider = {
      submitTx: async (tx: any) => wallet.submitTransaction(tx),
    };
    const publicDataProvider = indexerPublicDataProvider(PREPROD_CONFIG.indexer, PREPROD_CONFIG.indexerWS);
    const zkConfigProvider = new NodeZkConfigProvider(ZK_PATH);
    const providers: any = {
      privateStateProvider: memoryPrivateStateProvider(),
      publicDataProvider,
      zkConfigProvider,
      proofProvider: httpClientProofProvider(process.env.MIDNIGHT_PROOF_SERVER, zkConfigProvider),
      walletProvider,
      midnightProvider,
    };
    const compiledContract = buildCompiledContract(adminSecret, ZK_PATH);
    const deployTxData = await createUnprovenDeployTx(
      { zkConfigProvider: providers.zkConfigProvider, walletProvider } as any,
      {
        compiledContract,
        initialPrivateState: {},
        signingKey: sampleSigningKey(),
        args: [threshold, sessionId, deadline, brokerId, adminHash, cap, bytes32(info.assetId, 'assetId'), bytes32(info.issuerId, 'issuerId'), providerKey, 900n],
      } as any,
    );
    const contractAddress = deployTxData.public.contractAddress;
    const submitted = await submitTxAsync(providers, { unprovenTx: deployTxData.private.unprovenTx } as any);
    if (!submitted) throw new Error('Preprod wallet returned no deployment transaction id');
    const finalized = await publicDataProvider.watchForTxData(submitted);
    if (finalized?.status !== 'SucceedEntirely') throw new Error(`Deployment transaction failed: ${String(finalized?.status)}`);

    let indexedState: any = null;
    for (let attempt = 0; attempt < 60; attempt += 1) {
      const stateResult = await publicDataProvider.queryContractState(contractAddress, { blockHeight: undefined } as any).catch(() => null);
      if (stateResult?.data) {
        indexedState = decodeLedger(stateResult.data);
        break;
      }
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }
    if (!indexedState) throw new Error('Deployment finalized but contract state was not indexed');
    if (toHex(indexedState.asset_id) !== toHex(bytes32(info.assetId, 'assetId'))) throw new Error('Indexed asset does not match deployment');

    const record = {
      network: 'preprod',
      contractAddress,
      deploymentTransaction: submitted,
      deployedAt: new Date().toISOString(),
      adminCommitment: Buffer.from(adminHash).toString('hex'),
      assetId: info.assetId,
      issuerId: info.issuerId,
      threshold: threshold.toString(),
      cap: cap.toString(),
      status: 'CONFIRMED_ON_CHAIN',
    };
    console.log(JSON.stringify(record, null, 2));
    return record;
  } finally {
    hd.hdWallet.clear();
    await wallet.stop();
  }
}

function toHex(value: Uint8Array): string {
  return Buffer.from(value).toString('hex');
}

if (process.argv[1]?.endsWith('deploy-preprod.ts')) {
  deploySilentSolventPreprod().catch((error) => {
    console.error(`Preprod deployment failed: ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  });
}
