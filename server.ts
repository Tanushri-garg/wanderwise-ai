import express from 'express';
import path from 'path';
import dotenv from 'dotenv';
import { GoogleGenAI } from '@google/genai';
import { createServer as createViteServer } from 'vite';
import { generateSmartTripPlan } from './serverFallbackPlanner';

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json());

// Helper function to interpret WMO weather codes
function decodeWeatherCode(code: number): { condition: string; packing: string } {
  switch (code) {
    case 0:
      return { condition: 'Clear sky', packing: 'Sunglasses, sunblock, light breathable clothing' };
    case 1:
    case 2:
      return { condition: 'Mainly clear / Partly cloudy', packing: 'Light layers, comfortable walking shoes, sunglasses' };
    case 3:
      return { condition: 'Overcast', packing: 'Comfortable light jacket or sweater, casual walking shoes' };
    case 45:
    case 48:
      return { condition: 'Foggy / Mist', packing: 'Windbreaker, warm layers, moisture-wicking clothes' };
    case 51:
    case 53:
    case 55:
      return { condition: 'Drizzle', packing: 'Compact umbrella, water-resistant light jacket' };
    case 61:
    case 63:
    case 65:
      return { condition: 'Rain', packing: 'Raincoat or sturdy umbrella, waterproof shoes' };
    case 71:
    case 73:
    case 75:
      return { condition: 'Snowfall', packing: 'Insulated winter coat, gloves, thermal innerwear, boots' };
    case 80:
    case 81:
    case 82:
      return { condition: 'Rain showers', packing: 'Waterproof jacket, quick-drying clothing, travel umbrella' };
    case 95:
    case 96:
    case 99:
      return { condition: 'Thunderstorm', packing: 'Heavy-duty raincoat, waterproof bag cover, indoor backup plans' };
    default:
      return { condition: 'Mild / Variable', packing: 'Versatile layers and comfortable walking shoes' };
  }
}

// In-memory weather cache
const weatherCache = new Map<string, { data: any; timestamp: number }>();
const CACHE_TTL = 30 * 60 * 1000; // 30 minutes

