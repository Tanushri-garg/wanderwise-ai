import { CheckCircle2, Circle, MapPin, Calendar, Users, Wallet, Compass, PlaneTakeoff, Tag } from 'lucide-react';
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
    <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-4">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-sm font-semibold text-slate-900 flex items-center gap-1.5">
            <Compass className="w-4 h-4 text-teal-600" /> Trip Details Progress
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            {completedCount} of {items.length} requirements collected
          </p>
        </div>
        <button
          id="open-setup-from-tracker"
          onClick={onOpenModal}
          className="text-xs text-teal-600 hover:text-teal-700 font-medium px-2.5 py-1 rounded-md bg-teal-50 hover:bg-teal-100/70 transition-colors"
        >
          Fill All
        </button>
      </div>

      {/* Progress bar */}
      <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
        <div
          className="bg-teal-600 h-2 rounded-full transition-all duration-500"
          style={{ width: `${progressPercent}%` }}
        />
      </div>

      <div className="divide-y divide-slate-100">
        {items.map((item) => {
          const Icon = item.icon;
          return (
            <div
              key={item.id}
              className="py-2.5 flex items-center justify-between gap-3 text-xs"
            >
              <div className="flex items-center gap-2 min-w-0">
                {item.isSet ? (
                  <CheckCircle2 className="w-4 h-4 text-teal-600 shrink-0" />
                ) : (
                  <Circle className="w-4 h-4 text-slate-300 shrink-0" />
                )}
                <div className="min-w-0">
                  <span className="font-medium text-slate-700 block truncate">{item.label}</span>
                  {item.value ? (
                    <span className="text-slate-900 font-semibold truncate block">
                      {item.value}
                    </span>
                  ) : (
                    <span className="text-slate-400 italic">Not specified yet</span>
                  )}
                </div>
              </div>

              {!item.isSet && (
                <button
                  onClick={() => onQuickFill(item.id, item.prompt)}
                  className="shrink-0 text-[11px] text-teal-600 hover:text-teal-700 hover:underline"
                >
                  Specify
                </button>
              )}
            </div>
          );
        })}
      </div>

      <div className="pt-2 border-t border-slate-100 bg-slate-50/70 -mx-5 -mb-5 p-3.5 rounded-b-2xl">
        <p className="text-[11px] text-slate-600 leading-relaxed">
          💡 <strong>Tip:</strong> You can either chat naturally with WanderWise AI, choose a starter trip below, or click <strong>Fill All</strong> to set up everything in one form.
        </p>
      </div>
    </div>
  );
}
