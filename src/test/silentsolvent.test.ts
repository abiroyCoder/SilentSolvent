import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { WebSocket } from 'ws';
import { setNetworkId } from '@midnight-ntwrk/midnight-js-network-id';
import { deployContract, submitCallTx, type DeployedContract } from '@midnight-ntwrk/midnight-js-contracts';
import type { ContractAddress } from '@midnight-ntwrk/midnight-js-protocol/compact-runtime';
import { type EnvironmentConfiguration, waitForFunds, FluentWalletBuilder } from '@midnight-ntwrk/testkit-js';
import pino from 'pino';
import crypto from 'crypto';
import { getConfig } from '../config.js';
import { buildProviders, type SilentSolventProviders } from '../providers.js';
import { CompiledSilentSolventContract, Contract, ledger, pureCircuits, zkConfigPath } from '../../contracts/index.js';

// @ts-expect-error
globalThis.WebSocket = WebSocket;

const ALICE_SEED = '0000000000000000000000000000000000000000000000000000000000000001';
const PRIVATE_STATE_ID = 'SilentSolventState';
const logger = pino({ level: 'info', transport: { target: 'pino-pretty' } });
const network = process.env['MIDNIGHT_NETWORK'] ?? 'local';

function resolveSecret() {
  if (network === 'local') return { kind: 'seed' as const, value: ALICE_SEED };
  const upper = network.toUpperCase();
  const mnemonic = process.env[`MIDNIGHT_${upper}_MNEMONIC`]?.trim().replace(/\s+/g, ' ');
  const seed = process.env[`MIDNIGHT_${upper}_SEED`]?.trim();
  if (mnemonic && seed) throw new Error('Set only one of mnemonic or seed.');
  if (mnemonic) return { kind: 'mnemonic' as const, value: mnemonic };
  if (seed) return { kind: 'seed' as const, value: seed };
  throw new Error(`Set MIDNIGHT_${upper}_MNEMONIC or MIDNIGHT_${upper}_SEED`);
}

