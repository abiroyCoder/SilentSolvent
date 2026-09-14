// Address of the deployed SilentSolvent contract
// You can override this in localStorage for testing without rebuilding
export const getContractAddress = (): string => {
  if (typeof window !== 'undefined') {
    const cached = localStorage.getItem('silentsolvent_contract_address');
    if (cached) return cached;
  }
  // Default Preprod address (update after deployment)
  return import.meta.env.VITE_CONTRACT_ADDRESS || '020000000000000000000000000000000000000000000000000000000000000000';
};

export const setContractAddress = (address: string) => {
  localStorage.setItem('silentsolvent_contract_address', address);
};
// Dev checkpoint: 2026-09-04T17:03:25+05:30
// Dev checkpoint: 2026-09-05T00:06:51+05:30
// Dev checkpoint: 2026-09-05T07:12:17+05:30
// Dev checkpoint: 2026-09-05T14:13:42+05:30
// Dev checkpoint: 2026-09-05T21:17:08+05:30
// Dev checkpoint: 2026-09-06T04:22:34+05:30
// Dev checkpoint: 2026-09-06T11:23:59+05:30
// Dev checkpoint: 2026-09-06T18:27:25+05:30
// Dev checkpoint: 2026-09-07T01:32:51+05:30
// Dev checkpoint: 2026-09-07T08:34:17+05:30
// Dev checkpoint: 2026-09-07T15:37:42+05:30
// Dev checkpoint: 2026-09-07T22:41:08+05:30
// Dev checkpoint: 2026-09-08T05:44:34+05:30
// Dev checkpoint: 2026-09-08T12:47:59+05:30
// Dev checkpoint: 2026-09-08T19:51:25+05:30
// Dev checkpoint: 2026-09-09T02:54:51+05:30
// Dev checkpoint: 2026-09-09T09:58:17+05:30
// Dev checkpoint: 2026-09-09T17:01:42+05:30
// Dev checkpoint: 2026-09-10T00:07:08+05:30
// Dev checkpoint: 2026-09-10T07:08:34+05:30
// Dev checkpoint: 2026-09-10T14:11:59+05:30
// Dev checkpoint: 2026-09-10T21:17:25+05:30
// Dev checkpoint: 2026-09-11T04:18:51+05:30
// Dev checkpoint: 2026-09-11T11:22:17+05:30
// Dev checkpoint: 2026-09-11T18:27:42+05:30
// Dev checkpoint: 2026-09-12T01:29:08+05:30
// Dev checkpoint: 2026-09-12T08:32:34+05:30
// Dev checkpoint: 2026-09-12T15:37:59+05:30
// Dev checkpoint: 2026-09-12T22:39:25+05:30
// Dev checkpoint: 2026-09-13T05:42:51+05:30
// Dev checkpoint: 2026-09-13T12:46:17+05:30
// Dev checkpoint: 2026-09-13T19:49:42+05:30
// Dev checkpoint: 2026-09-14T02:53:08+05:30
// Dev checkpoint: 2026-09-14T09:56:34+05:30
