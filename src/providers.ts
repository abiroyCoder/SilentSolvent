import { NodeZkConfigProvider } from '@midnight-ntwrk/midnight-js-node-zk-config-provider';
import { httpClientProofProvider } from '@midnight-ntwrk/midnight-js-http-client-proof-provider';
import { indexerPublicDataProvider } from '@midnight-ntwrk/midnight-js-indexer-public-data-provider';
import type { NetworkConfig } from './config.js';

export type SilentSolventProviders = {
  privateStateProvider: ReturnType<typeof createMemoryPrivateStateProvider>;
  publicDataProvider: any;
  zkConfigProvider: any;
  proofProvider: any;
  walletProvider: any;
  midnightProvider: any;
};

/** Node-side private state is deliberately process-local until an operator supplies an audited keystore. */
export function createMemoryPrivateStateProvider() {
  const states = new Map<string, unknown>();
  const signingKeys = new Map<string, unknown>();
  return {
    setContractAddress: (_address: string) => undefined,
    async set(id: string, value: unknown) { states.set(id, value); },
    async get(id: string) { return states.get(id) ?? null; },
    async remove(id: string) { states.delete(id); },
    async clear() { states.clear(); signingKeys.clear(); },
    async setSigningKey(address: string, key: unknown) { signingKeys.set(address, key); },
    async getSigningKey(address: string) { return signingKeys.get(address) ?? null; },
    async removeSigningKey(address: string) { signingKeys.delete(address); },
    async clearSigningKeys() { signingKeys.clear(); },
  };
}

export function buildProviders(wallet: any, zkConfigPath: string, config: NetworkConfig): SilentSolventProviders {
  const zkConfigProvider = new NodeZkConfigProvider(zkConfigPath);
  return {
    privateStateProvider: createMemoryPrivateStateProvider(),
    publicDataProvider: indexerPublicDataProvider(config.indexer, config.indexerWS),
    zkConfigProvider,
    proofProvider: httpClientProofProvider(config.proofServer, zkConfigProvider),
    walletProvider: wallet.wallet.walletProvider,
    midnightProvider: wallet.wallet.midnightProvider,
  };
}
