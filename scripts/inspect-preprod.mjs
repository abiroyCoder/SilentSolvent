import { ContractState } from '../node_modules/@midnight-ntwrk/compact-runtime/dist/index.js';
import { ledger } from '../contracts/managed/silentsolvent/contract/index.js';

const url = 'https://indexer.preprod.midnight.network/api/v4/graphql';
const contractAddress = '79f20921e5ca2377260b4912892cb690f20afa14ccc86667e697724d6eb13268';

function fromHex(hex) {
  const normalized = hex.startsWith('0x') ? hex.slice(2) : hex;
  const bytes = new Uint8Array(normalized.length / 2);
  for (let i = 0; i < normalized.length; i += 2) {
    bytes[i / 2] = parseInt(normalized.slice(i, i + 2), 16);
  }
  return bytes;
}

async function main() {
  const query = `
    query GetContract($address: HexEncoded!) {
      contractAction(address: $address) {
        __typename
        address
        state
        transaction {
          hash
          block { height timestamp }
        }
      }
    }
  `;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ query, variables: { address: contractAddress } }),
  });
  const data = await res.json();
  const rawState = data.data.contractAction.state;
  console.log('Tx:', data.data.contractAction.transaction);
  const cs = ContractState.deserialize(fromHex(rawState));
  const decoded = ledger(cs.data);
  console.log('Decoded ledger state:');
  console.log('min_solvency_threshold:', decoded.min_solvency_threshold);
  console.log('trade_session_id:', Buffer.from(decoded.trade_session_id).toString('hex'));
  console.log('is_active:', decoded.is_active);
  console.log('total_attestations:', decoded.total_attestations);
  console.log('max_attestations:', decoded.max_attestations);
  console.log('nullifiers iterator:');
  for (const n of decoded.nullifiers) {
    console.log(' - nullifier:', Buffer.from(n).toString('hex'));
  }
  console.log('attestation_log iterator:');
  for (const entry of decoded.attestation_log) {
    console.log(' - entry:', entry);
    if (Array.isArray(entry)) {
      console.log('   k:', Buffer.from(entry[0]).toString('hex'), 'v:', Buffer.from(entry[1]).toString('hex'));
    }
  }
}

main().catch(console.error);