describe(`SilentSolvent (${network})`, () => {
  let wallet: any;
  let providers: SilentSolventProviders;
  let contractAddress: ContractAddress;
  let adminSk: Uint8Array;
  let adminHash: Uint8Array;

  const config = getConfig();
  const secret = resolveSecret();
  const isRemote = config.faucet !== '';

  const sessionId = new Uint8Array(crypto.randomBytes(32));
  const brokerId = new Uint8Array(crypto.randomBytes(32));
  const deadline = BigInt(Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60); // 30 days

  async function queryLedger(p: SilentSolventProviders) {
    const state = await p.publicDataProvider.queryContractState(contractAddress);
    expect(state).not.toBeNull();
    return ledger(state!.data);
  }

  beforeAll(async () => {
    setNetworkId(config.networkId as any);
    const envConfig: EnvironmentConfiguration = {
      walletNetworkId: config.networkId as any,
      networkId: config.networkId as any,
      indexer: config.indexer,
      indexerWS: config.indexerWS,
      node: config.node,
      nodeWS: config.nodeWS,
      faucet: config.faucet,
      proofServer: config.proofServer,
    };

    wallet = secret.kind === 'seed'
      ? await FluentWalletBuilder.newWalletFromSeed(secret.value, envConfig)
      : await FluentWalletBuilder.newWalletFromMnemonic(secret.value, envConfig);

    await wallet.start?.();

    if (isRemote) {
      const balance = await waitForFunds(wallet, envConfig, true, wallet.unshieldedKeystore);
      logger.info(`Balance: ${balance}`);
    }

    providers = buildProviders(wallet, zkConfigPath, config);

    adminSk = new Uint8Array(crypto.randomBytes(32));
    adminHash =
      typeof (pureCircuits as any)?.admin_public_key === 'function'
        ? (pureCircuits as any).admin_public_key(adminSk)
        : new Uint8Array(crypto.randomBytes(32));
  });

  afterAll(async () => { if (wallet) await wallet.stop?.(); });

  it('deploys the contract with session parameters', async () => {
    const deployed: DeployedContract<Contract> = await deployContract<Contract>(providers, {
      compiledContract: CompiledSilentSolventContract,
      privateStateId: PRIVATE_STATE_ID,
      initialPrivateState: {},
      args: [5000000n, sessionId, deadline, brokerId, adminHash, 50n],
    });
    contractAddress = deployed.deployTxData.public.contractAddress;
    logger.info(`Deployed at: ${contractAddress}`);
    expect(contractAddress).toBeDefined();

    const state = await queryLedger(providers);
    expect(state.min_solvency_threshold).toEqual(5000000n);
    expect(state.is_active).toBe(true);
    expect(state.max_attestations).toEqual(50n);
  });

  it('accepts attestation from a solvent firm', async () => {
    const firmSecret = new Uint8Array(crypto.randomBytes(32));

    await submitCallTx<Contract>(providers, { contractAddress } as any, {
      circuitId: 'verify_solvency',
      witnesses: {
        get_liquid_balance: () => 15000000n,
        get_firm_secret: () => firmSecret,
      },
      args: [],
    });

    const state = await queryLedger(providers);
    expect(state.total_attestations).toEqual(1n);
  });

  it('rejects an insolvent firm', async () => {
    const firmSecret = new Uint8Array(crypto.randomBytes(32));

    await expect(
      submitCallTx<Contract>(providers, { contractAddress } as any, {
        circuitId: 'verify_solvency',
        witnesses: {
          get_liquid_balance: () => 1000000n, // below 5M threshold
          get_firm_secret: () => firmSecret,
        },
        args: [],
      }),
    ).rejects.toThrow();
  });

  it('prevents double attestation in the same session', async () => {
    const firmSecret = new Uint8Array(crypto.randomBytes(32));

    // First attestation succeeds
    await submitCallTx<Contract>(providers, { contractAddress } as any, {
      circuitId: 'verify_solvency',
      witnesses: {
        get_liquid_balance: () => 10000000n,
        get_firm_secret: () => firmSecret,
      },
      args: [],
    });

    // Second attestation with same firm secret fails (nullifier collision)
    await expect(
      submitCallTx<Contract>(providers, { contractAddress } as any, {
        circuitId: 'verify_solvency',
        witnesses: {
          get_liquid_balance: () => 10000000n,
          get_firm_secret: () => firmSecret,
        },
        args: [],
      }),
    ).rejects.toThrow();
  });

  it('allows admin to update session parameters', async () => {
    const newSessionId = new Uint8Array(crypto.randomBytes(32));
    const newBrokerId = new Uint8Array(crypto.randomBytes(32));
    const newDeadline = BigInt(Math.floor(Date.now() / 1000) + 60 * 24 * 60 * 60);

    await submitCallTx<Contract>(providers, { contractAddress } as any, {
      circuitId: 'update_session',
      witnesses: { admin_secret: () => adminSk },
      args: [10000000n, newSessionId, newDeadline, newBrokerId, 100n],
    });

    const state = await queryLedger(providers);
    expect(state.min_solvency_threshold).toEqual(10000000n);
    expect(state.max_attestations).toEqual(100n);
  });

  it('allows admin to pause and resume the session', async () => {
    // Pause
    await submitCallTx<Contract>(providers, { contractAddress } as any, {
      circuitId: 'pause_session',
      witnesses: { admin_secret: () => adminSk },
      args: [],
    });

    let state = await queryLedger(providers);
    expect(state.is_active).toBe(false);

    // Verify fails when paused
    const firmSecret = new Uint8Array(crypto.randomBytes(32));
    await expect(
      submitCallTx<Contract>(providers, { contractAddress } as any, {
        circuitId: 'verify_solvency',
        witnesses: {
          get_liquid_balance: () => 50000000n,
          get_firm_secret: () => firmSecret,
        },
        args: [],
      }),
    ).rejects.toThrow();

    // Resume
    await submitCallTx<Contract>(providers, { contractAddress } as any, {
      circuitId: 'resume_session',
      witnesses: { admin_secret: () => adminSk },
      args: [],
    });

    state = await queryLedger(providers);
    expect(state.is_active).toBe(true);
  });
});
