import { CheckCircle2, Circle, MapPin, Calendar, Users, Wallet, Compass, PlaneTakeoff, Tag, Sparkles, ArrowRight } from 'lucide-react';
import { TripParameters } from '../types';

interface TripTrackerCardProps {
  params: TripParameters;
  onQuickFill: (field: string, promptText: string) => void;
  onOpenModal: () => void;
}

export function TripTrackerCard({ params, onQuickFill, onOpenModal }: TripTrackerCardProps) {
  const items = [
    {
      id: 'destination',
      label: 'Destination',
      icon: MapPin,
      value: params.destination,
      isSet: Boolean(params.destination),
      prompt: 'My destination is ',
    },
    {
      id: 'startingCity',
      label: 'Starting City',
      icon: PlaneTakeoff,
      value: params.startingCity,
      isSet: Boolean(params.startingCity),
      prompt: 'I am starting from ',
    },
    {
      id: 'travelDates',
      label: 'Travel Dates',
      icon: Calendar,
      value: params.travelDates,
      isSet: Boolean(params.travelDates),
      prompt: 'I want to travel around ',
    },
    {
      id: 'days',
      label: 'Number of Days',
      icon: Calendar,
      value: params.days ? `${params.days} Days` : undefined,
      isSet: Boolean(params.days),
      prompt: 'The trip will be for 4 days',
    },
    {
      id: 'travelers',
      label: 'Travelers',
      icon: Users,
      value: params.travelers ? `${params.travelers} ${params.travelers === 1 ? 'Person' : 'People'}` : undefined,
      isSet: Boolean(params.travelers),
      prompt: 'We have 2 travelers',
    },
    {
      id: 'budget',
      label: 'Total Budget & Currency',
      icon: Wallet,
      value: params.budget ? `${params.currency || 'USD'} ${params.budget.toLocaleString()}` : undefined,
      isSet: Boolean(params.budget),
      prompt: 'My total budget is $1200 USD',
    },
    {
      id: 'preferences',
      label: 'Travel Preferences',
      icon: Tag,
      value: params.preferences && params.preferences.length > 0 ? params.preferences.join(', ') : undefined,
      isSet: Boolean(params.preferences && params.preferences.length > 0),
      prompt: 'My travel preferences are sightseeing, food, relaxation, and culture',
    },
  ];

  const completedCount = items.filter((i) => i.isSet).length;
  const progressPercent = Math.round((completedCount / items.length) * 100);

  return (
    <div className="bg-white rounded-2xl border border-slate-200/90 p-5 shadow-xs hover:shadow-md transition-all space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-teal-50 border border-teal-200/70 text-teal-700 flex items-center justify-center shadow-2xs">
            <Compass className="w-4 h-4 text-teal-600" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
              Trip Details Progress
            </h2>
            <p className="text-[11px] text-slate-500 font-medium">
              {completedCount} of {items.length} details collected ({progressPercent}%)
            </p>
          </div>
        </div>

        <button
          id="open-setup-from-tracker"
          onClick={onOpenModal}
          className="text-xs text-teal-700 hover:text-teal-800 font-bold px-3 py-1.5 rounded-xl bg-teal-50 hover:bg-teal-100/80 border border-teal-200/70 transition-all shadow-2xs hover:shadow-xs active:scale-95 flex items-center gap-1"
        >
          <Sparkles className="w-3 h-3 text-teal-600" /> Fill All
        </button>
      </div>

      {/* Progress bar */}
      <div className="space-y-1">
        <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden p-0.5 border border-slate-200/60">
          <div
            className="bg-linear-to-r from-teal-500 via-teal-600 to-emerald-500 h-full rounded-full transition-all duration-600 shadow-2xs"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>

      <div className="divide-y divide-slate-100/90">
        {items.map((item) => {
          const Icon = item.icon;
          return (
            <div
              key={item.id}
              className={`py-2.5 px-2 -mx-2 rounded-xl flex items-center justify-between gap-3 text-xs transition-colors ${
                item.isSet ? 'bg-teal-50/20' : 'hover:bg-slate-50/60'
              }`}
            >
              <div className="flex items-center gap-2.5 min-w-0">
                {item.isSet ? (
                  <div className="w-5 h-5 rounded-full bg-teal-600 text-white flex items-center justify-center shrink-0 shadow-2xs">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                  </div>
                ) : (
                  <div className="w-5 h-5 rounded-full border-2 border-slate-300 flex items-center justify-center shrink-0">
                    <Circle className="w-2.5 h-2.5 text-transparent" />
                  </div>
                )}
                <div className="min-w-0">
                  <span className="font-semibold text-slate-700 block truncate text-[11px]">{item.label}</span>
                  {item.value ? (
                    <span className="text-slate-900 font-bold truncate block text-xs">
                      {item.value}
                    </span>
                  ) : (
                    <span className="text-slate-400 italic text-[11px]">Not specified yet</span>
                  )}
                </div>
              </div>

              {!item.isSet && (
                <button
                  onClick={() => onQuickFill(item.id, item.prompt)}
                  className="shrink-0 text-[11px] font-semibold text-teal-600 hover:text-teal-700 hover:bg-teal-50 px-2 py-0.5 rounded-md transition-colors flex items-center gap-0.5"
                >
                  Specify <ArrowRight className="w-2.5 h-2.5" />
                </button>
              )}
            </div>
          );
        })}
      </div>

      <div className="pt-2 border-t border-slate-100 bg-linear-to-b from-slate-50/70 to-teal-50/20 -mx-5 -mb-5 p-3.5 rounded-b-2xl border-b border-x border-slate-200/50">
        <p className="text-[11px] text-slate-600 leading-relaxed font-medium">
          💡 <strong>Tip:</strong> Chat naturally with WanderWise AI or click <strong>Fill All</strong> to set up destination, budget, and dates in seconds.
        </p>
      </div>
    </div>
  );
}
