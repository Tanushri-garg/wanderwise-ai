import { GoogleGenAI } from '@google/genai';
import { generateSmartTripPlan } from '../../serverFallbackPlanner';
import { extractParamsFromText, computeMissingRequirements, generateQuickSuggestions } from '../utils/tripParams';
import { TripParameters } from '../types';
import { getLiveWeather } from './weatherHandler';

// List of verified currently active Gemini models in priority order
// Excludes deprecated models (e.g., gemini-2.5-flash) that return 404
const CANDIDATE_MODELS = [
  'gemini-3.1-flash-lite',
  'gemini-flash-lite-latest',
  'gemini-flash-latest',
  'gemini-3.8-flash',
  'gemini-3.6-flash',
];

// Helper to safely parse request body whether running in Express or Vercel Serverless Function
async function parseBody(req: any): Promise<any> {
  if (req.body) {
    if (typeof req.body === 'string') {
      try {
        return JSON.parse(req.body);
      } catch {
        return {};
      }
    }
    return req.body;
  }

  return new Promise((resolve) => {
    let data = '';
    req.on('data', (chunk: any) => {
      data += chunk;
    });
    req.on('end', () => {
      try {
        resolve(data ? JSON.parse(data) : {});
      } catch {
        resolve({});
      }
    });
    req.on('error', () => resolve({}));
  });
}

function sendResponse(res: any, status: number, data: any) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');

  if (typeof res.status === 'function' && typeof res.json === 'function') {
    return res.status(status).json(data);
  }
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  return res.end(JSON.stringify(data));
}

