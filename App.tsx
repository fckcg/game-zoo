
import React, { useState } from 'react';
import { RocketLaunch } from './components/RocketLaunch';
import { Fan } from './components/Fan';
import { V8Engine } from './components/V8Engine';
import { MathGame } from './components/MathGame';

type View = 'rocket' | 'fan' | 'engine' | 'math';

const App: React.FC = () => {
  const [currentView, setCurrentView] = useState<View>('math');
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  return (
    <div className="min-h-screen flex flex-col bg-slate-950 text-slate-200 overflow-hidden font-sans selection:bg-blue-500 selection:text-white">
      {/* Header / Nav */}
      <header className="w-full h-16 bg-slate-900 border-b border-slate-800 flex items-center px-4 md:px-6 justify-between z-20 shadow-lg shrink-0">
        <div className="flex items-center gap-4">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center shadow-blue-500/20 shadow-lg">
            <span className="text-lg">🚀</span>
          </div>
          <div>
            <h1 className="text-lg font-bold text-slate-100 tracking-wider uppercase font-mono hidden md:block">
              Interactive
              <span className="text-blue-500 mx-2">///</span>
              Playground
            </h1>
            <h1 className="text-lg font-bold text-slate-100 md:hidden">Playground</h1>
          </div>
        </div>
        
        {/* Desktop Nav */}
        <nav className="hidden md:flex items-center gap-1 bg-slate-800/50 p-1 rounded-lg">
            <NavButton active={currentView === 'rocket'} onClick={() => setCurrentView('rocket')} label="Space Mission" icon="🚀" />
            <NavButton active={currentView === 'engine'} onClick={() => setCurrentView('engine')} label="V8 Engine" icon="⚙️" />
            <NavButton active={currentView === 'fan'} onClick={() => setCurrentView('fan')} label="Electric Fan" icon="💨" />
            <NavButton active={currentView === 'math'} onClick={() => setCurrentView('math')} label="Math Zoo" icon="🦁" highlight />
        </nav>

        {/* Mobile Menu Button */}
        <button 
          className="md:hidden p-2 text-slate-400 hover:text-white"
          onClick={() => setIsMenuOpen(!isMenuOpen)}
        >
          ☰
        </button>
      </header>
      
      {/* Mobile Nav Menu */}
      {isMenuOpen && (
        <div className="md:hidden bg-slate-900 border-b border-slate-800 p-2 flex flex-col gap-2 relative z-30">
            <NavButton active={currentView === 'rocket'} onClick={() => {setCurrentView('rocket'); setIsMenuOpen(false)}} label="Space Mission" icon="🚀" />
            <NavButton active={currentView === 'engine'} onClick={() => {setCurrentView('engine'); setIsMenuOpen(false)}} label="V8 Engine" icon="⚙️" />
            <NavButton active={currentView === 'fan'} onClick={() => {setCurrentView('fan'); setIsMenuOpen(false)}} label="Electric Fan" icon="💨" />
            <NavButton active={currentView === 'math'} onClick={() => {setCurrentView('math'); setIsMenuOpen(false)}} label="Math Zoo" icon="🦁" highlight />
        </div>
      )}

      {/* Main Content Area */}
      <main className="flex-1 w-full relative overflow-hidden flex flex-col">
        {currentView === 'rocket' && <RocketLaunch />}
        
        {currentView === 'engine' && (
          <div className="flex-1 overflow-y-auto p-8 flex items-center justify-center bg-gray-900">
            <V8Engine />
          </div>
        )}
        
        {currentView === 'fan' && (
          <div className="flex-1 overflow-y-auto p-8 flex items-center justify-center bg-slate-100 text-slate-900">
            <div className="bg-white p-12 rounded-3xl shadow-xl flex flex-col items-center">
              <h2 className="text-2xl font-bold mb-8 text-slate-700">Interactive Fan</h2>
              <Fan />
            </div>
          </div>
        )}

        {currentView === 'math' && (
             <div className="flex-1 h-full overflow-hidden">
                <MathGame />
             </div>
        )}
      </main>
    </div>
  );
};

const NavButton: React.FC<{ active: boolean; onClick: () => void; label: string; icon: string; highlight?: boolean }> = ({ active, onClick, label, icon, highlight }) => (
  <button
    onClick={onClick}
    className={`
      px-4 py-2 rounded-md text-xs font-bold transition-all flex items-center gap-2 w-full md:w-auto
      ${active 
        ? (highlight ? 'bg-yellow-500 text-white' : 'bg-blue-600 text-white') 
        : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'}
    `}
  >
    <span className="text-base">{icon}</span>
    {label}
  </button>
);

export default App;
