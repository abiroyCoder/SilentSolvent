import React from 'react';
import { XCircle, CheckCircle2, ShieldAlert, ShieldCheck } from 'lucide-react';

export default function PrivacyMatrixSection() {
  const comparisonItems = [
    {
      feature: 'Custody Address Visibility',
      statusQuo: 'Publicly revealed to counterparty; indexed by Arkham, Nansen, and MEV searchers',
      silentSolvent: 'Never disclosed or signed; execution uses witness identity decoupling',
      isSecurityBenefit: true,
    },
    {
      feature: 'Liquidity Balance Disclosure',
      statusQuo: 'Broker sees exact wallet balance or bank PDF statements, exposing treasury size',
      silentSolvent: 'Evaluated locally inside browser ZK circuit; desk only receives binary threshold proof',
      isSecurityBenefit: true,
    },
    {
      feature: 'Front-Running / Copy-Trading Risk',
      statusQuo: 'High: Bots track incoming collateral movements and front-run block trade execution',
      silentSolvent: 'Zero: No transaction link connects the trader’s custody vault to the attestation',
      isSecurityBenefit: true,
    },
    {
      feature: 'Sybil / Ghost Order Mitigation',
      statusQuo: 'Requires manual broker trust or expensive escrow lockups to prevent fake bids',
      silentSolvent: 'Cryptographic session nullifiers prevent a single fund from double-attesting',
      isSecurityBenefit: true,
    },
    {
      feature: 'Settlement Speed',
      statusQuo: '24 to 72 hours for auditor verification and legal escrow clearing',
      silentSolvent: '< 3 seconds for local zero-knowledge proof generation and Midnight on-chain commit',
      isSecurityBenefit: true,
    },
  ];

  return (
    <section className="matrix-section">
      <div className="section-header">
        <div className="section-tag">INSTITUTIONAL BENCHMARK</div>
        <h2 className="section-title">Traditional Proof of Funds vs SilentSolvent</h2>
        <p className="section-sub">
          Why multi-million dollar institutional OTC desks and quantitative trading funds transition to zero-knowledge attestation.
        </p>
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
