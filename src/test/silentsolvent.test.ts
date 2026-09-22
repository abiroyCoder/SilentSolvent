import { describe, it, expect, beforeAll } from 'vitest';
import crypto from 'crypto';
import {
  createConstructorContext,
  createCircuitContext,
  dummyContractAddress,
  sampleUserAddress,
} from '@midnight-ntwrk/compact-runtime';
import { Contract, pureCircuits, ledger } from '../../contracts/managed/silentsolvent/contract/index.js';

describe('SilentSolvent Smart Contract Circuit & State Verification', () => {
  let contract: Contract;
  let contractState: any;
  let adminSk: Uint8Array;
  let adminHash: Uint8Array;
  const address = dummyContractAddress();
  const userAddr = sampleUserAddress();

  const sessionId = new Uint8Array(crypto.randomBytes(32));
  const brokerId = new Uint8Array(crypto.randomBytes(32));
  const deadline = BigInt(Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60);

  beforeAll(() => {
    adminSk = new Uint8Array(crypto.randomBytes(32));
    adminHash = pureCircuits.admin_public_key(adminSk);
  });

  it('deploys the contract with session parameters', () => {
    const witnesses = {
      get_liquid_balance: () => [{}, 15000000n],
      get_firm_secret: () => [{}, new Uint8Array(crypto.randomBytes(32))],
      admin_secret: () => [{}, adminSk],
    };
    contract = new Contract(witnesses as any);

    const initCtx = createConstructorContext({}, userAddr);
    const initRes = contract.initialState(
      initCtx,
      5000000n,
      sessionId,
      deadline,
      brokerId,
      adminHash,
      50n
    );
    contractState = initRes.currentContractState.data;

    const state = ledger(contractState);
    expect(state.min_solvency_threshold).toEqual(5000000n);
    expect(state.is_active).toBe(true);
    expect(state.max_attestations).toEqual(50n);
    expect(state.total_attestations).toEqual(0n);
  });

  it('accepts attestation from a solvent firm', () => {
    const firmSecret = new Uint8Array(crypto.randomBytes(32));
    contract.witnesses = {
      get_liquid_balance: () => [{}, 15000000n], // 15M >= 5M threshold
      get_firm_secret: () => [{}, firmSecret],
      admin_secret: () => [{}, adminSk],
    };

    const circuitCtx = createCircuitContext(
      address,
      userAddr,
      contractState,
      {}
    );
    const verifyRes = contract.circuits.verify_solvency(circuitCtx);
    contractState = verifyRes.context.currentQueryContext.state;

    const state = ledger(contractState);
    expect(state.total_attestations).toEqual(1n);
  });

  it('rejects an insolvent firm', () => {
    const firmSecret = new Uint8Array(crypto.randomBytes(32));
    contract.witnesses = {
      get_liquid_balance: () => [{}, 1000000n], // 1M < 5M threshold
      get_firm_secret: () => [{}, firmSecret],
      admin_secret: () => [{}, adminSk],
    };

    const circuitCtx = createCircuitContext(
      address,
      userAddr,
      contractState,
      {}
    );
    expect(() => {
      contract.circuits.verify_solvency(circuitCtx);
    }).toThrow(/Insufficient liquidity/);
  });

  it('prevents double attestation in the same session', () => {
    const firmSecret = new Uint8Array(crypto.randomBytes(32));
    contract.witnesses = {
      get_liquid_balance: () => [{}, 10000000n],
      get_firm_secret: () => [{}, firmSecret],
      admin_secret: () => [{}, adminSk],
    };

    // First attestation succeeds
    const ctx1 = createCircuitContext(address, userAddr, contractState, {});
    const res1 = contract.circuits.verify_solvency(ctx1);
    contractState = res1.context.currentQueryContext.state;

    // Second attestation with same firm secret fails (nullifier collision)
    const ctx2 = createCircuitContext(address, userAddr, contractState, {});
    expect(() => {
      contract.circuits.verify_solvency(ctx2);
    }).toThrow(/Firm already attested in this session/);
  });

  it('allows admin to update session parameters', () => {
    const newSessionId = new Uint8Array(crypto.randomBytes(32));
    const newBrokerId = new Uint8Array(crypto.randomBytes(32));
    const newDeadline = BigInt(Math.floor(Date.now() / 1000) + 60 * 24 * 60 * 60);

    contract.witnesses = {
      get_liquid_balance: () => [{}, 15000000n],
      get_firm_secret: () => [{}, new Uint8Array(crypto.randomBytes(32))],
      admin_secret: () => [{}, adminSk],
    };

    const ctx = createCircuitContext(address, userAddr, contractState, {});
    const res = contract.circuits.update_session(
      ctx,
      10000000n,
      newSessionId,
      newDeadline,
      newBrokerId,
      100n
    );
    contractState = res.context.currentQueryContext.state;

    const state = ledger(contractState);
    expect(state.min_solvency_threshold).toEqual(10000000n);
    expect(state.max_attestations).toEqual(100n);
  });

  it('allows admin to pause and resume the session', () => {
    contract.witnesses = {
      get_liquid_balance: () => [{}, 50000000n],
      get_firm_secret: () => [{}, new Uint8Array(crypto.randomBytes(32))],
      admin_secret: () => [{}, adminSk],
    };

    // Pause
    const pauseCtx = createCircuitContext(address, userAddr, contractState, {});
    const pauseRes = contract.circuits.pause_session(pauseCtx);
    contractState = pauseRes.context.currentQueryContext.state;

    let state = ledger(contractState);
    expect(state.is_active).toBe(false);

    // Verify fails when paused
    const verifyCtx = createCircuitContext(address, userAddr, contractState, {});
    expect(() => {
      contract.circuits.verify_solvency(verifyCtx);
    }).toThrow(/Trade session is paused/);

    // Resume
    const resumeCtx = createCircuitContext(address, userAddr, contractState, {});
    const resumeRes = contract.circuits.resume_session(resumeCtx);
    contractState = resumeRes.context.currentQueryContext.state;

    state = ledger(contractState);
    expect(state.is_active).toBe(true);
  });
});
