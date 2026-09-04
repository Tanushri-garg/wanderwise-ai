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

// Extract parameters from user text
function extractParamsFromText(text: string, current: any) {
  const updated = { ...current };
  const lower = text.toLowerCase();

  // 1. Destination
  const destMatch = text.match(/(?:to|in|visit|trip to|explore|vacation in|holiday in)\s+([A-Za-z\s,]+?)(?=\s+(?:with|for|from|starting|under|on|around|budget|\$|€|£|₹|\d)|$|[,\.!?])/i);
  if (destMatch && destMatch[1] && !['the', 'a', 'an', 'my', 'budget', 'some', 'any'].includes(destMatch[1].trim().toLowerCase())) {
    updated.destination = destMatch[1].trim();
  }

  // 2. Days
  const daysMatch = text.match(/(\d+)\s*(?:day|days|night|nights)/i);
  if (daysMatch) {
    updated.days = parseInt(daysMatch[1], 10);
  }

  // 3. Travelers
  const travelersMatch = text.match(/(\d+)\s*(?:travelers?|people|persons?|guests?|adults?|friends?)/i);
  if (travelersMatch) {
    updated.travelers = parseInt(travelersMatch[1], 10);
  } else if (lower.includes('solo') || lower.includes('just me') || lower.includes('myself')) {
    updated.travelers = 1;
  } else if (lower.includes('couple') || lower.includes('partner') || lower.includes('my wife') || lower.includes('my husband')) {
    updated.travelers = 2;
  } else if (lower.includes('family')) {
    if (!updated.travelers) updated.travelers = 4;
  }

  // 4. Budget & Currency
  const budgetMatch = text.match(/(?:budget\s*(?:of|is|:)?\s*)?[\$€£₹¥]?\s*(\d+[\d,]*)\s*(?:dollars|usd|eur|inr|gbp|jpy|cad|aud|\$|€|£|₹|¥|budget)?/i);
  if (budgetMatch) {
    const val = parseInt(budgetMatch[1].replace(/,/g, ''), 10);
    if (val > 20) {
      updated.budget = val;
    }
  }
  if (lower.includes('eur') || text.includes('€')) updated.currency = 'EUR';
  else if (lower.includes('gbp') || text.includes('£')) updated.currency = 'GBP';
  else if (lower.includes('inr') || text.includes('₹') || lower.includes('rupee')) updated.currency = 'INR';
  else if (lower.includes('jpy') || text.includes('¥') || lower.includes('yen')) updated.currency = 'JPY';
  else if (lower.includes('cad') || lower.includes('c$')) updated.currency = 'CAD';
  else if (lower.includes('aud') || lower.includes('a$')) updated.currency = 'AUD';
  else if (lower.includes('usd') || text.includes('$')) updated.currency = 'USD';

  // 5. Travel Dates
  const dateMatch = text.match(/(?:dates?:|dates|during|around|in)\s+([A-Za-z]+(?:\s+\d{1,2})?(?:\s*-\s*(?:[A-Za-z]+\s+)?\d{1,2})?(?:,?\s*\d{4})?)/i);
  if (dateMatch && !['the', 'a', 'days', 'hotel', 'food', 'budget', 'usd', 'eur'].includes(dateMatch[1].trim().toLowerCase())) {
    updated.travelDates = dateMatch[1].trim();
  } else if (lower.includes('next month')) {
    updated.travelDates = 'Next Month';
  } else if (lower.includes('summer')) {
    updated.travelDates = 'Summer Season';
  } else if (lower.includes('winter')) {
    updated.travelDates = 'Winter Season';
  } else if (lower.includes('spring')) {
    updated.travelDates = 'Spring Season';
  } else if (lower.includes('autumn') || lower.includes('fall')) {
    updated.travelDates = 'Autumn Season';
  }

  // 6. Preferences
  const foundPrefs = new Set<string>(updated.preferences || []);
  if (lower.includes('sightsee') || lower.includes('monument') || lower.includes('landmark') || lower.includes('attractions')) foundPrefs.add('Sightseeing');
  if (lower.includes('food') || lower.includes('dining') || lower.includes('culinary') || lower.includes('eat') || lower.includes('restaurant')) foundPrefs.add('Food & Dining');
  if (lower.includes('adventure') || lower.includes('hiking') || lower.includes('hike') || lower.includes('trek') || lower.includes('outdoor')) foundPrefs.add('Adventure');
  if (lower.includes('shop') || lower.includes('shopping') || lower.includes('boutique') || lower.includes('market')) foundPrefs.add('Shopping');
  if (lower.includes('relax') || lower.includes('relaxation') || lower.includes('spa') || lower.includes('beach') || lower.includes('chill')) foundPrefs.add('Relaxation');
  if (lower.includes('art') || lower.includes('museum') || lower.includes('culture') || lower.includes('history') || lower.includes('heritage')) foundPrefs.add('Art & Culture');

  if (foundPrefs.size > 0) {
    updated.preferences = Array.from(foundPrefs);
  }

  return updated;
}

