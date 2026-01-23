import { useState } from 'react';
import Home from './components/Home/Home';
import Uplink from './components/Uplink/Uplink';
import Journal from './components/Journal/Journal';
import './App.css';

const TABS = [
  { id: 'home', label: 'Home', icon: '\u{1F3E0}' },
  { id: 'uplink', label: 'Uplink', icon: '\u{1F4E1}' },
  { id: 'journal', label: 'Journal', icon: '\u{1F4D3}' },
];

function App() {
  const [activeTab, setActiveTab] = useState('home');

  return (
    <div className="app">
      <header className="app-header">
        <div className="header-content">
          <h1 className="app-title">The Nest</h1>
          <span className="app-subtitle">NESTeq Memory</span>
        </div>
      </header>

      <nav className="tab-bar">
        {TABS.map(tab => (
          <button
            key={tab.id}
            className={`tab-button ${activeTab === tab.id ? 'active' : ''}`}
            onClick={() => setActiveTab(tab.id)}
          >
            <span className="tab-icon">{tab.icon}</span>
            <span className="tab-label">{tab.label}</span>
          </button>
        ))}
      </nav>

      <main className="app-content">
        {activeTab === 'home' && <Home />}
        {activeTab === 'uplink' && <Uplink />}
        {activeTab === 'journal' && <Journal />}
      </main>

      <footer className="app-footer">
        <span>Binary Home v3.0 — Fox & Alex</span>
        <span className="embers">Embers Remember</span>
      </footer>
    </div>
  );
}

export default App;