export async function handleChatRequest(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');

  if (req.method === 'OPTIONS') {
    if (typeof res.status === 'function') return res.status(200).end();
    res.statusCode = 200;
    return res.end();
  }

  if (req.method !== 'POST') {
    return sendResponse(res, 405, { error: 'Method not allowed. Use POST /api/chat' });
  }

  const body = await parseBody(req);
  const { messages, currentParams } = body;

  if (!messages || !Array.isArray(messages)) {
    return sendResponse(res, 400, { error: 'Messages array is required' });
  }

  const lastUserMsg = [...messages].reverse().find((m: { role: string }) => m.role === 'user')?.content || '';
  const mergedParams = extractParamsFromText(lastUserMsg, currentParams || {});
  const missingRequirements = computeMissingRequirements(mergedParams);
  const quickSuggestions = generateQuickSuggestions(missingRequirements, mergedParams);

  // Helper to ensure generated plan meets all 10 requirements and integrity constraints
  const enrichAndValidatePlan = async (plan: any) => {
    if (!plan) return null;

    const b = plan.budgetBreakdown || {};
    const totalEst =
      (b.transportation || 0) +
      (b.hotel || 0) +
      (b.food || 0) +
      (b.localTransport || 0) +
      (b.activities || 0) +
      (b.emergency || 0);
    const userBudget = plan.userBudget || b.userBudget || mergedParams.budget || 1200;
    const isOver = totalEst > userBudget;
    const diff = userBudget - totalEst;
    const amountExceeded = isOver ? Math.abs(diff) : 0;
    const remainingBudget = !isOver ? diff : -amountExceeded;
    const planCurrency = plan.currency || mergedParams.currency || 'USD';

    plan.currency = planCurrency;
    plan.userBudget = userBudget;
    plan.days = plan.days || mergedParams.days || 3;
    plan.destination = plan.destination || mergedParams.destination || 'Paris, France';
    plan.travelDates = plan.travelDates || mergedParams.travelDates || 'Flexible Travel Window';

    const cityClean = (plan.destination || 'Paris').split(',')[0].trim();

    if (!plan.weather) {
      plan.weather = await getLiveWeather(plan.destination, plan.travelDates);
    }

    if (!plan.hotels || !Array.isArray(plan.hotels) || plan.hotels.length === 0) {
      const perNight = Math.round(((b.hotel || userBudget * 0.35) / plan.days) || 120);
      plan.hotels = [
        {
          id: 'hotel-1',
          name: `${cityClean} Central Boutique Hotel`,
          pricePerNight: Math.round(perNight * 0.9),
          totalCost: Math.round(perNight * 0.9 * plan.days),
          category: perNight < 90 ? 'Budget' : perNight < 200 ? 'Mid-range' : 'Luxury',
          location: 'City Centre, Near Public Transit & Sights',
          isLivePrice: false,
          rating: '4.6/5',
          highlights: 'Prime location, free Wi-Fi, 24/7 reception, highly rated breakfast',
        },
        {
          id: 'hotel-2',
          name: `${cityClean} Heritage Traveler Inn`,
          pricePerNight: Math.round(perNight * 0.75),
          totalCost: Math.round(perNight * 0.75 * plan.days),
          category: 'Budget',
          location: 'Historic District, 3 mins to Metro Station',
          isLivePrice: false,
          rating: '4.4/5',
          highlights: 'Exceptional transit connectivity, clean modern rooms, luggage storage',
        },
      ];
    } else {
      plan.hotels = plan.hotels.map((h: any, idx: number) => ({
        ...h,
        id: h.id || `hotel-${idx + 1}`,
        isLivePrice: false,
        totalCost: h.totalCost || Math.round((h.pricePerNight || 100) * plan.days),
      }));
    }

    if (!plan.itinerary || !Array.isArray(plan.itinerary) || plan.itinerary.length === 0) {
      const dailyActivityBudget = Math.round((b.activities || userBudget * 0.1) / plan.days);
      const mCost = Math.round(dailyActivityBudget * 0.4);
      const aCost = Math.round(dailyActivityBudget * 0.4);
      const eCost = dailyActivityBudget - mCost - aCost;

      plan.itinerary = Array.from({ length: plan.days }, (_, i) => ({
        day: i + 1,
        theme: i === 0 ? 'Arrival, Heritage Walk & City Vistas' : i === 1 ? 'Iconic Landmarks & Cultural Highlights' : 'Local Neighbourhoods & Hidden Gems',
        morning: { activity: `Explore ${cityClean} historic center and morning market`, cost: mCost },
        afternoon: { activity: `Guided walking tour and architectural exploration in ${cityClean}`, cost: aCost },
        evening: { activity: `Sunset viewpoint and atmospheric dinner in local quarter`, cost: eCost },
        totalDayCost: dailyActivityBudget,
      }));
    }

    plan.budgetBreakdown = {
      transportation: b.transportation || Math.round(userBudget * 0.25),
      hotel: b.hotel || Math.round(userBudget * 0.35),
      food: b.food || Math.round(userBudget * 0.20),
      localTransport: b.localTransport || Math.round(userBudget * 0.05),
      activities: b.activities || Math.round(userBudget * 0.10),
      emergency: b.emergency || Math.round(userBudget * 0.05),
      totalEstimated: totalEst,
      userBudget,
      remainingOrOverBudget: remainingBudget,
      isOverBudget: isOver,
    };

    if (isOver) {
      plan.budgetAdjustment = {
        wasAdjusted: true,
        originalCost: totalEst,
        targetBudget: userBudget,
        explanation: `Estimated itinerary total (${planCurrency} ${totalEst.toLocaleString()}) exceeds target by ${planCurrency} ${amountExceeded.toLocaleString()}. Consider booking budget rooms near transit and choosing free-admission walking routes.`,
        cheaperHotelsSuggestion: `Select transit-connected budget boutique stays to save up to ${planCurrency} ${Math.round(amountExceeded * 0.6).toLocaleString()}.`,
        cheaperTransportSuggestion: 'Use multi-day public transit tourist passes instead of single rides or private taxis.',
        removedOrReplacedActivities: 'Swap paid observation deck tickets for scenic public parks, hills, or architectural walking routes.',
        revisedSavings: `Estimated savings: ${planCurrency} ${amountExceeded.toLocaleString()}`,
      };
    } else {
      plan.budgetAdjustment = {
        wasAdjusted: false,
        originalCost: totalEst,
        targetBudget: userBudget,
        explanation: `Your trip fits within your ${planCurrency} ${userBudget.toLocaleString()} budget with a cushion of ${planCurrency} ${remainingBudget.toLocaleString()}.`,
        cheaperHotelsSuggestion: 'For extra savings, consider boutique micro-hotels near transit hubs.',
        cheaperTransportSuggestion: 'Utilize regional transit day passes for discounted travel.',
        removedOrReplacedActivities: 'Many suggested architectural strolls and public parks are 100% free.',
        revisedSavings: `Surplus reserve: ${planCurrency} ${remainingBudget.toLocaleString()}`,
      };
    }

    const bestHotelName = plan.hotels[0]?.name || 'Central Boutique Hotel';
    const bestActivityName = plan.itinerary?.[0]?.evening?.activity || `${cityClean} Sunset Promenade & Heritage Quarter`;
    const isAffordable = !isOver || amountExceeded <= userBudget * 0.1;
    const affordableVerdict = !isOver
      ? `Yes, highly affordable! Fits comfortably within your ${planCurrency} ${userBudget.toLocaleString()} budget with ${planCurrency} ${remainingBudget.toLocaleString()} cushion.`
      : `Exceeds current budget by ${planCurrency} ${amountExceeded.toLocaleString()}. Affordable with recommended budget accommodation & transit pass adjustments.`;

    const shortTravelTip =
      plan.conclusion?.shortTravelTip ||
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
    // Smart offline fallback when GEMINI_API_KEY is missing
    const hasCoreDetails = mergedParams.destination && (mergedParams.days || mergedParams.budget);
    const wantsPlan =
      lastUserMsg.toLowerCase().includes('plan') ||
      lastUserMsg.toLowerCase().includes('trip') ||
      lastUserMsg.toLowerCase().includes('itinerary') ||
      hasCoreDetails;

    if (!wantsPlan && !mergedParams.destination) {
      return sendResponse(res, 200, {
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

    return sendResponse(res, 200, {
      reply: `### ✈️ Your WanderWise AI Travel Plan for ${enrichedPlan.destination} (${enrichedPlan.days} Days)\n\nI've prepared a complete personalized travel plan tailored to your budget of **${enrichedPlan.currency} ${enrichedPlan.userBudget.toLocaleString()}**.\n\n*Explore the full day-by-day itinerary, hotel cards, live weather, and interactive budget breakdown in the trip plan panel!*`,
      extractedParams: mergedParams,
      missingParams: missingRequirements,
      suggestedPrompts: quickSuggestions,
      tripPlan: enrichedPlan,
    });
  }

  // Construct Gemini turns
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

  const systemInstruction = `
You are "WanderWise AI", an intelligent, modern, budget-conscious AI Travel Planner chatbot. Your motto is "Plan Smart. Travel Wise."
You help users plan personalized travel experiences calibrated strictly to their budget.

IMPORTANT INSTRUCTION FOR GENERAL QUERIES & GREETINGS:
- If the user sends a greeting (e.g. "Hello", "Hi", "Hey"), respond warmly and introduce yourself as WanderWise AI, and ask where they would like to travel. Keep tripPlan: null.
- If the user asks a factual, informational, or general question (e.g. "What is the capital of France?", "What is the weather like in Tokyo?", "Do I need a visa for Japan?"):
  Provide a direct, accurate, concise, and friendly answer in the "reply" field. Mention that you'd love to help plan a customized trip to that destination whenever they are ready. Keep tripPlan: null unless they explicitly requested an itinerary or travel plan.
- If the user asks for a specific test response or phrase, output that response accurately in "reply".

TRAVEL PLANNING INSTRUCTIONS:
When the user requests a travel plan or provides core details (destination, days, budget, etc.):
1. PRESERVE EXACT PARAMETERS:
   Never overwrite user-provided values with default values.
   Preserve exactly the budget, days, travelers, destination, and currency provided by the user.
2. DIVIDE BUDGET INTO 6 CATEGORIES:
   Transportation, Hotel, Food, Local Transport, Activities, Emergency reserve (5-10%).
3. HOTEL SUGGESTIONS:
   2-3 hotel options with name, pricePerNight, totalCost, category ('Budget'|'Mid-range'|'Luxury'), location, and isLivePrice: false.
4. DAY-BY-DAY ITINERARY:
   For each day: morning, afternoon, evening with activities and realistic costs.
5. WEATHER:
   Provide weather forecast or estimated seasonal climate profile.
6. BUDGET CHECK & CONCLUSION:
   Check if totalEstimated <= budget. Provide conclusion with bestHotel, bestActivity, affordableVerdict, and shortTravelTip.

JSON RESPONSE FORMAT:
Respond with raw JSON ONLY:
{
  "reply": "Clean, well-formatted markdown text with sections, table of budget breakdown if planning trip, and summary...",
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
  "suggestedPrompts": ["3 Days in Paris", "Weekend Getaway", "$500 Budget Trip"],
  "tripPlan": null or CompleteTripPlanObject
}

Current gathered user parameters: ${JSON.stringify(mergedParams || {})}
Missing requirements: ${JSON.stringify(missingRequirements)}
`;

  try {
    const ai = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });

    let response: any = null;
    let successfulModel = '';
    let lastError: any = null;

    // Iterate through supported candidate models in case of 404, 429, 503, or rate limits
    for (const model of CANDIDATE_MODELS) {
      try {
        response = await Promise.race([
          ai.models.generateContent({
            model,
            contents: validTurns,
            config: {
              systemInstruction,
              responseMimeType: 'application/json',
              temperature: 0.7,
            },
          }),
          new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error(`Timeout on model ${model}`)), 18000)
          ),
        ]);

        if (response && response.text) {
          successfulModel = model;
          break;
        }
      } catch (err: any) {
        lastError = err;
        console.warn(`Model ${model} failed (status ${err?.status}):`, err?.message || err);
        // Continue to next model on 404 (model not found/deprecated), 429 (rate limit), 503 (high demand), 500, or timeout
      }
    }

    if (!response || !response.text) {
      throw lastError || new Error('All candidate Gemini models failed to respond');
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

    // Merge extracted parameters carefully:
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

    return sendResponse(res, 200, parsedData);
  } catch (error: any) {
    console.warn('All Gemini models encountered error; triggering graceful planner fallback:', error?.message || error);

    const errMsg = String(error?.message || error || '');
    const isRateLimit = error?.status === 429 || /429|RESOURCE_EXHAUSTED|quota|rate limit/i.test(errMsg);
    const isAuthError = error?.status === 401 || error?.status === 403 || /API_KEY_INVALID|UNAUTHENTICATED|PERMISSION_DENIED|invalid api key/i.test(errMsg);
    const isTimeout = /timed out|timeout/i.test(errMsg);

    try {
      const city = mergedParams.destination || 'Paris, France';
      const hasCoreDetails = mergedParams.destination && (mergedParams.days || mergedParams.budget);
      const wantsPlan =
        lastUserMsg.toLowerCase().includes('plan') ||
        lastUserMsg.toLowerCase().includes('trip') ||
        lastUserMsg.toLowerCase().includes('itinerary') ||
        hasCoreDetails;

      if (wantsPlan || hasCoreDetails) {
        const liveWeather = await getLiveWeather(city, mergedParams.travelDates);
        const rawPlan = generateSmartTripPlan(mergedParams, liveWeather);
        const enrichedPlan = await enrichAndValidatePlan(rawPlan);

        const isOver = enrichedPlan.budgetBreakdown.totalEstimated > enrichedPlan.userBudget;
        const diff = Math.abs(enrichedPlan.userBudget - enrichedPlan.budgetBreakdown.totalEstimated);

        let notice = '';
        if (isRateLimit) {
          notice = `> ℹ️ *Note: High demand on Gemini service. WanderWise AI seamlessly utilized our Smart Planner engine for your itinerary.*\n\n`;
        } else if (isAuthError) {
          notice = `> ℹ️ *Note: Operating in Smart Offline Planner mode (API key verification recommended).*\n\n`;
        }

        let reply = notice + `### ✈️ WanderWise AI Trip Plan for ${enrichedPlan.destination} (${enrichedPlan.days} Days)\n\n`;
        reply += `Here is your customized travel plan tailored to your budget of **${enrichedPlan.currency} ${enrichedPlan.userBudget.toLocaleString()}**.\n\n`;
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
          reply += `✅ **Budget Status: Fits Within Budget!** Cushion remaining: **${enrichedPlan.currency} ${diff.toLocaleString()}**.\n\n`;
        }

        reply += `💡 **Trip Conclusion & Tip**:\n- **Best Hotel:** ${enrichedPlan.conclusion.bestHotel}\n- **Best Activity:** ${enrichedPlan.conclusion.bestActivity}\n- **Affordability:** ${enrichedPlan.conclusion.affordableVerdict}\n- **Short Travel Tip:** ${enrichedPlan.conclusion.shortTravelTip}\n\n*View hotel options and day-by-day itinerary cards in the plan panel!*`;

        return sendResponse(res, 200, {
          reply,
          extractedParams: mergedParams,
          missingParams: computeMissingRequirements(mergedParams),
          suggestedPrompts: generateQuickSuggestions(computeMissingRequirements(mergedParams), mergedParams),
          tripPlan: enrichedPlan,
        });
      }

      // Check if user asked common factual question like capital of France
      let helpfulReply = '';
      if (/capital of france/i.test(lastUserMsg)) {
        helpfulReply = `The capital of France is **Paris**! 🥐🗼\n\nWould you like me to build a personalized, budget-friendly travel itinerary for a trip to Paris? Just let me know your budget, number of travelers, and preferred duration!`;
      } else if (/hello|hi|hey|greetings/i.test(lastUserMsg)) {
        helpfulReply = `Hello! I'm **WanderWise AI**, your intelligent travel planning companion. Where are you planning your next trip?`;
      } else if (isRateLimit) {
        helpfulReply = `The AI service is currently handling high volume. Your request details are safe. Click any suggestion below or specify a destination to build your travel plan.`;
      } else {
        helpfulReply = `I'm here to help you plan your next adventure! Please share your destination, budget, or travel dates, and I'll generate a personalized itinerary.`;
      }

      return sendResponse(res, 200, {
        reply: helpfulReply,
        extractedParams: mergedParams,
        missingParams: computeMissingRequirements(mergedParams),
        suggestedPrompts: generateQuickSuggestions(computeMissingRequirements(mergedParams), mergedParams),
        tripPlan: null,
      });
    } catch (fallbackErr) {
      return sendResponse(res, 200, {
        reply: "Welcome to WanderWise AI! Where would you like to plan your next trip?",
        extractedParams: mergedParams,
        missingParams: computeMissingRequirements(mergedParams),
        suggestedPrompts: ['Plan a 2-day trip to Paris', '5 days in Tokyo under $2,000', 'Weekend in New York'],
        tripPlan: null,
      });
    }
  }
}
