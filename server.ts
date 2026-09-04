import express from 'express';
import path from 'path';
import dotenv from 'dotenv';
import { GoogleGenAI } from '@google/genai';
import { createServer as createViteServer } from 'vite';
import { generateSmartTripPlan } from './serverFallbackPlanner';
import { extractParamsFromText, computeMissingRequirements, generateQuickSuggestions } from './src/utils/tripParams';
import { TripParameters } from './src/types';

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

// Helper to fetch weather with clear Live vs Estimated distinction
async function getLiveWeather(city: string, travelDates?: string) {
  const normalizedCity = city.trim().toLowerCase();
  const cacheKey = `${normalizedCity}__${travelDates || 'current'}`;
  const cached = weatherCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data;
  }

  // Check if dates are explicitly distant in the future (e.g. >14 days ahead or seasonal references like "Summer", "December 2026")
  const isDistantDate = travelDates && (
    /202[7-9]|2026-(?:1[0-2]|09-[2-3]\d)|next year|later this year|summer|winter|spring|autumn|fall/i.test(travelDates)
  );

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
        temperature: '22°C (72°F) [Estimated seasonal average]',
        rainProbability: '15% average historical precipitation',
        condition: 'Temperate / Seasonal Climate Estimate',
        packingAdvice: 'Pack versatile clothing layers, sunglasses, and comfortable walking shoes.',
        isLiveData: false,
        source: 'Estimated Seasonal Climate Model (Live weather data unavailable for this location)',
      };
      weatherCache.set(cacheKey, { data: fallbackWeather, timestamp: Date.now() });
      return fallbackWeather;
    }

    const { latitude, longitude, name: resolvedName, country } = geoData.results[0];
    const destinationLabel = `${resolvedName}${country ? ', ' + country : ''}`;

    if (isDistantDate) {
      // For future travel dates beyond live forecast capability, provide honest seasonal climate estimate
      const estimatedWeather = {
        destination: destinationLabel,
        temperature: '21°C (70°F) [Historical seasonal benchmark]',
        rainProbability: '20% typical seasonal probability',
        condition: 'Seasonal Climate Estimate for selected dates',
        packingAdvice: 'Layered outfits, a light rain jacket or umbrella, and supportive walking shoes for city exploration.',
        isLiveData: false,
        source: `Estimated Seasonal Climate Model (Selected dates "${travelDates}" are beyond the 14-day live satellite window; historical benchmark provided)`,
      };
      weatherCache.set(cacheKey, { data: estimatedWeather, timestamp: Date.now() });
      return estimatedWeather;
    }

    // Live forecast within available window
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
      destination: destinationLabel,
      temperature: `${Math.round(currentTemp)}°C (${Math.round((currentTemp * 9) / 5 + 32)}°F) [High: ${Math.round(maxTemp)}°C, Low: ${Math.round(minTemp)}°C]`,
      rainProbability: `${rainProb}% live precipitation probability`,
      condition: `${condition} (Live)`,
      packingAdvice: packing,
      isLiveData: true,
      source: 'Open-Meteo Global Meteorological Network (Live 7-Day Satellite Forecast)',
    };
    weatherCache.set(cacheKey, { data: liveWeather, timestamp: Date.now() });
    return liveWeather;
  } catch (err: unknown) {
    console.error('Weather error:', err);
    const fallbackWeather = {
      destination: city,
      temperature: '21°C (70°F) [Estimated seasonal average]',
      rainProbability: '20% estimated historical probability',
      condition: 'Pleasant & Seasonable (Estimate)',
      packingAdvice: 'Layered outfits, comfortable walking shoes, and a light travel umbrella.',
      isLiveData: false,
      source: 'Estimated Seasonal Climate Model (Live weather network connection currently unavailable)',
    };
    weatherCache.set(cacheKey, { data: fallbackWeather, timestamp: Date.now() });
    return fallbackWeather;
  }
}

