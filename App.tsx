
import React, { useState } from 'react';
import { RocketLaunch } from './components/RocketLaunch';
import { Fan } from './components/Fan';
import { V8Engine } from './components/V8Engine';
import { MathGame } from './components/MathGame';
import { PizzaMaster } from './components/PizzaMaster';
import { FruitBalance } from './components/FruitBalance';
import { MysteryPyramid } from './components/MysteryPyramid';
import { MarsRover } from './components/MarsRover';
import { NumberFactory } from './components/NumberFactory';

type View = 'rocket' | 'fan' | 'engine' | 'math' | 'pizza' | 'balance' | 'pyramid' | 'rover' | 'factory';

const App: React.FC = () => {
  const [currentView, setCurrentView] = useState<View>('math');
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  return (
    <div className="h-[100dvh] flex flex-col bg-slate-950 text-slate-200 overflow-hidden font-sans selection:bg-blue-500 selection:text-white touch-manipulation">
      {/* Header / Nav */}
      <header className="w-full h-14 md:h-16 bg-slate-900 border-b border-slate-800 flex items-center px-4 justify-between z-30 shadow-lg shrink-0 relative">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center shadow-blue-500/20 shadow-lg">
            <span className="text-lg">🚀</span>
          </div>
          <div>
            <h1 className="text-base md:text-lg font-bold text-slate-100 tracking-wider uppercase font-mono hidden md:block">
              Interactive
              <span className="text-blue-500 mx-2">///</span>
              Playground
            </h1>
            <h1 className="text-base font-bold text-slate-100 md:hidden">Playground</h1>
          </div>
        </div>
        
        {/* Desktop Nav */}
        <nav className="hidden md:flex items-center gap-1 bg-slate-800/50 p-1 rounded-lg overflow-x-auto no-scrollbar max-w-[70vw]">
            <NavButton active={currentView === 'rocket'} onClick={() => setCurrentView('rocket')} label="Space" icon="🚀" />
            <NavButton active={currentView === 'engine'} onClick={() => setCurrentView('engine')} label="Engine" icon="⚙️" />
            <NavButton active={currentView === 'fan'} onClick={() => setCurrentView('fan')} label="Fan" icon="💨" />
            <div className="w-px h-6 bg-slate-700 mx-2 shrink-0"></div>
            <NavButton active={currentView === 'math'} onClick={() => setCurrentView('math')} label="Math Zoo" icon="🦁" highlight />
            <NavButton active={currentView === 'pizza'} onClick={() => setCurrentView('pizza')} label="Fraction Chef" icon="🍕" highlight />
            <NavButton active={currentView === 'balance'} onClick={() => setCurrentView('balance')} label="Balance" icon="⚖️" highlight />
            <NavButton active={currentView === 'pyramid'} onClick={() => setCurrentView('pyramid')} label="Pyramid" icon="🏜️" highlight />
            <NavButton active={currentView === 'rover'} onClick={() => setCurrentView('rover')} label="Logic Rover" icon="🤖" highlight />
            <NavButton active={currentView === 'factory'} onClick={() => setCurrentView('factory')} label="Num Factory" icon="🏭" highlight />
        </nav>

        {/* Mobile Menu Button */}
        <button 
          className="md:hidden p-2 text-slate-400 hover:text-white active:bg-slate-800 rounded"
          onClick={() => setIsMenuOpen(!isMenuOpen)}
        >
          {isMenuOpen ? '✕' : '☰'}
        </button>

        {/* Mobile Nav Menu Overlay */}
        {isMenuOpen && (
          <div className="absolute top-14 left-0 w-full bg-slate-900/95 backdrop-blur-md border-b border-slate-800 p-4 flex flex-col gap-3 shadow-2xl animate-in slide-in-from-top-5 duration-200 z-50 max-h-[calc(100dvh-3.5rem)] overflow-y-auto">
              <NavButton active={currentView === 'rocket'} onClick={() => {setCurrentView('rocket'); setIsMenuOpen(false)}} label="Space Mission" icon="🚀" mobile />
              <NavButton active={currentView === 'engine'} onClick={() => {setCurrentView('engine'); setIsMenuOpen(false)}} label="V8 Engine" icon="⚙️" mobile />
              <NavButton active={currentView === 'fan'} onClick={() => {setCurrentView('fan'); setIsMenuOpen(false)}} label="Electric Fan" icon="💨" mobile />
              <div className="h-px bg-slate-800 my-1"></div>
              <NavButton active={currentView === 'math'} onClick={() => {setCurrentView('math'); setIsMenuOpen(false)}} label="Math Zoo" icon="🦁" highlight mobile />
              <NavButton active={currentView === 'pizza'} onClick={() => {setCurrentView('pizza'); setIsMenuOpen(false)}} label="Fraction Chef" icon="🍕" highlight mobile />
              <NavButton active={currentView === 'balance'} onClick={() => {setCurrentView('balance'); setIsMenuOpen(false)}} label="Market Balance" icon="⚖️" highlight mobile />
              <NavButton active={currentView === 'pyramid'} onClick={() => {setCurrentView('pyramid'); setIsMenuOpen(false)}} label="Mystery Pyramid" icon="🏜️" highlight mobile />
              <NavButton active={currentView === 'rover'} onClick={() => {setCurrentView('rover'); setIsMenuOpen(false)}} label="Logic Rover" icon="🤖" highlight mobile />
              <NavButton active={currentView === 'factory'} onClick={() => {setCurrentView('factory'); setIsMenuOpen(false)}} label="Number Factory" icon="🏭" highlight mobile />
          </div>
        )}
      </header>
      

      {/* Main Content Area */}
      <main className="flex-1 w-full relative overflow-hidden flex flex-col">
        {currentView === 'rocket' && <RocketLaunch />}
        
        {currentView === 'engine' && (
          <div className="flex-1 overflow-y-auto p-4 md:p-8 flex items-center justify-center bg-gray-900">
            <V8Engine />
          </div>
        )}
        
        {currentView === 'fan' && (
          <div className="flex-1 overflow-y-auto p-4 md:p-8 flex items-center justify-center bg-slate-100 text-slate-900">
            <div className="bg-white p-6 md:p-12 rounded-3xl shadow-xl flex flex-col items-center w-full max-w-md md:max-w-none">
              <h2 className="text-xl md:text-2xl font-bold mb-4 md:mb-8 text-slate-700">Interactive Fan</h2>
              <Fan />
            </div>
          </div>
        )}

        {currentView === 'math' && (
             <div className="flex-1 h-full overflow-hidden">
                <MathGame />
             </div>
        )}

        {currentView === 'pizza' && (
             <div className="flex-1 h-full overflow-hidden bg-orange-50">
                <PizzaMaster />
             </div>
        )}

        {currentView === 'balance' && (
             <div className="flex-1 h-full overflow-hidden bg-emerald-50">
                <FruitBalance />
             </div>
        )}

        {currentView === 'pyramid' && (
             <div className="flex-1 h-full overflow-hidden bg-amber-50">
                <MysteryPyramid />
             </div>
        )}

        {currentView === 'rover' && (
             <div className="flex-1 h-full overflow-hidden bg-slate-950">
                <MarsRover />
             </div>
        )}

        {currentView === 'factory' && (
             <div className="flex-1 h-full overflow-hidden bg-indigo-950">
                <NumberFactory />
             </div>
        )}
      </main>
    </div>
  );
};

const NavButton: React.FC<{ active: boolean; onClick: () => void; label: string; icon: string; highlight?: boolean; mobile?: boolean }> = ({ active, onClick, label, icon, highlight, mobile }) => (
  <button
    onClick={onClick}
    className={`
      px-4 py-2 rounded-md font-bold transition-all flex items-center gap-3 md:gap-2 whitespace-nowrap
      ${mobile ? 'text-base h-14 w-full border border-slate-800' : 'text-xs shrink-0'}
      ${active 
        ? (highlight ? 'bg-amber-500 text-white shadow-lg shadow-amber-500/20' : 'bg-blue-600 text-white') 
        : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'}
    `}
  >
    <span className="text-xl md:text-base">{icon}</span>
    {label}
  </button>
);

export default App;
