import React from 'react';
import { XCircle, CheckCircle2, ShieldAlert, ShieldCheck } from 'lucide-react';

export default function PrivacyMatrixSection() {
  const comparisonItems = [
    {
      feature: 'Custody Address',
      statusQuo: 'Exposed to counterparties & MEV trackers',
      silentSolvent: 'Concealed in client witness',
      isSecurityBenefit: true,
    },
    {
      feature: 'Treasury Balance',
      statusQuo: 'Reveals exact holdings & portfolio size',
      silentSolvent: 'Binary threshold proof only',
      isSecurityBenefit: true,
    },
    {
      feature: 'Front-Running Risk',
      statusQuo: 'Mempool & analytics surveillance',
      silentSolvent: 'Zero on-chain vault link',
      isSecurityBenefit: true,
    },
    {
      feature: 'Sybil Mitigation',
      statusQuo: 'Manual escrow lockups',
      silentSolvent: 'Deterministic session nullifiers',
      isSecurityBenefit: true,
    },
    {
      feature: 'Verification Time',
      statusQuo: '24–72 hours via auditors',
      silentSolvent: '< 3 seconds via Compact ZK',
      isSecurityBenefit: true,
    },
  ];

  return (
    <section className="matrix-section">
      <div className="section-header">
        <div className="section-tag">SECURITY BENCHMARK</div>
        <h2 className="section-title">Privacy Comparison</h2>
      </div>

      <div className="matrix-table-card">
        <div className="matrix-table-header">
          <div className="col-feature">CAPABILITY</div>
          <div className="col-status-quo flex items-center gap-6">
            <ShieldAlert size={14} className="text-red" />
            <span>TRADITIONAL OTC (STATUS QUO)</span>
          </div>
          <div className="col-silentsolvent flex items-center gap-6">
            <ShieldCheck size={14} className="text-green" />
            <span>SILENTSOLVENT (MIDNIGHT)</span>
          </div>
        </div>

        <div className="matrix-table-body">
          {comparisonItems.map((item, idx) => (
            <div key={idx} className="matrix-row">
              <div className="col-feature font-semibold text-text-0 text-[13px]">
                {item.feature}
              </div>
              <div className="col-status-quo text-text-2 text-[12px] flex items-start gap-8">
                <XCircle size={15} className="text-red shrink-0 mt-2" />
                <span>{item.statusQuo}</span>
              </div>
              <div className="col-silentsolvent text-text-1 text-[12px] flex items-start gap-8">
                <CheckCircle2 size={15} className="text-green shrink-0 mt-2" />
                <span className="text-text-0">{item.silentSolvent}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
