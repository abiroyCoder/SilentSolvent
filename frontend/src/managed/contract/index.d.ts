import type * as __compactRuntime from '@midnight-ntwrk/compact-runtime';

export type Witnesses<PS> = {
  get_liquid_balance(context: __compactRuntime.WitnessContext<Ledger, PS>): [PS, bigint];
  get_firm_secret(context: __compactRuntime.WitnessContext<Ledger, PS>): [PS, Uint8Array];
  admin_secret(context: __compactRuntime.WitnessContext<Ledger, PS>): [PS, Uint8Array];
}

export type ImpureCircuits<PS> = {
  verify_solvency(context: __compactRuntime.CircuitContext<PS>): __compactRuntime.CircuitResults<PS, []>;
  update_session(context: __compactRuntime.CircuitContext<PS>,
                 new_threshold_0: bigint,
                 new_session_0: Uint8Array,
                 new_deadline_0: bigint,
                 new_broker_0: Uint8Array,
                 new_cap_0: bigint): __compactRuntime.CircuitResults<PS, []>;
  pause_session(context: __compactRuntime.CircuitContext<PS>): __compactRuntime.CircuitResults<PS, []>;
  resume_session(context: __compactRuntime.CircuitContext<PS>): __compactRuntime.CircuitResults<PS, []>;
}

export type ProvableCircuits<PS> = {
  verify_solvency(context: __compactRuntime.CircuitContext<PS>): __compactRuntime.CircuitResults<PS, []>;
  update_session(context: __compactRuntime.CircuitContext<PS>,
                 new_threshold_0: bigint,
                 new_session_0: Uint8Array,
                 new_deadline_0: bigint,
                 new_broker_0: Uint8Array,
                 new_cap_0: bigint): __compactRuntime.CircuitResults<PS, []>;
  pause_session(context: __compactRuntime.CircuitContext<PS>): __compactRuntime.CircuitResults<PS, []>;
  resume_session(context: __compactRuntime.CircuitContext<PS>): __compactRuntime.CircuitResults<PS, []>;
}

export type PureCircuits = {
  admin_public_key(sk_0: Uint8Array): Uint8Array;
  make_nullifier(firm_secret_0: Uint8Array, session_0: Uint8Array): Uint8Array;
}

export type Circuits<PS> = {
  verify_solvency(context: __compactRuntime.CircuitContext<PS>): __compactRuntime.CircuitResults<PS, []>;
  update_session(context: __compactRuntime.CircuitContext<PS>,
                 new_threshold_0: bigint,
                 new_session_0: Uint8Array,
                 new_deadline_0: bigint,
                 new_broker_0: Uint8Array,
                 new_cap_0: bigint): __compactRuntime.CircuitResults<PS, []>;
  pause_session(context: __compactRuntime.CircuitContext<PS>): __compactRuntime.CircuitResults<PS, []>;
  resume_session(context: __compactRuntime.CircuitContext<PS>): __compactRuntime.CircuitResults<PS, []>;
  admin_public_key(context: __compactRuntime.CircuitContext<PS>,
                   sk_0: Uint8Array): __compactRuntime.CircuitResults<PS, Uint8Array>;
  make_nullifier(context: __compactRuntime.CircuitContext<PS>,
                 firm_secret_0: Uint8Array,
                 session_0: Uint8Array): __compactRuntime.CircuitResults<PS, Uint8Array>;
}

export type Ledger = {
  readonly min_solvency_threshold: bigint;
  readonly trade_session_id: Uint8Array;
  readonly session_deadline: bigint;
  readonly broker_id: Uint8Array;
  readonly admin: Uint8Array;
  readonly is_active: boolean;
  readonly total_attestations: bigint;
  readonly max_attestations: bigint;
  nullifiers: {
    isEmpty(): boolean;
    size(): bigint;
    member(elem_0: Uint8Array): boolean;
    [Symbol.iterator](): Iterator<Uint8Array>
  };
  attestation_log: {
    isEmpty(): boolean;
    size(): bigint;
    member(key_0: Uint8Array): boolean;
    lookup(key_0: Uint8Array): Uint8Array;
    [Symbol.iterator](): Iterator<[Uint8Array, Uint8Array]>
  };
  readonly contract_version: Uint8Array;
}

export type ContractReferenceLocations = any;

export declare const contractReferenceLocations : ContractReferenceLocations;

export declare class Contract<PS = any, W extends Witnesses<PS> = Witnesses<PS>> {
  witnesses: W;
  circuits: Circuits<PS>;
  impureCircuits: ImpureCircuits<PS>;
  provableCircuits: ProvableCircuits<PS>;
  constructor(witnesses: W);
  initialState(context: __compactRuntime.ConstructorContext<PS>,
               threshold_0: bigint,
               session_0: Uint8Array,
               deadline_0: bigint,
               broker_0: Uint8Array,
               admin_hash_0: Uint8Array,
               cap_0: bigint): __compactRuntime.ConstructorResult<PS>;
}

export declare function ledger(state: __compactRuntime.StateValue | __compactRuntime.ChargedState): Ledger;
export declare const pureCircuits: PureCircuits;
