import { describe, it, expect, beforeAll } from 'vitest';
import crypto from 'node:crypto';
import {
  createConstructorContext,
  createCircuitContext,
  dummyContractAddress,
  sampleUserAddress,
} from '@midnight-ntwrk/compact-runtime';
import { Contract, pureCircuits, ledger } from '../../contracts/managed/silentsolvent/contract/index.js';
import { keyPair, makeAttestation, witnessSet } from './attestation.js';

const bytes32 = () => new Uint8Array(crypto.randomBytes(32));

 describe('SilentSolvent authenticated attestation contract', () => {
  let contract: Contract;
  let contractState: any;
  let adminSk: Uint8Array;
  let adminHash: Uint8Array;
  let providerSk: bigint;
  let providerKey: any;
  let assetId: Uint8Array;
  let issuerId: Uint8Array;
  let sessionId: Uint8Array;
  let brokerId: Uint8Array;
  let firmSecret: Uint8Array;
  const address = dummyContractAddress();
  const userAddr = sampleUserAddress();
  const now = () => BigInt(Math.floor(Date.now() / 1000));

  beforeAll(() => {
    adminSk = bytes32();
    adminHash = pureCircuits.admin_public_key(adminSk);
    providerSk = 123456789n;
    providerKey = keyPair(providerSk).publicKey;
    assetId = bytes32();
    issuerId = bytes32();
    sessionId = bytes32();
    brokerId = bytes32();
    firmSecret = bytes32();

    contract = new Contract(witnessSet({} as any, firmSecret, adminSk) as any);
    const initRes = contract.initialState(
      createConstructorContext({}, userAddr),
      5_000_000n,
      sessionId,
      now() + 30n * 24n * 60n * 60n,
      brokerId,
      adminHash,
      50n,
      assetId,
      issuerId,
      providerKey,
      900n,
    );
    contractState = initRes.currentContractState.data;
  });

  function setAttestation(attestation: any, firm = firmSecret) {
    contract.witnesses = witnessSet(attestation, firm, adminSk) as any;
  }

  function runVerify() {
    return contract.circuits.verify_solvency(
      createCircuitContext(address, userAddr, contractState, {}),
    );
  }

  it('deploys with an explicit asset, issuer, provider key, and freshness bound', () => {
    const state = ledger(contractState);
    expect(state.min_solvency_threshold).toEqual(5_000_000n);
    expect(state.asset_id).toEqual(assetId);
    expect(state.attestation_issuer_id).toEqual(issuerId);
    expect(state.max_attestation_age).toEqual(900n);
    expect(state.total_attestations).toEqual(0n);
  });

  it('accepts a fresh provider-signed asset-specific attestation', () => {
    const current = now();
    const attestation = makeAttestation({
      assetId,
      issuerId,
      sessionId,
      firmCommitment: pureCircuits.derive_firm_commitment(firmSecret),
      balance: 15_000_000n,
      issuedAt: current - 10n,
      expiresAt: current + 300n,
      nonce: bytes32(),
    }, providerSk);
    setAttestation(attestation);
    const result = runVerify();
    contractState = result.context.currentQueryContext.state;
    expect(ledger(contractState).total_attestations).toEqual(1n);
  });

  it('rejects a forged signature even when the balance is above threshold', () => {
    const current = now();
    const attestation = makeAttestation({
      assetId,
      issuerId,
      sessionId,
      firmCommitment: pureCircuits.derive_firm_commitment(bytes32()),
      balance: 99_000_000n,
      issuedAt: current - 1n,
      expiresAt: current + 300n,
      nonce: bytes32(),
    }, providerSk);
    attestation.signature.response += 1n;
    setAttestation(attestation, firmSecret);
    expect(() => runVerify()).toThrow(/Invalid attestation signature|Attestation firm mismatch/);
  });

  it('rejects an expired attestation and an attestation for another asset', () => {
    const current = now();
    const expired = makeAttestation({
      assetId,
      issuerId,
      sessionId,
      firmCommitment: pureCircuits.derive_firm_commitment(firmSecret),
      balance: 15_000_000n,
      issuedAt: current - 500n,
      expiresAt: current - 1n,
      nonce: bytes32(),
    }, providerSk);
    setAttestation(expired);
    expect(() => runVerify()).toThrow(/Attestation has expired/);

    const otherAsset = bytes32();
    const wrongAsset = makeAttestation({
      assetId: otherAsset,
      issuerId,
      sessionId,
      firmCommitment: pureCircuits.derive_firm_commitment(firmSecret),
      balance: 15_000_000n,
      issuedAt: current - 1n,
      expiresAt: current + 300n,
      nonce: bytes32(),
    }, providerSk);
    setAttestation(wrongAsset);
    expect(() => runVerify()).toThrow(/Attestation asset mismatch/);
  });

  it('rejects an insufficient signed balance and prevents duplicate attestation', () => {
    const current = now();
    const insufficient = makeAttestation({
      assetId,
      issuerId,
      sessionId,
      firmCommitment: pureCircuits.derive_firm_commitment(bytes32()),
      balance: 1_000_000n,
      issuedAt: current - 1n,
      expiresAt: current + 300n,
      nonce: bytes32(),
    }, providerSk);
    // The firm mismatch is checked before the threshold, proving that the
    // signed snapshot cannot be swapped between firm credentials.
    setAttestation(insufficient, firmSecret);
    expect(() => runVerify()).toThrow(/Attestation firm mismatch/);

    const validSecondFirm = bytes32();
    const valid = makeAttestation({
      assetId,
      issuerId,
      sessionId,
      firmCommitment: pureCircuits.derive_firm_commitment(validSecondFirm),
      balance: 15_000_000n,
      issuedAt: current - 1n,
      expiresAt: current + 300n,
      nonce: bytes32(),
    }, providerSk);
    setAttestation(valid, validSecondFirm);
    const first = contract.circuits.verify_solvency(createCircuitContext(address, userAddr, contractState, {}));
    contractState = first.context.currentQueryContext.state;
    setAttestation(valid, validSecondFirm);
    expect(() => contract.circuits.verify_solvency(createCircuitContext(address, userAddr, contractState, {}))).toThrow(/Firm already attested/);
  });

  it('keeps admin session controls behind the admin secret witness', () => {
    const newSession = bytes32();
    const newBroker = bytes32();
    setAttestation({} as any, firmSecret);
    const result = contract.circuits.update_session(
      createCircuitContext(address, userAddr, contractState, {}),
      10_000_000n,
      newSession,
      now() + 60n * 24n * 60n * 60n,
      newBroker,
      100n,
    );
    contractState = result.context.currentQueryContext.state;
    const state = ledger(contractState);
    expect(state.min_solvency_threshold).toEqual(10_000_000n);
    expect(state.max_attestations).toEqual(100n);
  });
});
