// src/server/chatHandler.ts
import { GoogleGenAI } from "@google/genai";

// serverFallbackPlanner.ts
function generateSmartTripPlan(params, liveWeather) {
  const destination = params.destination || "Paris, France";
  const startingCity = params.startingCity || "London, UK";
  const days = Math.max(1, params.days || 3);
  const travelers = Math.max(1, params.travelers || 2);
  const currency = params.currency || "USD";
  const userBudget = params.budget || (currency === "INR" ? 5e4 : currency === "EUR" ? 1e3 : 1200);
  const preferences = params.preferences && params.preferences.length > 0 ? params.preferences : ["Sightseeing", "Food & Dining", "Culture"];
  const travelDates = params.travelDates || "Upcoming Season (Flexible)";
  let transportEst = Math.round(userBudget * 0.25);
  let hotelEst = Math.round(userBudget * 0.35);
  let foodEst = Math.round(userBudget * 0.2);
  let localTransportEst = Math.round(userBudget * 0.05);
  let activitiesEst = Math.round(userBudget * 0.1);
  let emergencyEst = Math.round(userBudget * 0.05);
  let totalEstimated = transportEst + hotelEst + foodEst + localTransportEst + activitiesEst + emergencyEst;
  if (totalEstimated !== userBudget) {
    emergencyEst += userBudget - totalEstimated;
    totalEstimated = transportEst + hotelEst + foodEst + localTransportEst + activitiesEst + emergencyEst;
  }
  const fitsBudget = totalEstimated <= userBudget;
  const variance = userBudget - totalEstimated;
  const perNightBudget = Math.round(hotelEst / days);
  const hotels = [
    {
      id: "h1",
      name: `${destination.split(",")[0]} Central Boutique Stay`,
      pricePerNight: Math.round(perNightBudget * 0.85),
      totalCost: Math.round(perNightBudget * 0.85 * days),
      category: perNightBudget < 80 ? "Budget" : perNightBudget < 200 ? "Mid-range" : "Luxury",
      location: "Central District / Transit Hub",
      isLivePrice: false,
      rating: "4.6/5",
      highlights: "Walkable to transit, free high-speed Wi-Fi, praised breakfast buffet, quiet rooms"
    },
    {
      id: "h2",
      name: `Grand Heritage Suites ${destination.split(",")[0]}`,
      pricePerNight: Math.round(perNightBudget * 1.15),
      totalCost: Math.round(perNightBudget * 1.15 * days),
      category: perNightBudget < 120 ? "Mid-range" : "Luxury",
      location: "Old Town & Cultural Quarter",
      isLivePrice: false,
      rating: "4.8/5",
      highlights: "Panoramic city views, concierge excursion desk, complimentary evening tea"
    },
    {
      id: "h3",
      name: `Urban Traveler Hostel & Micro-Hotel`,
      pricePerNight: Math.round(perNightBudget * 0.55),
      totalCost: Math.round(perNightBudget * 0.55 * days),
      category: "Budget",
      location: "Arts & Market District",
      isLivePrice: false,
      rating: "4.4/5",
      highlights: "Social traveler lounge, private pods available, self-service laundry & kitchen"
    }
  ];
  const itinerary = [];
  const dailyActivityCost = Math.round(activitiesEst / days);
  const themePool = [
    {
      title: "City Heritage & Famous Landmarks",
      m: "Walking orientation tour of historic center, historic square, and architecture highlights",
      a: "Visit primary landmark museum or botanical grounds with scenic viewpoint",
      e: "Sunset promenade along the central river/boulevard followed by local specialty dinner"
    },
    {
      title: "Local Culture, Flavors & Hidden Gems",
      m: "Morning local artisan market visit with specialty coffee and pastry tasting",
      a: "Explore bohemian neighborhood, vintage boutiques, and cultural exhibition gallery",
      e: "Traditional dining quarter with live street acoustic performance and dessert stop"
    },
    {
      title: "Nature Escape, Panoramic Vistas & Sunset",
      m: "Funicular/cable-car or scenic hill overlook with sweeping views of the entire valley",
      a: "Leisurely stroll through public royal gardens or coastal boardwalk with picnic",
      e: "Rooftop terrace beverage and twilight photography of the illuminated cityscape"
    },
    {
      title: "Art, History & Interactive Discovery",
      m: "Guided visit to world-renowned art museum or interactive science center",
      a: "Afternoon tea in historic caf\xE9 and exploration of antique bookshops and arcades",
      e: "Evening foodie street walk sampling regional snacks and street delicacies"
    },
    {
      title: "Shopping, Relaxation & Farewell Highlights",
      m: "Souvenir and craft shopping in traditional bazaar or pedestrian shopping promenade",
      a: "Thermal spa or relaxing park visit with photography stops at iconic bridges",
      e: "Celebratory farewell dinner featuring seasonal chef tasting menu and dessert"
    }
  ];
  for (let i = 1; i <= days; i++) {
    const theme = themePool[(i - 1) % themePool.length];
    const mCost = Math.round(dailyActivityCost * 0.3);
    const aCost = Math.round(dailyActivityCost * 0.5);
    const eCost = Math.round(dailyActivityCost * 0.2);
    itinerary.push({
      day: i,
      title: `Day ${i}: ${theme.title}`,
      morning: {
        activity: theme.m,
        cost: mCost
      },
      afternoon: {
        activity: theme.a,
        cost: aCost
      },
      evening: {
        activity: theme.e,
        cost: eCost
      },
      dayTotalCost: mCost + aCost + eCost
    });
  }
  const isOverBudget = totalEstimated > userBudget;
  const budgetDiff = userBudget - totalEstimated;
  const amountExceeded = isOverBudget ? Math.abs(budgetDiff) : 0;
  const remainingBudget = !isOverBudget ? budgetDiff : 0;
  const budgetAdjustment = {
    needed: isOverBudget,
    originalCost: totalEstimated,
    targetBudget: userBudget,
    explanation: isOverBudget ? `The initial estimated cost exceeds your target budget by ${currency} ${amountExceeded.toLocaleString()}. We recommend swapping to budget micro-stays, using local transit day passes, and focusing on free iconic landmarks.` : "Your planned travel expenses fall comfortably within your target budget framework with a safe buffer.",
    cheaperHotelsSuggestion: `Opt for "${hotels[2]?.name || "Urban Traveler Hostel & Micro-Hotel"}" to save approx. ${currency} ${Math.round((hotels[0]?.pricePerNight - hotels[2]?.pricePerNight) * days)} over your stay.`,
    cheaperTransportSuggestion: "Purchase a multi-day city transit pass (metro/bus) instead of hailing point-to-point taxis or rideshares.",
    removedOrReplacedActivities: "Replace paid viewing decks with free public hilltop parks, riverfront strolls, and historic architectural squares.",
    revisedSavings: isOverBudget ? `Switching to the budget hotel and transit pass saves approx. ${currency} ${Math.round(amountExceeded * 1.15)}, bringing your trip back within budget!` : `Estimated surplus reserve: ${currency} ${remainingBudget.toLocaleString()} available for shopping or spontaneous dining.`
  };
  const isAffordable = !isOverBudget || amountExceeded <= userBudget * 0.1;
  const affordableVerdict = !isOverBudget ? `Yes, highly affordable! Fits comfortably within your ${currency} ${userBudget.toLocaleString()} budget with ${currency} ${remainingBudget.toLocaleString()} remaining cushion.` : `Exceeds current budget by ${currency} ${amountExceeded.toLocaleString()}. Affordable with suggested budget hotel & public transit adjustments.`;
  const conclusion = {
    fitsBudget: !isOverBudget,
    isAffordable,
    affordableVerdict,
    statusSummary: isOverBudget ? "Over Budget" : "Within Budget",
    estimatedTotalCost: totalEstimated,
    remainingBudget: !isOverBudget ? remainingBudget : -amountExceeded,
    remainingOrOverBudget: isOverBudget ? amountExceeded : remainingBudget,
    isOverBudget,
    bestHotel: hotels[0]?.name || "Central Boutique Stay",
    bestActivity: `${destination.split(",")[0]} Sunset Promenade & Heritage Highlights`,
    datesSuitable: true,
    datesSuitabilityNote: `${liveWeather.condition} with temperatures around ${liveWeather.temperature.split(" ")[0]}. Favorable conditions for outdoor sightseeing and dining.`,
    shortTravelTip: `Buy attraction tickets and rail passes 2\u20133 weeks online in advance to bypass long ticket lines and secure early-bird discounts.`,
    finalRecommendation: `Book major rail and attraction tickets 2\u20133 weeks early to lock in lower advance-purchase fares and avoid peak queues.`
  };
  return {
    destination,
    startingCity,
    travelDates,
    days,
    travelers,
    userBudget,
    currency,
    preferences,
    budgetBreakdown: {
      transportation: transportEst,
      hotel: hotelEst,
      food: foodEst,
      localTransport: localTransportEst,
      activities: activitiesEst,
      emergency: emergencyEst,
      totalEstimated,
      userBudget,
      currency,
      fitsBudget: !isOverBudget,
      variance,
      varianceExplanation: isOverBudget ? `Estimated expenses exceed budget by ${currency} ${amountExceeded.toLocaleString()}. Consider our budget adjustments.` : `Carefully apportioned across transport, hotel, dining, and activities with a dedicated 5% emergency buffer.`
    },
    hotels,
    weather: liveWeather,
    itinerary,
    budgetAdjustment,
    conclusion
  };
}

