import { Compass, Sparkles, Trash2, SlidersHorizontal, MapPin, Globe, Plane } from 'lucide-react';
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
    <header className="bg-white/95 backdrop-blur-md border-b border-slate-200/80 sticky top-0 z-30 shadow-xs transition-all">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between gap-3">
        {/* Brand identity */}
        <div className="flex items-center gap-3">
          <div className="relative group cursor-pointer">
            <div className="w-10 h-10 rounded-xl bg-linear-to-br from-teal-500 via-teal-600 to-emerald-600 text-white flex items-center justify-center shadow-sm shadow-teal-500/20 group-hover:shadow-md group-hover:scale-105 transition-all">
              <Compass className="w-5 h-5 text-teal-50 group-hover:rotate-45 transition-transform duration-500" />
            </div>
            <div className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-emerald-500 border-2 border-white flex items-center justify-center">
              <Plane className="w-2.5 h-2.5 text-white" />
            </div>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-lg sm:text-xl font-black text-slate-900 tracking-tight flex items-center gap-1.5 font-sans">
                WanderWise <span className="text-teal-600">AI</span>
              </span>
              <span className="hidden sm:inline-flex items-center gap-1 text-[11px] font-semibold bg-linear-to-r from-teal-50 to-emerald-50 text-teal-700 border border-teal-200/70 px-2.5 py-0.5 rounded-full shadow-2xs">
                <Sparkles className="w-3 h-3 text-teal-600 animate-pulse" /> AI Travel Planner
              </span>
            </div>
            <p className="text-[11px] text-slate-500 font-medium hidden sm:flex items-center gap-1">
              <Globe className="w-3 h-3 text-slate-400" /> Plan Smart. Travel Wise.
            </p>
          </div>
        </div>

        {/* Current Destination badge if set */}
        {currentParams.destination && (
          <div className="hidden md:flex items-center gap-2 px-3.5 py-1 rounded-full bg-slate-100/90 text-slate-700 text-xs font-semibold border border-slate-200 shadow-2xs">
            <MapPin className="w-3.5 h-3.5 text-teal-600 animate-bounce" />
            <span className="truncate max-w-[140px]">{currentParams.destination}</span>
            {currentParams.budget && (
              <span className="text-teal-700 font-bold bg-teal-50 px-2 py-0.5 rounded-full border border-teal-200/60 text-[11px]">
                {currentParams.currency || '$'}{currentParams.budget.toLocaleString()}
              </span>
            )}
          </div>
        )}

        {/* Right action buttons */}
        <div className="flex items-center gap-2">
          {/* Mobile view toggle */}
          <div className="flex lg:hidden bg-slate-100 p-0.5 rounded-xl border border-slate-200 text-xs font-semibold">
            <button
              id="mobile-tab-chat"
              onClick={() => setActiveMobileTab('chat')}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                activeMobileTab === 'chat'
                  ? 'bg-white text-slate-900 shadow-xs font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Chat
            </button>
            <button
              id="mobile-tab-plan"
              onClick={() => setActiveMobileTab('plan')}
              className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${
                activeMobileTab === 'plan'
                  ? 'bg-white text-slate-900 shadow-xs font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Trip Plan
              {hasPlan && (
                <span className="w-2 h-2 rounded-full bg-teal-500 ring-2 ring-white animate-pulse"></span>
              )}
            </button>
          </div>

          <button
            id="quick-setup-btn"
            onClick={onOpenQuickSetup}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl text-slate-700 bg-slate-100 hover:bg-slate-200/90 transition-all border border-slate-200 shadow-2xs hover:shadow-xs active:scale-95"
            title="Quick Trip Setup"
          >
            <SlidersHorizontal className="w-3.5 h-3.5 text-teal-600" />
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
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl text-rose-600 bg-rose-50/90 hover:bg-rose-100 text-rose-700 transition-all border border-rose-200/70 shadow-2xs hover:shadow-xs cursor-pointer select-none active:scale-95"
            title="Clear Chat history"
          >
            <Trash2 className="w-3.5 h-3.5 text-rose-500" />
            <span className="hidden sm:inline">Clear Chat</span>
          </button>
        </div>
      </div>
    </header>
  );
}