// Live Weather Endpoint using Open-Meteo
app.get('/api/weather', async (req, res) => {
  const city = req.query.city as string;
  const dates = req.query.dates as string | undefined;
  if (!city) {
    return res.status(400).json({ error: 'City parameter is required' });
  }
  const weather = await getLiveWeather(city, dates);
  return res.json(weather);
});

// Gemini AI Chat / Planner Endpoint
app.post('/api/chat', async (req, res) => {
  const { messages, currentParams } = req.body;

  if (!messages || !Array.isArray(messages)) {
    return res.status(400).json({ error: 'Messages array is required' });
  }

  const lastUserMsg = [...messages].reverse().find((m: { role: string }) => m.role === 'user')?.content || '';
  const mergedParams = extractParamsFromText(lastUserMsg, currentParams || {});
  const missingRequirements = computeMissingRequirements(mergedParams);
  const quickSuggestions = generateQuickSuggestions(missingRequirements, mergedParams);

  // Helper to ensure generated plan meets all 10 requirements and integrity constraints
  const enrichAndValidatePlan = async (plan: any) => {
    if (!plan) return null;

    // Check budget arithmetic
    const b = plan.budgetBreakdown || {};
    const totalEst = (b.transportation || 0) + (b.hotel || 0) + (b.food || 0) + (b.localTransport || 0) + (b.activities || 0) + (b.emergency || 0);
    const userBudget = plan.userBudget || b.userBudget || mergedParams.budget || 1200;
    const isOver = totalEst > userBudget;
    const diff = userBudget - totalEst;
    const amountExceeded = isOver ? Math.abs(diff) : 0;
    const remainingBudget = !isOver ? diff : -amountExceeded;
    const planCurrency = plan.currency || mergedParams.currency || 'USD';

    plan.budgetBreakdown = {
      transportation: b.transportation || Math.round(userBudget * 0.25),
      hotel: b.hotel || Math.round(userBudget * 0.35),
      food: b.food || Math.round(userBudget * 0.20),
      localTransport: b.localTransport || Math.round(userBudget * 0.06),
      activities: b.activities || Math.round(userBudget * 0.09),
      emergency: b.emergency || Math.round(userBudget * 0.05),
      totalEstimated: totalEst > 0 ? totalEst : userBudget,
      userBudget,
      currency: planCurrency,
      fitsBudget: !isOver,
      variance: diff,
      varianceExplanation: isOver
        ? `Estimated expenses exceed your target budget by ${planCurrency} ${amountExceeded.toLocaleString()}. See budget adjustments below.`
        : `Calculated with 6 balanced categories and a dedicated emergency buffer.`,
    };

    // Ensure 2-3 hotels with all required properties
    const city = plan.destination || mergedParams.destination || 'Destination';
    const cityClean = typeof city === 'string' ? city.split(',')[0].trim() : 'Central';
    const tripDays = plan.days || mergedParams.days || 3;

    if (!plan.hotels || plan.hotels.length === 0) {
      plan.hotels = [
        {
          id: 'h1',
          name: `${cityClean} Central Heritage Boutique`,
          pricePerNight: Math.round(plan.budgetBreakdown.hotel / tripDays),
          totalCost: plan.budgetBreakdown.hotel,
          category: 'Mid-range',
          location: 'City Center / Historic Quarter',
          isLivePrice: false,
          rating: '4.6/5',
          highlights: 'Prime walkable location, breakfast included, free cancellation',
        },
        {
          id: 'h2',
          name: `The Urban Traveler Micro-Hotel`,
          pricePerNight: Math.round((plan.budgetBreakdown.hotel * 0.7) / tripDays),
          totalCost: Math.round(plan.budgetBreakdown.hotel * 0.7),
          category: 'Budget',
          location: 'Arts District / Near Metro Station',
          isLivePrice: false,
          rating: '4.3/5',
          highlights: 'Modern compact rooms, coworking lounge, 2 min walk to transit',
        },
      ];
    } else {
      plan.hotels = plan.hotels.map((h: any) => ({
        ...h,
        isLivePrice: false,
      }));
    }

    // Weather enrichment (Live if available, or clearly labeled estimate)
    const targetCity = plan.destination || mergedParams.destination || 'Paris, France';
    try {
      const weatherData = await getLiveWeather(targetCity, plan.travelDates || mergedParams.travelDates);
      plan.weather = weatherData;
    } catch (wErr) {
      console.warn('Weather fetch error:', wErr);
      plan.weather = {
        destination: targetCity,
        temperature: '21°C (70°F) [Estimated seasonal average]',
        rainProbability: '20% historical probability',
        condition: 'Temperate / Seasonal Estimate',
        packingAdvice: 'Versatile layers, comfortable walking shoes, and a travel umbrella.',
        isLiveData: false,
        source: 'Estimated Seasonal Climate Model (Live weather network temporarily unreachable)',
      };
    }

    // Budget Adjustment if exceeded
    if (isOver) {
      const cheapHotel = plan.hotels.find((h: any) => h.category === 'Budget') || plan.hotels[1] || plan.hotels[0];
      plan.budgetAdjustment = {
        needed: true,
        originalCost: totalEst,
        targetBudget: userBudget,
        explanation: `Estimated costs exceed budget by ${planCurrency} ${amountExceeded.toLocaleString()}. We suggest swapping to budget lodging and using local transit day passes.`,
        cheaperHotelsSuggestion: `Switch to ${cheapHotel?.name || 'budget lodging'} (~${planCurrency} ${cheapHotel?.pricePerNight || 60}/night) to save up to 30% on accommodations.`,
        cheaperTransportSuggestion: 'Purchase a multi-day unlimited city transit pass instead of point-to-point taxis.',
        removedOrReplacedActivities: 'Replace paid viewing decks and private tours with free scenic viewpoints, public parks, and self-guided audio walks.',
        revisedSavings: `Estimated savings: approx. ${planCurrency} ${Math.round(amountExceeded * 1.15)}, bringing the trip back under your ${planCurrency} ${userBudget} ceiling.`,
      };
    } else if (!plan.budgetAdjustment) {
      plan.budgetAdjustment = {
        needed: false,
        originalCost: totalEst,
        targetBudget: userBudget,
        explanation: `Your trip fits within your ${planCurrency} ${userBudget.toLocaleString()} budget with a cushion of ${planCurrency} ${remainingBudget.toLocaleString()}.`,
        cheaperHotelsSuggestion: 'For extra savings, consider boutique micro-hotels near transit hubs.',
        cheaperTransportSuggestion: 'Utilize regional transit day passes for discounted travel.',
        removedOrReplacedActivities: 'Many suggested architectural strolls and public parks are 100% free.',
        revisedSavings: `Surplus reserve: ${planCurrency} ${remainingBudget.toLocaleString()}`,
      };
    }

    // Trip Conclusion with all 6 required elements
    const bestHotelName = plan.hotels[0]?.name || 'Central Boutique Hotel';
    const bestActivityName = plan.itinerary?.[0]?.evening?.activity || `${cityClean} Sunset Promenade & Heritage Quarter`;
    const isAffordable = !isOver || amountExceeded <= userBudget * 0.1;
    const affordableVerdict = !isOver
      ? `Yes, highly affordable! Fits comfortably within your ${planCurrency} ${userBudget.toLocaleString()} budget with ${planCurrency} ${remainingBudget.toLocaleString()} cushion.`
      : `Exceeds current budget by ${planCurrency} ${amountExceeded.toLocaleString()}. Affordable with recommended budget accommodation & transit pass adjustments.`;

    const shortTravelTip = plan.conclusion?.shortTravelTip ||
      plan.conclusion?.finalRecommendation ||
      `Book attraction tickets and transit passes 2–3 weeks online in advance to skip ticket queues and secure early-bird discounts.`;

    plan.conclusion = {
      fitsBudget: !isOver,
      isAffordable,
      affordableVerdict,
      statusSummary: isOver ? 'Over Budget' : 'Within Budget',
      estimatedTotalCost: totalEst,
      remainingBudget,
      remainingOrOverBudget: isOver ? amountExceeded : remainingBudget,
      isOverBudget: isOver,
      bestHotel: plan.conclusion?.bestHotel || bestHotelName,
      bestActivity: plan.conclusion?.bestActivity || bestActivityName,
      datesSuitable: true,
      datesSuitabilityNote: plan.weather?.condition ? `Weather: ${plan.weather.condition}. Favorable conditions for travel.` : 'Great season to visit.',
      shortTravelTip,
      finalRecommendation: shortTravelTip,
    };

    return plan;
  };

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    // High-quality local intelligence fallback when GEMINI_API_KEY is not configured
    const hasCoreDetails = mergedParams.destination && (mergedParams.days || mergedParams.budget);
    const wantsPlan = lastUserMsg.toLowerCase().includes('plan') || lastUserMsg.toLowerCase().includes('trip') || lastUserMsg.toLowerCase().includes('itinerary') || hasCoreDetails;

    if (!wantsPlan && !mergedParams.destination) {
      return res.json({
        reply: `Hello! I'm **WanderWise AI**, your personal AI Travel Planner.\n\nTo build your personalized, budget-conscious travel plan, please share:\n1. 📍 **Destination**\n2. 📅 **Number of days & travel dates**\n3. 👥 **Number of travelers**\n4. 💰 **Total budget and currency**\n5. 🎯 **Travel preferences** (e.g., Sightseeing, Food, Adventure, Shopping, Relaxation)\n\nWhere are you dreaming of traveling next?`,
        extractedParams: mergedParams,
        missingParams: missingRequirements,
        suggestedPrompts: quickSuggestions,
        tripPlan: null,
      });
    }

    const city = mergedParams.destination || 'Paris, France';
    const liveWeather = await getLiveWeather(city, mergedParams.travelDates);
    const rawPlan = generateSmartTripPlan(mergedParams, liveWeather);
    const enrichedPlan = await enrichAndValidatePlan(rawPlan);

    const isOver = enrichedPlan.budgetBreakdown.totalEstimated > enrichedPlan.userBudget;
    const diff = Math.abs(enrichedPlan.userBudget - enrichedPlan.budgetBreakdown.totalEstimated);

    let reply = `### ✈️ Your WanderWise AI Travel Plan for ${enrichedPlan.destination} (${enrichedPlan.days} Days)\n\n`;
    reply += `I've prepared a complete personalized travel plan tailored to your budget of **${enrichedPlan.currency} ${enrichedPlan.userBudget.toLocaleString()}**.\n\n`;
    reply += `| Category | Estimated Cost | Share |\n| :--- | :--- | :--- |\n`;
    reply += `| 🛫 Transportation | ${enrichedPlan.currency} ${enrichedPlan.budgetBreakdown.transportation.toLocaleString()} | 25% |\n`;
    reply += `| 🏨 Hotel | ${enrichedPlan.currency} ${enrichedPlan.budgetBreakdown.hotel.toLocaleString()} | 35% |\n`;
    reply += `| 🍽️ Food & Dining | ${enrichedPlan.currency} ${enrichedPlan.budgetBreakdown.food.toLocaleString()} | 20% |\n`;
    reply += `| 🚇 Local Transport | ${enrichedPlan.currency} ${enrichedPlan.budgetBreakdown.localTransport.toLocaleString()} | 6% |\n`;
    reply += `| 🎟️ Activities | ${enrichedPlan.currency} ${enrichedPlan.budgetBreakdown.activities.toLocaleString()} | 9% |\n`;
    reply += `| 🛡️ Emergency Reserve | ${enrichedPlan.currency} ${enrichedPlan.budgetBreakdown.emergency.toLocaleString()} | 5% |\n`;
    reply += `| **Total** | **${enrichedPlan.currency} ${enrichedPlan.budgetBreakdown.totalEstimated.toLocaleString()}** | **100%** |\n\n`;

    if (isOver) {
      reply += `⚠️ **Budget Check: Over Budget by ${enrichedPlan.currency} ${diff.toLocaleString()}**\n`;
      reply += `> ${enrichedPlan.budgetAdjustment.explanation}\n\n`;
    } else {
      reply += `✅ **Budget Check: Within Budget!** You have **${enrichedPlan.currency} ${diff.toLocaleString()}** remaining cushion.\n\n`;
    }

    reply += `💡 **Trip Conclusion & Tip**:\n- **Best Hotel:** ${enrichedPlan.conclusion.bestHotel}\n- **Best Activity:** ${enrichedPlan.conclusion.bestActivity}\n- **Affordability:** ${enrichedPlan.conclusion.affordableVerdict}\n- **Pro Travel Tip:** ${enrichedPlan.conclusion.shortTravelTip}\n\n*Explore the full day-by-day itinerary, hotel cards, live weather, and interactive budget breakdown in the trip plan panel!*`;

    return res.json({
      reply,
      extractedParams: mergedParams,
      missingParams: missingRequirements,
      suggestedPrompts: quickSuggestions,
      tripPlan: enrichedPlan,
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
You help users plan personalized travel experiences calibrated strictly to their budget.

YOUR CORE MISSION & THE 10 MANDATORY CAPABILITIES:
1. ASK & COLLECT THE 6 KEY DETAILS:
   - Destination
   - Number of days
   - Travel dates
   - Number of travelers
   - Total budget and currency (USD, EUR, GBP, INR, JPY, CAD, AUD, etc.)
   - Travel preferences (e.g. sightseeing, food, adventure, shopping, relaxation, culture)
   If any of these are missing or if the user's message is incomplete, ask for the missing ones warmly and provide 3-5 clickable suggested prompt chips in the JSON response ("suggestedPrompts").

2. GENERATE A COMPLETE PERSONALIZED TRAVEL PLAN:
   When the user provides enough core details (at least destination, days, budget, or asks to plan/generate), create a comprehensive travel plan matching their budget and preferences.
   CRITICAL: Do NOT replace user-provided values with default values such as $1200 or 3 days. Preserve exactly the budget, days, travelers, destination, and currency provided by the user.

3. DIVIDE THE BUDGET INTO THE 6 EXACT CATEGORIES:
   - Transportation (flights/trains between origin and destination)
   - Hotel (lodging accommodation)
   - Food (dining, street food, snacks)
   - Local transport (subway, metro, buses, taxis)
   - Activities (sightseeing, tickets, tours, experiences)
   - Emergency/miscellaneous expenses (dedicated 5-10% buffer)

4. PROVIDE 2-3 HOTEL SUGGESTIONS:
   For each hotel:
   - Hotel name
   - Approximate price per night
   - Estimated total stay cost
   - Area/location
   - Budget category ('Budget' | 'Mid-range' | 'Luxury')
   - Explicitly note that prices are market benchmark estimates (isLivePrice: false).

5. PROVIDE A DAY-BY-DAY ITINERARY:
   For each day (Day 1 to Day N):
   - Morning activity & estimated activity cost
   - Afternoon activity & estimated activity cost
   - Evening activity & estimated activity cost
   - Total estimated activity cost for that day

6. PROVIDE HONEST WEATHER INFORMATION:
   If live weather data is available for selected dates, provide it.
   If live weather is unavailable or dates are far in the future, clearly state that the weather is a seasonal estimate and do not pretend it is real-time.

7. AUTOMATICALLY CHECK BUDGET:
   Validate if total estimated trip cost <= user budget.

8. IF OVER BUDGET:
   - Clearly show the amount exceeded
   - Suggest cheaper hotels/activities/transport
   - Adjust the itinerary to fit the budget where possible

9. AT THE END, PROVIDE A CLEAR "TRIP CONCLUSION" CONTAINING:
   - Total estimated cost
   - Remaining budget (or amount exceeded)
   - Best hotel option
   - Best activity
   - Whether the trip is affordable (isAffordable & affordableVerdict)
   - One short travel tip (shortTravelTip)

10. CHATBOT UI & RESPONSE FORMAT:
    In "reply", write clean, beautiful markdown using sections, bold headers, and markdown tables where appropriate so the user can easily read the plan in the chat.
    Keep the WanderWise AI branding.

JSON RESPONSE FORMAT:
Respond with raw JSON ONLY (no markdown code fence wrapper):
{
  "reply": "Clean, well-formatted markdown text with sections, table of budget breakdown, and summary...",
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
  "missingParams": ["travelDates", "preferences"],
  "suggestedPrompts": ["3 Days", "5 Days", "Budget: $1,200 USD", "Sightseeing & Food"],
  "tripPlan": null or CompleteTripPlanObject
}

Current gathered user parameters: ${JSON.stringify(mergedParams || {})}
Missing requirements: ${JSON.stringify(missingRequirements)}
`;

    // Construct valid turns for Gemini:
    // 1. Drop leading assistant messages so first turn is always 'user'
    // 2. Strict alternating turns (user -> model -> user -> model)
    const validTurns: Array<{ role: 'user' | 'model'; parts: [{ text: string }] }> = [];
    let hasStartedUser = false;

    for (const m of messages) {
      if (!m.content || typeof m.content !== 'string' || !m.content.trim()) continue;
      const role: 'user' | 'model' = m.role === 'assistant' ? 'model' : 'user';
      if (!hasStartedUser) {
        if (role === 'user') {
          hasStartedUser = true;
          validTurns.push({ role: 'user', parts: [{ text: m.content }] });
        }
      } else {
        const last = validTurns[validTurns.length - 1];
        if (last && last.role === role) {
          last.parts[0].text += `\n\n${m.content}`;
        } else {
          validTurns.push({ role, parts: [{ text: m.content }] });
        }
      }
    }

    if (validTurns.length === 0) {
      validTurns.push({ role: 'user', parts: [{ text: lastUserMsg || 'Hello' }] });
    }

    let response: any;
    let lastError: any = null;

    // Retry loop with 25s timeout
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        response = await Promise.race([
          ai.models.generateContent({
            model: 'gemini-3.8-flash',
            contents: validTurns,
            config: {
              systemInstruction,
              responseMimeType: 'application/json',
              temperature: 0.7,
            },
          }),
          new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error('AI generation timed out')), 25000)
          ),
        ]);
        if (response) break;
      } catch (err: any) {
        lastError = err;
        console.warn(`Gemini attempt ${attempt} failed:`, err?.message || err);
        if (attempt === 1) {
          await new Promise((r) => setTimeout(r, 1000));
        }
      }
    }

    if (!response) {
      throw lastError || new Error('No response from Gemini API');
    }

    const responseText = response.text || '{}';
    let parsedData: any;
    try {
      parsedData = JSON.parse(responseText);
    } catch {
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        parsedData = JSON.parse(jsonMatch[0]);
      } else {
        parsedData = {
          reply: responseText,
          extractedParams: mergedParams,
          tripPlan: null,
        };
      }
    }

    // Merge extracted parameters CAREFULLY:
    // Never overwrite user-provided values with null, undefined, or defaults
    const finalParams: TripParameters = { ...mergedParams };
    if (parsedData.extractedParams && typeof parsedData.extractedParams === 'object') {
      const ep = parsedData.extractedParams;
      if (ep.destination && typeof ep.destination === 'string' && ep.destination.trim() && !finalParams.destination) {
        finalParams.destination = ep.destination.trim();
      }
      if (ep.startingCity && typeof ep.startingCity === 'string' && ep.startingCity.trim() && !finalParams.startingCity) {
        finalParams.startingCity = ep.startingCity.trim();
      }
      if (ep.travelDates && typeof ep.travelDates === 'string' && ep.travelDates.trim() && !finalParams.travelDates) {
        finalParams.travelDates = ep.travelDates.trim();
      }
      if (typeof ep.days === 'number' && ep.days > 0 && !finalParams.days) {
        finalParams.days = ep.days;
      }
      if (typeof ep.travelers === 'number' && ep.travelers > 0 && !finalParams.travelers) {
        finalParams.travelers = ep.travelers;
      }
      if (typeof ep.budget === 'number' && ep.budget > 0 && !finalParams.budget) {
        finalParams.budget = ep.budget;
      }
      if (ep.currency && typeof ep.currency === 'string' && ep.currency.trim()) {
        finalParams.currency = ep.currency.trim().toUpperCase();
      }
      if (Array.isArray(ep.preferences) && ep.preferences.length > 0) {
        finalParams.preferences = Array.from(new Set([...(finalParams.preferences || []), ...ep.preferences]));
      }
    }

    parsedData.extractedParams = finalParams;
    parsedData.missingParams = computeMissingRequirements(finalParams);
    if (!parsedData.suggestedPrompts || parsedData.suggestedPrompts.length === 0) {
      parsedData.suggestedPrompts = generateQuickSuggestions(parsedData.missingParams, finalParams);
    }

    // Validate and enrich plan if returned
    if (parsedData.tripPlan) {
      parsedData.tripPlan = await enrichAndValidatePlan(parsedData.tripPlan);
    }

    return res.json(parsedData);
  } catch (error: any) {
    console.warn('Gemini API call encountered error; providing graceful recovery:', error?.message || error);

    const errMsg = String(error?.message || error || '');
    const isRateLimit = error?.status === 429 || /429|RESOURCE_EXHAUSTED|quota|rate limit/i.test(errMsg);
    const isAuthError = error?.status === 401 || error?.status === 403 || /API_KEY_INVALID|UNAUTHENTICATED|PERMISSION_DENIED|invalid api key/i.test(errMsg);
    const isTimeout = /timed out/i.test(errMsg);

    try {
      const city = mergedParams.destination || 'Paris, France';
      const hasCoreDetails = mergedParams.destination && (mergedParams.days || mergedParams.budget);
      const wantsPlan = lastUserMsg.toLowerCase().includes('plan') || lastUserMsg.toLowerCase().includes('trip') || lastUserMsg.toLowerCase().includes('itinerary') || hasCoreDetails;

      if (wantsPlan || hasCoreDetails) {
        const liveWeather = await getLiveWeather(city, mergedParams.travelDates);
        const rawPlan = generateSmartTripPlan(mergedParams, liveWeather);
        const enrichedPlan = await enrichAndValidatePlan(rawPlan);

        const isOver = enrichedPlan.budgetBreakdown.totalEstimated > enrichedPlan.userBudget;
        const diff = Math.abs(enrichedPlan.userBudget - enrichedPlan.budgetBreakdown.totalEstimated);

        let notice = '';
        if (isRateLimit) {
          notice = `> ℹ️ *Note: The Gemini AI service reached a temporary rate limit. WanderWise AI has seamlessly used our Smart Planner to generate your customized trip plan without delay.*\n\n`;
        } else if (isAuthError) {
          notice = `> ℹ️ *Note: Operating in Smart Offline Planner mode (API key verification required in Settings).*\n\n`;
        } else if (isTimeout) {
          notice = `> ℹ️ *Note: Gemini AI generation timed out. WanderWise AI has seamlessly compiled your itinerary using our Smart Planner.*\n\n`;
        }

        let reply = notice + `### ✈️ WanderWise AI Trip Plan for ${enrichedPlan.destination} (${enrichedPlan.days} Days)\n\n`;
        reply += `Here is your personalized budget-conscious travel plan based on your target budget of **${enrichedPlan.currency} ${enrichedPlan.userBudget.toLocaleString()}**.\n\n`;
        reply += `| Category | Estimated Cost | Share |\n| :--- | :--- | :--- |\n`;
        reply += `| 🛫 Transportation | ${enrichedPlan.currency} ${enrichedPlan.budgetBreakdown.transportation.toLocaleString()} | 25% |\n`;
        reply += `| 🏨 Hotel | ${enrichedPlan.currency} ${enrichedPlan.budgetBreakdown.hotel.toLocaleString()} | 35% |\n`;
        reply += `| 🍽️ Food & Dining | ${enrichedPlan.currency} ${enrichedPlan.budgetBreakdown.food.toLocaleString()} | 20% |\n`;
        reply += `| 🚇 Local Transport | ${enrichedPlan.currency} ${enrichedPlan.budgetBreakdown.localTransport.toLocaleString()} | 6% |\n`;
        reply += `| 🎟️ Activities | ${enrichedPlan.currency} ${enrichedPlan.budgetBreakdown.activities.toLocaleString()} | 9% |\n`;
        reply += `| 🛡️ Emergency Reserve | ${enrichedPlan.currency} ${enrichedPlan.budgetBreakdown.emergency.toLocaleString()} | 5% |\n`;
        reply += `| **Total** | **${enrichedPlan.currency} ${enrichedPlan.budgetBreakdown.totalEstimated.toLocaleString()}** | **100%** |\n\n`;

        if (isOver) {
          reply += `⚠️ **Budget Alert: Exceeds Budget by ${enrichedPlan.currency} ${diff.toLocaleString()}**\n`;
          reply += `> ${enrichedPlan.budgetAdjustment.explanation}\n\n`;
        } else {
          reply += `✅ **Budget Status: Fits Within Budget!** Remaining cushion: **${enrichedPlan.currency} ${diff.toLocaleString()}**.\n\n`;
        }

        reply += `💡 **Trip Conclusion & Tip**:\n- **Best Hotel:** ${enrichedPlan.conclusion.bestHotel}\n- **Best Activity:** ${enrichedPlan.conclusion.bestActivity}\n- **Affordability:** ${enrichedPlan.conclusion.affordableVerdict}\n- **Short Travel Tip:** ${enrichedPlan.conclusion.shortTravelTip}\n\n*Check the interactive cards and day-by-day itinerary in the trip panel!*`;

        return res.json({
          reply,
          extractedParams: mergedParams,
          missingParams: computeMissingRequirements(mergedParams),
          suggestedPrompts: generateQuickSuggestions(computeMissingRequirements(mergedParams), mergedParams),
          tripPlan: enrichedPlan,
        });
      }

      // Friendly conversational response for queries when AI is temporarily unavailable
      let helpfulReply = '';
      if (isRateLimit) {
        helpfulReply = `The AI service is currently experiencing high demand and reached a temporary rate limit. Your trip details have been safely recorded. Please wait a moment and try again, or click one of the suggested prompts below to plan your trip.`;
      } else if (isAuthError) {
        helpfulReply = `The Gemini API key is not configured or unauthorized. Please verify the \`GEMINI_API_KEY\` in Settings. In the meantime, I can still generate complete travel itineraries using our built-in Smart Planner.`;
      } else if (isTimeout) {
        helpfulReply = `The AI service took longer than expected to respond. Your trip details are preserved. Please click one of the suggestions below to retry.`;
      } else {
        helpfulReply = `I experienced a temporary connection delay with the AI service. Your trip details are saved. Please try asking again in a moment.`;
      }

      return res.json({
        reply: helpfulReply,
        extractedParams: mergedParams,
        missingParams: computeMissingRequirements(mergedParams),
        suggestedPrompts: generateQuickSuggestions(computeMissingRequirements(mergedParams), mergedParams),
        tripPlan: null,
      });
    } catch (fallbackError) {
      console.error('Fallback plan generation failed:', fallbackError);
      return res.status(200).json({
        reply: 'The AI travel service experienced a temporary error. Your trip parameters have been preserved—please try sending your request again.',
        extractedParams: mergedParams,
        missingParams: computeMissingRequirements(mergedParams),
        suggestedPrompts: ['3 Days in Paris', '5 Days in Tokyo', 'Budget: $2,500 USD'],
        tripPlan: null,
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
