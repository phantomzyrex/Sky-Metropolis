/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import React from 'react';
import { WeatherType } from '../types';

interface WeatherOverlayProps {
  weather: WeatherType;
}

export const WeatherOverlay: React.FC<WeatherOverlayProps> = ({ weather }) => {
  if (weather === 'clear') return null;

  return (
    <div className="absolute inset-0 pointer-events-none z-20 overflow-hidden transition-opacity duration-1000">
      {/* Rain Atmosphere Overlay */}
      {weather === 'rain' && (
        <>
          {/* Rainy Vignette & Ambient Mist */}
          <div 
            className="absolute inset-0 bg-gradient-to-b from-slate-900/25 via-transparent to-slate-950/40 mix-blend-multiply transition-opacity duration-1000"
            style={{
              boxShadow: 'inset 0 0 120px rgba(15, 23, 42, 0.5)'
            }}
          />

          {/* Screen Rain Streaks (CSS particle layers for foreground depth) */}
          <div className="absolute inset-0 opacity-40 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-blue-900/10 via-transparent to-transparent" />
          
          <div className="absolute inset-0 overflow-hidden">
            <div className="rain-layer rain-fast" />
            <div className="rain-layer rain-slow" />
          </div>
        </>
      )}

      {/* Snow Atmosphere Overlay */}
      {weather === 'snow' && (
        <>
          {/* Frosty Ambient Vignette */}
          <div 
            className="absolute inset-0 transition-opacity duration-1000"
            style={{
              boxShadow: 'inset 0 0 140px rgba(186, 230, 253, 0.22), inset 0 0 60px rgba(255, 255, 255, 0.12)'
            }}
          />

          {/* Gentle Foreground Snow Flurries */}
          <div className="absolute inset-0 overflow-hidden opacity-75">
            <div className="snow-layer snow-foreground" />
            <div className="snow-layer snow-background" />
          </div>
        </>
      )}
    </div>
  );
};
