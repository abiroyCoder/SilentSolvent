import React, { useState, useEffect, useRef } from 'react';
import { Play, Pause, ArrowLeftRight, RotateCcw, ShieldCheck, Gauge, Shield } from 'lucide-react';

interface TradeCard {
  id: string;
  sessionCode: string;
  broker: string;
  thresholdUsd: string;
  pair: string;
  status: string;
  timestamp: string;
  asciiProof: string;
}

const SAMPLE_TRADES: TradeCard[] = [
  {
    id: '1',
    sessionCode: 'OTC-SES-8841',
    broker: 'FALCONX // BLOCK DESK',
    thresholdUsd: '$25,000,000.00',
    pair: 'BTC / USDC (350 BTC)',
    status: 'ATTESTED [OK]',
    timestamp: '14.2s ago',
    asciiProof: `┌──[ ZK-SNARK BN254 ]────┐\n│ WITNESS: [CONCEALED]   │\n│ NULLIFIER: 0x9f83..4b  │\n│ ASSERTION: TRUE        │\n└────────────────────────┘`,
  },
  {
    id: '2',
    sessionCode: 'OTC-SES-8842',
    broker: 'WINTERMUTE OTC',
    thresholdUsd: '$10,000,000.00',
    pair: 'ETH / USDT (4,200 ETH)',
    status: 'ATTESTED [OK]',
    timestamp: '28.5s ago',
    asciiProof: `┌──[ ZK-SNARK BN254 ]────┐\n│ WITNESS: [CONCEALED]   │\n│ NULLIFIER: 0x14d2..8e  │\n│ ASSERTION: TRUE        │\n└────────────────────────┘`,
  },
  {
    id: '3',
    sessionCode: 'OTC-SES-8843',
    broker: 'CUMBERLAND DRW',
    thresholdUsd: '$50,000,000.00',
    pair: 'SOL / USDC (320k SOL)',
    status: 'ATTESTED [OK]',
    timestamp: '42.1s ago',
    asciiProof: `┌──[ ZK-SNARK BN254 ]────┐\n│ WITNESS: [CONCEALED]   │\n│ NULLIFIER: 0x7c30..aa  │\n│ ASSERTION: TRUE        │\n└────────────────────────┘`,
  },
  {
    id: '4',
    sessionCode: 'OTC-SES-8844',
    broker: 'GENESIS PRIME',
    thresholdUsd: '$5,000,000.00',
    pair: 'NIGHT / USDT (2.5M tNIGHT)',
    status: 'ATTESTED [OK]',
    timestamp: '1m ago',
    asciiProof: `┌──[ ZK-SNARK BN254 ]────┐\n│ WITNESS: [CONCEALED]   │\n│ NULLIFIER: 0x5a19..3c  │\n│ ASSERTION: TRUE        │\n└────────────────────────┘`,
  },
];

/**
 * Direct implementation inspired by pulkitxm/claude-directory (components-ui/scanner-card-stream)
 * Real-time sliding card carousel intersected by a vertical laser scanner revealing underlying ASCII ZK proofs.
 */
export default function ScannerCardStream() {
  const [isPaused, setIsPaused] = useState(false);
  const [direction, setDirection] = useState<1 | -1>(-1);
  const [position, setPosition] = useState(0);
  const [speed, setSpeed] = useState(35);
  const requestRef = useRef<number>(0);
  const lastTimeRef = useRef<number>(performance.now());

  useEffect(() => {
    const animate = (time: number) => {
      const delta = (time - lastTimeRef.current) / 1000;
      lastTimeRef.current = time;

      if (!isPaused) {
        setPosition((prev) => {
          const next = prev + speed * direction * delta;
          // Loop around roughly 1400px width
          if (next < -1200) return 400;
          if (next > 600) return -1000;
          return next;
        });
      }
      requestRef.current = requestAnimationFrame(animate);
    };

    requestRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(requestRef.current);
  }, [isPaused, direction, speed]);

  return (
    <section className="scanner-stream-section">
      <div className="section-header flex items-center justify-between">
        <div>
          <div className="section-tag">LIVE VERIFICATION STREAM // SCANNER DECK</div>
          <h2 className="section-title">Institutional Block Trade Verification Stream</h2>
          <p className="section-sub">
            Observe incoming block trade attestations passing through the Midnight zero-knowledge scanner beam.
          </p>
        </div>

        <div className="flex items-center gap-8">
          <div className="speed-badge">
            <Gauge size={13} className="text-accent" />
            <span className="mono text-[11px] text-muted uppercase tracking-wider">SCAN RATE</span>
            <span className="mono text-[12px] font-bold text-accent tabular-nums">00{speed} PX/S</span>
          </div>

          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={() => setIsPaused((p) => !p)}
              className="scanner-ctrl-btn"
              title={isPaused ? 'Play' : 'Pause'}
            >
              {isPaused ? <Play size={13} /> : <Pause size={13} />}
            </button>
            <button
              type="button"
              onClick={() => setDirection((d) => (d === 1 ? -1 : 1))}
              className="scanner-ctrl-btn"
              title="Reverse Direction"
            >
              <ArrowLeftRight size={13} />
            </button>
            <button
              type="button"
              onClick={() => setPosition(0)}
              className="scanner-ctrl-btn"
              title="Reset Position"
            >
              <RotateCcw size={13} />
            </button>
          </div>
        </div>
      </div>

      <div className="scanner-stream-viewport">
        {/* LASER SCANNER BEAM (Vertical Laser) */}
        <div className="scanner-laser-beam" />
        <div className="scanner-ambient-line" />

        {/* CARDS CONTAINER */}
        <div
          className="scanner-cards-track"
          style={{ transform: `translateX(${position}px)` }}
        >
          {SAMPLE_TRADES.concat(SAMPLE_TRADES).map((trade, idx) => (
            <div key={`${trade.id}-${idx}`} className="trade-stream-card">
              <div className="card-top-row">
                <span className="mono text-[11px] text-accent font-semibold">{trade.sessionCode}</span>
                <span className="mono text-[10px] text-green border border-[var(--green)] px-4 py-1 rounded">
                  {trade.status}
                </span>
              </div>

              <div className="mt-8">
                <div className="text-[11px] text-muted mono">OTC DESK</div>
                <div className="font-bold text-[13px] text-text-0">{trade.broker}</div>
              </div>

              <div className="mt-8">
                <div className="text-[11px] text-muted mono">CAPITAL REQUIREMENT</div>
                <div className="font-bold text-[16px] text-accent mono">{trade.thresholdUsd}</div>
              </div>

              <div className="trade-card-ascii-strip">
                <pre className="mono text-[10px] text-text-2 leading-tight">
                  {trade.asciiProof}
                </pre>
              </div>

              <div className="card-bottom-row">
                <span className="mono text-[11px] text-text-2">{trade.pair}</span>
                <span className="mono text-[10px] text-text-2">{trade.timestamp}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
