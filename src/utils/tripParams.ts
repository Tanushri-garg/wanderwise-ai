import { TripParameters } from '../types';

const POPULAR_DESTINATIONS = [
  'Paris', 'Tokyo', 'Rome', 'London', 'New York', 'Bali', 'Barcelona', 'Amsterdam',
  'Venice', 'Florence', 'Madrid', 'Berlin', 'Vienna', 'Prague', 'Budapest', 'Dublin',
  'Edinburgh', 'Lisbon', 'Athens', 'Istanbul', 'Dubai', 'Singapore', 'Bangkok', 'Kyoto',
  'Seoul', 'Sydney', 'Melbourne', 'Auckland', 'Toronto', 'Vancouver', 'Montreal',
  'San Francisco', 'Los Angeles', 'Chicago', 'Miami', 'Las Vegas', 'Honolulu', 'Hawaii',
  'Cancun', 'Rio de Janeiro', 'Buenos Aires', 'Cape Town', 'Cairo', 'Marrakech', 'Phuket',
  'Hanoi', 'Milan', 'Munich', 'Zurich', 'Geneva', 'Nice', 'Oslo', 'Stockholm',
  'Copenhagen', 'Helsinki', 'Reykjavik', 'Santorini', 'Mykonos', 'Dubrovnik', 'Seville',
  'Porto', 'Maldives', 'Bora Bora', 'Seychelles', 'Mauritius', 'Belfast', 'Manchester',
  'Glasgow', 'Brussels', 'Bruges', 'Antwerp', 'Salzburg', 'Innsbruck', 'Warsaw',
  'Krakow', 'Ljubljana', 'Zagreb', 'Split', 'Sofia', 'Bucharest', 'Valletta',
  'Granada', 'Valencia', 'Bilbao', 'San Sebastian', 'Palma', 'Ibiza', 'Tenerife',
  'Madeira', 'Azores', 'Naples', 'Turin', 'Bologna', 'Verona', 'Palermo', 'Amalfi',
  'Capri', 'Cinque Terre', 'Lake Como', 'Rotterdam', 'Antalya', 'Cappadocia', 'Bodrum',
  'Abu Dhabi', 'Doha', 'Muscat', 'Riyadh', 'Amman', 'Petra', 'Tel Aviv', 'Jerusalem',
  'Mumbai', 'Delhi', 'Goa', 'Jaipur', 'Kerala', 'Bengaluru', 'Agra', 'Udaipur',
  'Kathmandu', 'Pokhara', 'Colombo', 'Kandy', 'Male', 'Kuala Lumpur', 'Penang',
  'Jakarta', 'Yogyakarta', 'Lombok', 'Ubud', 'Manila', 'Cebu', 'Boracay', 'Palawan',
  'Taipei', 'Hong Kong', 'Macau', 'Beijing', 'Shanghai', 'Chengdu', 'Xi\'an',
  'Osaka', 'Nagoya', 'Fukuoka', 'Sapporo', 'Hiroshima', 'Nara', 'Okinawa', 'Busan',
  'Jeju', 'Hoi An', 'Da Nang', 'Siem Reap', 'Luang Prabang', 'Chiang Mai', 'Krabi',
  'Ko Samui', 'Brisbane', 'Perth', 'Gold Coast', 'Cairns', 'Queenstown', 'Wellington',
  'Christchurch', 'Fiji', 'Tahiti', 'Boston', 'Seattle', 'Washington', 'San Diego',
  'Austin', 'New Orleans', 'Nashville', 'Denver', 'Salt Lake City', 'Portland',
  'Maui', 'Kauai', 'Oahu', 'Calgary', 'Ottawa', 'Quebec City', 'Mexico City',
  'Oaxaca', 'Playa del Carmen', 'Tulum', 'Cabo San Lucas', 'Puerto Vallarta',
  'San Jose', 'Panama City', 'Bogota', 'Medellin', 'Cartagena', 'Lima', 'Cusco',
  'Quito', 'Santiago', 'Montevideo', 'Sao Paulo', 'Nairobi', 'Zanzibar', 'Casablanca',
  'Luxor', 'Aswan'
];

/**
 * Extracts trip parameters from natural language user messages.
 * Preserves existing parameters unless explicitly overridden by the user.
 * Never replaces user values with defaults.
 */
