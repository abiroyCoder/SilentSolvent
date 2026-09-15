import React from 'react';

export default function TerminalGridBackground() {
  return (
    <div className="terminal-bg-container" aria-hidden="true">
      <div className="terminal-grid-overlay" />
      <div className="terminal-ambient-glow" />
    </div>
  );
}