function computeMissingRequirements(p: any) {
  const missing: Array<'destination' | 'days' | 'travelDates' | 'travelers' | 'budget' | 'preferences'> = [];
  if (!p.destination) missing.push('destination');
  if (!p.days) missing.push('days');
  if (!p.travelDates) missing.push('travelDates');
  if (!p.travelers) missing.push('travelers');
  if (!p.budget) missing.push('budget');
  if (!p.preferences || p.preferences.length === 0) missing.push('preferences');
  return missing;
}

function generateQuickSuggestions(missing: string[], current: any) {
  const suggestions: string[] = [];
  if (missing.includes('destination')) {
    return ['Trip to Tokyo, Japan', 'Trip to Paris, France', 'Explore Rome, Italy', 'Trip to Bali, Indonesia'];
  }
  if (missing.includes('days')) {
    suggestions.push('3 Days', '5 Days', '7 Days');
  }
  if (missing.includes('budget')) {
    const cur = current.currency || 'USD';
    const sym = cur === 'EUR' ? '€' : cur === 'GBP' ? '£' : cur === 'INR' ? '₹' : '$';
    suggestions.push(`${sym}800 ${cur}`, `${sym}1,500 ${cur}`, `${sym}2,500 ${cur}`);
  }
  if (missing.includes('travelers')) {
    suggestions.push('1 Solo Traveler', '2 Travelers', '4 Family Members');
  }
  if (missing.includes('preferences')) {
    suggestions.push('🏛️ Sightseeing & Food', '🧗 Adventure & Outdoors', '🌴 Relaxation & Spa', '🛍️ Shopping & Culture');
  }
  if (missing.includes('travelDates')) {
    suggestions.push('Next Month', 'Flexible Upcoming Dates', 'Spring 2026');
  }
  if (current.destination && (current.days || current.budget)) {
    suggestions.push('🚀 Plan My Trip with current details');
  }
  return suggestions.slice(0, 5);
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

    plan.budgetBreakdown = {
      transportation: b.transportation || Math.round(userBudget * 0.25),
      hotel: b.hotel || Math.round(userBudget * 0.35),
      food: b.food || Math.round(userBudget * 0.20),
      localTransport: b.localTransport || Math.round(userBudget * 0.06),
      activities: b.activities || Math.round(userBudget * 0.09),
      emergency: b.emergency || Math.round(userBudget * 0.05),
      totalEstimated: totalEst > 0 ? totalEst : userBudget,
      userBudget,
      currency: plan.currency || mergedParams.currency || 'USD',
      fitsBudget: !isOver,
      variance: diff,
      varianceExplanation: isOver
        ? `Estimated expenses exceed your target budget by ${plan.currency || 'USD'} ${amountExceeded.toLocaleString()}. See budget adjustments below.`
        : `Calculated with 6 balanced categories and a dedicated emergency buffer.`,
    };

    // Ensure 2-3 hotels with all required properties
    if (!plan.hotels || plan.hotels.length === 0) {
      const city = plan.destination || 'Destination';
      plan.hotels = [
        {
          id: 'h1',
          name: `${city.split(',')[0]} Central Heritage Boutique`,
          pricePerNight: Math.round(plan.budgetBreakdown.hotel / (plan.days || 3)),
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
          pricePerNight: Math.round((plan.budgetBreakdown.hotel * 0.7) / (plan.days || 3)),
          totalCost: Math.round(plan.budgetBreakdown.hotel * 0.7),
          category: 'Budget',
          location: 'Arts District / Near Metro Station',
          isLivePrice: false,
          rating: '4.3/5',
          highlights: 'Modern compact rooms, coworking lounge, 2 min walk to transit',
        },
      ];
    } else {
      // Mark isLivePrice false to never mislead
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
        explanation: `Estimated costs exceed budget by ${plan.currency} ${amountExceeded.toLocaleString()}. We suggest swapping to budget lodging and using local transit day passes.`,
        cheaperHotelsSuggestion: `Switch to ${cheapHotel.name} (~${plan.currency} ${cheapHotel.pricePerNight}/night) to save up to 30% on accommodations.`,
        cheaperTransportSuggestion: 'Purchase a multi-day unlimited city transit pass instead of point-to-point taxis.',
        removedOrReplacedActivities: 'Replace paid viewing decks and private tours with free scenic viewpoints, public parks, and self-guided audio walks.',
        revisedSavings: `Estimated savings: approx. ${plan.currency} ${Math.round(amountExceeded * 1.15)}, bringing the trip back under your ${plan.currency} ${userBudget} ceiling.`,
      };
    } else if (!plan.budgetAdjustment) {
      plan.budgetAdjustment = {
        needed: false,
        originalCost: totalEst,
        targetBudget: userBudget,
        explanation: `Your trip fits within your ${plan.currency} ${userBudget.toLocaleString()} budget with a cushion of ${plan.currency} ${remainingBudget.toLocaleString()}.`,
        cheaperHotelsSuggestion: 'For extra savings, consider boutique micro-hotels near transit hubs.',
        cheaperTransportSuggestion: 'Utilize regional transit day passes for discounted travel.',
        removedOrReplacedActivities: 'Many suggested architectural strolls and public parks are 100% free.',
        revisedSavings: `Surplus reserve: ${plan.currency} ${remainingBudget.toLocaleString()}`,
      };
    }

    // Trip Conclusion with all 6 required elements:
    // 1. Total estimated cost, 2. Remaining budget, 3. Best hotel option, 4. Best activity, 5. Whether trip is affordable, 6. One short travel tip
    const bestHotelName = plan.hotels[0]?.name || 'Central Boutique Hotel';
    const bestActivityName = plan.itinerary?.[0]?.evening?.activity || `${plan.destination.split(',')[0]} Sunset Promenade & Heritage Quarter`;
    const isAffordable = !isOver || amountExceeded <= userBudget * 0.1;
    const affordableVerdict = !isOver
      ? `Yes, highly affordable! Fits comfortably within your ${plan.currency} ${userBudget.toLocaleString()} budget with ${plan.currency} ${remainingBudget.toLocaleString()} cushion.`
      : `Exceeds current budget by ${plan.currency} ${amountExceeded.toLocaleString()}. Affordable with recommended budget accommodation & transit pass adjustments.`;

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
    // High-quality local intelligence fallback
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

    // Construct history for Gemini
    const contents = messages.map((m: { role: string; content: string }) => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }],
    }));

    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('AI generation timed out (initiating smart planner)')), 11000)
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

    // Merge extracted parameters
    const finalParams = {
      ...mergedParams,
      ...(parsedData.extractedParams || {}),
    };
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
  } catch (error: unknown) {
    console.warn('Gemini API call fallback to smart planner:', error);
    try {
      const city = mergedParams.destination || 'Paris, France';
      const liveWeather = await getLiveWeather(city, mergedParams.travelDates);
      const rawPlan = generateSmartTripPlan(mergedParams, liveWeather);
      const enrichedPlan = await enrichAndValidatePlan(rawPlan);

      const isOver = enrichedPlan.budgetBreakdown.totalEstimated > enrichedPlan.userBudget;
      const diff = Math.abs(enrichedPlan.userBudget - enrichedPlan.budgetBreakdown.totalEstimated);

      let reply = `### ✈️ WanderWise AI Trip Plan for ${enrichedPlan.destination} (${enrichedPlan.days} Days)\n\n`;
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
        missingParams: missingRequirements,
        suggestedPrompts: quickSuggestions,
        tripPlan: enrichedPlan,
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
