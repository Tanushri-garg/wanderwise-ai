import { useState, useEffect } from 'react';
import { Header } from './components/Header';
import { ChatArea } from './components/ChatArea';
import { TripTrackerCard } from './components/TripTrackerCard';
import { StandaloneBudgetCalculator } from './components/StandaloneBudgetCalculator';
import { TripPlanView } from './components/TripPlanView';
import { TripFormModal } from './components/TripFormModal';
import { ChatMessage, CompleteTripPlan, TripParameters } from './types';

const INITIAL_PARAMS: TripParameters = {
  currency: 'USD',
  preferences: ['Sightseeing', 'Food & Dining'],
};

const INITIAL_MESSAGE: ChatMessage = {
  id: 'welcome-1',
  role: 'assistant',
  content: `Hello! I'm **WanderWise AI**, your personal AI Travel Planner. 🌍✈️

Plan Smart. Travel Wise. I create complete personalized travel plans tailored precisely to your budget.

To design your custom itinerary, simply tell me:
1. 📍 **Destination**
2. 📅 **Number of days & travel dates**
3. 👥 **Number of travelers**
4. 💰 **Total budget & currency**
5. 🎯 **Travel preferences** (Sightseeing, Food, Adventure, Shopping, Relaxation)

You can type naturally, pick one of the quick suggestions, or use the setup button above!`,
  timestamp: 'Just now',
  missingParams: ['destination', 'days', 'travelDates', 'travelers', 'budget', 'preferences'],
  suggestedPrompts: [
    'Trip to Tokyo, Japan (5 Days, $2,000 USD)',
    'Trip to Paris, France (3 Days, $1,200 USD)',
    'Explore Rome, Italy (4 Days, €1,100 EUR)',
    'Relax in Bali, Indonesia (7 Days, $900 USD)',
  ],
};

