import { useState, useEffect, useRef } from 'react';
import { Header } from './components/Header';
import { ChatArea } from './components/ChatArea';
import { TripTrackerCard } from './components/TripTrackerCard';
import { StandaloneBudgetCalculator } from './components/StandaloneBudgetCalculator';
import { TripPlanView } from './components/TripPlanView';
import { TripFormModal } from './components/TripFormModal';
import { ChatMessage, CompleteTripPlan, TripParameters } from './types';
import { extractParamsFromText } from './utils/tripParams';

const INITIAL_PARAMS: TripParameters = {
  currency: 'USD',
  preferences: ['Sightseeing', 'Food & Dining'],
};

const createInitialMessage = (): ChatMessage => ({
  id: 'welcome-' + Date.now(),
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
});

export default function App() {
  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    try {
      const saved = localStorage.getItem('wanderwise_messages') || localStorage.getItem('travelmate_messages');
      if (saved) {
        const parsed: ChatMessage[] = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed.map((m) =>
            m.id.startsWith('welcome')
              ? { ...m, content: createInitialMessage().content }
              : { ...m, content: m.content.replace(/TravelMate/g, 'WanderWise AI') }
          );
        }
      }
      return [createInitialMessage()];
    } catch {
      return [createInitialMessage()];
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
  const [clearSignal, setClearSignal] = useState<number>(0);

  // Synchronous refs to prevent race conditions & stale closures
  const messagesRef = useRef<ChatMessage[]>(messages);
  const paramsRef = useRef<TripParameters>(currentParams);
  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  useEffect(() => {
    paramsRef.current = currentParams;
  }, [currentParams]);

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

    // Abort previous request if in-flight
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const controller = new AbortController();
    abortControllerRef.current = controller;

    const userMsg: ChatMessage = {
      id: 'usr-' + Date.now(),
      role: 'user',
      content: text,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    // Use latest messages from ref to eliminate stale closure problems
    const baseMessages = messagesRef.current;
    const newMessages = [...baseMessages, userMsg];
    messagesRef.current = newMessages;
    setMessages(newMessages);
    setIsLoading(true);

    // Optimistically extract parameters from user input right away to immediately update UI/Budget Calculator
    const clientExtracted = extractParamsFromText(text, paramsRef.current);
    paramsRef.current = clientExtracted;
    setCurrentParams(clientExtracted);

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          messages: newMessages.map((m) => ({
            role: m.role,
            content: m.content,
          })),
          currentParams: clientExtracted,
        }),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        const rawErr = errorData.userMessage || errorData.details || errorData.error || `Server status ${res.status}`;
        throw new Error(rawErr);
      }

      const data = await res.json();

      // If aborted while request was in-flight, discard and do not touch state
      if (controller.signal.aborted) return;

      if (data.extractedParams) {
        const updatedParams: TripParameters = {
          ...paramsRef.current,
          ...data.extractedParams,
        };
        // Preserve any user-provided parameters so AI defaults never overwrite them
        if (clientExtracted.budget) updatedParams.budget = clientExtracted.budget;
        if (clientExtracted.currency) updatedParams.currency = clientExtracted.currency;
        if (clientExtracted.days) updatedParams.days = clientExtracted.days;
        if (clientExtracted.travelers) updatedParams.travelers = clientExtracted.travelers;
        if (clientExtracted.destination) updatedParams.destination = clientExtracted.destination;

        paramsRef.current = updatedParams;
        setCurrentParams(updatedParams);
      }

      if (data.tripPlan) {
        setCurrentPlan(data.tripPlan);
      }

      const botMsg: ChatMessage = {
        id: 'bot-' + Date.now(),
        role: 'assistant',
        content: data.reply || "I've processed your travel plan details.",
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        tripPlan: data.tripPlan || undefined,
        extractedParams: data.extractedParams || undefined,
        missingParams: data.missingParams || undefined,
        suggestedPrompts: data.suggestedPrompts || undefined,
      };

      const finalMessages = [...messagesRef.current, botMsg];
      messagesRef.current = finalMessages;
      setMessages(finalMessages);
    } catch (error: any) {
      if (error?.name === 'AbortError' || controller.signal.aborted) {
        // Aborted cleanly by Clear Chat or new request
        return;
      }
      console.error('Chat error:', error);

      const raw = String((error as Error)?.message || '');
      let helpfulMessage = 'The AI service experienced a temporary delay. Your trip details have been preserved. Please try sending your message again.';

      if (/rate limit|429|resource_exhausted/i.test(raw)) {
        helpfulMessage = 'The AI travel service is currently experiencing high demand (Rate Limit). Your trip parameters have been saved. Please wait a moment and try again.';
      } else if (/api key|unauthenticated|401|403|unauthorized/i.test(raw)) {
        helpfulMessage = 'The Gemini API key is missing or unauthorized. Please verify the GEMINI_API_KEY environment variable in Settings.';
      } else if (/timeout|timed out/i.test(raw)) {
        helpfulMessage = 'The AI service took longer than usual to respond. Your trip details are preserved—please click one of the suggested prompts to retry.';
      } else if (raw && !raw.includes('Server error') && !raw.includes('500') && !raw.includes('Failed to fetch')) {
        helpfulMessage = raw;
      }

      const errorMsg: ChatMessage = {
        id: 'err-' + Date.now(),
        role: 'assistant',
        content: helpfulMessage,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      const finalErrorMessages = [...messagesRef.current, errorMsg];
      messagesRef.current = finalErrorMessages;
      setMessages(finalErrorMessages);
    } finally {
      if (abortControllerRef.current === controller) {
        abortControllerRef.current = null;
        setIsLoading(false);
      }
    }
  };

  // Handle Clear Chat
  const handleClearChat = () => {
    // 1. Abort any ongoing in-flight request immediately
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsLoading(false);

    // 2. Create fresh initial welcome message
    const freshInitial = createInitialMessage();

    // 3. Reset sync refs immediately
    messagesRef.current = [freshInitial];
    paramsRef.current = { ...INITIAL_PARAMS };

    // 4. Reset React state completely
    setMessages([freshInitial]);
    setCurrentParams({ ...INITIAL_PARAMS });
    setCurrentPlan(null);
    setIsModalOpen(false);
    setActiveMobileTab('chat');

    // 5. Trigger Clear Signal for ChatArea to empty input box and focus
    setClearSignal((prev) => prev + 1);

    // 6. Purge localStorage
    try {
      localStorage.removeItem('wanderwise_messages');
      localStorage.removeItem('wanderwise_params');
      localStorage.removeItem('wanderwise_plan');
      localStorage.removeItem('travelmate_messages');
      localStorage.removeItem('travelmate_params');
      localStorage.removeItem('travelmate_plan');
    } catch (e) {
      console.warn('Failed to clear storage:', e);
    }
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
            clearSignal={clearSignal}
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
                onApplyBudget={(budget, currency, days, travelers) => {
                  const updated = {
                    ...paramsRef.current,
                    budget,
                    currency,
                    ...(days ? { days } : {}),
                    ...(travelers ? { travelers } : {}),
                  };
                  paramsRef.current = updated;
                  setCurrentParams(updated);
                }}
                onPlanTripWithBudget={(budget, currency, days, travelers) => {
                  const numDays = days || paramsRef.current.days || 5;
                  const numTravelers = travelers || paramsRef.current.travelers || 2;
                  const updated = {
                    ...paramsRef.current,
                    budget,
                    currency,
                    days: numDays,
                    travelers: numTravelers,
                  };
                  paramsRef.current = updated;
                  setCurrentParams(updated);
                  setActiveMobileTab('chat');
                  const dest = updated.destination || 'Paris, France';
                  handleSendMessage(
                    `Plan a ${numDays}-day trip to ${dest} with a total budget of ${currency} ${budget} for ${numTravelers} travelers.`
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
        key={`modal-${clearSignal}`}
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        currentParams={currentParams}
        onSubmit={(prompt, updatedParams) => {
          paramsRef.current = updatedParams;
          setCurrentParams(updatedParams);
          handleSendMessage(prompt);
        }}
      />
    </div>
  );
}
