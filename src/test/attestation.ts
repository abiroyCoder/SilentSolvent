import crypto from 'node:crypto';
import { ecMulGenerator } from '@midnight-ntwrk/midnight-js-protocol/compact-runtime';
import { pureCircuits } from '../../contracts/managed/silentsolvent/contract/index.js';

export const JUBJUB_ORDER = 6554484396890773809930967563523245729705921265872317281365359162392183254199n;
export const TWO_248 = 2n ** 248n;

export type AttestationFields = {
  assetId: Uint8Array;
  issuerId: Uint8Array;
  sessionId: Uint8Array;
  firmCommitment: Uint8Array;
  balance: bigint;
  issuedAt: bigint;
  expiresAt: bigint;
  nonce: Uint8Array;
};

function randomScalar(): bigint {
  const value = BigInt(`0x${crypto.randomBytes(32).toString('hex')}`) % JUBJUB_ORDER;
  return value === 0n ? 1n : value;
}

export function keyPair(secretKey = randomScalar()) {
  return { secretKey, publicKey: ecMulGenerator(secretKey) };
}

export function makeAttestation(fields: AttestationFields, providerSecretKey: bigint) {
  const { publicKey } = keyPair(providerSecretKey);
  const message = pureCircuits.attestation_message(
    fields.assetId,
    fields.issuerId,
    fields.sessionId,
    fields.firmCommitment,
    fields.balance,
    fields.issuedAt,
    fields.expiresAt,
    fields.nonce,
  );
  const ephemeral = randomScalar();
  const announcement = ecMulGenerator(ephemeral);
  const challenge = BigInt(pureCircuits.attestation_challenge(
    announcement.x,
    announcement.y,
    publicKey.x,
    publicKey.y,
    message,
  )) % TWO_248;
  const response = (ephemeral + challenge * providerSecretKey) % JUBJUB_ORDER;
  return {
    asset_id: fields.assetId,
    issuer_id: fields.issuerId,
    session_id: fields.sessionId,
    firm_commitment: fields.firmCommitment,
    balance: fields.balance,
    issued_at: fields.issuedAt,
    expires_at: fields.expiresAt,
    nonce: fields.nonce,
    signature: { announcement, response },
  };
}

export function witnessSet(attestation: any, firmSecret: Uint8Array, adminSecret: Uint8Array) {
  return {
    get_balance_attestation: () => [{}, attestation],
    get_firm_secret: () => [{}, firmSecret],
    admin_secret: () => [{}, adminSecret],
    getSchnorrReduction: (_ctx: any, challengeHash: bigint) => {
      const challenge = BigInt(challengeHash);
      return [{}, [challenge / TWO_248, challenge % TWO_248]];
    },
  };
}