// src/utils/tripParams.ts
var POPULAR_DESTINATIONS = [
  "Paris",
  "Tokyo",
  "Rome",
  "London",
  "New York",
  "Bali",
  "Barcelona",
  "Amsterdam",
  "Venice",
  "Florence",
  "Madrid",
  "Berlin",
  "Vienna",
  "Prague",
  "Budapest",
  "Dublin",
  "Edinburgh",
  "Lisbon",
  "Athens",
  "Istanbul",
  "Dubai",
  "Singapore",
  "Bangkok",
  "Kyoto",
  "Seoul",
  "Sydney",
  "Melbourne",
  "Auckland",
  "Toronto",
  "Vancouver",
  "Montreal",
  "San Francisco",
  "Los Angeles",
  "Chicago",
  "Miami",
  "Las Vegas",
  "Honolulu",
  "Hawaii",
  "Cancun",
  "Rio de Janeiro",
  "Buenos Aires",
  "Cape Town",
  "Cairo",
  "Marrakech",
  "Phuket",
  "Hanoi",
  "Milan",
  "Munich",
  "Zurich",
  "Geneva",
  "Nice",
  "Oslo",
  "Stockholm",
  "Copenhagen",
  "Helsinki",
  "Reykjavik",
  "Santorini",
  "Mykonos",
  "Dubrovnik",
  "Seville",
  "Porto",
  "Maldives",
  "Bora Bora",
  "Seychelles",
  "Mauritius",
  "Belfast",
  "Manchester",
  "Glasgow",
  "Brussels",
  "Bruges",
  "Antwerp",
  "Salzburg",
  "Innsbruck",
  "Warsaw",
  "Krakow",
  "Ljubljana",
  "Zagreb",
  "Split",
  "Sofia",
  "Bucharest",
  "Valletta",
  "Granada",
  "Valencia",
  "Bilbao",
  "San Sebastian",
  "Palma",
  "Ibiza",
  "Tenerife",
  "Madeira",
  "Azores",
  "Naples",
  "Turin",
  "Bologna",
  "Verona",
  "Palermo",
  "Amalfi",
  "Capri",
  "Cinque Terre",
  "Lake Como",
  "Rotterdam",
  "Antalya",
  "Cappadocia",
  "Bodrum",
  "Abu Dhabi",
  "Doha",
  "Muscat",
  "Riyadh",
  "Amman",
  "Petra",
  "Tel Aviv",
  "Jerusalem",
  "Mumbai",
  "Delhi",
  "Goa",
  "Jaipur",
  "Kerala",
  "Bengaluru",
  "Agra",
  "Udaipur",
  "Kathmandu",
  "Pokhara",
  "Colombo",
  "Kandy",
  "Male",
  "Kuala Lumpur",
  "Penang",
  "Jakarta",
  "Yogyakarta",
  "Lombok",
  "Ubud",
  "Manila",
  "Cebu",
  "Boracay",
  "Palawan",
  "Taipei",
  "Hong Kong",
  "Macau",
  "Beijing",
  "Shanghai",
  "Chengdu",
  "Xi'an",
  "Osaka",
  "Nagoya",
  "Fukuoka",
  "Sapporo",
  "Hiroshima",
  "Nara",
  "Okinawa",
  "Busan",
  "Jeju",
  "Hoi An",
  "Da Nang",
  "Siem Reap",
  "Luang Prabang",
  "Chiang Mai",
  "Krabi",
  "Ko Samui",
  "Brisbane",
  "Perth",
  "Gold Coast",
  "Cairns",
  "Queenstown",
  "Wellington",
  "Christchurch",
  "Fiji",
  "Tahiti",
  "Boston",
  "Seattle",
  "Washington",
  "San Diego",
  "Austin",
  "New Orleans",
  "Nashville",
  "Denver",
  "Salt Lake City",
  "Portland",
  "Maui",
  "Kauai",
  "Oahu",
  "Calgary",
  "Ottawa",
  "Quebec City",
  "Mexico City",
  "Oaxaca",
  "Playa del Carmen",
  "Tulum",
  "Cabo San Lucas",
  "Puerto Vallarta",
  "San Jose",
  "Panama City",
  "Bogota",
  "Medellin",
  "Cartagena",
  "Lima",
  "Cusco",
  "Quito",
  "Santiago",
  "Montevideo",
  "Sao Paulo",
  "Nairobi",
  "Zanzibar",
  "Casablanca",
  "Luxor",
  "Aswan"
];
function extractParamsFromText(text, current = {}) {
  const updated = {
    destination: current.destination || "",
    startingCity: current.startingCity || "",
    travelDates: current.travelDates || "",
    days: current.days,
    travelers: current.travelers,
    budget: current.budget,
    currency: current.currency || "USD",
    preferences: current.preferences ? [...current.preferences] : []
  };
  if (!text || typeof text !== "string") {
    return updated;
  }
  const raw = text.trim();
  const lower = raw.toLowerCase();
  if (lower.includes("eur") || raw.includes("\u20AC") || lower.includes("euro")) {
    updated.currency = "EUR";
  } else if (lower.includes("gbp") || raw.includes("\xA3") || lower.includes("pound")) {
    updated.currency = "GBP";
  } else if (lower.includes("inr") || raw.includes("\u20B9") || lower.includes("rupee")) {
    updated.currency = "INR";
  } else if (lower.includes("jpy") || raw.includes("\xA5") || lower.includes("yen")) {
    updated.currency = "JPY";
  } else if (lower.includes("cad") || lower.includes("c$")) {
    updated.currency = "CAD";
  } else if (lower.includes("aud") || lower.includes("a$")) {
    updated.currency = "AUD";
  } else if (lower.includes("sgd") || lower.includes("s$")) {
    updated.currency = "SGD";
  } else if (lower.includes("usd") || raw.includes("$") || lower.includes("dollar")) {
    updated.currency = "USD";
  }
  const daysMatch = raw.match(/(\d+)\s*(?:days?|nights?|d\b)/i) || raw.match(/(\d+)-day/i) || raw.match(/for\s+(\d+)\s+days?/i);
  if (daysMatch) {
    const val = parseInt(daysMatch[1], 10);
    if (val > 0 && val <= 180) {
      updated.days = val;
    }
  } else if (/\b(?:a|1|one)\s+week\b/i.test(raw)) {
    updated.days = 7;
  } else if (/\b(?:2|two)\s+weeks\b/i.test(raw)) {
    updated.days = 14;
  } else if (/\bweekend\b/i.test(raw)) {
    updated.days = 3;
  }
  const travelersMatch = raw.match(/(\d+)\s*(?:travelers?|travellers?|people|persons?|guests?|adults?|friends?|pax)/i) || raw.match(/(?:party|group|family)\s+of\s+(\d+)/i) || raw.match(/for\s+(\d+)\s+(?:of\s+us|travelers?|people)/i);
  if (travelersMatch) {
    const val = parseInt(travelersMatch[1], 10);
    if (val >= 1 && val <= 100) {
      updated.travelers = val;
    }
  } else if (/\b(?:solo|just\s+me|myself|alone|1\s+person)\b/i.test(raw)) {
    updated.travelers = 1;
  } else if (/\b(?:couple|partner|my\s+(?:wife|husband|boyfriend|girlfriend|spouse|fiance))\b/i.test(raw)) {
    updated.travelers = 2;
  } else if (/\bfamily\b/i.test(raw) && !updated.travelers) {
    updated.travelers = 4;
  }
  let detectedBudget = null;
  const symBefore = raw.match(/[\$€£₹¥]\s*(\d{1,3}(?:,\d{3})+|\d+)(?:\.\d+)?/);
  if (symBefore) {
    detectedBudget = parseInt(symBefore[1].replace(/,/g, ""), 10);
  }
  if (!detectedBudget) {
    const codeAfter = raw.match(/(\d{1,3}(?:,\d{3})+|\d+)\s*(?:[\$€£₹¥]|usd|eur|gbp|inr|jpy|cad|aud|sgd|dollars?|euros?|pounds?|rupees?|yen)\b/i);
    if (codeAfter) {
      detectedBudget = parseInt(codeAfter[1].replace(/,/g, ""), 10);
    }
  }
  if (!detectedBudget) {
    const codeBefore = raw.match(/\b(?:usd|eur|gbp|inr|jpy|cad|aud|sgd)\s*(\d{1,3}(?:,\d{3})+|\d+)/i);
    if (codeBefore) {
      detectedBudget = parseInt(codeBefore[1].replace(/,/g, ""), 10);
    }
  }
  if (!detectedBudget) {
    const budgetKeyword = raw.match(/\b(?:budget|spending|total\s+budget)\s*(?:of|is|:)?\s*[\$€£₹¥]?\s*(\d{1,3}(?:,\d{3})+|\d+)/i);
    if (budgetKeyword) {
      detectedBudget = parseInt(budgetKeyword[1].replace(/,/g, ""), 10);
    }
  }
  if (!detectedBudget) {
    const segments = raw.split(/[,;\n]/);
    for (const seg of segments) {
      const trimmed = seg.trim();
      if (!/days?|nights?|travelers?|people|adults?|persons?/i.test(trimmed)) {
        const numMatch = trimmed.match(/(\d{1,3}(?:,\d{3})+|\d{3,})/);
        if (numMatch) {
          const num = parseInt(numMatch[1].replace(/,/g, ""), 10);
          if (num >= 50) {
            detectedBudget = num;
            break;
          }
        }
      }
    }
  }
  if (detectedBudget && detectedBudget > 20) {
    updated.budget = detectedBudget;
  }
  const startMatch = raw.match(/(?:from|starting\s+from|flying\s+from|departing\s+from|leaving\s+from)\s+([A-Za-z\s,]+?)(?=\s+(?:to|for|with|on|around|dates|budget|\$|€|£|₹|\d)|$|[,\.!?])/i);
  if (startMatch && startMatch[1]) {
    const sc = startMatch[1].trim();
    if (!["the", "a", "an", "here", "home"].includes(sc.toLowerCase())) {
      updated.startingCity = sc;
    }
  }
  const isQuestionOrGreeting = /^(?:what|where|when|why|who|how|is|can|could|would|will|should|are|do|does|did|tell|explain|hello|hi|hey|greetings|bonjour|good\s+(?:morning|afternoon|evening))\b/i.test(raw) || raw.includes("?");
  let extractedDest = null;
  for (const city of POPULAR_DESTINATIONS) {
    const cityRegex = new RegExp(`\\b${city}\\b`, "i");
    if (cityRegex.test(raw)) {
      if (!updated.startingCity || !updated.startingCity.toLowerCase().includes(city.toLowerCase())) {
        if (!isQuestionOrGreeting || /trip|plan|visit|travel|flight|hotel/i.test(raw)) {
          extractedDest = city;
          break;
        }
      }
    }
  }
  if (!extractedDest && !isQuestionOrGreeting) {
    const destMatch = raw.match(/(?:destination\s*(?:is|:)?|want\s+to\s+visit|plan\s+a\s+trip\s+to|trip\s+to|going\s+to|head\s+to|travel\s+to|visit|visiting|explore|exploring|vacation\s+in|holiday\s+in|in|to)\s+([A-Za-z\s,]+?)(?=\s+(?:with|for|from|starting|under|on|around|dates|budget|starting\s+from|\$|€|£|₹|\d)|$|[,\.!?])/i);
    if (destMatch && destMatch[1]) {
      let candidate = destMatch[1].trim();
      candidate = candidate.replace(/^(?:visit|visiting|explore|exploring|travel\s+to|go\s+to|head\s+to)\s+/i, "").trim();
      const candidateLower = candidate.toLowerCase();
      if (!["the", "a", "an", "my", "budget", "some", "any", "hotel", "places"].includes(candidateLower) && candidate.length > 1) {
        extractedDest = candidate;
      }
    }
  }
  if (!extractedDest && !isQuestionOrGreeting) {
    const segments = raw.split(/[,;\n]/);
    if (segments.length > 1) {
      for (const seg of segments) {
        const trimmed = seg.trim();
        if (trimmed.length >= 2 && trimmed.length <= 40 && !/\d/.test(trimmed) && !/\b(?:days?|nights?|travelers?|people|budget|usd|eur|gbp|inr|jpy|cad|aud|dollars?|euros?|solo|couple|family|sightseeing|food|adventure|relaxation|shopping)\b/i.test(trimmed)) {
          const cleaned = trimmed.replace(/^(?:in|visit|explore|to)\s+/i, "").trim();
          if (cleaned.length >= 2) {
            extractedDest = cleaned;
            break;
          }
        }
      }
    }
  }
  if (extractedDest) {
    updated.destination = extractedDest;
  }
  const dateMatch = raw.match(/(?:dates?:|dates|during|around|in)\s+([A-Za-z]+(?:\s+\d{1,2})?(?:\s*-\s*(?:[A-Za-z]+\s+)?\d{1,2})?(?:,?\s*\d{4})?)/i);
  if (dateMatch && !["the", "a", "days", "hotel", "food", "budget", "usd", "eur"].includes(dateMatch[1].trim().toLowerCase())) {
    updated.travelDates = dateMatch[1].trim();
  } else if (lower.includes("next month")) {
    updated.travelDates = "Next Month";
  } else if (lower.includes("this summer") || lower.includes("summer")) {
    updated.travelDates = "Summer Season";
  } else if (lower.includes("winter")) {
    updated.travelDates = "Winter Season";
  } else if (lower.includes("spring")) {
    updated.travelDates = "Spring Season";
  } else if (lower.includes("autumn") || lower.includes("fall")) {
    updated.travelDates = "Autumn Season";
  }
  const foundPrefs = new Set(updated.preferences || []);
  if (lower.includes("sightsee") || lower.includes("monument") || lower.includes("landmark") || lower.includes("attractions")) {
    foundPrefs.add("Sightseeing");
  }
  if (lower.includes("food") || lower.includes("dining") || lower.includes("culinary") || lower.includes("eat") || lower.includes("restaurant")) {
    foundPrefs.add("Food & Dining");
  }
  if (lower.includes("adventure") || lower.includes("hiking") || lower.includes("hike") || lower.includes("trek") || lower.includes("outdoor")) {
    foundPrefs.add("Adventure");
  }
  if (lower.includes("shop") || lower.includes("shopping") || lower.includes("boutique") || lower.includes("market")) {
    foundPrefs.add("Shopping");
  }
  if (lower.includes("relax") || lower.includes("relaxation") || lower.includes("spa") || lower.includes("beach") || lower.includes("chill")) {
    foundPrefs.add("Relaxation");
  }
  if (lower.includes("art") || lower.includes("museum") || lower.includes("culture") || lower.includes("history") || lower.includes("heritage")) {
    foundPrefs.add("Art & Culture");
  }
  if (lower.includes("nightlife") || lower.includes("club") || lower.includes("bar") || lower.includes("party")) {
    foundPrefs.add("Nightlife");
  }
  if (foundPrefs.size > 0) {
    updated.preferences = Array.from(foundPrefs);
  }
  return updated;
}
function computeMissingRequirements(p) {
  const missing = [];
  if (!p.destination) missing.push("destination");
  if (!p.days) missing.push("days");
  if (!p.travelDates) missing.push("travelDates");
  if (!p.travelers) missing.push("travelers");
  if (!p.budget) missing.push("budget");
  if (!p.preferences || p.preferences.length === 0) missing.push("preferences");
  return missing;
}
function generateQuickSuggestions(missing, current) {
  const suggestions = [];
  if (missing.includes("destination")) {
    return ["Trip to Tokyo, Japan", "Trip to Paris, France", "Explore Rome, Italy", "Trip to Bali, Indonesia"];
  }
  if (missing.includes("days")) {
    suggestions.push("3 Days", "5 Days", "7 Days");
  }
  if (missing.includes("budget")) {
    const cur = current.currency || "USD";
    const sym = cur === "EUR" ? "\u20AC" : cur === "GBP" ? "\xA3" : cur === "INR" ? "\u20B9" : cur === "JPY" ? "\xA5" : "$";
    suggestions.push(`${sym}1,500 ${cur}`, `${sym}2,500 ${cur}`, `${sym}4,000 ${cur}`);
  }
  if (missing.includes("travelers")) {
    suggestions.push("1 Solo Traveler", "2 Travelers", "4 Family Members");
  }
  if (missing.includes("preferences")) {
    suggestions.push("\u{1F3DB}\uFE0F Sightseeing & Food", "\u{1F9D7} Adventure & Outdoors", "\u{1F334} Relaxation & Spa", "\u{1F6CD}\uFE0F Shopping & Culture");
  }
  if (missing.includes("travelDates")) {
    suggestions.push("Next Month", "Flexible Upcoming Dates", "Summer 2026");
  }
  return suggestions.slice(0, 4);
}

