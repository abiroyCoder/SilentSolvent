import { setNetworkId } from '@midnight-ntwrk/midnight-js-network-id';
import { FetchZkConfigProvider } from '@midnight-ntwrk/midnight-js-fetch-zk-config-provider';
import { indexerPublicDataProvider } from '@midnight-ntwrk/midnight-js-indexer-public-data-provider';
import { ContractState } from '@midnight-ntwrk/compact-runtime';
import type { MidnightProvider, WalletProvider } from '@midnight-ntwrk/midnight-js-types';

/** Hex encoding used at every wallet/indexer boundary. */
export function toHex(bytes: Uint8Array | string | null | undefined): string {
  if (!bytes) return '';
  if (typeof bytes === 'string') return bytes.replace(/^0x/i, '').toLowerCase();
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

export function fromHex(hex: string): Uint8Array {
  const normalized = hex.replace(/^0x/i, '');
  if (!/^[0-9a-fA-F]*$/.test(normalized) || normalized.length % 2 !== 0) {
    throw new Error('Expected an even-length hexadecimal string.');
  }
  const bytes = new Uint8Array(normalized.length / 2);
  for (let i = 0; i < normalized.length; i += 2) {
    bytes[i / 2] = Number.parseInt(normalized.slice(i, i + 2), 16);
  }
  return bytes;
}

/**
 * Remove keys written by pre-prototype builds. New private state and all
 * operator secrets are deliberately memory-only; this is a one-time migration
 * for browsers that ran an older build.
 */
export function purgeLegacySecretStorage(): void {
  if (typeof window === 'undefined') return;
  const legacyExact = new Set([
    'silentsolvent_firm_credential_v1',
    'silentsolvent_admin_sk',
  ]);
  try {
    const keysToRemove: string[] = [];
    for (let i = 0; i < window.localStorage.length; i += 1) {
      const key = window.localStorage.key(i);
      if (
        key &&
        (legacyExact.has(key) ||
          key.startsWith('silentsolvent_admin_sk_') ||
          key.startsWith('silentsolvent_pstate_'))
      ) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach((key) => window.localStorage.removeItem(key));
  } catch {
    // Storage may be blocked. Secrets are never written by this build.
  }
}

export function createPatchedPublicDataProvider(queryUrl: string, subscriptionUrl: string) {
  const base = indexerPublicDataProvider(queryUrl, subscriptionUrl) as any;

  async function queryLatest(query: string, address: string) {
    const response = await fetch(queryUrl, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ query, variables: { address } }),
    });
    if (!response.ok) throw new Error(`Indexer HTTP ${response.status}`);
    const payload = await response.json();
    if (payload.errors?.length) {
      throw new Error(payload.errors.map((error: any) => error.message).join('; '));
    }
    return payload.data?.contractAction ?? null;
  }

  return {
    ...base,
    async queryContractState(contractAddress: string, config?: any) {
      if (config) return base.queryContractState(contractAddress, config);
      const action = await queryLatest(
        `query LATEST_CONTRACT_STATE($address: HexEncoded!) { contractAction(address: $address) { state } }`,
        contractAddress,
      );
      return action?.state ? ContractState.deserialize(fromHex(action.state)) : null;
    },
  };
}

/** No persistence, export, or backup path exists for private state. */
export function createPrivateStateProvider() {
  let scope = '';
  const stateStore = new Map<string, unknown>();
  const signingKeyStore = new Map<string, unknown>();
  const scoped = (id: string) => `${scope}:${id}`;

  return {
    setContractAddress(address: string) {
      scope = address;
    },
    async set(id: string, state: unknown) {
      stateStore.set(scoped(id), state);
    },
    async get(id: string) {
      return stateStore.get(scoped(id)) ?? null;
    },
    async remove(id: string) {
      stateStore.delete(scoped(id));
    },
    async clear() {
      stateStore.clear();
      signingKeyStore.clear();
    },
    async setSigningKey(address: string, key: unknown) {
      signingKeyStore.set(address, key);
    },
    async getSigningKey(address: string) {
      return signingKeyStore.get(address) ?? null;
    },
    async removeSigningKey(address: string) {
      signingKeyStore.delete(address);
    },
    async clearSigningKeys() {
      signingKeyStore.clear();
    },
    async exportPrivateStates(): Promise<never> {
      throw new Error('Private state export is disabled in this prototype.');
    },
    async importPrivateStates(): Promise<never> {
      throw new Error('Private state import is disabled in this prototype.');
    },
    async exportSigningKeys(): Promise<never> {
      throw new Error('Signing-key export is disabled in this prototype.');
    },
    async importSigningKeys(): Promise<never> {
      throw new Error('Signing-key import is disabled in this prototype.');
    },
  };
}

export interface ConnectedSession {
  api: any;
  config: any;
  unshieldedAddress: string;
  shieldedAddress: any;
  providers: {
    privateStateProvider: ReturnType<typeof createPrivateStateProvider>;
    publicDataProvider: any;
    zkConfigProvider: FetchZkConfigProvider;
    proofProvider: { proveTx: (unprovenTx: any, _config?: any) => Promise<any> };
    walletProvider: WalletProvider;
    midnightProvider: MidnightProvider;
  };
}

export function assertPreprodNetwork(config: any): void {
  const network = String(config?.networkId ?? '').toLowerCase();
  if (!network.includes('preprod')) {
    throw new Error(`This prototype only permits Midnight Preprod; wallet reported "${config?.networkId ?? 'unknown'}".`);
  }
}