// Helper to fetch live weather from Open-Meteo
async function getLiveWeather(city: string) {
  const normalizedCity = city.trim().toLowerCase();
  const cached = weatherCache.get(normalizedCity);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data;
  }

  try {
    const geoUrl = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1&language=en&format=json`;
    const geoRes = await fetch(geoUrl, { signal: AbortSignal.timeout(4000) });
    if (!geoRes.ok) {
      throw new Error(`Geocoding failed: ${geoRes.statusText}`);
    }
    const geoData = (await geoRes.json()) as { results?: Array<{ latitude: number; longitude: number; name: string; country?: string }> };

    if (!geoData.results || geoData.results.length === 0) {
      const fallbackWeather = {
        destination: city,
        temperature: '22°C (72°F) typical',
        rainProbability: '15% average',
        condition: 'Temperate / Seasonable',
        packingAdvice: 'Pack versatile clothing layers, sunglasses, and comfortable walking shoes.',
        isLiveData: false,
        source: 'Estimated Regional Benchmark',
      };
      weatherCache.set(normalizedCity, { data: fallbackWeather, timestamp: Date.now() });
      return fallbackWeather;
    }

    const { latitude, longitude, name: resolvedName, country } = geoData.results[0];
    const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,relative_humidity_2m,weather_code&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max&timezone=auto`;
    const weatherRes = await fetch(weatherUrl, { signal: AbortSignal.timeout(4000) });
    if (!weatherRes.ok) {
      throw new Error(`Weather fetch failed: ${weatherRes.statusText}`);
    }
    const weatherData = (await weatherRes.json()) as {
      current?: { temperature_2m: number; relative_humidity_2m: number; weather_code: number };
      daily?: {
        temperature_2m_max: number[];
        temperature_2m_min: number[];
        precipitation_probability_max?: number[];
        weather_code: number[];
      };
    };

    const currentTemp = weatherData.current?.temperature_2m ?? 20;
    const weatherCode = weatherData.current?.weather_code ?? weatherData.daily?.weather_code?.[0] ?? 1;
    const rainProb = weatherData.daily?.precipitation_probability_max?.[0] ?? 20;
    const minTemp = weatherData.daily?.temperature_2m_min?.[0] ?? currentTemp - 4;
    const maxTemp = weatherData.daily?.temperature_2m_max?.[0] ?? currentTemp + 4;

    const { condition, packing } = decodeWeatherCode(weatherCode);

    const liveWeather = {
      destination: `${resolvedName}${country ? ', ' + country : ''}`,
      temperature: `${Math.round(currentTemp)}°C (${Math.round((currentTemp * 9) / 5 + 32)}°F) [High: ${Math.round(maxTemp)}°C, Low: ${Math.round(minTemp)}°C]`,
      rainProbability: `${rainProb}% chance of rain`,
      condition,
      packingAdvice: packing,
      isLiveData: true,
      source: 'Open-Meteo Global Weather Network (Live)',
    };
    weatherCache.set(normalizedCity, { data: liveWeather, timestamp: Date.now() });
    return liveWeather;
  } catch (err: unknown) {
    console.error('Weather error:', err);
    const fallbackWeather = {
      destination: city,
      temperature: '21°C (70°F) estimated',
      rainProbability: '20% estimated',
      condition: 'Partly sunny and pleasant',
      packingAdvice: 'Layered outfits, comfortable walking shoes, and a light travel umbrella.',
      isLiveData: false,
      source: 'Estimated Seasonal Climate',
    };
    weatherCache.set(normalizedCity, { data: fallbackWeather, timestamp: Date.now() });
    return fallbackWeather;
  }
}

// Live Weather Endpoint using Open-Meteo (Free, No API key needed, real-time live data)
app.get('/api/weather', async (req, res) => {
  const city = req.query.city as string;
  if (!city) {
    return res.status(400).json({ error: 'City parameter is required' });
  }
  const weather = await getLiveWeather(city);
  return res.json(weather);
});