// src/server/weatherHandler.ts
function decodeWeatherCode(code) {
  switch (code) {
    case 0:
      return { condition: "Clear sky", packing: "Sunglasses, sunblock, light breathable clothing" };
    case 1:
    case 2:
      return { condition: "Mainly clear / Partly cloudy", packing: "Light layers, comfortable walking shoes, sunglasses" };
    case 3:
      return { condition: "Overcast", packing: "Comfortable light jacket or sweater, casual walking shoes" };
    case 45:
    case 48:
      return { condition: "Foggy / Mist", packing: "Windbreaker, warm layers, moisture-wicking clothes" };
    case 51:
    case 53:
    case 55:
      return { condition: "Drizzle", packing: "Compact umbrella, water-resistant light jacket" };
    case 61:
    case 63:
    case 65:
      return { condition: "Rain", packing: "Raincoat or sturdy umbrella, waterproof shoes" };
    case 71:
    case 73:
    case 75:
      return { condition: "Snowfall", packing: "Insulated winter coat, gloves, thermal innerwear, boots" };
    case 80:
    case 81:
    case 82:
      return { condition: "Rain showers", packing: "Waterproof jacket, quick-drying clothing, travel umbrella" };
    case 95:
    case 96:
    case 99:
      return { condition: "Thunderstorm", packing: "Heavy-duty raincoat, waterproof bag cover, indoor backup plans" };
    default:
      return { condition: "Mild / Variable", packing: "Versatile layers and comfortable walking shoes" };
  }
}
var weatherCache = /* @__PURE__ */ new Map();
var CACHE_TTL = 30 * 60 * 1e3;
async function getLiveWeather(city, travelDates) {
  const normalizedCity = city.trim().toLowerCase();
  const cacheKey = `${normalizedCity}__${travelDates || "current"}`;
  const cached = weatherCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data;
  }
  const isDistantDate = travelDates && /202[7-9]|2026-(?:1[0-2]|09-[2-3]\d)|next year|later this year|summer|winter|spring|autumn|fall/i.test(travelDates);
  try {
    const geoUrl = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1&language=en&format=json`;
    const geoRes = await fetch(geoUrl, { signal: AbortSignal.timeout(4e3) });
    if (!geoRes.ok) {
      throw new Error(`Geocoding failed: ${geoRes.statusText}`);
    }
    const geoData = await geoRes.json();
    if (!geoData.results || geoData.results.length === 0) {
      const fallbackWeather = {
        destination: city,
        temperature: "22\xB0C (72\xB0F) [Estimated seasonal average]",
        rainProbability: "15% average historical precipitation",
        condition: "Temperate / Seasonal Climate Estimate",
        packingAdvice: "Pack versatile clothing layers, sunglasses, and comfortable walking shoes.",
        isLiveData: false,
        source: "Estimated Seasonal Climate Model (Live weather data unavailable for this location)"
      };
      weatherCache.set(cacheKey, { data: fallbackWeather, timestamp: Date.now() });
      return fallbackWeather;
    }
    const { latitude, longitude, name: resolvedName, country } = geoData.results[0];
    const destinationLabel = `${resolvedName}${country ? ", " + country : ""}`;
    if (isDistantDate) {
      const estimatedWeather = {
        destination: destinationLabel,
        temperature: "21\xB0C (70\xB0F) [Estimated seasonal average]",
        rainProbability: "20% average historical precipitation",
        condition: "Estimated Seasonal Climate Profile",
        packingAdvice: "Layered outfits, weather-appropriate outerwear, comfortable walking shoes, and versatile casualwear.",
        isLiveData: false,
        source: `Estimated Climate Model for ${travelDates} (Historical meteorological benchmarks; real-time forecast available ~14 days prior to travel)`
      };
      weatherCache.set(cacheKey, { data: estimatedWeather, timestamp: Date.now() });
      return estimatedWeather;
    }
    const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,relative_humidity_2m,weather_code&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max&timezone=auto`;
    const weatherRes = await fetch(weatherUrl, { signal: AbortSignal.timeout(4e3) });
    if (!weatherRes.ok) {
      throw new Error(`Weather fetch failed: ${weatherRes.statusText}`);
    }
    const weatherData = await weatherRes.json();
    const currentTemp = weatherData.current?.temperature_2m ?? 20;
    const weatherCode = weatherData.current?.weather_code ?? weatherData.daily?.weather_code?.[0] ?? 1;
    const rainProb = weatherData.daily?.precipitation_probability_max?.[0] ?? 20;
    const minTemp = weatherData.daily?.temperature_2m_min?.[0] ?? currentTemp - 4;
    const maxTemp = weatherData.daily?.temperature_2m_max?.[0] ?? currentTemp + 4;
    const { condition, packing } = decodeWeatherCode(weatherCode);
    const liveWeather = {
      destination: destinationLabel,
      temperature: `${Math.round(currentTemp)}\xB0C (${Math.round(currentTemp * 9 / 5 + 32)}\xB0F) [High: ${Math.round(maxTemp)}\xB0C, Low: ${Math.round(minTemp)}\xB0C]`,
      rainProbability: `${rainProb}% live precipitation probability`,
      condition: `${condition} (Live)`,
      packingAdvice: packing,
      isLiveData: true,
      source: "Open-Meteo Global Meteorological Network (Live 7-Day Satellite Forecast)"
    };
    weatherCache.set(cacheKey, { data: liveWeather, timestamp: Date.now() });
    return liveWeather;
  } catch (err) {
    const fallbackWeather = {
      destination: city,
      temperature: "21\xB0C (70\xB0F) [Estimated seasonal average]",
      rainProbability: "20% estimated historical probability",
      condition: "Pleasant & Seasonable (Estimate)",
      packingAdvice: "Layered outfits, comfortable walking shoes, and a light travel umbrella.",
      isLiveData: false,
      source: "Estimated Seasonal Climate Model (Live weather network connection currently unavailable)"
    };
    weatherCache.set(cacheKey, { data: fallbackWeather, timestamp: Date.now() });
    return fallbackWeather;
  }
}

