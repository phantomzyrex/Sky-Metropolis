/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI, Type } from '@google/genai';
import { AIGoal, BuildingType, CityStats, Grid, NewsItem } from './types.js';
import { BUILDINGS } from './constants.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const modelId = 'gemini-3.8-flash';

const getAI = () => {
  const apiKey = process.env.GEMINI_API_KEY || process.env.API_KEY;
  if (!apiKey) {
    throw new Error('Missing GEMINI_API_KEY environment variable');
  }
  return new GoogleGenAI({ apiKey });
};

// Fallback procedural goals if AI is unreachable or busy
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

const goalSchema = {
  type: Type.OBJECT,
  properties: {
    description: {
      type: Type.STRING,
      description: "A short, creative description of the goal from the perspective of city council or citizens.",
    },
    targetType: {
      type: Type.STRING,
      enum: ['population', 'money', 'building_count'],
      description: "The metric to track.",
    },
    targetValue: {
      type: Type.INTEGER,
      description: "The target numeric value to reach.",
    },
    buildingType: {
      type: Type.STRING,
      enum: [BuildingType.Residential, BuildingType.Commercial, BuildingType.Industrial, BuildingType.Park, BuildingType.Road],
      description: "Required if targetType is building_count.",
    },
    reward: {
      type: Type.INTEGER,
      description: "Monetary reward for completion.",
    },
  },
  required: ['description', 'targetType', 'targetValue', 'reward'],
};

const newsSchema = {
  type: Type.OBJECT,
  properties: {
    text: { type: Type.STRING, description: "A one-sentence news headline representing life in the city." },
    type: { type: Type.STRING, enum: ['positive', 'negative', 'neutral'] },
  },
  required: ['text', 'type'],
};

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '5mb' }));

  app.post('/api/goal', async (req, res) => {
    const { stats, grid, cityName = 'SkyMetropolis' } = req.body as {
      stats: CityStats;
      grid: Grid;
      cityName?: string;
    };

    const safeStats: CityStats = stats || { money: 1000, population: 0, day: 1 };
    const counts: Record<string, number> = {};
    if (Array.isArray(grid)) {
      grid.flat().forEach(tile => {
        if (tile && tile.buildingType) {
          counts[tile.buildingType] = (counts[tile.buildingType] || 0) + 1;
        }
      });
    }

    const context = `
      City Name: ${cityName}
      Current City Stats:
      Day: ${safeStats.day}
      Money: $${safeStats.money}
      Population: ${safeStats.population}
      Buildings: ${JSON.stringify(counts)}
      Building Costs/Stats: ${JSON.stringify(
        Object.values(BUILDINGS)
          .filter(b => b.type !== BuildingType.None)
          .map(b => ({ type: b.type, cost: b.cost, pop: b.popGen, income: b.incomeGen }))
      )}
    `;

    const prompt = `You are the AI City Advisor for the city named "${cityName}". Based on the current city stats, generate a challenging but achievable short-term goal for the player to help the city grow. Return JSON.`;

    try {
      const ai = getAI();
      const response = await ai.models.generateContent({
        model: modelId,
        contents: `${context}\n${prompt}`,
        config: {
          responseMimeType: "application/json",
          responseSchema: goalSchema,
          temperature: 0.7,
        },
      });

      if (response.text) {
        const goalData = JSON.parse(response.text) as Omit<AIGoal, 'completed'>;
        return res.json({ ...goalData, completed: false });
      }
    } catch (error) {
      console.warn("Server AI goal generation fallback active:", error);
    }

    return res.json(getFallbackGoal(safeStats, counts, cityName));
  });

  app.post('/api/news', async (req, res) => {
    const {
      stats,
      recentAction = null,
      cityName = 'SkyMetropolis',
      weatherName = 'Clear'
    } = req.body as {
      stats: CityStats;
      recentAction?: string | null;
      cityName?: string;
      weatherName?: string;
    };

    const safeStats: CityStats = stats || { money: 1000, population: 0, day: 1 };
    const context = `City Name: ${cityName}, Pop: ${safeStats.population}, Money: ${safeStats.money}, Day: ${safeStats.day}, Current Weather: ${weatherName}. ${recentAction ? `Recent Action: ${recentAction}` : ''}`;
    const prompt = `Generate a very short, isometric-sim-city style news headline for the city "${cityName}" based on the city state and current weather (${weatherName}). Can be funny, cynical, or celebratory.`;

    try {
      const ai = getAI();
      const response = await ai.models.generateContent({
        model: modelId,
        contents: `${context}\n${prompt}`,
        config: {
          responseMimeType: "application/json",
          responseSchema: newsSchema,
          temperature: 1.1,
        },
      });

      if (response.text) {
        const data = JSON.parse(response.text);
        return res.json({
          id: Date.now().toString() + Math.random(),
          text: data.text,
          type: data.type,
        });
      }
    } catch (error) {
      console.warn("Server AI news generation fallback active:", error);
    }

    const item = fallbackNewsHeadlines[Math.floor(Math.random() * fallbackNewsHeadlines.length)];
    return res.json({
      id: Date.now().toString() + Math.random(),
      text: item.text,
      type: item.type,
    });
  });

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*all', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
