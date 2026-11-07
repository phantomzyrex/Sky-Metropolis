/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import React, { useState } from 'react';

const RANDOM_NAMES = [
  'SkyMetropolis',
  'Neo Avalon',
  'Aether City',
  'Verdant Bay',
  'Zenith Heights',
  'CloudHaven',
  'Solaris Reach',
  'Nova Marina'
];

interface StartScreenProps {
  onStart: (cityName: string, aiEnabled: boolean) => void;
  defaultCityName?: string;
}

const StartScreen: React.FC<StartScreenProps> = ({ onStart, defaultCityName = 'SkyMetropolis' }) => {
  const [cityName, setCityName] = useState(defaultCityName);
  const [aiEnabled, setAiEnabled] = useState(true);

  const handleRandomize = () => {
    const available = RANDOM_NAMES.filter(n => n !== cityName);
    const chosen = available[Math.floor(Math.random() * available.length)];
    setCityName(chosen);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const finalName = cityName.trim() || 'SkyMetropolis';
    onStart(finalName, aiEnabled);
  };

  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center z-50 text-white font-sans p-6 bg-black/30 backdrop-blur-sm transition-all duration-1000">
      <div className="max-w-md w-full bg-slate-900/90 p-8 rounded-2xl border border-slate-700 shadow-2xl backdrop-blur-xl relative overflow-hidden animate-fade-in">
        {/* Decorative background glow */}
        <div className="absolute -top-24 -right-24 w-48 h-48 bg-cyan-500/20 rounded-full blur-3xl pointer-events-none"></div>
        <div className="absolute -bottom-24 -left-24 w-48 h-48 bg-indigo-500/20 rounded-full blur-3xl pointer-events-none"></div>
        
        <div className="relative z-10">
          <h1 className="text-5xl font-black mb-2 bg-gradient-to-br from-white via-cyan-200 to-blue-400 bg-clip-text text-transparent tracking-tight">
            SkyMetropolis
          </h1>
          <p className="text-slate-400 mb-6 text-sm font-medium uppercase tracking-widest">
            Isometric City Builder
          </p>

          <form onSubmit={handleSubmit}>
            {/* City Name Input */}
            <div className="mb-5 bg-slate-800/50 p-4 rounded-xl border border-slate-700/50 hover:border-slate-600 transition-colors shadow-inner">
              <div className="flex justify-between items-center mb-2">
                <label htmlFor="cityNameInput" className="text-xs font-bold uppercase tracking-wider text-slate-300">
                  City Name
                </label>
                <button
                  type="button"
                  onClick={handleRandomize}
                  className="text-[11px] text-cyan-400 hover:text-cyan-300 font-mono transition-colors flex items-center gap-1 cursor-pointer"
                  title="Generate random name"
                >
                  <span>🎲 Randomize</span>
                </button>
              </div>
              <input
                id="cityNameInput"
                type="text"
                value={cityName}
                onChange={(e) => setCityName(e.target.value)}
                maxLength={24}
                placeholder="Enter city name..."
                className="w-full bg-slate-900/90 border border-slate-600 focus:border-cyan-400 focus:ring-2 focus:ring-cyan-500/30 rounded-lg px-3.5 py-2.5 text-white font-bold placeholder-slate-500 outline-none transition-all shadow-inner text-base"
              />
              <span className="text-[10px] text-slate-500 mt-1 block">
                Give your metropolis a distinctive identity
              </span>
            </div>

            {/* AI Advisor Toggle */}
            <div className="bg-slate-800/50 p-4 rounded-xl border border-slate-700/50 mb-6 hover:border-slate-600 transition-colors shadow-inner">
              <label className="flex items-center justify-between cursor-pointer group">
                <div className="flex flex-col gap-1">
                  <span className="font-bold text-sm text-slate-200 group-hover:text-white transition-colors flex items-center gap-2">
                    AI City Advisor
                    {aiEnabled && <span className="flex h-2 w-2 rounded-full bg-cyan-400 animate-pulse"></span>}
                  </span>
                  <span className="text-xs text-slate-500 group-hover:text-slate-400 transition-colors">
                    Enable dynamic quests & news events via Gemini API
                  </span>
                </div>
                
                <div className="relative flex-shrink-0 ml-4">
                  <input 
                    type="checkbox" 
                    className="sr-only peer"
                    checked={aiEnabled}
                    onChange={(e) => setAiEnabled(e.target.checked)}
                  />
                  <div className="w-11 h-6 bg-slate-700 rounded-full peer peer-focus:ring-2 peer-focus:ring-cyan-500/40 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-slate-300 after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-cyan-600 peer-checked:after:bg-white"></div>
                </div>
              </label>
            </div>

            <button 
              type="submit"
              className="w-full py-4 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-bold rounded-xl shadow-lg shadow-cyan-900/20 transform transition-all hover:scale-[1.02] active:scale-[0.98] text-lg tracking-wide cursor-pointer"
            >
              Start Building
            </button>
          </form>

          <div className="mt-8 text-center">
            <div className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-cyan-400 transition-colors font-mono">
              <span>Created with ❤️ by</span>
              <span className="font-bold text-slate-200">Shivang Gupta</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default StartScreen;