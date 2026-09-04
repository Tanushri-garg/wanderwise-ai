export interface TripParameters {
  destination?: string;
  startingCity?: string;
  travelDates?: string;
  days?: number;
  travelers?: number;
  budget?: number;
  currency?: string;
  preferences?: string[];
}

export interface BudgetBreakdown {
  transportation: number;
  hotel: number;
  food: number;
  localTransport: number;
  activities: number;
  emergency: number;
  totalEstimated: number;
  userBudget: number;
  currency: string;
  fitsBudget: boolean;
  variance: number; // positive = under budget, negative = over budget
  varianceExplanation?: string;
}

export interface HotelRecommendation {
  id: string;
  name: string;
  pricePerNight: number;
  totalCost: number;
  category: 'Budget' | 'Mid-range' | 'Luxury' | string;
  location: string;
  isLivePrice: boolean; // Must clearly label if live or estimated
  rating?: string;
  highlights?: string;
}

export interface WeatherInfo {
  destination: string;
  temperature: string;
  rainProbability: string;
  condition: string;
  packingAdvice: string;
  isLiveData: boolean;
  source: string;
}

export interface DayItinerary {
  day: number;
  title: string;
  morning: {
    activity: string;
    cost: number;
  };
  afternoon: {
    activity: string;
    cost: number;
  };
  evening: {
    activity: string;
    cost: number;
  };
  dayTotalCost: number;
}

export interface BudgetAdjustment {
  needed: boolean;
  originalCost?: number;
  targetBudget?: number;
  explanation: string;
  cheaperHotelsSuggestion?: string;
  cheaperTransportSuggestion?: string;
  removedOrReplacedActivities?: string;
  revisedSavings?: string;
}

export interface TripConclusion {
  fitsBudget: boolean;
  isAffordable: boolean;
  affordableVerdict: string;
  statusSummary: 'Within Budget' | 'Over Budget' | 'Adjusted to Fit' | string;
  estimatedTotalCost: number;
  remainingBudget: number; // positive = remaining cushion, negative/abs = exceeded amount
  remainingOrOverBudget: number;
  isOverBudget: boolean;
  bestHotel: string;
  bestActivity: string;
  datesSuitable: boolean;
  datesSuitabilityNote: string;
  shortTravelTip: string;
  finalRecommendation: string;
}

export interface CompleteTripPlan {
  destination: string;
  startingCity: string;
  travelDates: string;
  days: number;
  travelers: number;
  userBudget: number;
  currency: string;
  preferences: string[];
  budgetBreakdown: BudgetBreakdown;
  hotels: HotelRecommendation[];
  weather: WeatherInfo;
  itinerary: DayItinerary[];
  budgetAdjustment?: BudgetAdjustment;
  conclusion: TripConclusion;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
  extractedParams?: TripParameters;
  tripPlan?: CompleteTripPlan;
  missingParams?: Array<'destination' | 'days' | 'travelDates' | 'travelers' | 'budget' | 'preferences'>;
  suggestedPrompts?: string[];
}
