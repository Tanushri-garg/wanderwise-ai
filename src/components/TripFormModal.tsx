import React, { useState } from 'react';
import { X, MapPin, PlaneTakeoff, Calendar, Users, DollarSign, Tag, Sparkles } from 'lucide-react';
import { TripParameters } from '../types';

interface TripFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentParams: TripParameters;
  onSubmit: (prompt: string, updatedParams: TripParameters) => void;
}

const PREFERENCE_OPTIONS = [
  'Sightseeing',
  'Food & Dining',
  'Relaxation',
  'Adventure',
  'Shopping',
  'Art & Museums',
  'Nature & Outdoors',
  'Nightlife',
  'Historical Sites',
  'Beaches',
];

const CURRENCY_OPTIONS = ['USD', 'EUR', 'GBP', 'INR', 'JPY', 'CAD', 'AUD', 'SGD'];

export function TripFormModal({
  isOpen,
  onClose,
  currentParams,
  onSubmit,
}: TripFormModalProps) {
  const [destination, setDestination] = useState(currentParams.destination || '');
  const [startingCity, setStartingCity] = useState(currentParams.startingCity || '');
  const [travelDates, setTravelDates] = useState(currentParams.travelDates || '');
  const [days, setDays] = useState(currentParams.days?.toString() || '4');
  const [travelers, setTravelers] = useState(currentParams.travelers?.toString() || '2');
  const [budget, setBudget] = useState(currentParams.budget?.toString() || '1200');
  const [currency, setCurrency] = useState(currentParams.currency || 'USD');
  const [preferences, setPreferences] = useState<string[]>(
    currentParams.preferences || ['Sightseeing', 'Food & Dining']
  );

  if (!isOpen) return null;

  const togglePreference = (pref: string) => {
    if (preferences.includes(pref)) {
      setPreferences(preferences.filter((p) => p !== pref));
    } else {
      setPreferences([...preferences, pref]);
    }
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const parsedDays = parseInt(days, 10) || 3;
    const parsedTravelers = parseInt(travelers, 10) || 1;
    const parsedBudget = parseInt(budget, 10) || 1000;

    const updatedParams: TripParameters = {
      destination: destination.trim(),
      startingCity: startingCity.trim(),
      travelDates: travelDates.trim(),
      days: parsedDays,
      travelers: parsedTravelers,
      budget: parsedBudget,
      currency,
      preferences,
    };

    const prompt = `Please create a complete personalized travel plan for my trip:
- Destination: ${updatedParams.destination || 'Unspecified'}
- Starting City: ${updatedParams.startingCity || 'Unspecified'}
- Travel Dates: ${updatedParams.travelDates || 'Flexible upcoming dates'}
- Number of Days: ${updatedParams.days}
- Number of Travelers: ${updatedParams.travelers}
- Total Budget: ${updatedParams.currency} ${updatedParams.budget}
- Travel Preferences: ${updatedParams.preferences?.join(', ') || 'Sightseeing and food'}

Please provide the full budget breakdown, suitable hotel suggestions, expected live weather, day-by-day itinerary, smart budget adjustment if needed, and trip conclusion.`;

    onSubmit(prompt, updatedParams);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 my-8">
        <div className="flex items-center justify-between pb-4 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-teal-50 text-teal-600 flex items-center justify-center">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">Trip Setup</h3>
              <p className="text-xs text-slate-500">Provide all trip details in one quick step</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleFormSubmit} className="space-y-4 pt-4 text-xs">
          {/* Destination & Starting City */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="font-semibold text-slate-700 flex items-center gap-1 mb-1">
                <MapPin className="w-3.5 h-3.5 text-teal-600" /> Destination *
              </label>
              <input
                required
                type="text"
                placeholder="e.g. Paris, France or Tokyo"
                value={destination}
                onChange={(e) => setDestination(e.target.value)}
                className="w-full p-2.5 rounded-lg border border-slate-300 text-slate-900 focus:ring-2 focus:ring-teal-500 focus:outline-hidden"
              />
            </div>
            <div>
              <label className="font-semibold text-slate-700 flex items-center gap-1 mb-1">
                <PlaneTakeoff className="w-3.5 h-3.5 text-slate-500" /> Starting City
              </label>
              <input
                type="text"
                placeholder="e.g. London, New York"
                value={startingCity}
                onChange={(e) => setStartingCity(e.target.value)}
                className="w-full p-2.5 rounded-lg border border-slate-300 text-slate-900 focus:ring-2 focus:ring-teal-500 focus:outline-hidden"
              />
            </div>
          </div>

          {/* Travel Dates & Days */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="font-semibold text-slate-700 flex items-center gap-1 mb-1">
                <Calendar className="w-3.5 h-3.5 text-slate-500" /> Travel Dates
              </label>
              <input
                type="text"
                placeholder="e.g. Oct 10 - Oct 14 or Next Month"
                value={travelDates}
                onChange={(e) => setTravelDates(e.target.value)}
                className="w-full p-2.5 rounded-lg border border-slate-300 text-slate-900 focus:ring-2 focus:ring-teal-500 focus:outline-hidden"
              />
            </div>
            <div>
              <label className="font-semibold text-slate-700 flex items-center gap-1 mb-1">
                Number of Days *
              </label>
              <input
                required
                type="number"
                min="1"
                max="30"
                value={days}
                onChange={(e) => setDays(e.target.value)}
                className="w-full p-2.5 rounded-lg border border-slate-300 text-slate-900 focus:ring-2 focus:ring-teal-500 focus:outline-hidden"
              />
            </div>
          </div>

          {/* Travelers & Budget */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="font-semibold text-slate-700 flex items-center gap-1 mb-1">
                <Users className="w-3.5 h-3.5 text-slate-500" /> Travelers
              </label>
              <input
                required
                type="number"
                min="1"
                max="20"
                value={travelers}
                onChange={(e) => setTravelers(e.target.value)}
                className="w-full p-2.5 rounded-lg border border-slate-300 text-slate-900 focus:ring-2 focus:ring-teal-500 focus:outline-hidden"
              />
            </div>
            <div>
              <label className="font-semibold text-slate-700 flex items-center gap-1 mb-1">
                <DollarSign className="w-3.5 h-3.5 text-emerald-600" /> Total Budget *
              </label>
              <input
                required
                type="number"
                min="10"
                value={budget}
                onChange={(e) => setBudget(e.target.value)}
                className="w-full p-2.5 rounded-lg border border-slate-300 text-slate-900 focus:ring-2 focus:ring-teal-500 focus:outline-hidden"
              />
            </div>
            <div>
              <label className="font-semibold text-slate-700 mb-1 block">
                Currency
              </label>
              <select
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                className="w-full p-2.5 rounded-lg border border-slate-300 text-slate-900 bg-white focus:ring-2 focus:ring-teal-500 focus:outline-hidden"
              >
                {CURRENCY_OPTIONS.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Preferences */}
          <div>
            <label className="font-semibold text-slate-700 flex items-center gap-1 mb-2">
              <Tag className="w-3.5 h-3.5 text-purple-600" /> Travel Preferences
            </label>
            <div className="flex flex-wrap gap-1.5">
              {PREFERENCE_OPTIONS.map((pref) => {
                const selected = preferences.includes(pref);
                return (
                  <button
                    key={pref}
                    type="button"
                    onClick={() => togglePreference(pref)}
                    className={`px-2.5 py-1 rounded-full text-[11px] font-medium transition-all ${
                      selected
                        ? 'bg-teal-600 text-white shadow-xs'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    {selected ? '✓ ' : '+ '}
                    {pref}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100 font-medium text-xs transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-semibold text-xs shadow-xs transition-colors flex items-center gap-1.5"
            >
              <Sparkles className="w-3.5 h-3.5" /> Generate Travel Plan
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
