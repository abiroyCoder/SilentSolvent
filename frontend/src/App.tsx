import { Routes, Route, Link, useLocation } from 'react-router-dom';
import { useWallet } from './contexts/WalletContext';
import { Shield, ShieldAlert, LogOut, Link as LinkIcon, Activity } from 'lucide-react';
import LandingPage from './pages/LandingPage';
import VerifyPage from './pages/VerifyPage';
import AdminPage from './pages/AdminPage';
import ExplorerPage from './pages/ExplorerPage';
import AboutPage from './pages/AboutPage';

function App() {
  const { address, isConnected, connect, disconnect, isConnecting, walletType, walletStatus } = useWallet();
  const location = useLocation();

  const shortAddress = address ? `${address.slice(0, 8)}...${address.slice(-6)}` : '';

  return (
    <div className="app-layout">
      <nav className="nav">
        <div className="flex items-center gap-24">
          <Link to="/" className="nav-brand">
            <Shield />
            SILENTSOLVENT
          </Link>
          <div className="nav-links">
            <Link to="/verify" className={`nav-link ${location.pathname === '/verify' ? 'active' : ''}`}>Verify Solvency</Link>
            <Link to="/explorer" className={`nav-link ${location.pathname === '/explorer' ? 'active' : ''}`}>Explorer</Link>
            <Link to="/admin" className={`nav-link ${location.pathname === '/admin' ? 'active' : ''}`}>Admin</Link>
            <Link to="/about" className={`nav-link ${location.pathname === '/about' ? 'active' : ''}`}>Privacy Model</Link>
          </div>
        </div>
        <div className="nav-right">
          {isConnected ? (
            <>
              <div className="nav-wallet">
                <div className="nav-dot"></div>
                {shortAddress}
                <span className="text-muted">({walletType})</span>
              </div>
              <button className="btn btn-ghost btn-sm" onClick={disconnect} title="Disconnect">
                <LogOut size={14} />
              </button>
            </>
          ) : (
            <button 
              className="btn btn-primary btn-sm"
              onClick={() => connect()}
              disabled={isConnecting || walletStatus === 'not-found'}
            >
              {isConnecting ? (
                <><div className="spinner" /> Connecting...</>
              ) : walletStatus === 'not-found' ? (
                <><ShieldAlert size={14} /> No Wallet Found</>
              ) : (
                <><LinkIcon size={14} /> Connect 1AM / Lace</>
              )}
            </button>
          )}
        </div>
      </nav>

      <main className="flex-1">
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/verify" element={<VerifyPage />} />
          <Route path="/admin" element={<AdminPage />} />
          <Route path="/explorer" element={<ExplorerPage />} />
          <Route path="/about" element={<AboutPage />} />
        </Routes>
      </main>
    </div>
  );
}

export default App;