export function extractParamsFromText(text: string, current: Partial<TripParameters> = {}): TripParameters {
  const updated: TripParameters = {
    destination: current.destination || '',
    startingCity: current.startingCity || '',
    travelDates: current.travelDates || '',
    days: current.days,
    travelers: current.travelers,
    budget: current.budget,
    currency: current.currency || 'USD',
    preferences: current.preferences ? [...current.preferences] : [],
  };

  if (!text || typeof text !== 'string') {
    return updated;
  }

  const raw = text.trim();
  const lower = raw.toLowerCase();

  // 1. CURRENCY DETECTION
  if (lower.includes('eur') || raw.includes('€') || lower.includes('euro')) {
    updated.currency = 'EUR';
  } else if (lower.includes('gbp') || raw.includes('£') || lower.includes('pound')) {
    updated.currency = 'GBP';
  } else if (lower.includes('inr') || raw.includes('₹') || lower.includes('rupee')) {
    updated.currency = 'INR';
  } else if (lower.includes('jpy') || raw.includes('¥') || lower.includes('yen')) {
    updated.currency = 'JPY';
  } else if (lower.includes('cad') || lower.includes('c$')) {
    updated.currency = 'CAD';
  } else if (lower.includes('aud') || lower.includes('a$')) {
    updated.currency = 'AUD';
  } else if (lower.includes('sgd') || lower.includes('s$')) {
    updated.currency = 'SGD';
  } else if (lower.includes('usd') || raw.includes('$') || lower.includes('dollar')) {
    updated.currency = 'USD';
  }

  // 2. NUMBER OF DAYS
  const daysMatch = raw.match(/(\d+)\s*(?:days?|nights?|d\b)/i) ||
                    raw.match(/(\d+)-day/i) ||
                    raw.match(/for\s+(\d+)\s+days?/i);
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

  // 3. NUMBER OF TRAVELERS
  const travelersMatch = raw.match(/(\d+)\s*(?:travelers?|travellers?|people|persons?|guests?|adults?|friends?|pax)/i) ||
                         raw.match(/(?:party|group|family)\s+of\s+(\d+)/i) ||
                         raw.match(/for\s+(\d+)\s+(?:of\s+us|travelers?|people)/i);
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

  // 4. BUDGET DETECTION
  // Look for currency symbol attached e.g. $2,500 or 2,500 USD or budget of 2500
  let detectedBudget: number | null = null;

  // Pattern A: Symbol before number: $2,500, € 1800, £2000, ₹50,000
  const symBefore = raw.match(/[\$€£₹¥]\s*(\d{1,3}(?:,\d{3})+|\d+)(?:\.\d+)?/);
  if (symBefore) {
    detectedBudget = parseInt(symBefore[1].replace(/,/g, ''), 10);
  }

  // Pattern B: Number before currency symbol or currency code: 2,500 USD, 2500$, 1800 EUR
  if (!detectedBudget) {
    const codeAfter = raw.match(/(\d{1,3}(?:,\d{3})+|\d+)\s*(?:[\$€£₹¥]|usd|eur|gbp|inr|jpy|cad|aud|sgd|dollars?|euros?|pounds?|rupees?|yen)\b/i);
    if (codeAfter) {
      detectedBudget = parseInt(codeAfter[1].replace(/,/g, ''), 10);
    }
  }

  // Pattern C: Currency code before number: USD 2500, EUR 1,800
  if (!detectedBudget) {
    const codeBefore = raw.match(/\b(?:usd|eur|gbp|inr|jpy|cad|aud|sgd)\s*(\d{1,3}(?:,\d{3})+|\d+)/i);
    if (codeBefore) {
      detectedBudget = parseInt(codeBefore[1].replace(/,/g, ''), 10);
    }
  }

  // Pattern D: "budget" prefix: budget: 2500, budget of 2,500, budget is $2500
  if (!detectedBudget) {
    const budgetKeyword = raw.match(/\b(?:budget|spending|total\s+budget)\s*(?:of|is|:)?\s*[\$€£₹¥]?\s*(\d{1,3}(?:,\d{3})+|\d+)/i);
    if (budgetKeyword) {
      detectedBudget = parseInt(budgetKeyword[1].replace(/,/g, ''), 10);
    }
  }

  // Pattern E: If still no budget detected, look for comma-separated tokens or standalone numbers >= 50
  // that don't match days or travelers
  if (!detectedBudget) {
    const segments = raw.split(/[,;\n]/);
    for (const seg of segments) {
      const trimmed = seg.trim();
      if (!/days?|nights?|travelers?|people|adults?|persons?/i.test(trimmed)) {
        const numMatch = trimmed.match(/(\d{1,3}(?:,\d{3})+|\d{3,})/);
        if (numMatch) {
          const num = parseInt(numMatch[1].replace(/,/g, ''), 10);
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

  // 5. STARTING CITY
  const startMatch = raw.match(/(?:from|starting\s+from|flying\s+from|departing\s+from|leaving\s+from)\s+([A-Za-z\s,]+?)(?=\s+(?:to|for|with|on|around|dates|budget|\$|€|£|₹|\d)|$|[,\.!?])/i);
  if (startMatch && startMatch[1]) {
    const sc = startMatch[1].trim();
    if (!['the', 'a', 'an', 'here', 'home'].includes(sc.toLowerCase())) {
      updated.startingCity = sc;
    }
  }

  // 6. DESTINATION
  // Check A: Look for known popular destinations anywhere in the text (word-bounded) first for highest accuracy
  let extractedDest: string | null = null;
  for (const city of POPULAR_DESTINATIONS) {
    const cityRegex = new RegExp(`\\b${city}\\b`, 'i');
    if (cityRegex.test(raw)) {
      // Ensure it wasn't captured as starting city
      if (!updated.startingCity || !updated.startingCity.toLowerCase().includes(city.toLowerCase())) {
        extractedDest = city;
        break;
      }
    }
  }

  // Check B: Explicit prepositions: "trip to Paris", "to Paris", "in Paris", "visit Paris", "destination is Paris", "destination: Paris"
  if (!extractedDest) {
    const destMatch = raw.match(/(?:destination\s*(?:is|:)?|want\s+to\s+visit|plan\s+a\s+trip\s+to|trip\s+to|going\s+to|head\s+to|travel\s+to|visit|visiting|explore|exploring|vacation\s+in|holiday\s+in|in|to)\s+([A-Za-z\s,]+?)(?=\s+(?:with|for|from|starting|under|on|around|dates|budget|starting\s+from|\$|€|£|₹|\d)|$|[,\.!?])/i);
    if (destMatch && destMatch[1]) {
      let candidate = destMatch[1].trim();
      candidate = candidate.replace(/^(?:visit|visiting|explore|exploring|travel\s+to|go\s+to|head\s+to)\s+/i, '').trim();
      const candidateLower = candidate.toLowerCase();
      if (!['the', 'a', 'an', 'my', 'budget', 'some', 'any', 'hotel', 'places'].includes(candidateLower) && candidate.length > 1) {
        extractedDest = candidate;
      }
    }
  }

  // Check C: If comma-separated tokens exist (e.g. "$2,500 USD, 5 days, 2 travelers, Paris")
  // Check tokens that have no digits, are not keywords, and are clean strings
  if (!extractedDest) {
    const segments = raw.split(/[,;\n]/);
    for (const seg of segments) {
      const trimmed = seg.trim();
      if (
        trimmed.length >= 2 &&
        trimmed.length <= 40 &&
        !/\d/.test(trimmed) &&
        !/\b(?:days?|nights?|travelers?|people|budget|usd|eur|gbp|inr|jpy|cad|aud|dollars?|euros?|solo|couple|family|sightseeing|food|adventure|relaxation|shopping)\b/i.test(trimmed)
      ) {
        // Clean out any leading "in " or "visit "
        const cleaned = trimmed.replace(/^(?:in|visit|explore|to)\s+/i, '').trim();
        if (cleaned.length >= 2) {
          extractedDest = cleaned;
          break;
        }
      }
    }
  }

  if (extractedDest) {
    updated.destination = extractedDest;
  }

  // 7. TRAVEL DATES
  const dateMatch = raw.match(/(?:dates?:|dates|during|around|in)\s+([A-Za-z]+(?:\s+\d{1,2})?(?:\s*-\s*(?:[A-Za-z]+\s+)?\d{1,2})?(?:,?\s*\d{4})?)/i);
  if (dateMatch && !['the', 'a', 'days', 'hotel', 'food', 'budget', 'usd', 'eur'].includes(dateMatch[1].trim().toLowerCase())) {
    updated.travelDates = dateMatch[1].trim();
  } else if (lower.includes('next month')) {
    updated.travelDates = 'Next Month';
  } else if (lower.includes('this summer') || lower.includes('summer')) {
    updated.travelDates = 'Summer Season';
  } else if (lower.includes('winter')) {
    updated.travelDates = 'Winter Season';
  } else if (lower.includes('spring')) {
    updated.travelDates = 'Spring Season';
  } else if (lower.includes('autumn') || lower.includes('fall')) {
    updated.travelDates = 'Autumn Season';
  }

  // 8. PREFERENCES
  const foundPrefs = new Set<string>(updated.preferences || []);
  if (lower.includes('sightsee') || lower.includes('monument') || lower.includes('landmark') || lower.includes('attractions')) {
    foundPrefs.add('Sightseeing');
  }
  if (lower.includes('food') || lower.includes('dining') || lower.includes('culinary') || lower.includes('eat') || lower.includes('restaurant')) {
    foundPrefs.add('Food & Dining');
  }
  if (lower.includes('adventure') || lower.includes('hiking') || lower.includes('hike') || lower.includes('trek') || lower.includes('outdoor')) {
    foundPrefs.add('Adventure');
  }
  if (lower.includes('shop') || lower.includes('shopping') || lower.includes('boutique') || lower.includes('market')) {
    foundPrefs.add('Shopping');
  }
  if (lower.includes('relax') || lower.includes('relaxation') || lower.includes('spa') || lower.includes('beach') || lower.includes('chill')) {
    foundPrefs.add('Relaxation');
  }
  if (lower.includes('art') || lower.includes('museum') || lower.includes('culture') || lower.includes('history') || lower.includes('heritage')) {
    foundPrefs.add('Art & Culture');
  }
  if (lower.includes('nightlife') || lower.includes('club') || lower.includes('bar') || lower.includes('party')) {
    foundPrefs.add('Nightlife');
  }

  if (foundPrefs.size > 0) {
    updated.preferences = Array.from(foundPrefs);
  }

  return updated;
}

/**
 * Computes missing requirements for planning
 */
export function computeMissingRequirements(p: TripParameters): Array<'destination' | 'days' | 'travelDates' | 'travelers' | 'budget' | 'preferences'> {
  const missing: Array<'destination' | 'days' | 'travelDates' | 'travelers' | 'budget' | 'preferences'> = [];
  if (!p.destination) missing.push('destination');
  if (!p.days) missing.push('days');
  if (!p.travelDates) missing.push('travelDates');
  if (!p.travelers) missing.push('travelers');
  if (!p.budget) missing.push('budget');
  if (!p.preferences || p.preferences.length === 0) missing.push('preferences');
  return missing;
}

/**
 * Generates quick prompt suggestions based on missing requirements
 */
export function generateQuickSuggestions(missing: string[], current: TripParameters): string[] {
  const suggestions: string[] = [];
  if (missing.includes('destination')) {
    return ['Trip to Tokyo, Japan', 'Trip to Paris, France', 'Explore Rome, Italy', 'Trip to Bali, Indonesia'];
  }
  if (missing.includes('days')) {
    suggestions.push('3 Days', '5 Days', '7 Days');
  }
  if (missing.includes('budget')) {
    const cur = current.currency || 'USD';
    const sym = cur === 'EUR' ? '€' : cur === 'GBP' ? '£' : cur === 'INR' ? '₹' : cur === 'JPY' ? '¥' : '$';
    suggestions.push(`${sym}1,500 ${cur}`, `${sym}2,500 ${cur}`, `${sym}4,000 ${cur}`);
  }
  if (missing.includes('travelers')) {
    suggestions.push('1 Solo Traveler', '2 Travelers', '4 Family Members');
  }
  if (missing.includes('preferences')) {
    suggestions.push('🏛️ Sightseeing & Food', '🧗 Adventure & Outdoors', '🌴 Relaxation & Spa', '🛍️ Shopping & Culture');
  }
  if (missing.includes('travelDates')) {
    suggestions.push('Next Month', 'Flexible Upcoming Dates', 'Summer 2026');
  }
  return suggestions.slice(0, 4);
}
