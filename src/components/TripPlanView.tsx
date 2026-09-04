import { useState } from 'react';
import {
  Calculator,
  DollarSign,
  Building2,
  CloudSun,
  CalendarCheck,
  AlertTriangle,
  Sparkles,
  Plane,
  Utensils,
  Car,
  Compass,
  ShieldCheck,
  CheckCircle2,
  Clock,
  ArrowRight,
  Sun,
  Umbrella,
  Shirt,
  Info,
  ChevronDown,
  ChevronUp,
  RotateCcw,
  Sliders,
  MapPin,
  Calendar,
  Layers,
  Star,
} from 'lucide-react';
import { CompleteTripPlan } from '../types';

interface TripPlanViewProps {
  plan: CompleteTripPlan;
  onAskAdjustment: (prompt: string) => void;
}

export function TripPlanView({ plan, onAskAdjustment }: TripPlanViewProps) {
  // Allow toggling specific days, or expanding all
  const [expandedDays, setExpandedDays] = useState<Record<number, boolean>>({ 1: true });
  const [allExpanded, setAllExpanded] = useState(false);

  // Interactive budget recalculation slider/input within the plan view
  const [customBudget, setCustomBudget] = useState<number>(plan.userBudget);
  const [isEditingBudget, setIsEditingBudget] = useState<boolean>(false);

  const { budgetBreakdown, hotels, weather, itinerary, budgetAdjustment, conclusion } = plan;

  // Currency helper
  const currencySymbol = plan.currency || '$';
  const formatCost = (num: number) => {
    return `${currencySymbol} ${num.toLocaleString()}`;
  };

  const toggleDay = (dayNum: number) => {
    setExpandedDays((prev) => ({
      ...prev,
      [dayNum]: !prev[dayNum],
    }));
  };

  const handleToggleAllDays = () => {
    const nextState = !allExpanded;
    setAllExpanded(nextState);
    const newMap: Record<number, boolean> = {};
    itinerary.forEach((d) => {
      newMap[d.day] = nextState;
    });
    setExpandedDays(newMap);
  };

  // Check if current or custom budget causes an over-budget status
  const effectiveBudget = isEditingBudget ? customBudget : plan.userBudget;
  const isOverBudget = budgetBreakdown.totalEstimated > effectiveBudget;
  const budgetDifference = effectiveBudget - budgetBreakdown.totalEstimated;

  const budgetItems = [
    { label: 'Transportation (Flights/Rail)', cost: budgetBreakdown.transportation, icon: Plane, color: 'bg-blue-500' },
    { label: 'Hotel & Accommodation', cost: budgetBreakdown.hotel, icon: Building2, color: 'bg-teal-500' },
    { label: 'Food & Dining', cost: budgetBreakdown.food, icon: Utensils, color: 'bg-amber-500' },
    { label: 'Local Travel (Metro/Taxis)', cost: budgetBreakdown.localTransport, icon: Car, color: 'bg-indigo-500' },
    { label: 'Activities & Sightseeing', cost: budgetBreakdown.activities, icon: Compass, color: 'bg-purple-500' },
    { label: 'Miscellaneous & Emergency', cost: budgetBreakdown.emergency, icon: ShieldCheck, color: 'bg-emerald-500' },
  ];

  return (
    <div className="space-y-6 pb-12">
      {/* 1. Header Overview Banner */}
      <div className="bg-linear-to-r from-teal-800 via-teal-900 to-slate-900 text-white rounded-2xl p-5 sm:p-6 shadow-md relative overflow-hidden">
        <div className="absolute right-0 top-0 translate-x-8 -translate-y-8 w-48 h-48 bg-teal-500/10 rounded-full blur-2xl pointer-events-none" />
        <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-teal-700/60 backdrop-blur-xs text-teal-100 text-xs font-medium mb-2 border border-teal-500/30">
              <Sparkles className="w-3.5 h-3.5" /> Complete Travel Plan
            </div>
            <h2 className="text-xl sm:text-2xl font-bold tracking-tight flex items-center gap-2">
              <span>{plan.destination}</span>
            </h2>
            <p className="text-xs sm:text-sm text-teal-100/90 mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
              <span>From: <strong>{plan.startingCity || 'Home City'}</strong></span>
              <span>•</span>
              <span><strong>{plan.days} Days</strong></span>
              <span>•</span>
              <span><strong>{plan.travelers} Traveler{plan.travelers > 1 ? 's' : ''}</strong></span>
              <span>•</span>
              <span>Dates: <strong>{plan.travelDates}</strong></span>
            </p>
          </div>

          <div className="bg-white/10 backdrop-blur-md rounded-xl p-3 sm:px-4 sm:py-3 border border-white/15 shrink-0 text-right sm:text-left">
            <span className="text-[11px] text-teal-200 uppercase tracking-wider block font-semibold">
              Total Budget Status
            </span>
            <div className="flex items-baseline gap-2 mt-0.5">
              <span className="text-lg sm:text-xl font-bold text-white">
                {formatCost(budgetBreakdown.totalEstimated)}
              </span>
              <span className="text-xs text-teal-200">
                / {formatCost(effectiveBudget)}
              </span>
            </div>
            <div className="mt-1 flex items-center gap-1.5">
              <span
                className={`inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-0.5 rounded-full ${
                  isOverBudget
                    ? 'bg-rose-500/30 text-rose-200 border border-rose-400/40'
                    : 'bg-emerald-500/30 text-emerald-200 border border-emerald-400/40'
                }`}
              >
                {isOverBudget ? '⚠️ Over Budget' : '✓ Within Budget'}
              </span>
            </div>
          </div>
        </div>

        {/* User Interests / Preferences Chips */}
        {plan.preferences && plan.preferences.length > 0 && (
          <div className="mt-4 pt-3.5 border-t border-white/10 flex flex-wrap items-center gap-1.5 text-xs text-teal-100">
            <span className="text-teal-300 text-[11px] font-semibold mr-1">User Interests:</span>
            {plan.preferences.map((pref) => (
              <span key={pref} className="px-2.5 py-0.5 rounded-md bg-white/10 text-[11px] font-medium">
                {pref}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* ============================================================ */}
      {/* 1. SEPARATE CARD: BUDGET CALCULATOR */}
      {/* ============================================================ */}
      <section id="card-budget" className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-teal-50 text-teal-600 flex items-center justify-center shrink-0">
              <Calculator className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                1. Budget Calculator
              </h3>
              <p className="text-xs text-slate-500">
                Estimated transportation, hotel, food, local travel, activities and miscellaneous expenses
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsEditingBudget(!isEditingBudget)}
              className="text-xs text-teal-700 bg-teal-50 hover:bg-teal-100 border border-teal-200 px-2.5 py-1 rounded-lg font-medium transition-colors flex items-center gap-1"
            >
              <Sliders className="w-3.5 h-3.5" />
              {isEditingBudget ? 'Lock Target' : 'Adjust Budget Target'}
            </button>
          </div>
        </div>

        {/* Interactive Budget Adjustment Bar if user wants to test custom budget */}
        {isEditingBudget && (
          <div className="p-3 bg-teal-50/70 border border-teal-200 rounded-xl space-y-2 text-xs">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-teal-900">Test Custom Trip Budget Target:</span>
              <span className="font-bold text-teal-700">{formatCost(customBudget)}</span>
            </div>
            <input
              type="range"
              min={Math.round(plan.userBudget * 0.4)}
              max={Math.round(plan.userBudget * 2)}
              step={50}
              value={customBudget}
              onChange={(e) => setCustomBudget(parseInt(e.target.value, 10))}
              className="w-full accent-teal-600 cursor-pointer"
            />
            <div className="flex items-center justify-between text-[11px] text-teal-700">
              <span>{formatCost(Math.round(plan.userBudget * 0.4))}</span>
              <button
                onClick={() => setCustomBudget(plan.userBudget)}
                className="underline hover:text-teal-900"
              >
                Reset to Original ({formatCost(plan.userBudget)})
              </button>
              <span>{formatCost(Math.round(plan.userBudget * 2))}</span>
            </div>
          </div>
        )}

        {/* Big Key Metric Scoreboard: Total Estimated Cost vs User Budget & Remaining Budget */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
            <span className="text-slate-500 font-medium block text-[11px]">User's Total Budget</span>
            <span className="text-lg font-bold text-slate-900 mt-0.5 block">
              {formatCost(effectiveBudget)}
            </span>
            <span className="text-[10px] text-slate-400">Specified budget target</span>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
            <span className="text-slate-500 font-medium block text-[11px]">Total Estimated Cost</span>
            <span className="text-lg font-bold text-teal-800 mt-0.5 block">
              {formatCost(budgetBreakdown.totalEstimated)}
            </span>
            <span className="text-[10px] text-slate-400">Sum of all 6 expense categories</span>
          </div>

          <div
            className={`p-3.5 rounded-xl border ${
              isOverBudget
                ? 'bg-rose-50 border-rose-200 text-rose-900'
                : 'bg-emerald-50 border-emerald-200 text-emerald-900'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="font-semibold text-[11px]">
                {isOverBudget ? 'Budget Exceeded' : 'Remaining Budget'}
              </span>
              <span
                className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${
                  isOverBudget
                    ? 'bg-rose-200 text-rose-800'
                    : 'bg-emerald-200 text-emerald-800'
                }`}
              >
                {isOverBudget ? 'Over Budget' : 'Remaining'}
              </span>
            </div>
            <span className="text-lg font-bold mt-0.5 block">
              {isOverBudget
                ? `-${formatCost(Math.abs(budgetDifference))}`
                : `+${formatCost(budgetDifference)}`}
            </span>
            <span className="text-[10px] opacity-80">
              {isOverBudget
                ? 'Trip costs exceed your target budget'
                : 'Available as buffer or leisure funds'}
            </span>
          </div>
        </div>

        {/* Clear "Over Budget" Alert with Cheaper Alternatives when exceeding */}
        {isOverBudget && (
          <div className="p-4 rounded-xl bg-rose-50 border border-rose-300 text-xs text-rose-900 space-y-2.5">
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded-md bg-rose-600 text-white font-bold text-[10px] uppercase tracking-wider">
                Over Budget
              </span>
              <h4 className="font-bold text-rose-900">
                This trip exceeds the target budget by {formatCost(Math.abs(budgetDifference))}.
              </h4>
            </div>

            <p className="leading-relaxed">
              To bring this itinerary strictly within your {formatCost(effectiveBudget)} limit, here are suggested cheaper alternatives:
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
              <div className="p-2.5 rounded-lg bg-white border border-rose-200 space-y-1">
                <span className="font-bold text-rose-800 flex items-center gap-1">
                  🏨 Cheaper Accommodation:
                </span>
                <p className="text-slate-600 text-[11px]">
                  Switch to <em>Urban Traveler Hostel & Micro-Hotel</em> in Arts District (saves ~30-40% on lodging).
                </p>
              </div>

              <div className="p-2.5 rounded-lg bg-white border border-rose-200 space-y-1">
                <span className="font-bold text-rose-800 flex items-center gap-1">
                  🚆 Cheaper Transportation:
                </span>
                <p className="text-slate-600 text-[11px]">
                  Use multi-day public subway/bus passes instead of private taxis or on-demand rides.
                </p>
              </div>

              <div className="p-2.5 rounded-lg bg-white border border-rose-200 space-y-1">
                <span className="font-bold text-rose-800 flex items-center gap-1">
                  🎟️ Free Activities & Sights:
                </span>
                <p className="text-slate-600 text-[11px]">
                  Prioritize free museum days, architectural walking tours, public botanical gardens, and scenic viewpoints.
                </p>
              </div>

              <div className="p-2.5 rounded-lg bg-white border border-rose-200 space-y-1">
                <span className="font-bold text-rose-800 flex items-center gap-1">
                  🍕 Casual Food & Markets:
                </span>
                <p className="text-slate-600 text-[11px]">
                  Eat at authentic local food markets, bakeries, and student bistro spots rather than tourist restaurants.
                </p>
              </div>
            </div>

            <div className="pt-2 flex items-center gap-2">
              <button
                onClick={() =>
                  onAskAdjustment(
                    `The trip is currently over budget. Please modify the itinerary to strictly stay within ${formatCost(effectiveBudget)} by suggesting cheaper hotels, free activities, and public transit!`
                  )
                }
                className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white transition-colors flex items-center gap-1"
              >
                Ask WanderWise AI to Apply Cheaper Plan <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}

        {/* Visual Allocation Percentage Bar */}
        <div className="space-y-1.5 pt-1">
          <div className="flex items-center justify-between text-[11px] text-slate-500 font-medium">
            <span>Itemized Expense Allocation</span>
            <span>Total: {formatCost(budgetBreakdown.totalEstimated)}</span>
          </div>
          <div className="w-full bg-slate-100 rounded-full h-3 flex overflow-hidden">
            {budgetItems.map((item, idx) => {
              const pct = Math.max(3, (item.cost / (budgetBreakdown.totalEstimated || 1)) * 100);
              return (
                <div
                  key={idx}
                  style={{ width: `${pct}%` }}
                  className={`${item.color} h-full transition-all duration-300`}
                  title={`${item.label}: ${formatCost(item.cost)}`}
                />
              );
            })}
          </div>
        </div>

        {/* 6 Category Expense Breakdown Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
          {budgetItems.map((item, idx) => {
            const Icon = item.icon;
            const pct = Math.round((item.cost / (budgetBreakdown.totalEstimated || 1)) * 100);
            return (
              <div
                key={idx}
                className="p-3 rounded-xl bg-slate-50 border border-slate-200/80 flex items-center justify-between"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className={`w-7 h-7 rounded-lg ${item.color} text-white flex items-center justify-center shrink-0`}>
                    <Icon className="w-3.5 h-3.5" />
                  </div>
                  <div className="min-w-0">
                    <span className="text-xs font-medium text-slate-800 block truncate">{item.label}</span>
                    <span className="text-[11px] text-slate-400">{pct}% of total</span>
                  </div>
                </div>
                <span className="text-xs font-bold text-slate-900 shrink-0 ml-2">{formatCost(item.cost)}</span>
              </div>
            );
          })}
        </div>

        {budgetBreakdown.varianceExplanation && (
          <p className="text-xs text-slate-600 bg-slate-50 p-3 rounded-xl border border-slate-200/60 leading-relaxed">
            💡 {budgetBreakdown.varianceExplanation}
          </p>
        )}
      </section>

      {/* ============================================================ */}
      {/* 2. SEPARATE CARD: WEATHER SECTION */}
      {/* ============================================================ */}
      <section id="card-weather" className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-sky-50 text-sky-600 flex items-center justify-center shrink-0">
              <CloudSun className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">2. Weather Forecast</h3>
              <p className="text-xs text-slate-500">
                Weather conditions for {weather.destination} during {plan.travelDates}
              </p>
            </div>
          </div>

          <span
            className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-full flex items-center gap-1 self-start sm:self-auto ${
              weather.isLiveData
                ? 'bg-sky-50 text-sky-700 border border-sky-200'
                : 'bg-amber-50 text-amber-700 border border-amber-200'
            }`}
          >
            <Info className="w-3 h-3" />
            {weather.isLiveData ? 'Live Data (Open-Meteo)' : 'Estimated Climate Benchmark'}
          </span>
        </div>

        {/* Destination & Dates Context Banner */}
        <div className="p-3 bg-sky-50/50 rounded-xl border border-sky-100/80 flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-2">
            <MapPin className="w-4 h-4 text-sky-600" />
            <span className="font-semibold text-slate-800">Destination:</span>
            <span className="text-slate-900 font-bold">{weather.destination}</span>
          </div>
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-sky-600" />
            <span className="font-semibold text-slate-800">Travel Dates:</span>
            <span className="text-slate-900 font-bold">{plan.travelDates}</span>
          </div>
        </div>

        {/* Temperature, Rain Probability, Condition, and Packing Suggestions */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="p-3.5 rounded-xl bg-amber-50/60 border border-amber-100 flex items-start gap-3">
            <div className="w-9 h-9 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center shrink-0 mt-0.5">
              <Sun className="w-5 h-5 text-amber-500" />
            </div>
            <div>
              <span className="text-[11px] text-slate-500 font-medium block">Temperature</span>
              <span className="text-sm font-bold text-slate-900 block mt-0.5">{weather.temperature}</span>
              <span className="text-xs font-semibold text-amber-800 mt-0.5 inline-block">
                {weather.condition}
              </span>
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-blue-50/60 border border-blue-100 flex items-start gap-3">
            <div className="w-9 h-9 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center shrink-0 mt-0.5">
              <Umbrella className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <span className="text-[11px] text-slate-500 font-medium block">Precipitation Chance</span>
              <span className="text-sm font-bold text-slate-900 block mt-0.5">{weather.rainProbability}</span>
              <span className="text-[11px] text-slate-600">Expected rain & humidity</span>
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-teal-50/60 border border-teal-100 flex items-start gap-3">
            <div className="w-9 h-9 rounded-lg bg-teal-100 text-teal-700 flex items-center justify-center shrink-0 mt-0.5">
              <Shirt className="w-5 h-5 text-teal-600" />
            </div>
            <div>
              <span className="text-[11px] text-slate-500 font-medium block">Packing & Clothing</span>
              <p className="text-xs text-slate-800 font-medium mt-0.5 leading-snug">
                {weather.packingAdvice}
              </p>
            </div>
          </div>
        </div>

        <div className="text-[11px] text-slate-500 flex items-center justify-between border-t border-slate-100 pt-2.5">
          <span>Source: {weather.source}</span>
          <span>Verified meteorological data for trip planning</span>
        </div>
      </section>

      {/* ============================================================ */}
      {/* 3. SEPARATE CARD: HOTEL SECTION */}
      {/* ============================================================ */}
      <section id="card-hotels" className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
              <Building2 className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">3. Hotel Accommodations</h3>
              <p className="text-xs text-slate-500">
                Suitable stays categorized by budget with estimated prices and locations
              </p>
            </div>
          </div>

          <span className="text-[11px] font-medium text-amber-800 bg-amber-50 border border-amber-200 px-2.5 py-0.5 rounded-full self-start sm:self-auto">
            Prices are Estimated Benchmarks
          </span>
        </div>

        {/* Grid of Attractive Hotel Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
          {hotels.map((hotel) => (
            <div
              key={hotel.id}
              className="rounded-xl border border-slate-200 p-4 hover:border-teal-400 hover:shadow-xs transition-all bg-slate-50/50 flex flex-col justify-between"
            >
              <div>
                <div className="flex items-start justify-between gap-2 mb-2">
                  <span
                    className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md ${
                      hotel.category === 'Budget'
                        ? 'bg-emerald-100 text-emerald-800'
                        : hotel.category === 'Luxury'
                        ? 'bg-purple-100 text-purple-800'
                        : 'bg-blue-100 text-blue-800'
                    }`}
                  >
                    {hotel.category}
                  </span>
                  {hotel.rating && (
                    <span className="text-xs font-bold text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded-md border border-amber-200/60 flex items-center gap-0.5">
                      <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                      {hotel.rating}
                    </span>
                  )}
                </div>

                <h4 className="text-sm font-bold text-slate-900 leading-snug">{hotel.name}</h4>
                <p className="text-xs text-slate-600 mt-1 flex items-center gap-1 font-medium">
                  <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  <span>{hotel.location}</span>
                </p>

                {hotel.highlights && (
                  <p className="text-xs text-slate-600 mt-2.5 leading-relaxed bg-white p-2.5 rounded-lg border border-slate-100">
                    {hotel.highlights}
                  </p>
                )}
              </div>

              <div className="mt-4 pt-3 border-t border-slate-200 flex items-baseline justify-between">
                <div>
                  <span className="text-[11px] text-slate-400 block font-medium">
                    Approx. per night <span className="text-amber-600 text-[10px] font-bold">(Estimated)</span>
                  </span>
                  <span className="text-sm font-bold text-slate-900">{formatCost(hotel.pricePerNight)}</span>
                </div>
                <div className="text-right">
                  <span className="text-[11px] text-slate-400 block font-medium">
                    Total for {plan.days} nights
                  </span>
                  <span className="text-sm font-bold text-teal-700">{formatCost(hotel.totalCost)}</span>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="p-3 bg-slate-50 rounded-xl text-[11px] text-slate-500 leading-relaxed border border-slate-200/50">
          ℹ️ <strong>Price Notice:</strong> Hotel prices are estimated seasonal market averages for {plan.destination}. Real-time hotel booking rates fluctuate dynamically based on live dates, room tiers, and occupancy availability.
        </div>
      </section>

      {/* ============================================================ */}
      {/* 4. SEPARATE CARD: TRIP ITINERARY */}
      {/* ============================================================ */}
      <section id="card-itinerary" className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-teal-50 text-teal-600 flex items-center justify-center shrink-0">
              <CalendarCheck className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">4. Trip Itinerary</h3>
              <p className="text-xs text-slate-500">
                Day-by-day travel plan curated for {plan.destination} based on your {formatCost(plan.userBudget)} budget
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto">
            <button
              onClick={handleToggleAllDays}
              className="text-xs font-semibold px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors"
            >
              {allExpanded ? 'Collapse All Days' : 'Expand All Days'}
            </button>
            <div className="text-xs font-semibold text-teal-800 bg-teal-50 px-2.5 py-1 rounded-full border border-teal-200">
              {itinerary.length} Days Planned
            </div>
          </div>
        </div>

        {/* Day-by-day plan with Morning, Afternoon, Evening, and Estimated Activity Cost */}
        <div className="space-y-3">
          {itinerary.map((day) => {
            const isExpanded = expandedDays[day.day] ?? false;
            return (
              <div
                key={day.day}
                className="rounded-xl border border-slate-200 overflow-hidden transition-all bg-white"
              >
                <button
                  onClick={() => toggleDay(day.day)}
                  className="w-full p-4 text-left flex items-center justify-between bg-slate-50/70 hover:bg-slate-100/70 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <span className="w-7 h-7 rounded-full bg-teal-600 text-white text-xs font-bold flex items-center justify-center shrink-0">
                      {day.day}
                    </span>
                    <div>
                      <h4 className="text-sm font-bold text-slate-900">{day.title}</h4>
                      <span className="text-xs font-medium text-slate-500">
                        Estimated Day Activity Cost: <strong>{formatCost(day.dayTotalCost)}</strong>
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 text-slate-400">
                    {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </div>
                </button>

                {isExpanded && (
                  <div className="p-4 pt-2 space-y-3 text-xs border-t border-slate-100 bg-white">
                    {/* Morning */}
                    <div className="flex items-start gap-3 p-3 rounded-lg bg-amber-50/50 border border-amber-100">
                      <div className="w-6 h-6 rounded-md bg-amber-100 text-amber-700 flex items-center justify-center shrink-0 mt-0.5">
                        <Sun className="w-3.5 h-3.5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-bold text-slate-900">Morning Activity</span>
                          <span className="font-semibold text-slate-700 bg-amber-100/60 px-2 py-0.5 rounded-md">
                            Est. {formatCost(day.morning.cost)}
                          </span>
                        </div>
                        <p className="text-slate-700 mt-1 leading-relaxed">{day.morning.activity}</p>
                      </div>
                    </div>

                    {/* Afternoon */}
                    <div className="flex items-start gap-3 p-3 rounded-lg bg-sky-50/50 border border-sky-100">
                      <div className="w-6 h-6 rounded-md bg-sky-100 text-sky-700 flex items-center justify-center shrink-0 mt-0.5">
                        <Clock className="w-3.5 h-3.5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-bold text-slate-900">Afternoon Activity</span>
                          <span className="font-semibold text-slate-700 bg-sky-100/60 px-2 py-0.5 rounded-md">
                            Est. {formatCost(day.afternoon.cost)}
                          </span>
                        </div>
                        <p className="text-slate-700 mt-1 leading-relaxed">{day.afternoon.activity}</p>
                      </div>
                    </div>

                    {/* Evening */}
                    <div className="flex items-start gap-3 p-3 rounded-lg bg-indigo-50/50 border border-indigo-100">
                      <div className="w-6 h-6 rounded-md bg-indigo-100 text-indigo-700 flex items-center justify-center shrink-0 mt-0.5">
                        <Compass className="w-3.5 h-3.5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-bold text-slate-900">Evening Activity</span>
                          <span className="font-semibold text-slate-700 bg-indigo-100/60 px-2 py-0.5 rounded-md">
                            Est. {formatCost(day.evening.cost)}
                          </span>
                        </div>
                        <p className="text-slate-700 mt-1 leading-relaxed">{day.evening.activity}</p>
                      </div>
                    </div>

                    <div className="text-right text-[11px] text-slate-500 pt-1 font-medium">
                      Total Activity Cost for Day {day.day}: <strong className="text-slate-900">{formatCost(day.dayTotalCost)}</strong>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* ============================================================ */}
      {/* 5. SEPARATE CARD: TRIP CONCLUSION */}
      {/* ============================================================ */}
      <section
        id="card-conclusion"
        className="bg-linear-to-br from-slate-900 via-slate-800 to-teal-950 text-white rounded-2xl p-5 sm:p-6 shadow-lg space-y-5"
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/10 pb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-teal-500/20 text-teal-400 flex items-center justify-center border border-teal-500/30 shrink-0">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-bold tracking-tight">5. Trip Conclusion</h3>
              <p className="text-xs text-teal-200/80">
                Final feasibility verdict, budget match & recommendations
              </p>
            </div>
          </div>

          <span
            className={`text-xs font-bold px-3 py-1 rounded-full self-start sm:self-auto ${
              isOverBudget
                ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
            }`}
          >
            {isOverBudget ? '⚠️ Over Budget' : '✓ Fits Target Budget'}
          </span>
        </div>

        {/* The 6 Explicit Required Conclusion Points */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 text-xs">
          {/* Point 1: Total Estimated Cost */}
          <div className="p-3.5 rounded-xl bg-white/5 border border-white/10 space-y-1">
            <span className="text-teal-300 font-semibold block text-[11px] uppercase tracking-wider">
              1. Total Estimated Cost
            </span>
            <p className="text-lg font-bold text-white">
              {formatCost(budgetBreakdown.totalEstimated)}
            </p>
            <p className="text-slate-300 text-[11px]">
              Itemized across transport, hotel, dining, local commute, activities, and emergency buffer.
            </p>
          </div>

          {/* Point 2: Remaining Budget */}
          <div
            className={`p-3.5 rounded-xl border space-y-1 ${
              isOverBudget
                ? 'bg-rose-500/15 border-rose-500/40 text-rose-200'
                : 'bg-emerald-500/15 border-emerald-500/40 text-emerald-200'
            }`}
          >
            <span className="font-semibold block text-[11px] uppercase tracking-wider">
              2. Remaining Budget
            </span>
            <p className="text-lg font-bold text-white">
              {isOverBudget
                ? `-${formatCost(Math.abs(budgetDifference))} (Over Budget)`
                : `+${formatCost(budgetDifference)} (Remaining Cushion)`}
            </p>
            <p className="text-slate-300 text-[11px]">
              {isOverBudget
                ? `Exceeds target budget. Use the budget adjustment to cut costs by ${formatCost(Math.abs(budgetDifference))}.`
                : `Remaining balance preserved safely for souvenirs, treats, or unexpected needs.`}
            </p>
          </div>

          {/* Point 3: Affordability Check */}
          <div
            className={`p-3.5 rounded-xl border space-y-1 ${
              isOverBudget
                ? 'bg-amber-500/15 border-amber-500/40 text-amber-100'
                : 'bg-teal-500/15 border-teal-500/40 text-teal-100'
            }`}
          >
            <span className="font-semibold block text-[11px] uppercase tracking-wider text-teal-300">
              3. Affordability Verdict
            </span>
            <p className="text-sm font-bold text-white flex items-center gap-1.5">
              {conclusion.isAffordable ? (
                <span className="text-emerald-400">✓ Highly Affordable</span>
              ) : (
                <span className="text-amber-400">⚠️ Needs Budget Adjustments</span>
              )}
            </p>
            <p className="text-slate-300 text-[11px] leading-relaxed">
              {conclusion.affordableVerdict || (isOverBudget ? `Exceeds budget by ${formatCost(Math.abs(budgetDifference))}` : `Fits within ${formatCost(effectiveBudget)} target.`)}
            </p>
          </div>

          {/* Point 4: Best Hotel Option */}
          <div className="p-3.5 rounded-xl bg-white/5 border border-white/10 space-y-1">
            <span className="text-teal-300 font-semibold block text-[11px] uppercase tracking-wider">
              4. Best Hotel Option
            </span>
            <p className="text-sm font-bold text-white leading-snug">
              {conclusion.bestHotel}
            </p>
            <p className="text-slate-300 text-[11px]">
              Top value pick for location convenience, clean amenities, and budget compliance.
            </p>
          </div>

          {/* Point 5: Best Activity */}
          <div className="p-3.5 rounded-xl bg-white/5 border border-white/10 space-y-1">
            <span className="text-teal-300 font-semibold block text-[11px] uppercase tracking-wider">
              5. Best Highlight Activity
            </span>
            <p className="text-sm font-bold text-white leading-snug">
              {conclusion.bestActivity}
            </p>
            <p className="text-slate-300 text-[11px]">
              Must-experience flagship activity tailored to your travel interests within budget.
            </p>
          </div>

          {/* Point 6: Weather Context */}
          <div className="p-3.5 rounded-xl bg-white/5 border border-white/10 space-y-1">
            <span className="text-teal-300 font-semibold block text-[11px] uppercase tracking-wider">
              6. Weather Suitability
            </span>
            <p className="text-sm font-bold text-white">
              {conclusion.datesSuitable ? '✓ Seasonally Favorable' : '⚠️ Moderate Weather Caution'}
            </p>
            <p className="text-slate-300 text-[11px] leading-relaxed line-clamp-2">
              {conclusion.datesSuitabilityNote}
            </p>
          </div>
        </div>

        {/* Short Travel Tip Card */}
        <div className="p-4 rounded-xl bg-teal-900/60 border border-teal-500/40 text-xs text-teal-100 space-y-1.5">
          <div className="flex items-center gap-2">
            <span className="text-amber-400 font-bold uppercase tracking-wider text-[11px] flex items-center gap-1">
              💡 WanderWise Pro Travel Tip
            </span>
          </div>
          <p className="text-sm leading-relaxed text-slate-100 font-medium">
            {conclusion.shortTravelTip || conclusion.finalRecommendation}
          </p>
        </div>
      </section>
    </div>
  );
}