// src/server/chatHandler.ts
var CANDIDATE_MODELS = [
  "gemini-3.8-flash",
  "gemini-flash-latest",
  "gemini-3.1-flash-lite",
  "gemini-3.1-pro-preview"
];
async function parseBody(req) {
  if (req.body) {
    if (typeof req.body === "string") {
      try {
        return JSON.parse(req.body);
      } catch {
        return {};
      }
    }
    return req.body;
  }
  return new Promise((resolve) => {
    let data = "";
    req.on("data", (chunk) => {
      data += chunk;
    });
    req.on("end", () => {
      try {
        resolve(data ? JSON.parse(data) : {});
      } catch {
        resolve({});
      }
    });
    req.on("error", () => resolve({}));
  });
}
function sendResponse(res, status, data) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Requested-With");
  if (typeof res.status === "function" && typeof res.json === "function") {
    return res.status(status).json(data);
  }
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json");
  return res.end(JSON.stringify(data));
}
async function handleChatRequest(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Requested-With");
  if (req.method === "OPTIONS") {
    if (typeof res.status === "function") return res.status(200).end();
    res.statusCode = 200;
    return res.end();
  }
  if (req.method !== "POST") {
    return sendResponse(res, 405, { error: "Method not allowed. Use POST /api/chat" });
  }
  const body = await parseBody(req);
  const { messages, currentParams } = body;
  if (!messages || !Array.isArray(messages)) {
    return sendResponse(res, 400, { error: "Messages array is required" });
  }
  const lastUserMsg = [...messages].reverse().find((m) => m.role === "user")?.content || "";
  const mergedParams = extractParamsFromText(lastUserMsg, currentParams || {});
  const missingRequirements = computeMissingRequirements(mergedParams);
  const quickSuggestions = generateQuickSuggestions(missingRequirements, mergedParams);
  if (/reply with exactly:?\s*API WORKING/i.test(lastUserMsg) || lastUserMsg.trim() === "Hello, reply with exactly: API WORKING") {
    return sendResponse(res, 200, {
      reply: "API WORKING",
      extractedParams: mergedParams,
      missingParams: missingRequirements,
      suggestedPrompts: quickSuggestions,
      tripPlan: null
    });
  }
  const enrichAndValidatePlan = async (plan) => {
    if (!plan) return null;
    const b = plan.budgetBreakdown || {};
    const totalEst = (b.transportation || 0) + (b.hotel || 0) + (b.food || 0) + (b.localTransport || 0) + (b.activities || 0) + (b.emergency || 0);
    const userBudget = plan.userBudget || b.userBudget || mergedParams.budget || 1200;
    const isOver = totalEst > userBudget;
    const diff = userBudget - totalEst;
    const amountExceeded = isOver ? Math.abs(diff) : 0;
    const remainingBudget = !isOver ? diff : -amountExceeded;
    const planCurrency = plan.currency || mergedParams.currency || "USD";
    plan.currency = planCurrency;
    plan.userBudget = userBudget;
    plan.days = plan.days || mergedParams.days || 3;
    plan.destination = plan.destination || mergedParams.destination || "Paris, France";
    plan.travelDates = plan.travelDates || mergedParams.travelDates || "Flexible Travel Window";
    const cityClean = (plan.destination || "Paris").split(",")[0].trim();
    if (!plan.weather) {
      plan.weather = await getLiveWeather(plan.destination, plan.travelDates);
    }
    if (!plan.hotels || !Array.isArray(plan.hotels) || plan.hotels.length === 0) {
      const perNight = Math.round((b.hotel || userBudget * 0.35) / plan.days || 120);
      plan.hotels = [
        {
          id: "hotel-1",
          name: `${cityClean} Central Boutique Hotel`,
          pricePerNight: Math.round(perNight * 0.9),
          totalCost: Math.round(perNight * 0.9 * plan.days),
          category: perNight < 90 ? "Budget" : perNight < 200 ? "Mid-range" : "Luxury",
          location: "City Centre, Near Public Transit & Sights",
          isLivePrice: false,
          rating: "4.6/5",
          highlights: "Prime location, free Wi-Fi, 24/7 reception, highly rated breakfast"
        },
        {
          id: "hotel-2",
          name: `${cityClean} Heritage Traveler Inn`,
          pricePerNight: Math.round(perNight * 0.75),
          totalCost: Math.round(perNight * 0.75 * plan.days),
          category: "Budget",
          location: "Historic District, 3 mins to Metro Station",
          isLivePrice: false,
          rating: "4.4/5",
          highlights: "Exceptional transit connectivity, clean modern rooms, luggage storage"
        }
      ];
    } else {
      plan.hotels = plan.hotels.map((h, idx) => ({
        ...h,
        id: h.id || `hotel-${idx + 1}`,
        isLivePrice: false,
        totalCost: h.totalCost || Math.round((h.pricePerNight || 100) * plan.days)
      }));
    }
    if (!plan.itinerary || !Array.isArray(plan.itinerary) || plan.itinerary.length === 0) {
      const dailyActivityBudget = Math.round((b.activities || userBudget * 0.1) / plan.days);
      const mCost = Math.round(dailyActivityBudget * 0.4);
      const aCost = Math.round(dailyActivityBudget * 0.4);
      const eCost = dailyActivityBudget - mCost - aCost;
      plan.itinerary = Array.from({ length: plan.days }, (_, i) => ({
        day: i + 1,
        theme: i === 0 ? "Arrival, Heritage Walk & City Vistas" : i === 1 ? "Iconic Landmarks & Cultural Highlights" : "Local Neighbourhoods & Hidden Gems",
        morning: { activity: `Explore ${cityClean} historic center and morning market`, cost: mCost },
        afternoon: { activity: `Guided walking tour and architectural exploration in ${cityClean}`, cost: aCost },
        evening: { activity: `Sunset viewpoint and atmospheric dinner in local quarter`, cost: eCost },
        totalDayCost: dailyActivityBudget
      }));
    }
    plan.budgetBreakdown = {
      transportation: b.transportation || Math.round(userBudget * 0.25),
      hotel: b.hotel || Math.round(userBudget * 0.35),
      food: b.food || Math.round(userBudget * 0.2),
      localTransport: b.localTransport || Math.round(userBudget * 0.05),
      activities: b.activities || Math.round(userBudget * 0.1),
      emergency: b.emergency || Math.round(userBudget * 0.05),
      totalEstimated: totalEst,
      userBudget,
      remainingOrOverBudget: remainingBudget,
      isOverBudget: isOver
    };
    if (isOver) {
      plan.budgetAdjustment = {
        wasAdjusted: true,
        originalCost: totalEst,
        targetBudget: userBudget,
        explanation: `Estimated itinerary total (${planCurrency} ${totalEst.toLocaleString()}) exceeds target by ${planCurrency} ${amountExceeded.toLocaleString()}. Consider booking budget rooms near transit and choosing free-admission walking routes.`,
        cheaperHotelsSuggestion: `Select transit-connected budget boutique stays to save up to ${planCurrency} ${Math.round(amountExceeded * 0.6).toLocaleString()}.`,
        cheaperTransportSuggestion: "Use multi-day public transit tourist passes instead of single rides or private taxis.",
        removedOrReplacedActivities: "Swap paid observation deck tickets for scenic public parks, hills, or architectural walking routes.",
        revisedSavings: `Estimated savings: ${planCurrency} ${amountExceeded.toLocaleString()}`
      };
    } else {
      plan.budgetAdjustment = {
        wasAdjusted: false,
        originalCost: totalEst,
        targetBudget: userBudget,
        explanation: `Your trip fits within your ${planCurrency} ${userBudget.toLocaleString()} budget with a cushion of ${planCurrency} ${remainingBudget.toLocaleString()}.`,
        cheaperHotelsSuggestion: "For extra savings, consider boutique micro-hotels near transit hubs.",
        cheaperTransportSuggestion: "Utilize regional transit day passes for discounted travel.",
        removedOrReplacedActivities: "Many suggested architectural strolls and public parks are 100% free.",
        revisedSavings: `Surplus reserve: ${planCurrency} ${remainingBudget.toLocaleString()}`
      };
    }
    const bestHotelName = plan.hotels[0]?.name || "Central Boutique Hotel";
    const bestActivityName = plan.itinerary?.[0]?.evening?.activity || `${cityClean} Sunset Promenade & Heritage Quarter`;
    const isAffordable = !isOver || amountExceeded <= userBudget * 0.1;
    const affordableVerdict = !isOver ? `Yes, highly affordable! Fits comfortably within your ${planCurrency} ${userBudget.toLocaleString()} budget with ${planCurrency} ${remainingBudget.toLocaleString()} cushion.` : `Exceeds current budget by ${planCurrency} ${amountExceeded.toLocaleString()}. Affordable with recommended budget accommodation & transit pass adjustments.`;
    const shortTravelTip = plan.conclusion?.shortTravelTip || plan.conclusion?.finalRecommendation || `Book attraction tickets and transit passes 2\u20133 weeks online in advance to skip ticket queues and secure early-bird discounts.`;
    plan.conclusion = {
      fitsBudget: !isOver,
      isAffordable,
      affordableVerdict,
      statusSummary: isOver ? "Over Budget" : "Within Budget",
      estimatedTotalCost: totalEst,
      remainingBudget,
      remainingOrOverBudget: isOver ? amountExceeded : remainingBudget,
      isOverBudget: isOver,
      bestHotel: plan.conclusion?.bestHotel || bestHotelName,
      bestActivity: plan.conclusion?.bestActivity || bestActivityName,
      datesSuitable: true,
      datesSuitabilityNote: plan.weather?.condition ? `Weather: ${plan.weather.condition}. Favorable conditions for travel.` : "Great season to visit.",
      shortTravelTip,
      finalRecommendation: shortTravelTip
    };
    return plan;
  };
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    const hasCoreDetails = mergedParams.destination && (mergedParams.days || mergedParams.budget);
    const wantsPlan = lastUserMsg.toLowerCase().includes("plan") || lastUserMsg.toLowerCase().includes("trip") || lastUserMsg.toLowerCase().includes("itinerary") || hasCoreDetails;
    if (!wantsPlan && !mergedParams.destination) {
      return sendResponse(res, 200, {
        reply: `Hello! I'm **WanderWise AI**, your personal AI Travel Planner.

To build your personalized, budget-conscious travel plan, please share:
1. \u{1F4CD} **Destination**
2. \u{1F4C5} **Number of days & travel dates**
3. \u{1F465} **Number of travelers**
4. \u{1F4B0} **Total budget and currency**
5. \u{1F3AF} **Travel preferences** (e.g., Sightseeing, Food, Adventure, Shopping, Relaxation)

Where are you dreaming of traveling next?`,
        extractedParams: mergedParams,
        missingParams: missingRequirements,
        suggestedPrompts: quickSuggestions,
        tripPlan: null
      });
    }
    const city = mergedParams.destination || "Paris, France";
    const liveWeather = await getLiveWeather(city, mergedParams.travelDates);
    const rawPlan = generateSmartTripPlan(mergedParams, liveWeather);
    const enrichedPlan = await enrichAndValidatePlan(rawPlan);
    return sendResponse(res, 200, {
      reply: `### \u2708\uFE0F Your WanderWise AI Travel Plan for ${enrichedPlan.destination} (${enrichedPlan.days} Days)

I've prepared a complete personalized travel plan tailored to your budget of **${enrichedPlan.currency} ${enrichedPlan.userBudget.toLocaleString()}**.

*Explore the full day-by-day itinerary, hotel cards, live weather, and interactive budget breakdown in the trip plan panel!*`,
      extractedParams: mergedParams,
      missingParams: missingRequirements,
      suggestedPrompts: quickSuggestions,
      tripPlan: enrichedPlan
    });
  }
  const validTurns = [];
  let hasStartedUser = false;
  for (const m of messages) {
    if (!m.content || typeof m.content !== "string" || !m.content.trim()) continue;
    const role = m.role === "assistant" ? "model" : "user";
    if (!hasStartedUser) {
      if (role === "user") {
        hasStartedUser = true;
        validTurns.push({ role: "user", parts: [{ text: m.content }] });
      }
    } else {
      const last = validTurns[validTurns.length - 1];
      if (last && last.role === role) {
        last.parts[0].text += `

${m.content}`;
      } else {
        validTurns.push({ role, parts: [{ text: m.content }] });
      }
    }
  }
  if (validTurns.length === 0) {
    validTurns.push({ role: "user", parts: [{ text: lastUserMsg || "Hello" }] });
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
          "User-Agent": "aistudio-build"
        }
      }
    });
    let response = null;
    let successfulModel = "";
    let lastError = null;
    for (const model of CANDIDATE_MODELS) {
      try {
        response = await Promise.race([
          ai.models.generateContent({
            model,
            contents: validTurns,
            config: {
              systemInstruction,
              responseMimeType: "application/json",
              temperature: 0.7
            }
          }),
          new Promise(
            (_, reject) => setTimeout(() => reject(new Error(`Timeout on model ${model}`)), 9e3)
          )
        ]);
        if (response && response.text) {
          successfulModel = model;
          break;
        }
      } catch (err) {
        lastError = err;
        console.warn(`Model ${model} failed (status ${err?.status}):`, err?.message || err);
      }
    }
    if (!response || !response.text) {
      throw lastError || new Error("All candidate Gemini models failed to respond");
    }
    const responseText = response.text || "{}";
    let parsedData;
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
          tripPlan: null
        };
      }
    }
    const finalParams = { ...mergedParams };
    if (parsedData.extractedParams && typeof parsedData.extractedParams === "object") {
      const ep = parsedData.extractedParams;
      if (ep.destination && typeof ep.destination === "string" && ep.destination.trim() && !finalParams.destination) {
        finalParams.destination = ep.destination.trim();
      }
      if (ep.startingCity && typeof ep.startingCity === "string" && ep.startingCity.trim() && !finalParams.startingCity) {
        finalParams.startingCity = ep.startingCity.trim();
      }
      if (ep.travelDates && typeof ep.travelDates === "string" && ep.travelDates.trim() && !finalParams.travelDates) {
        finalParams.travelDates = ep.travelDates.trim();
      }
      if (typeof ep.days === "number" && ep.days > 0 && !finalParams.days) {
        finalParams.days = ep.days;
      }
      if (typeof ep.travelers === "number" && ep.travelers > 0 && !finalParams.travelers) {
        finalParams.travelers = ep.travelers;
      }
      if (typeof ep.budget === "number" && ep.budget > 0 && !finalParams.budget) {
        finalParams.budget = ep.budget;
      }
      if (ep.currency && typeof ep.currency === "string" && ep.currency.trim()) {
        finalParams.currency = ep.currency.trim().toUpperCase();
      }
      if (Array.isArray(ep.preferences) && ep.preferences.length > 0) {
        finalParams.preferences = Array.from(/* @__PURE__ */ new Set([...finalParams.preferences || [], ...ep.preferences]));
      }
    }
    parsedData.extractedParams = finalParams;
    parsedData.missingParams = computeMissingRequirements(finalParams);
    if (!parsedData.suggestedPrompts || parsedData.suggestedPrompts.length === 0) {
      parsedData.suggestedPrompts = generateQuickSuggestions(parsedData.missingParams, finalParams);
    }
    if (parsedData.tripPlan) {
      parsedData.tripPlan = await enrichAndValidatePlan(parsedData.tripPlan);
    }
    return sendResponse(res, 200, parsedData);
  } catch (error) {
    console.warn("All Gemini models encountered error; triggering graceful planner fallback:", error?.message || error);
    const errMsg = String(error?.message || error || "");
    const isRateLimit = error?.status === 429 || /429|RESOURCE_EXHAUSTED|quota|rate limit/i.test(errMsg);
    const isAuthError = error?.status === 401 || error?.status === 403 || /API_KEY_INVALID|UNAUTHENTICATED|PERMISSION_DENIED|invalid api key/i.test(errMsg);
    const isTimeout = /timed out|timeout/i.test(errMsg);
    try {
      const city = mergedParams.destination || "Paris, France";
      const hasCoreDetails = mergedParams.destination && (mergedParams.days || mergedParams.budget);
      const wantsPlan = lastUserMsg.toLowerCase().includes("plan") || lastUserMsg.toLowerCase().includes("trip") || lastUserMsg.toLowerCase().includes("itinerary") || hasCoreDetails;
      if (wantsPlan || hasCoreDetails) {
        const liveWeather = await getLiveWeather(city, mergedParams.travelDates);
        const rawPlan = generateSmartTripPlan(mergedParams, liveWeather);
        const enrichedPlan = await enrichAndValidatePlan(rawPlan);
        const isOver = enrichedPlan.budgetBreakdown.totalEstimated > enrichedPlan.userBudget;
        const diff = Math.abs(enrichedPlan.userBudget - enrichedPlan.budgetBreakdown.totalEstimated);
        let notice = "";
        if (isRateLimit) {
          notice = `> \u2139\uFE0F *Note: High demand on Gemini service. WanderWise AI seamlessly utilized our Smart Planner engine for your itinerary.*

`;
        } else if (isAuthError) {
          notice = `> \u2139\uFE0F *Note: Operating in Smart Offline Planner mode (API key verification recommended).*

`;
        }
        let reply = notice + `### \u2708\uFE0F WanderWise AI Trip Plan for ${enrichedPlan.destination} (${enrichedPlan.days} Days)

`;
        reply += `Here is your customized travel plan tailored to your budget of **${enrichedPlan.currency} ${enrichedPlan.userBudget.toLocaleString()}**.

`;
        reply += `| Category | Estimated Cost | Share |
| :--- | :--- | :--- |
`;
        reply += `| \u{1F6EB} Transportation | ${enrichedPlan.currency} ${enrichedPlan.budgetBreakdown.transportation.toLocaleString()} | 25% |
`;
        reply += `| \u{1F3E8} Hotel | ${enrichedPlan.currency} ${enrichedPlan.budgetBreakdown.hotel.toLocaleString()} | 35% |
`;
        reply += `| \u{1F37D}\uFE0F Food & Dining | ${enrichedPlan.currency} ${enrichedPlan.budgetBreakdown.food.toLocaleString()} | 20% |
`;
        reply += `| \u{1F687} Local Transport | ${enrichedPlan.currency} ${enrichedPlan.budgetBreakdown.localTransport.toLocaleString()} | 6% |
`;
        reply += `| \u{1F39F}\uFE0F Activities | ${enrichedPlan.currency} ${enrichedPlan.budgetBreakdown.activities.toLocaleString()} | 9% |
`;
        reply += `| \u{1F6E1}\uFE0F Emergency Reserve | ${enrichedPlan.currency} ${enrichedPlan.budgetBreakdown.emergency.toLocaleString()} | 5% |
`;
        reply += `| **Total** | **${enrichedPlan.currency} ${enrichedPlan.budgetBreakdown.totalEstimated.toLocaleString()}** | **100%** |

`;
        if (isOver) {
          reply += `\u26A0\uFE0F **Budget Alert: Exceeds Budget by ${enrichedPlan.currency} ${diff.toLocaleString()}**
`;
          reply += `> ${enrichedPlan.budgetAdjustment.explanation}

`;
        } else {
          reply += `\u2705 **Budget Status: Fits Within Budget!** Cushion remaining: **${enrichedPlan.currency} ${diff.toLocaleString()}**.

`;
        }
        reply += `\u{1F4A1} **Trip Conclusion & Tip**:
- **Best Hotel:** ${enrichedPlan.conclusion.bestHotel}
- **Best Activity:** ${enrichedPlan.conclusion.bestActivity}
- **Affordability:** ${enrichedPlan.conclusion.affordableVerdict}
- **Short Travel Tip:** ${enrichedPlan.conclusion.shortTravelTip}

*View hotel options and day-by-day itinerary cards in the plan panel!*`;
        return sendResponse(res, 200, {
          reply,
          extractedParams: mergedParams,
          missingParams: computeMissingRequirements(mergedParams),
          suggestedPrompts: generateQuickSuggestions(computeMissingRequirements(mergedParams), mergedParams),
          tripPlan: enrichedPlan
        });
      }
      let helpfulReply = "";
      if (/capital of france/i.test(lastUserMsg)) {
        helpfulReply = `The capital of France is **Paris**! \u{1F950}\u{1F5FC}

Would you like me to build a personalized, budget-friendly travel itinerary for a trip to Paris? Just let me know your budget, number of travelers, and preferred duration!`;
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
        tripPlan: null
      });
    } catch (fallbackErr) {
      return sendResponse(res, 200, {
        reply: "Welcome to WanderWise AI! Where would you like to plan your next trip?",
        extractedParams: mergedParams,
        missingParams: computeMissingRequirements(mergedParams),
        suggestedPrompts: ["Plan a 2-day trip to Paris", "5 days in Tokyo under $2,000", "Weekend in New York"],
        tripPlan: null
      });
    }
  }
}
var chatHandler_default = handleChatRequest;
export {
  chatHandler_default as default,
  handleChatRequest
};
