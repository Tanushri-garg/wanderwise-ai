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
    <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-100 pb-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-teal-50 text-teal-600 flex items-center justify-center">
            <Calculator className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900">Budget Calculator</h3>
            <p className="text-[11px] text-slate-500">Estimate & apportion costs before booking</p>
          </div>
        </div>

        <span
          className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full flex items-center gap-1 ${
            isOverBudget
              ? 'bg-rose-50 text-rose-700 border border-rose-200'
              : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
          }`}
        >
          {isOverBudget ? (
            <>
              <AlertTriangle className="w-3 h-3" /> Over Budget
            </>
          ) : (
            <>
              <CheckCircle2 className="w-3 h-3" /> Within Budget
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
              className="w-full pl-6 pr-2.5 py-2 rounded-lg border border-slate-300 text-slate-900 font-semibold focus:ring-2 focus:ring-teal-500 focus:outline-hidden"
              placeholder="1200"
            />
          </div>
        </div>

        <div>
          <label className="font-semibold text-slate-700 block mb-1">Currency</label>
          <select
            value={currency}
            onChange={(e) => setCurrency(e.target.value)}
            className="w-full py-2 px-2.5 rounded-lg border border-slate-300 text-slate-900 bg-white font-medium focus:ring-2 focus:ring-teal-500 focus:outline-hidden"
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
              className="w-1/2 py-2 px-2 rounded-lg border border-slate-300 text-center text-slate-900 font-medium focus:ring-2 focus:ring-teal-500"
            />
            <input
              type="number"
              min="1"
              max="15"
              title="Number of Travelers"
              value={travelers}
              onChange={(e) => setTravelers(Math.max(1, parseInt(e.target.value, 10) || 1))}
              className="w-1/2 py-2 px-2 rounded-lg border border-slate-300 text-center text-slate-900 font-medium focus:ring-2 focus:ring-teal-500"
            />
          </div>
        </div>
      </div>

      {/* Summary Scoreboard */}
      <div className="grid grid-cols-2 gap-2 text-xs">
        <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
          <span className="text-slate-500 text-[11px] block">Total Estimated Cost</span>
          <span className="text-base font-bold text-slate-900">
            {formatCost(simulatedRequiredCost)}
          </span>
        </div>

        <div className={`p-3 rounded-xl border ${isOverBudget ? 'bg-rose-50/70 border-rose-200 text-rose-800' : 'bg-emerald-50/70 border-emerald-200 text-emerald-800'}`}>
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
        <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-900 space-y-2">
          <div className="flex items-center gap-1.5 font-bold text-rose-700">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>Over Budget Alert</span>
          </div>
          <p className="text-[11px] leading-relaxed">
            Your target budget of {formatCost(numBudget)} is under the estimated minimum of {formatCost(simulatedRequiredCost)} for {days} days and {travelers} travelers.
          </p>
          <div className="pt-1 border-t border-rose-200/80 text-[11px] space-y-1">
            <p className="font-semibold text-rose-800">Suggested Cheaper Alternatives:</p>
            <ul className="list-disc pl-4 space-y-0.5 text-rose-700">
              <li>Choose hostel dorms or micro-hotel rooms (saves up to 40% on hotel)</li>
              <li>Use regional trains and public transit passes instead of rental cars/cabs</li>
              <li>Focus on free walking tours, public parks, and local street food markets</li>
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
        <div className="w-full bg-slate-100 rounded-full h-2.5 flex overflow-hidden">
          {categories.map((c, idx) => (
            <div
              key={idx}
              style={{ width: `${c.pct}%` }}
              className={`${c.color} h-full`}
              title={`${c.label}: ${formatCost(c.cost)}`}
            />
          ))}
        </div>
      </div>

      {/* Grid of Estimated Expenses */}
      <div className="grid grid-cols-2 gap-2 text-xs">
        {categories.map((cat, idx) => {
          const Icon = cat.icon;
          return (
            <div
              key={idx}
              className="p-2.5 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-between"
            >
              <div className="flex items-center gap-2">
                <div className={`w-6 h-6 rounded-md ${cat.color} text-white flex items-center justify-center shrink-0`}>
                  <Icon className="w-3 h-3" />
                </div>
                <div className="min-w-0">
                  <span className="text-[11px] font-medium text-slate-700 block truncate">
                    {cat.label.split(' ')[0]}
                  </span>
                  <span className="text-[10px] text-slate-400">{cat.pct}%</span>
                </div>
              </div>
              <span className="text-xs font-bold text-slate-900">{formatCost(cat.cost)}</span>
            </div>
          );
        })}
      </div>

      {/* Action Buttons */}
      <div className="pt-2 flex items-center gap-2">
        <button
          onClick={handlePlanClick}
          className="flex-1 py-2.5 px-3 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-semibold shadow-xs transition-colors flex items-center justify-center gap-1.5"
        >
          <Sparkles className="w-3.5 h-3.5" /> Plan Trip with this Budget
        </button>
      </div>
    </div>
  );
}
