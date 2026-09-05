import { useState, useEffect } from 'react';
import {
  Calculator,
  DollarSign,
  Plane,
  Building2,
  Utensils,
  Car,
  Compass,
  ShieldCheck,
  AlertTriangle,
  CheckCircle2,
  Sparkles,
  ArrowRight,
  TrendingDown,
} from 'lucide-react';
import { TripParameters } from '../types';

interface StandaloneBudgetCalculatorProps {
  currentParams: TripParameters;
  onApplyBudget: (budget: number, currency: string, days?: number, travelers?: number) => void;
  onPlanTripWithBudget: (budget: number, currency: string, days: number, travelers?: number) => void;
}

export function StandaloneBudgetCalculator({
  currentParams,
  onApplyBudget,
  onPlanTripWithBudget,
}: StandaloneBudgetCalculatorProps) {
  const [budgetInput, setBudgetInput] = useState<string>(
    currentParams.budget !== undefined && currentParams.budget !== null
      ? currentParams.budget.toString()
      : '2500'
  );
  const [currency, setCurrency] = useState<string>(currentParams.currency || 'USD');
  const [days, setDays] = useState<number>(currentParams.days || 5);
  const [travelers, setTravelers] = useState<number>(currentParams.travelers || 2);

  // Synchronize when currentParams updates (e.g. from chat inputs or quick setup)
  useEffect(() => {
    if (currentParams.budget !== undefined && currentParams.budget !== null) {
      setBudgetInput(currentParams.budget.toString());
    }
    if (currentParams.currency) {
      setCurrency(currentParams.currency);
    }
    if (currentParams.days !== undefined && currentParams.days !== null) {
      setDays(currentParams.days);
    }
    if (currentParams.travelers !== undefined && currentParams.travelers !== null) {
      setTravelers(currentParams.travelers);
    }
  }, [currentParams.budget, currentParams.currency, currentParams.days, currentParams.travelers]);

  // Custom adjustments simulation
  const numBudget = Math.max(0, parseInt(budgetInput, 10) || (currentParams.budget ?? 0));

  // Benchmark minimum realistic costs per day per traveler based on destination
  const minCostPerDayPerPerson = 60; // rough baseline for modest travel
  const realisticBaseCost = days * travelers * minCostPerDayPerPerson;

  // Breakdown percentages:
  // Transportation: 25%
  // Hotel: 35%
  // Food: 20%
  // Local Travel: 5%
  // Activities: 10%
  // Miscellaneous / Emergency: 5%
  const transportEst = Math.round(numBudget * 0.25);
  const hotelEst = Math.round(numBudget * 0.35);
  const foodEst = Math.round(numBudget * 0.20);
  const localTravelEst = Math.round(numBudget * 0.05);
  const activitiesEst = Math.round(numBudget * 0.10);
  const miscEst = Math.round(numBudget * 0.05);

  const totalCalculated =
    transportEst + hotelEst + foodEst + localTravelEst + activitiesEst + miscEst;

  // If budget is extremely low for the days and travelers, flag as over budget simulation
  const isTightOrOver = numBudget > 0 && numBudget < realisticBaseCost;
  const simulatedRequiredCost = isTightOrOver ? realisticBaseCost : totalCalculated;
  const isOverBudget = simulatedRequiredCost > numBudget;
  const remainingBudget = numBudget - simulatedRequiredCost;

  const categories = [
    { label: 'Transportation (Flights / Trains)', cost: transportEst, pct: 25, icon: Plane, color: 'bg-blue-500' },
    { label: 'Hotel / Accommodation', cost: hotelEst, pct: 35, icon: Building2, color: 'bg-teal-500' },
    { label: 'Food & Dining', cost: foodEst, pct: 20, icon: Utensils, color: 'bg-amber-500' },
    { label: 'Local Travel (Metro / Taxis)', cost: localTravelEst, pct: 5, icon: Car, color: 'bg-indigo-500' },
    { label: 'Activities & Sightseeing', cost: activitiesEst, pct: 10, icon: Compass, color: 'bg-purple-500' },
    { label: 'Miscellaneous & Emergency', cost: miscEst, pct: 5, icon: ShieldCheck, color: 'bg-emerald-500' },
  ];

  const formatCost = (amt: number) => {
    return `${currency} ${amt.toLocaleString()}`;
  };

  const handleUpdate = () => {
    onApplyBudget(numBudget, currency, days, travelers);
  };

  const handlePlanClick = () => {
    onPlanTripWithBudget(numBudget, currency, days, travelers);
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200/90 p-5 shadow-xs hover:shadow-md transition-all space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-100 pb-3.5">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-teal-50 border border-teal-200/70 text-teal-700 flex items-center justify-center shadow-2xs">
            <Calculator className="w-4 h-4 text-teal-600" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900">Budget Calculator</h3>
            <p className="text-[11px] text-slate-500 font-medium">Estimate & apportion costs before booking</p>
          </div>
        </div>

        <span
          className={`text-xs font-bold px-3 py-1 rounded-full flex items-center gap-1.5 shadow-2xs ${
            isOverBudget
              ? 'bg-rose-50 text-rose-700 border border-rose-200/80 animate-pulse'
              : 'bg-emerald-50 text-emerald-700 border border-emerald-200/80'
          }`}
        >
          {isOverBudget ? (
            <>
              <AlertTriangle className="w-3.5 h-3.5 text-rose-600" /> Over Budget
            </>
          ) : (
            <>
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> Within Budget
            </>
          )}
        </span>
      </div>

      {/* Input Controls */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs">
        <div>
          <label className="font-semibold text-slate-700 block mb-1">
            Total Trip Budget *
          </label>
          <div className="relative">
            <span className="absolute left-2.5 top-2.5 text-slate-400 font-semibold">$</span>
            <input
              type="number"
              min="50"
              value={budgetInput}
              onChange={(e) => setBudgetInput(e.target.value)}
              className="w-full pl-6 pr-2.5 py-2 rounded-xl border border-slate-300 text-slate-900 font-semibold focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 focus:outline-hidden transition-all shadow-2xs"
              placeholder="1200"
            />
          </div>
        </div>

        <div>
          <label className="font-semibold text-slate-700 block mb-1">Currency</label>
          <select
            value={currency}
            onChange={(e) => setCurrency(e.target.value)}
            className="w-full py-2 px-2.5 rounded-xl border border-slate-300 text-slate-900 bg-white font-medium focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 focus:outline-hidden transition-all shadow-2xs"
          >
            <option value="USD">USD ($)</option>
            <option value="EUR">EUR (€)</option>
            <option value="GBP">GBP (£)</option>
            <option value="INR">INR (₹)</option>
            <option value="CAD">CAD ($)</option>
            <option value="AUD">AUD ($)</option>
            <option value="JPY">JPY (¥)</option>
          </select>
        </div>

        <div>
          <label className="font-semibold text-slate-700 block mb-1">Days & Travelers</label>
          <div className="flex gap-1.5">
            <input
              type="number"
              min="1"
              max="30"
              title="Number of Days"
              value={days}
              onChange={(e) => setDays(Math.max(1, parseInt(e.target.value, 10) || 1))}
              className="w-1/2 py-2 px-2 rounded-xl border border-slate-300 text-center text-slate-900 font-semibold focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-all shadow-2xs"
            />
            <input
              type="number"
              min="1"
              max="15"
              title="Number of Travelers"
              value={travelers}
              onChange={(e) => setTravelers(Math.max(1, parseInt(e.target.value, 10) || 1))}
              className="w-1/2 py-2 px-2 rounded-xl border border-slate-300 text-center text-slate-900 font-semibold focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-all shadow-2xs"
            />
          </div>
        </div>
      </div>

      {/* Summary Scoreboard */}
      <div className="grid grid-cols-2 gap-2 text-xs">
        <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80 shadow-2xs">
          <span className="text-slate-500 text-[11px] font-medium block">Total Estimated Cost</span>
          <span className="text-base font-bold text-slate-900">
            {formatCost(simulatedRequiredCost)}
          </span>
        </div>

        <div className={`p-3 rounded-xl border shadow-2xs ${isOverBudget ? 'bg-rose-50/80 border-rose-200 text-rose-800' : 'bg-emerald-50/80 border-emerald-200 text-emerald-800'}`}>
          <span className="text-[11px] font-medium block">
            {isOverBudget ? 'Exceeded Budget' : 'Remaining Budget'}
          </span>
          <span className="text-base font-bold">
            {isOverBudget
              ? `-${formatCost(Math.abs(remainingBudget))}`
              : `+${formatCost(remainingBudget)}`}
          </span>
        </div>
      </div>

      {/* If Over Budget: Prompt Cheaper Alternatives */}
      {isOverBudget && (
        <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-900 space-y-2 shadow-2xs">
          <div className="flex items-center gap-1.5 font-bold text-rose-700">
            <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600" />
            <span>Over Budget Notice</span>
          </div>
          <p className="text-[11px] leading-relaxed">
            Your target budget of {formatCost(numBudget)} is under the estimated baseline of {formatCost(simulatedRequiredCost)} for {days} days and {travelers} travelers.
          </p>
          <div className="pt-1 border-t border-rose-200/80 text-[11px] space-y-1">
            <p className="font-semibold text-rose-800">Suggested Cost-Saving Options:</p>
            <ul className="list-disc pl-4 space-y-0.5 text-rose-700">
              <li>Choose boutique hostels or budget apartments (saves ~35% on accommodation)</li>
              <li>Utilize local multi-day transit passes instead of taxis</li>
              <li>Mix casual street food and bistros with occasional dining</li>
            </ul>
          </div>
        </div>
      )}

      {/* Category Breakdown Bar */}
      <div className="space-y-1.5 pt-1">
        <div className="flex items-center justify-between text-[11px] text-slate-500 font-medium">
          <span>Estimated Category Allocation</span>
          <span>100% Calculated</span>
        </div>
        <div className="w-full bg-slate-100 rounded-full h-3 flex overflow-hidden p-0.5 border border-slate-200/70 shadow-2xs">
          {categories.map((c, idx) => (
            <div
              key={idx}
              style={{ width: `${c.pct}%` }}
              className={`${c.color} h-full first:rounded-l-full last:rounded-r-full transition-all duration-300 hover:opacity-85`}
              title={`${c.label}: ${formatCost(c.cost)}`}
            />
          ))}
        </div>
      </div>

      {/* Grid of Estimated Expenses with hover animation */}
      <div className="grid grid-cols-2 gap-2 text-xs">
        {categories.map((cat, idx) => {
          const Icon = cat.icon;
          return (
            <div
              key={idx}
              className="p-2.5 rounded-xl bg-slate-50/80 border border-slate-200/70 flex items-center justify-between hover:bg-white hover:-translate-y-0.5 hover:shadow-xs transition-all cursor-default"
            >
              <div className="flex items-center gap-2 min-w-0">
                <div className={`w-6 h-6 rounded-lg ${cat.color} text-white flex items-center justify-center shrink-0 shadow-2xs`}>
                  <Icon className="w-3 h-3" />
                </div>
                <div className="min-w-0">
                  <span className="text-[11px] font-semibold text-slate-700 block truncate">
                    {cat.label.split(' ')[0]}
                  </span>
                  <span className="text-[10px] text-slate-400 font-medium">{cat.pct}%</span>
                </div>
              </div>
              <span className="text-xs font-bold text-slate-900 shrink-0">{formatCost(cat.cost)}</span>
            </div>
          );
        })}
      </div>

      {/* Action Buttons */}
      <div className="pt-2 flex items-center gap-2">
        <button
          onClick={handlePlanClick}
          className="flex-1 py-2.5 px-3 rounded-xl bg-linear-to-r from-teal-600 via-teal-700 to-emerald-600 hover:from-teal-700 hover:to-emerald-700 text-white text-xs font-bold shadow-xs hover:shadow-md transition-all flex items-center justify-center gap-1.5 active:scale-98"
        >
          <Sparkles className="w-3.5 h-3.5" /> Plan Trip with this Budget
        </button>
      </div>
    </div>
  );
}
