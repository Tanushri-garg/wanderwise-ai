import { CompleteTripPlan, TripParameters } from './src/types';

export function generateSmartTripPlan(
  params: TripParameters,
  liveWeather: {
    destination: string;
    temperature: string;
    rainProbability: string;
    condition: string;
    packingAdvice: string;
    isLiveData: boolean;
    source: string;
  }
): CompleteTripPlan {
  const destination = params.destination || 'Paris, France';
  const startingCity = params.startingCity || 'London, UK';
  const days = Math.max(1, params.days || 3);
  const travelers = Math.max(1, params.travelers || 2);
  const currency = params.currency || 'USD';
  const userBudget = params.budget || (currency === 'INR' ? 50000 : currency === 'EUR' ? 1000 : 1200);
  const preferences = params.preferences && params.preferences.length > 0 ? params.preferences : ['Sightseeing', 'Food & Dining', 'Culture'];
  const travelDates = params.travelDates || 'Upcoming Season (Flexible)';

  // Realistic percentage allocations:
  // Transportation: ~25%
  // Hotel: ~35%
  // Food: ~20%
  // Local transport: ~5%
  // Activities: ~10%
  // Emergency buffer: ~5%
  let transportEst = Math.round(userBudget * 0.25);
  let hotelEst = Math.round(userBudget * 0.35);
  let foodEst = Math.round(userBudget * 0.20);
  let localTransportEst = Math.round(userBudget * 0.05);
  let activitiesEst = Math.round(userBudget * 0.10);
  let emergencyEst = Math.round(userBudget * 0.05);

  let totalEstimated = transportEst + hotelEst + foodEst + localTransportEst + activitiesEst + emergencyEst;
  // calibrate rounding
  if (totalEstimated !== userBudget) {
    emergencyEst += (userBudget - totalEstimated);
    totalEstimated = transportEst + hotelEst + foodEst + localTransportEst + activitiesEst + emergencyEst;
  }

  const fitsBudget = totalEstimated <= userBudget;
  const variance = userBudget - totalEstimated;

  // Hotel suggestions based on budget
  const perNightBudget = Math.round(hotelEst / days);
  const hotels = [
    {
      id: 'h1',
      name: `${destination.split(',')[0]} Central Boutique Stay`,
      pricePerNight: Math.round(perNightBudget * 0.85),
      totalCost: Math.round(perNightBudget * 0.85 * days),
      category: perNightBudget < 80 ? 'Budget' : perNightBudget < 200 ? 'Mid-range' : 'Luxury',
      location: 'Central District / Transit Hub',
      isLivePrice: false,
      rating: '4.6/5',
      highlights: 'Walkable to transit, free high-speed Wi-Fi, praised breakfast buffet, quiet rooms',
    },
    {
      id: 'h2',
      name: `Grand Heritage Suites ${destination.split(',')[0]}`,
      pricePerNight: Math.round(perNightBudget * 1.15),
      totalCost: Math.round(perNightBudget * 1.15 * days),
      category: perNightBudget < 120 ? 'Mid-range' : 'Luxury',
      location: 'Old Town & Cultural Quarter',
      isLivePrice: false,
      rating: '4.8/5',
      highlights: 'Panoramic city views, concierge excursion desk, complimentary evening tea',
    },
    {
      id: 'h3',
      name: `Urban Traveler Hostel & Micro-Hotel`,
      pricePerNight: Math.round(perNightBudget * 0.55),
      totalCost: Math.round(perNightBudget * 0.55 * days),
      category: 'Budget',
      location: 'Arts & Market District',
      isLivePrice: false,
      rating: '4.4/5',
      highlights: 'Social traveler lounge, private pods available, self-service laundry & kitchen',
    },
  ];

  // Daily Itinerary
  const itinerary = [];
  const dailyActivityCost = Math.round(activitiesEst / days);

  const themePool = [
    {
      title: 'City Heritage & Famous Landmarks',
      m: 'Walking orientation tour of historic center, historic square, and architecture highlights',
      a: 'Visit primary landmark museum or botanical grounds with scenic viewpoint',
      e: 'Sunset promenade along the central river/boulevard followed by local specialty dinner',
    },
    {
      title: 'Local Culture, Flavors & Hidden Gems',
      m: 'Morning local artisan market visit with specialty coffee and pastry tasting',
      a: 'Explore bohemian neighborhood, vintage boutiques, and cultural exhibition gallery',
      e: 'Traditional dining quarter with live street acoustic performance and dessert stop',
    },
    {
      title: 'Nature Escape, Panoramic Vistas & Sunset',
      m: 'Funicular/cable-car or scenic hill overlook with sweeping views of the entire valley',
      a: 'Leisurely stroll through public royal gardens or coastal boardwalk with picnic',
      e: 'Rooftop terrace beverage and twilight photography of the illuminated cityscape',
    },
    {
      title: 'Art, History & Interactive Discovery',
      m: 'Guided visit to world-renowned art museum or interactive science center',
      a: 'Afternoon tea in historic café and exploration of antique bookshops and arcades',
      e: 'Evening foodie street walk sampling regional snacks and street delicacies',
    },
    {
      title: 'Shopping, Relaxation & Farewell Highlights',
      m: 'Souvenir and craft shopping in traditional bazaar or pedestrian shopping promenade',
      a: 'Thermal spa or relaxing park visit with photography stops at iconic bridges',
      e: 'Celebratory farewell dinner featuring seasonal chef tasting menu and dessert',
    },
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
        cost: mCost,
      },
      afternoon: {
        activity: theme.a,
        cost: aCost,
      },
      evening: {
        activity: theme.e,
        cost: eCost,
      },
      dayTotalCost: mCost + aCost + eCost,
    });
  }

  const isOverBudget = totalEstimated > userBudget;
  const budgetDiff = userBudget - totalEstimated; // positive = under budget, negative = over budget
  const amountExceeded = isOverBudget ? Math.abs(budgetDiff) : 0;
  const remainingBudget = !isOverBudget ? budgetDiff : 0;

  // Budget adjustment suggestions if needed or proactively
  const budgetAdjustment = {
    needed: isOverBudget,
    originalCost: totalEstimated,
    targetBudget: userBudget,
    explanation: isOverBudget
      ? `The initial estimated cost exceeds your target budget by ${currency} ${amountExceeded.toLocaleString()}. We recommend swapping to budget micro-stays, using local transit day passes, and focusing on free iconic landmarks.`
      : 'Your planned travel expenses fall comfortably within your target budget framework with a safe buffer.',
    cheaperHotelsSuggestion: `Opt for "${hotels[2]?.name || 'Urban Traveler Hostel & Micro-Hotel'}" to save approx. ${currency} ${Math.round((hotels[0]?.pricePerNight - hotels[2]?.pricePerNight) * days)} over your stay.`,
    cheaperTransportSuggestion: 'Purchase a multi-day city transit pass (metro/bus) instead of hailing point-to-point taxis or rideshares.',
    removedOrReplacedActivities: 'Replace paid viewing decks with free public hilltop parks, riverfront strolls, and historic architectural squares.',
    revisedSavings: isOverBudget
      ? `Switching to the budget hotel and transit pass saves approx. ${currency} ${Math.round(amountExceeded * 1.15)}, bringing your trip back within budget!`
      : `Estimated surplus reserve: ${currency} ${remainingBudget.toLocaleString()} available for shopping or spontaneous dining.`,
  };

  // Conclusion adhering to exact requirements
  const isAffordable = !isOverBudget || amountExceeded <= userBudget * 0.1;
  const affordableVerdict = !isOverBudget
    ? `Yes, highly affordable! Fits comfortably within your ${currency} ${userBudget.toLocaleString()} budget with ${currency} ${remainingBudget.toLocaleString()} remaining cushion.`
    : `Exceeds current budget by ${currency} ${amountExceeded.toLocaleString()}. Affordable with suggested budget hotel & public transit adjustments.`;

  const conclusion = {
    fitsBudget: !isOverBudget,
    isAffordable,
    affordableVerdict,
    statusSummary: isOverBudget ? 'Over Budget' : 'Within Budget',
    estimatedTotalCost: totalEstimated,
    remainingBudget: !isOverBudget ? remainingBudget : -amountExceeded,
    remainingOrOverBudget: isOverBudget ? amountExceeded : remainingBudget,
    isOverBudget,
    bestHotel: hotels[0]?.name || 'Central Boutique Stay',
    bestActivity: `${destination.split(',')[0]} Sunset Promenade & Heritage Highlights`,
    datesSuitable: true,
    datesSuitabilityNote: `${liveWeather.condition} with temperatures around ${liveWeather.temperature.split(' ')[0]}. Favorable conditions for outdoor sightseeing and dining.`,
    shortTravelTip: `Buy attraction tickets and rail passes 2–3 weeks online in advance to bypass long ticket lines and secure early-bird discounts.`,
    finalRecommendation: `Book major rail and attraction tickets 2–3 weeks early to lock in lower advance-purchase fares and avoid peak queues.`,
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
      varianceExplanation: isOverBudget
        ? `Estimated expenses exceed budget by ${currency} ${amountExceeded.toLocaleString()}. Consider our budget adjustments.`
        : `Carefully apportioned across transport, hotel, dining, and activities with a dedicated 5% emergency buffer.`,
    },
    hotels,
    weather: liveWeather,
    itinerary,
    budgetAdjustment,
    conclusion,
  };
}