export async function createConnectedSession(api: any): Promise<ConnectedSession> {
  const [config, unshieldedAddress, shieldedAddress] = await Promise.all([
    api.getConfiguration(),
    api.getUnshieldedAddress(),
    api.getShieldedAddresses(),
  ]);

  assertPreprodNetwork(config);
  setNetworkId(config.networkId);

  const zkConfigProvider = new FetchZkConfigProvider(
    new URL('/managed', window.location.origin).toString(),
    window.fetch.bind(window),
  );
  const provingProvider = await api.getProvingProvider(zkConfigProvider);
  const proofProvider = {
    async proveTx(unprovenTx: any, _config?: any) {
      let CostModelClass: any;
      try {
        const protocolLedger = await import('@midnight-ntwrk/midnight-js-protocol/ledger');
        CostModelClass = protocolLedger.CostModel;
      } catch {
        const ledgerV8 = await import('@midnight-ntwrk/ledger-v8');
        CostModelClass = ledgerV8.CostModel;
      }
      return unprovenTx.prove(provingProvider, CostModelClass.initialCostModel());
    },
  };

  const walletProvider: WalletProvider = {
    getCoinPublicKey: () => shieldedAddress.shieldedCoinPublicKey,
    getEncryptionPublicKey: () => shieldedAddress.shieldedEncryptionPublicKey,
    balanceTx: async (tx: any) => {
      const balanced = await api.balanceUnsealedTransaction(toHex(tx.serialize()));
      if (!balanced?.tx) throw new Error('Wallet did not return a balanced transaction.');
      let TransactionClass: any;
      try {
        const protocolLedger = await import('@midnight-ntwrk/midnight-js-protocol/ledger');
        TransactionClass = protocolLedger.Transaction;
      } catch {
        const ledgerV8 = await import('@midnight-ntwrk/ledger-v8');
        TransactionClass = ledgerV8.Transaction;
      }
      return TransactionClass.deserialize('signature', 'proof', 'binding', fromHex(balanced.tx));
    },
  };

  const midnightProvider: MidnightProvider = {
    submitTx: async (tx: any) => {
      const result = await api.submitTransaction(toHex(tx.serialize()));
      if (typeof result === 'string' && result.length > 0) return result;
      if (result?.transactionId) return result.transactionId;
      if (result?.id) return result.id;

      // Some wallet versions return void. The identifiers belong to the real
      // balanced transaction; never manufacture a hash from serialized bytes.
      const identifiers = typeof tx.identifiers === 'function' ? tx.identifiers() : [];
      if (!Array.isArray(identifiers) || identifiers.length === 0 || !identifiers[0]) {
        throw new Error('Wallet returned no transaction id and the SDK transaction exposed no identifiers.');
      }
      return identifiers[0];
    },
  };

  const publicDataProvider = config?.indexerUri && config?.indexerWsUri
    ? createPatchedPublicDataProvider(config.indexerUri, config.indexerWsUri)
    : await api.getPublicDataProvider?.();
  if (!publicDataProvider) throw new Error('Wallet did not provide an indexer data provider.');

  const unshielded = typeof unshieldedAddress === 'string'
    ? unshieldedAddress
    : unshieldedAddress?.unshieldedAddress || '';

  return {
    api,
    config,
    unshieldedAddress: unshielded,
    shieldedAddress,
    providers: {
      privateStateProvider: createPrivateStateProvider(),
      publicDataProvider,
      zkConfigProvider,
      proofProvider,
      walletProvider,
      midnightProvider,
    },
  };
}

export async function waitForContractDeployment(
  publicDataProvider: any,
  contractAddress: string,
  pollIntervalMs = 2000,
  maxAttempts = 45,
): Promise<void> {
  for (let i = 0; i < maxAttempts; i += 1) {
    const state = await publicDataProvider.queryContractState(contractAddress);
    if (state?.data) return;
    await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
  }
  throw new Error(`Contract was not indexed after ${maxAttempts * pollIntervalMs}ms.`);
}

/**
 * Wait for both indexer transaction success and the exact expected ledger
 * mutation. A wallet acknowledgement alone is never treated as confirmation.
 */
export async function waitForSuccessfulTransactionAndState(
  publicDataProvider: any,
  txId: string,
  readState: () => Promise<any>,
  statePredicate: (state: any) => boolean,
  timeoutMs = 120_000,
  pollIntervalMs = 2000,
): Promise<any> {
  if (!txId) throw new Error('Cannot confirm a transaction without an actual transaction id.');
  if (typeof publicDataProvider.watchForTxData !== 'function') {
    throw new Error('Indexer provider cannot confirm transaction finality.');
  }

  const timeout = new Promise<never>((_, reject) => {
    setTimeout(() => reject(new Error('Timed out waiting for indexer transaction confirmation.')), timeoutMs);
  });
  const finalized = await Promise.race([publicDataProvider.watchForTxData(txId), timeout]);
  if (finalized?.status !== 'SucceedEntirely') {
    throw new Error(`Indexer reported transaction status ${String(finalized?.status ?? 'unknown')}.`);
  }
  if (Array.isArray(finalized.identifiers) && !finalized.identifiers.includes(txId)) {
    throw new Error('Indexer confirmation did not contain the submitted transaction identifier.');
  }

  const attempts = Math.max(1, Math.ceil(timeoutMs / pollIntervalMs));
  for (let i = 0; i < attempts; i += 1) {
    const state = await readState();
    if (statePredicate(state)) return finalized;
    await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
  }
  throw new Error('Transaction was indexed successfully, but the expected contract state change was not observed.');
}