// Gemini AI Chat / Planner Endpoint
app.post('/api/chat', async (req, res) => {
  const { messages, currentParams } = req.body;

  if (!messages || !Array.isArray(messages)) {
    return res.status(400).json({ error: 'Messages array is required' });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    const lastUserMsg = [...messages].reverse().find((m: { role: string }) => m.role === 'user')?.content || '';
    const updatedParams = { ...currentParams };

    // Extract quick hints from user message if available
    const destMatch = lastUserMsg.match(/(?:to|in|visit|trip to)\s+([A-Z][a-zA-Z\s,]+)/i);
    if (destMatch && !updatedParams.destination) {
      updatedParams.destination = destMatch[1].trim();
    }
    const daysMatch = lastUserMsg.match(/(\d+)\s*(?:day|days)/i);
    if (daysMatch) {
      updatedParams.days = parseInt(daysMatch[1], 10);
    }
    const budgetMatch = lastUserMsg.match(/[\$€£₹]?\s*(\d+[\d,]*)\s*(?:dollars|usd|eur|inr|gbp|\$|€|£|₹|budget)/i);
    if (budgetMatch) {
      updatedParams.budget = parseInt(budgetMatch[1].replace(/,/g, ''), 10);
    }

    const city = updatedParams.destination || 'Paris, France';
    const liveWeather = await getLiveWeather(city);
    const tripPlan = generateSmartTripPlan(updatedParams, liveWeather);

    return res.json({
      reply: `I've prepared a customized travel plan for ${tripPlan.destination} for ${tripPlan.days} days with an estimated budget of ${tripPlan.currency} ${tripPlan.userBudget}. Check out the breakdown, hotel suggestions, live weather, daily itinerary, and conclusion in the trip panel!`,
      extractedParams: {
        destination: tripPlan.destination,
        startingCity: tripPlan.startingCity,
        travelDates: tripPlan.travelDates,
        days: tripPlan.days,
        travelers: tripPlan.travelers,
        budget: tripPlan.userBudget,
        currency: tripPlan.currency,
        preferences: tripPlan.preferences,
      },
      tripPlan,
    });
  }

  try {
    const ai = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });

    const systemInstruction = `
You are "WanderWise AI", an intelligent, modern, budget-conscious AI Travel Planner chatbot. Your motto is "Plan Smart. Travel Wise."
Your goal is to help users plan amazing trips tailored strictly to their budget.

REQUIRED CORE FEATURES TO TRACK & COLLECT:
1. Destination
2. Starting city
3. Travel dates
4. Number of days
5. Number of travelers
6. Total budget
7. Currency (e.g. USD, EUR, INR, GBP, JPY, CAD, AUD, etc. Default to USD if unspecified)
8. Travel preferences (e.g. adventure, relaxation, sightseeing, food, shopping, cultural, nature, nightlife)

BEHAVIOR RULES:
- When any core parameters are missing, converse warmly, ask for the missing details naturally or summarize what you have so far.
- Once you have the essential information (at least destination, days, budget, and preferably travelers, starting city, dates, preferences), CREATE A FULL TRIP PLAN in the structured JSON response.
- If the user asks to modify an existing trip plan (e.g. "make it cheaper", "add more shopping", "change to 4 days", "change budget to $1000"), regenerate and adjust the plan accordingly.

BUDGET PLANNING RULES:
- Break the user's total budget into 6 categories:
  1. Transportation (flights/trains between starting city and destination)
  2. Hotel/accommodation
  3. Food (daily meals and snacks)
  4. Local transportation (metro, cabs, rentals)
  5. Activities/sightseeing
  6. Emergency/miscellaneous expenses (5-10% buffer)
- Sum of estimated costs: check if total stays within user's budget.
- If the trip exceeds the user's budget:
  * Activate SMART BUDGET ADJUSTMENT:
    - Explain clearly why it exceeded (e.g. high flight costs, luxury hotels, expensive ticketed activities).
    - Suggest cheaper hotels (hostels, guesthouses, 2-3 star boutique).
    - Suggest cheaper transportation (budget flights, trains, night buses, public transit).
    - Remove or replace expensive activities with free walking tours, public viewpoints, open parks.
    - Present the revised plan that fits the budget as closely as possible.

HOTEL INFORMATION RULES:
- Suggest 2 to 3 suitable hotels matching user's budget range.
- Provide: Hotel name, approximate price per night, estimated total stay cost, budget category ('Budget', 'Mid-range', 'Luxury'), location/area.
- Explicitly set isLivePrice: false (since real-time hotel booking rates require live supplier booking access; prices are market benchmark estimates).

DAILY ITINERARY RULES:
- For EVERY single day (from Day 1 to Day N):
  * Morning (activity description & estimated activity cost)
  * Afternoon (activity description & estimated activity cost)
  * Evening (activity description & estimated activity cost)
  * Day total activity cost.

TRIP CONCLUSION:
- Provide a clear conclusion:
  * Whether trip fits their budget (boolean & text status)
  * Estimated total cost
  * Remaining budget or amount over budget
  * Best hotel option
  * Best activity
  * Whether the selected dates are suitable (weather/season-wise)
  * One final practical recommendation.

FORMAT REQUIREMENT:
You MUST respond with valid JSON ONLY. No markdown wrappers (\`\`\`json ... \`\`\`), just raw JSON adhering to this schema:
{
  "reply": "Conversational assistant reply to the user. Speak warmly, clearly, highlighting key choices or asking questions.",
  "extractedParams": {
    "destination": "string or null",
    "startingCity": "string or null",
    "travelDates": "string or null",
    "days": number or null,
    "travelers": number or null,
    "budget": number or null,
    "currency": "USD",
    "preferences": ["sightseeing", "food"]
  },
  "tripPlan": null or {
    "destination": "Paris, France",
    "startingCity": "London, UK",
    "travelDates": "Oct 10 - Oct 13, 2026",
    "days": 3,
    "travelers": 2,
    "userBudget": 1200,
    "currency": "USD",
    "preferences": ["sightseeing", "food"],
    "budgetBreakdown": {
      "transportation": 240,
      "hotel": 450,
      "food": 240,
      "localTransport": 60,
      "activities": 130,
      "emergency": 80,
      "totalEstimated": 1200,
      "userBudget": 1200,
      "currency": "USD",
      "fitsBudget": true,
      "variance": 0,
      "varianceExplanation": "The itinerary is calibrated to stay right on budget with a prudent emergency reserve."
    },
    "hotels": [
      {
        "id": "h1",
        "name": "Hotel des Arts Montmartre",
        "pricePerNight": 150,
        "totalCost": 450,
        "category": "Mid-range",
        "location": "Montmartre / 18th Arrondissement",
        "isLivePrice": false,
        "rating": "4.5/5",
        "highlights": "Charming Parisian neighborhood, metro access, free continental breakfast"
      }
    ],
    "weather": {
      "destination": "Paris, France",
      "temperature": "16°C (61°F) average",
      "rainProbability": "25% chance of light showers",
      "condition": "Mild autumn with occasional drizzle",
      "packingAdvice": "Pack light layers, a trench coat or waterproof windbreaker, and walking boots.",
      "isLiveData": false,
      "source": "Estimated Seasonal Climate"
    },
    "itinerary": [
      {
        "day": 1,
        "title": "Historic Icons & River Walk",
        "morning": { "activity": "Arrival, check-in, stroll around Notre-Dame and Île de la Cité", "cost": 0 },
        "afternoon": { "activity": "Louvre Courtyard exploration and Jardin des Tuileries", "cost": 25 },
        "evening": { "activity": "Sunset Seine River Cruise and bistrot dinner", "cost": 30 },
        "dayTotalCost": 55
      }
    ],
    "budgetAdjustment": {
      "needed": false,
      "explanation": "Trip is within user budget."
    },
    "conclusion": {
      "fitsBudget": true,
      "statusSummary": "Within Budget",
      "estimatedTotalCost": 1200,
      "remainingOrOverBudget": 0,
      "isOverBudget": false,
      "bestHotel": "Hotel des Arts Montmartre",
      "bestActivity": "Sunset Seine River Cruise",
      "datesSuitable": true,
      "datesSuitabilityNote": "October is pleasant with fewer crowds and crisp autumn foliage.",
      "finalRecommendation": "Book museum passes in advance to bypass long ticket lines and use the Paris Metro Carnet for affordable transit."
    }
  }
}
Current gathered parameters: ${JSON.stringify(currentParams || {})}
`;

    // Construct history for Gemini
    const contents = messages.map((m: { role: string; content: string }) => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }],
    }));

    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('AI generation timed out (fallback initiated)')), 11000)
    );

    const response = await Promise.race([
      ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents,
        config: {
          systemInstruction,
          responseMimeType: 'application/json',
          temperature: 0.7,
        },
      }),
      timeoutPromise,
    ]);

    const responseText = response.text || '{}';
    let parsedData;
    try {
      parsedData = JSON.parse(responseText);
    } catch {
      // If parsing fails, extract JSON substring
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        parsedData = JSON.parse(jsonMatch[0]);
      } else {
        parsedData = {
          reply: responseText,
          extractedParams: currentParams || {},
          tripPlan: null,
        };
      }
    }

    // If a trip plan with destination was generated, fetch real live weather data from Open-Meteo
    if (parsedData.tripPlan && (parsedData.tripPlan.destination || parsedData.extractedParams?.destination)) {
      const targetCity = parsedData.tripPlan.destination || parsedData.extractedParams?.destination;
      try {
        const liveWeather = await getLiveWeather(targetCity);
        parsedData.tripPlan.weather = liveWeather;
      } catch (e) {
        console.warn('Could not fetch live weather during plan enrichment:', e);
      }
    }

    return res.json(parsedData);
  } catch (error: unknown) {
    console.warn('Gemini API call failed or high demand, falling back to smart planner:', error);
    try {
      const lastUserMsg = [...messages].reverse().find((m: { role: string }) => m.role === 'user')?.content || '';
      const updatedParams = { ...currentParams };

      const destMatch = lastUserMsg.match(/(?:to|in|visit|trip to)\s+([A-Za-z\s,]+?)(?=\s+(?:with|for|from|starting|under|budget|\$|€|£|₹|\d)|$|[,\.!?])/i);
      if (destMatch && !updatedParams.destination) {
        updatedParams.destination = destMatch[1].trim();
      }
      const daysMatch = lastUserMsg.match(/(\d+)\s*(?:day|days)/i);
      if (daysMatch) {
        updatedParams.days = parseInt(daysMatch[1], 10);
      }
      const travelersMatch = lastUserMsg.match(/(\d+)\s*(?:travelers?|people|persons?|guests?|adults?)/i);
      if (travelersMatch) {
        updatedParams.travelers = parseInt(travelersMatch[1], 10);
      }
      const budgetMatch = lastUserMsg.match(/(?:budget\s*(?:of|is|:)?\s*)?[\$€£₹]?\s*(\d+[\d,]*)\s*(?:dollars|usd|eur|inr|gbp|\$|€|£|₹|budget)?/i);
      if (budgetMatch && parseInt(budgetMatch[1].replace(/,/g, ''), 10) > 10) {
        updatedParams.budget = parseInt(budgetMatch[1].replace(/,/g, ''), 10);
      }
      if (lastUserMsg.toLowerCase().includes('eur') || lastUserMsg.includes('€')) updatedParams.currency = 'EUR';
      else if (lastUserMsg.toLowerCase().includes('gbp') || lastUserMsg.includes('£')) updatedParams.currency = 'GBP';
      else if (lastUserMsg.toLowerCase().includes('inr') || lastUserMsg.includes('₹')) updatedParams.currency = 'INR';
      else if (lastUserMsg.toLowerCase().includes('jpy') || lastUserMsg.includes('¥')) updatedParams.currency = 'JPY';
      else if (lastUserMsg.toLowerCase().includes('usd') || lastUserMsg.includes('$')) updatedParams.currency = 'USD';

      const city = updatedParams.destination || 'Paris, France';
      const liveWeather = await getLiveWeather(city);
      const tripPlan = generateSmartTripPlan(updatedParams, liveWeather);

      return res.json({
        reply: `I've prepared a comprehensive, budget-conscious travel plan for ${tripPlan.destination} for ${tripPlan.days} days with a target budget of ${tripPlan.currency} ${tripPlan.userBudget}. Explore the full breakdown, hotel suggestions, live weather, daily itinerary, and conclusion in the trip panel!`,
        extractedParams: {
          destination: tripPlan.destination,
          startingCity: tripPlan.startingCity,
          travelDates: tripPlan.travelDates,
          days: tripPlan.days,
          travelers: tripPlan.travelers,
          budget: tripPlan.userBudget,
          currency: tripPlan.currency,
          preferences: tripPlan.preferences,
        },
        tripPlan,
      });
    } catch (fallbackError) {
      console.error('Fallback plan generation failed:', fallbackError);
      return res.status(500).json({
        error: 'Failed to generate travel plan.',
        details: String(error),
      });
    }
  }
});

async function startServer() {
  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`WanderWise AI server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
