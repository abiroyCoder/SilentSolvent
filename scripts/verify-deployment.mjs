import fs from 'node:fs';
import { ContractState } from '@midnight-ntwrk/midnight-js-protocol/compact-runtime';
import { ledger } from '../contracts/managed/silentsolvent/contract/index.js';

const record = JSON.parse(fs.readFileSync(process.argv[2] ?? 'deployment-record.json', 'utf8'));
if (record.network !== 'preprod' || !record.contractAddress || !record.deploymentTransaction) {
  throw new Error('Deployment record is incomplete or not a Preprod deployment');
}
const indexer = process.env.PREPROD_INDEXER_URL ?? 'https://indexer.preprod.midnight.network/api/v4/graphql';
const response = await fetch(indexer, {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({
    query: `query VerifyDeployment($address: HexEncoded!) {
      contractAction(address: $address) { state transaction { hash } }
    }`,
    variables: { address: record.contractAddress },
  }),
});
if (!response.ok) throw new Error(`Indexer returned HTTP ${response.status}`);
const payload = await response.json();
if (payload.errors?.length) throw new Error(payload.errors.map((error) => error.message).join('; '));
const action = payload.data?.contractAction;
if (!action?.state) throw new Error('Deployment transaction is not indexed at the expected contract address');
const bytes = Buffer.from(action.state.replace(/^0x/i, ''), 'hex');
const state = ledger(ContractState.deserialize(bytes).data);
if (!state.is_active || state.total_attestations !== 0n) throw new Error('Fresh deployment state does not match expected invariants');
if (record.threshold && state.min_solvency_threshold !== BigInt(record.threshold)) throw new Error('Threshold mismatch');
if (record.cap && state.max_attestations !== BigInt(record.cap)) throw new Error('Attestation cap mismatch');
console.log(JSON.stringify({ verified: true, contractAddress: record.contractAddress, deploymentTransaction: record.deploymentTransaction }, null, 2));
