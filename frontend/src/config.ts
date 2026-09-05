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