export default function App() {
  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    try {
      const saved = localStorage.getItem('wanderwise_messages') || localStorage.getItem('travelmate_messages');
      if (saved) {
        const parsed: ChatMessage[] = JSON.parse(saved);
        return parsed.map((m) =>
          m.id === 'welcome-1'
            ? { ...m, content: INITIAL_MESSAGE.content }
            : { ...m, content: m.content.replace(/TravelMate/g, 'WanderWise AI') }
        );
      }
      return [INITIAL_MESSAGE];
    } catch {
      return [INITIAL_MESSAGE];
    }
  });

  const [currentParams, setCurrentParams] = useState<TripParameters>(() => {
    try {
      const saved = localStorage.getItem('wanderwise_params') || localStorage.getItem('travelmate_params');
      return saved ? JSON.parse(saved) : INITIAL_PARAMS;
    } catch {
      return INITIAL_PARAMS;
    }
  });

  const [currentPlan, setCurrentPlan] = useState<CompleteTripPlan | null>(() => {
    try {
      const saved = localStorage.getItem('wanderwise_plan') || localStorage.getItem('travelmate_plan');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  const [isLoading, setIsLoading] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [activeMobileTab, setActiveMobileTab] = useState<'chat' | 'plan'>('chat');

  // Sync to localStorage
  useEffect(() => {
    try {
      localStorage.setItem('wanderwise_messages', JSON.stringify(messages));
    } catch (e) {
      console.warn('Failed to save messages:', e);
    }
  }, [messages]);

  useEffect(() => {
    try {
      localStorage.setItem('wanderwise_params', JSON.stringify(currentParams));
    } catch (e) {
      console.warn('Failed to save params:', e);
    }
  }, [currentParams]);

  useEffect(() => {
    try {
      if (currentPlan) {
        localStorage.setItem('wanderwise_plan', JSON.stringify(currentPlan));
      } else {
        localStorage.removeItem('wanderwise_plan');
      }
    } catch (e) {
      console.warn('Failed to save plan:', e);
    }
  }, [currentPlan]);

  // Handle Send Message
  const handleSendMessage = async (text: string) => {
    if (!text.trim() || isLoading) return;

    const userMsg: ChatMessage = {
      id: 'usr-' + Date.now(),
      role: 'user',
      content: text,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setIsLoading(true);

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: newMessages.map((m) => ({
            role: m.role,
            content: m.content,
          })),
          currentParams,
        }),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({ error: 'Server error' }));
        throw new Error(errorData.details || errorData.error || `Error: ${res.status}`);
      }

      const data = await res.json();

      if (data.extractedParams) {
        setCurrentParams((prev) => ({
          ...prev,
          ...data.extractedParams,
        }));
      }

      if (data.tripPlan) {
        setCurrentPlan(data.tripPlan);
      }

      const botMsg: ChatMessage = {
        id: 'bot-' + Date.now(),
        role: 'assistant',
        content: data.reply || "I've processed your request.",
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        tripPlan: data.tripPlan || undefined,
        extractedParams: data.extractedParams || undefined,
        missingParams: data.missingParams || undefined,
        suggestedPrompts: data.suggestedPrompts || undefined,
      };

      setMessages((prev) => [...prev, botMsg]);
    } catch (error) {
      console.error('Chat error:', error);
      const errorMsg: ChatMessage = {
        id: 'err-' + Date.now(),
        role: 'assistant',
        content: `Sorry, I encountered an issue processing that: ${(error as Error).message}. Please try again or adjust your prompt.`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setIsLoading(false);
    }
  };

  // Handle Clear Chat
  const handleClearChat = () => {
    setMessages([INITIAL_MESSAGE]);
    setCurrentParams(INITIAL_PARAMS);
    setCurrentPlan(null);
    localStorage.removeItem('wanderwise_messages');
    localStorage.removeItem('wanderwise_params');
    localStorage.removeItem('wanderwise_plan');
    localStorage.removeItem('travelmate_messages');
    localStorage.removeItem('travelmate_params');
    localStorage.removeItem('travelmate_plan');
  };

  // Quick fill prompt from tracker
  const handleQuickFill = (_field: string, promptText: string) => {
    handleSendMessage(promptText);
  };

  // View plan action
  const handleViewPlan = (plan: CompleteTripPlan) => {
    setCurrentPlan(plan);
    setActiveMobileTab('plan');
  };

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col font-sans text-slate-900 selection:bg-teal-100 selection:text-teal-900">
      <Header
        currentParams={currentParams}
        onClearChat={handleClearChat}
        onOpenQuickSetup={() => setIsModalOpen(true)}
        hasPlan={Boolean(currentPlan)}
        activeMobileTab={activeMobileTab}
        setActiveMobileTab={setActiveMobileTab}
      />

      <main className="flex-1 max-w-7xl w-full mx-auto grid grid-cols-1 lg:grid-cols-12 overflow-hidden">
        {/* Chat Section (Center / Left on Desktop) */}
        <section
          className={`lg:col-span-6 xl:col-span-7 border-r border-slate-200 bg-white ${
            activeMobileTab === 'chat' ? 'block' : 'hidden lg:block'
          }`}
        >
          <ChatArea
            messages={messages}
            isLoading={isLoading}
            onSendMessage={handleSendMessage}
            onViewPlan={handleViewPlan}
            latestPlan={currentPlan || undefined}
          />
        </section>

        {/* Trip Details Sidebar (Right on Desktop) */}
        <section
          className={`lg:col-span-6 xl:col-span-5 p-4 sm:p-6 overflow-y-auto max-h-[calc(100vh-68px)] ${
            activeMobileTab === 'plan' ? 'block' : 'hidden lg:block'
          }`}
        >
          {currentPlan ? (
            <TripPlanView
              plan={currentPlan}
              onAskAdjustment={(prompt) => {
                setActiveMobileTab('chat');
                handleSendMessage(prompt);
              }}
            />
          ) : (
            <div className="space-y-6">
              {/* Standalone Interactive Budget Calculator */}
              <StandaloneBudgetCalculator
                currentParams={currentParams}
                onApplyBudget={(budget, currency) => {
                  setCurrentParams((prev) => ({ ...prev, budget, currency }));
                }}
                onPlanTripWithBudget={(budget, currency, days) => {
                  setCurrentParams((prev) => ({ ...prev, budget, currency, days }));
                  setActiveMobileTab('chat');
                  const dest = currentParams.destination || 'Tokyo, Japan';
                  handleSendMessage(
                    `Plan a ${days}-day trip to ${dest} with a total budget of ${currency} ${budget} for ${
                      currentParams.travelers || 2
                    } travelers.`
                  );
                }}
              />

              <TripTrackerCard
                params={currentParams}
                onQuickFill={handleQuickFill}
                onOpenModal={() => setIsModalOpen(true)}
              />

              {/* Helpful 5-Feature Checklist */}
              <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs text-xs space-y-3">
                <h3 className="text-sm font-bold text-slate-900">Your Complete Plan Will Include:</h3>
                <ul className="space-y-2 text-slate-600">
                  <li className="flex items-start gap-2">
                    <span className="font-bold text-teal-600 shrink-0">1.</span>
                    <span><strong>Budget Calculator:</strong> Itemized costs for transport, hotel, food, local travel, activities, and miscellaneous expenses.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="font-bold text-teal-600 shrink-0">2.</span>
                    <span><strong>Weather Forecast:</strong> Live destination temperature, condition, rain chance, and packing advice.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="font-bold text-teal-600 shrink-0">3.</span>
                    <span><strong>Hotel Accommodations:</strong> Price per night, total stay cost, location, and budget category cards.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="font-bold text-teal-600 shrink-0">4.</span>
                    <span><strong>Trip Itinerary:</strong> Day-by-day morning, afternoon, evening activities with estimated costs.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="font-bold text-teal-600 shrink-0">5.</span>
                    <span><strong>Trip Conclusion:</strong> Total estimated cost, remaining or over budget, best hotel, best activity, and overall recommendation.</span>
                  </li>
                </ul>
              </div>
            </div>
          )}
        </section>
      </main>

      {/* Quick Trip Setup Modal */}
      <TripFormModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        currentParams={currentParams}
        onSubmit={(prompt, updatedParams) => {
          setCurrentParams(updatedParams);
          handleSendMessage(prompt);
        }}
      />
    </div>
  );
}
