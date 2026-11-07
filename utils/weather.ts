/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import { WeatherType, WeatherInfo } from '../types';

export const CYCLE_DAYS = 8;

/**
 * Determines weather state correlated with the 8-day day/night cycle:
 * - Day 1: Dawn (Clear)
 * - Day 2: Bright Morning (Clear)
 * - Day 3: Midday (Clear)
 * - Day 4: Afternoon rain showers (Rain)
 * - Day 5: Sunset / Dusk (Clearing)
 * - Day 6: Early Night (Clear Starlight)
 * - Day 7: Cold Midnight Flurry (Snow)
 * - Day 8: Late Night / Pre-Dawn (Clearing)
 */
export const getWeatherForDay = (day: number): WeatherInfo => {
  const dayInCycle = ((day - 1) % CYCLE_DAYS) + 1;
  const cycleIndex = Math.floor((day - 1) / CYCLE_DAYS);

  const isRainDay = (dayInCycle === 4) || (cycleIndex % 2 === 1 && dayInCycle === 5);
  const isSnowDay = (dayInCycle === 7) || (cycleIndex % 3 === 0 && dayInCycle === 8);

  if (isRainDay) {
    return {
      type: 'rain',
      name: 'Rain',
      icon: '🌧️',
      description: 'Afternoon rain shower sweeping across the metropolis'
    };
  }

  if (isSnowDay) {
    return {
      type: 'snow',
      name: 'Snow',
      icon: '❄️',
      description: 'Cold winter snow flurries drifting through the night'
    };
  }

  return {
    type: 'clear',
    name: 'Clear',
    icon: dayInCycle >= 6 ? '✨' : '☀️',
    description: dayInCycle >= 6 ? 'Clear starlit night' : 'Bright and sunny skies'
  };
};
