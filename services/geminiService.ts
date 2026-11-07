/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import { AIGoal, BuildingType, CityStats, Grid, NewsItem } from "../types";

// Fallback procedural goals if the server request fails
const getFallbackGoal = (stats: CityStats, counts: Record<string, number>, cityName: string = 'SkyMetropolis'): AIGoal => {
  const resCount = counts[BuildingType.Residential] || 0;
  const comCount = counts[BuildingType.Commercial] || 0;
  const indCount = counts[BuildingType.Industrial] || 0;
  const parkCount = counts[BuildingType.Park] || 0;

  if (resCount < 3) {
    return {
      description: `Expand neighborhood housing to welcome more citizens to ${cityName}.`,
      targetType: 'building_count',
      buildingType: BuildingType.Residential,
      targetValue: resCount + 2,
      reward: 150,
      completed: false
    };
  }

  if (comCount < Math.ceil(resCount / 2)) {
    return {
      description: `Establish new commercial shops in ${cityName} to serve growing consumer demand.`,
      targetType: 'building_count',
      buildingType: BuildingType.Commercial,
      targetValue: comCount + 1,
      reward: 200,
      completed: false
    };
  }

  if (stats.population < 100) {
    return {
      description: `Boost ${cityName}'s population through residential development.`,
      targetType: 'population',
      targetValue: Math.max(50, Math.ceil((stats.population + 30) / 25) * 25),
      reward: 250,
      completed: false
    };
  }

  if (indCount < 2) {
    return {
      description: `Develop industrial manufacturing hubs to bolster ${cityName}'s production capacity.`,
      targetType: 'building_count',
      buildingType: BuildingType.Industrial,
      targetValue: indCount + 1,
      reward: 220,
      completed: false
    };
  }

  if (parkCount < 2) {
    return {
      description: `Create public green parks to elevate citizen happiness in ${cityName}.`,
      targetType: 'building_count',
      buildingType: BuildingType.Park,
      targetValue: parkCount + 2,
      reward: 180,
      completed: false
    };
  }

  return {
    description: `Grow ${cityName}'s municipal treasury through wise investments and steady taxation.`,
    targetType: 'money',
    targetValue: stats.money + 300,
    reward: 300,
    completed: false
  };
};

const fallbackNewsHeadlines: { text: string; type: 'positive' | 'negative' | 'neutral' }[] = [
  { text: "Local bakery's fresh cinnamon rolls spark morning line down the block.", type: 'positive' },
  { text: "City engineers report flawless utility grid synchronization.", type: 'positive' },
  { text: "Pigeons seen organizing surprisingly orderly traffic detour.", type: 'neutral' },
  { text: "Skyline expansion voted overwhelmingly popular in recent poll.", type: 'positive' },
  { text: "Breeze from the bay brings optimal kite-flying conditions to central plazas.", type: 'positive' },
  { text: "Residents discuss rumors of new zoning developments over coffee.", type: 'neutral' },
  { text: "Transit authority notes record-low commuting delays this morning.", type: 'positive' },
  { text: "High-rise construction workers wave cheerfully to passing clouds.", type: 'neutral' },
  { text: "Citizens pop colorful umbrellas as passing afternoon showers refresh the streets.", type: 'positive' },
  { text: "Soft nighttime snow flurries turn the city skyline into a winter postcard.", type: 'positive' }
];

// --- Goal Generation (via Server API) ---

export const generateCityGoal = async (stats: CityStats, grid: Grid, cityName: string = 'SkyMetropolis'): Promise<AIGoal | null> => {
  const counts: Record<string, number> = {};
  grid.flat().forEach(tile => {
    counts[tile.buildingType] = (counts[tile.buildingType] || 0) + 1;
  });

  try {
    const response = await fetch('/api/goal', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ stats, grid, cityName }),
    });

    if (response.ok) {
      const data = await response.json();
      return data as AIGoal;
    }
  } catch (error) {
    console.warn("Goal API call failed, using fallback:", error);
  }

  return getFallbackGoal(stats, counts, cityName);
};

// --- News Feed Generation (via Server API) ---

export const generateNewsEvent = async (
  stats: CityStats,
  recentAction: string | null,
  cityName: string = 'SkyMetropolis',
  weatherName: string = 'Clear'
): Promise<NewsItem | null> => {
  try {
    const response = await fetch('/api/news', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ stats, recentAction, cityName, weatherName }),
    });

    if (response.ok) {
      const data = await response.json();
      return data as NewsItem;
    }
  } catch (error) {
    console.warn("News API call failed, using fallback:", error);
  }

  const item = fallbackNewsHeadlines[Math.floor(Math.random() * fallbackNewsHeadlines.length)];
  return {
    id: Date.now().toString() + Math.random(),
    text: item.text,
    type: item.type,
  };
};