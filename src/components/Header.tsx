import { Compass, Sparkles, Trash2, SlidersHorizontal, MapPin } from 'lucide-react';
import { TripParameters } from '../types';

interface HeaderProps {
  currentParams: TripParameters;
  onClearChat: () => void;
  onOpenQuickSetup: () => void;
  hasPlan: boolean;
  activeMobileTab: 'chat' | 'plan';
  setActiveMobileTab: (tab: 'chat' | 'plan') => void;
}

export function Header({
  currentParams,
  onClearChat,
  onOpenQuickSetup,
  hasPlan,
  activeMobileTab,
  setActiveMobileTab,
}: HeaderProps) {
  return (
    <header className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3.5 flex items-center justify-between gap-3">
        {/* Brand identity */}
        <div className="flex items-center gap-2.5">
          <div className="w-10 h-10 rounded-xl bg-teal-600 text-white flex items-center justify-center shadow-sm">
            <Compass className="w-5 h-5 text-teal-100 animate-spin-slow" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-slate-900 tracking-tight">WanderWise AI</h1>
              <span className="hidden sm:inline-flex items-center gap-1 text-[11px] font-medium bg-teal-50 text-teal-700 border border-teal-200/80 px-2 py-0.5 rounded-full">
                <Sparkles className="w-3 h-3 text-teal-600" /> AI Travel Planner
              </span>
            </div>
            <p className="text-xs text-slate-500 hidden sm:block">
              Plan Smart. Travel Wise.
            </p>
          </div>
        </div>

        {/* Current Destination badge if set */}
        {currentParams.destination && (
          <div className="hidden md:flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-100 text-slate-700 text-xs font-medium border border-slate-200">
            <MapPin className="w-3.5 h-3.5 text-teal-600" />
            <span>{currentParams.destination}</span>
            {currentParams.budget && (
              <span className="text-slate-400">
                • {currentParams.currency || '$'}{currentParams.budget.toLocaleString()}
              </span>
            )}
          </div>
        )}

        {/* Right action buttons */}
        <div className="flex items-center gap-2">
          {/* Mobile view toggle */}
          <div className="flex lg:hidden bg-slate-100 p-0.5 rounded-lg border border-slate-200 text-xs font-medium">
            <button
              id="mobile-tab-chat"
              onClick={() => setActiveMobileTab('chat')}
              className={`px-3 py-1.5 rounded-md transition-all ${
                activeMobileTab === 'chat'
                  ? 'bg-white text-slate-900 shadow-xs font-semibold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Chat
            </button>
            <button
              id="mobile-tab-plan"
              onClick={() => setActiveMobileTab('plan')}
              className={`px-3 py-1.5 rounded-md transition-all flex items-center gap-1 ${
                activeMobileTab === 'plan'
                  ? 'bg-white text-slate-900 shadow-xs font-semibold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Trip Plan
              {hasPlan && (
                <span className="w-2 h-2 rounded-full bg-teal-500 ring-2 ring-white"></span>
              )}
            </button>
          </div>

          <button
            id="quick-setup-btn"
            onClick={onOpenQuickSetup}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg text-slate-700 bg-slate-100 hover:bg-slate-200/80 transition-colors border border-slate-200"
            title="Quick Trip Setup"
          >
            <SlidersHorizontal className="w-3.5 h-3.5 text-slate-600" />
            <span className="hidden sm:inline">Trip Setup</span>
          </button>

          <button
            id="clear-chat-btn"
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onClearChat();
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg text-rose-600 bg-rose-50 hover:bg-rose-100/80 transition-colors border border-rose-200/60 cursor-pointer select-none"
            title="Clear Chat history"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Clear Chat</span>
          </button>
        </div>
      </div>
    </header>
  );
}
