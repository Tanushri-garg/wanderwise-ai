import React, { useState, useRef, useEffect } from 'react';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { motion, AnimatePresence } from 'motion/react';
import { Send, Bot, User, Sparkles, MapPin, DollarSign, Calendar, ArrowRight, Loader2, Compass, Plane, Sparkle } from 'lucide-react';
import { ChatMessage, CompleteTripPlan } from '../types';

interface ChatAreaProps {
  messages: ChatMessage[];
  isLoading: boolean;
  onSendMessage: (text: string) => void;
  onViewPlan: (plan: CompleteTripPlan) => void;
  latestPlan?: CompleteTripPlan;
  clearSignal?: number;
}

const STARTER_PROMPTS = [
  {
    label: 'Paris (3 Days, $1,200)',
    icon: '🗼',
    text: 'I want to plan a 3-day trip to Paris from London for 2 travelers with a total budget of $1200 USD. We love sightseeing, local food, and walking tours.',
  },
  {
    label: 'Tokyo (5 Days, $2,000)',
    icon: '⛩️',
    text: 'Plan a 5-day cultural and foodie trip to Tokyo starting from San Francisco for 1 person with a total budget of $2000 USD in October.',
  },
  {
    label: 'Bali (7 Days, $900)',
    icon: '🌴',
    text: 'Help me plan a 7-day budget relaxation trip to Bali starting from Singapore for 2 people with a budget of $900 USD. We want beaches, nature, and relaxation.',
  },
  {
    label: 'Rome (4 Days, €1,100)',
    icon: '🏛️',
    text: 'Plan a 4-day trip to Rome for 2 travelers starting from Berlin with a total budget of 1100 EUR. We want historical monuments, pizza, and walking tours.',
  },
];

export function ChatArea({
  messages,
  isLoading,
  onSendMessage,
  onViewPlan,
  latestPlan,
  clearSignal,
}: ChatAreaProps) {
  const [inputText, setInputText] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Auto-scroll on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  // When Clear Chat is clicked, wipe input text, reset DOM textarea, and focus
  useEffect(() => {
    if (clearSignal !== undefined && clearSignal > 0) {
      setInputText('');
      if (inputRef.current) {
        inputRef.current.value = '';
        inputRef.current.focus();
      }
    }
  }, [clearSignal]);

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!inputText.trim() || isLoading) return;
    onSendMessage(inputText);
    setInputText('');
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-68px)] bg-linear-to-b from-slate-50 via-teal-50/10 to-slate-50">
      {/* Message Stream */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
        {messages.length === 0 ? (
          <div className="max-w-xl mx-auto my-auto text-center py-8 space-y-6">
            <div className="relative inline-block">
              <div className="w-16 h-16 rounded-2xl bg-linear-to-br from-teal-500 to-emerald-600 text-white mx-auto flex items-center justify-center shadow-lg shadow-teal-500/25">
                <Compass className="w-8 h-8 text-white" />
              </div>
              <div className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-amber-400 border-2 border-white flex items-center justify-center shadow-2xs">
                <Sparkles className="w-3 h-3 text-amber-900" />
              </div>
            </div>
            <div>
              <h2 className="text-2xl font-black text-slate-900 tracking-tight">
                Welcome to WanderWise <span className="text-teal-600">AI</span>
              </h2>
              <p className="text-sm text-slate-600 mt-2 leading-relaxed max-w-md mx-auto font-medium">
                Plan Smart. Travel Wise. Share your destination and budget, and I'll generate a complete itinerary with live weather, hotel prices, and smart budget breakdowns.
              </p>
            </div>

            {/* Quick Starters */}
            <div className="pt-2 text-left">
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3 text-center flex items-center justify-center gap-1.5">
                <Plane className="w-3.5 h-3.5 text-teal-600" /> Popular Destination Itineraries
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {STARTER_PROMPTS.map((starter, i) => (
                  <button
                    key={i}
                    onClick={() => onSendMessage(starter.text)}
                    className="p-3.5 rounded-2xl bg-white border border-slate-200/90 text-left hover:border-teal-400 hover:shadow-md hover:-translate-y-0.5 transition-all group shadow-2xs cursor-pointer"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-900 group-hover:text-teal-700 flex items-center gap-1.5">
                        <span>{starter.icon}</span> {starter.label}
                      </span>
                      <ArrowRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-teal-600 group-hover:translate-x-1 transition-transform" />
                    </div>
                    <p className="text-[11px] text-slate-500 line-clamp-2 mt-1.5 font-medium leading-relaxed">
                      {starter.text}
                    </p>
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : (
          messages.map((msg) => {
            const isBot = msg.role === 'assistant';
            return (
              <motion.div
                key={msg.id}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2 }}
                className={`flex gap-3 max-w-2xl ${isBot ? 'mr-auto' : 'ml-auto flex-row-reverse'}`}
              >
                {/* Avatar */}
                <div
                  className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 shadow-2xs ${
                    isBot
                      ? 'bg-linear-to-br from-teal-500 to-emerald-600 text-white'
                      : 'bg-linear-to-br from-slate-700 to-slate-900 text-white'
                  }`}
                >
                  {isBot ? <Compass className="w-4.5 h-4.5" /> : <User className="w-4.5 h-4.5" />}
                </div>

                {/* Message Bubble */}
                <div className={`space-y-2.5 max-w-[85%] ${isBot ? 'text-slate-800' : 'text-slate-900'}`}>
                  <div
                    className={`p-4 rounded-2xl text-xs sm:text-sm leading-relaxed shadow-xs transition-all ${
                      isBot
                        ? 'bg-white border border-slate-200/90 text-slate-800 rounded-tl-xs'
                        : 'bg-linear-to-r from-teal-600 via-teal-700 to-emerald-700 text-white rounded-tr-xs shadow-teal-700/10'
                    }`}
                  >
                    {isBot ? (
                      <div className="prose prose-sm max-w-none text-slate-800 space-y-2 prose-headings:font-bold prose-headings:text-slate-900 prose-a:text-teal-600 prose-table:text-xs">
                        <Markdown remarkPlugins={[remarkGfm]}>{msg.content}</Markdown>
                      </div>
                    ) : (
                      <p className="whitespace-pre-wrap font-medium">{msg.content}</p>
                    )}
                  </div>

                  {/* Plan attached card badge if assistant generated a plan */}
                  {isBot && msg.tripPlan && (
                    <div className="bg-white border border-teal-200/90 rounded-2xl p-3.5 shadow-xs flex items-center justify-between gap-3 hover:shadow-md transition-all">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-teal-50 border border-teal-200/70 text-teal-700 flex items-center justify-center shrink-0">
                          <MapPin className="w-4.5 h-4.5 text-teal-600" />
                        </div>
                        <div>
                          <div className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                            {msg.tripPlan.destination} <span className="text-teal-600">({msg.tripPlan.days} Days)</span>
                          </div>
                          <div className="text-[11px] text-slate-500 font-medium">
                            Est: <span className="font-bold text-slate-700">{msg.tripPlan.currency || '$'}{msg.tripPlan.budgetBreakdown.totalEstimated.toLocaleString()}</span> / Budget: <span className="font-bold text-teal-700">{msg.tripPlan.currency || '$'}{msg.tripPlan.userBudget.toLocaleString()}</span>
                          </div>
                        </div>
                      </div>
                      <button
                        onClick={() => onViewPlan(msg.tripPlan!)}
                        className="px-3.5 py-1.5 rounded-xl bg-linear-to-r from-teal-600 to-emerald-600 hover:from-teal-700 hover:to-emerald-700 text-white text-xs font-bold shrink-0 transition-all shadow-2xs hover:shadow-xs flex items-center gap-1 active:scale-95"
                      >
                        View Plan <ArrowRight className="w-3 h-3" />
                      </button>
                    </div>
                  )}

                  {/* Missing Parameters helper banner */}
                  {isBot && msg.missingParams && msg.missingParams.length > 0 && !msg.tripPlan && (
                    <div className="p-3 rounded-2xl bg-teal-50/70 border border-teal-200/80 text-xs text-teal-900 space-y-1.5 shadow-2xs">
                      <div className="flex items-center gap-1.5 font-bold text-[11px] text-teal-800">
                        <Sparkles className="w-3.5 h-3.5 text-teal-600" />
                        <span>Key details to finalize your travel plan:</span>
                      </div>
                      <div className="flex flex-wrap gap-1.5 pt-0.5">
                        {msg.missingParams.map((param, pIdx) => {
                          const paramLabels: Record<string, string> = {
                            destination: '📍 Destination',
                            days: '📅 Number of Days',
                            travelDates: '🗓️ Travel Dates',
                            travelers: '👥 Travelers',
                            budget: '💰 Total Budget',
                            preferences: '🎯 Preferences',
                          };
                          return (
                            <span
                              key={pIdx}
                              className="px-2.5 py-1 rounded-full bg-white border border-teal-200/80 text-[11px] font-semibold text-teal-700 shadow-2xs"
                            >
                              {paramLabels[param] || param}
                            </span>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Suggested Quick Prompt Chips */}
                  {isBot && msg.suggestedPrompts && msg.suggestedPrompts.length > 0 && (
                    <div className="pt-1 space-y-1.5">
                      <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 block px-1 flex items-center gap-1">
                        <Sparkle className="w-2.5 h-2.5 text-teal-500" /> Suggested Replies:
                      </span>
                      <div className="flex flex-wrap gap-1.5">
                        {msg.suggestedPrompts.map((prompt, sIdx) => (
                          <button
                            key={sIdx}
                            type="button"
                            onClick={() => onSendMessage(prompt)}
                            className="px-3.5 py-1.5 rounded-full bg-white hover:bg-teal-50 hover:border-teal-300 border border-slate-200 text-slate-700 hover:text-teal-800 text-xs font-semibold transition-all shadow-2xs hover:shadow-xs hover:-translate-y-0.5 text-left cursor-pointer active:scale-95"
                          >
                            {prompt}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  <span className="text-[10px] text-slate-400 block px-1 font-medium">
                    {msg.timestamp}
                  </span>
                </div>
              </motion.div>
            );
          })
        )}

        {/* Loading / Typing Bubble */}
        {isLoading && (
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex gap-3 mr-auto max-w-2xl"
          >
            <div className="w-9 h-9 rounded-xl bg-linear-to-br from-teal-500 to-emerald-600 text-white flex items-center justify-center shrink-0 shadow-2xs">
              <Compass className="w-4.5 h-4.5 animate-spin" />
            </div>
            <div className="p-4 rounded-2xl bg-white border border-slate-200/90 text-slate-700 text-xs sm:text-sm rounded-tl-xs shadow-xs flex items-center gap-3">
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-teal-500 animate-bounce [animation-delay:-0.3s]"></span>
                <span className="w-2 h-2 rounded-full bg-teal-600 animate-bounce [animation-delay:-0.15s]"></span>
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-bounce"></span>
              </div>
              <span className="font-medium text-slate-600">
                WanderWise AI is crafting your travel plan & checking live data...
              </span>
            </div>
          </motion.div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Suggested Next Questions if a plan is loaded */}
      {latestPlan && (
        <div className="px-4 sm:px-6 py-2.5 bg-white/90 backdrop-blur-xs border-t border-slate-200/80 flex items-center gap-2 overflow-x-auto no-scrollbar">
          <span className="text-[11px] text-slate-400 font-bold shrink-0 flex items-center gap-1">
            <Sparkles className="w-3 h-3 text-teal-600" /> Quick Ask:
          </span>
          {[
            'Can we make the hotel cheaper?',
            'Suggest free walking spots',
            'What if we reduce budget by $200?',
            'Recommend best local food dishes',
          ].map((prompt, i) => (
            <button
              key={i}
              onClick={() => onSendMessage(prompt)}
              className="text-xs font-semibold text-slate-700 bg-slate-100/90 hover:bg-teal-50 hover:text-teal-700 hover:border-teal-300 px-3 py-1 rounded-full border border-slate-200/80 transition-all shrink-0 shadow-2xs hover:shadow-xs active:scale-95"
            >
              {prompt}
            </button>
          ))}
        </div>
      )}

      {/* Input Area */}
      <div className="p-4 sm:p-5 bg-white border-t border-slate-200/80 shadow-xs">
        <form onSubmit={handleSubmit} className="max-w-4xl mx-auto flex items-end gap-2.5">
          <div className="flex-1 relative">
            <textarea
              ref={inputRef}
              id="chat-input"
              rows={2}
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask WanderWise AI to plan your next trip (e.g., 'Trip to Tokyo for 5 days, $2000 USD')..."
              className="w-full resize-none p-3.5 pr-10 text-xs sm:text-sm text-slate-900 bg-slate-50/80 border border-slate-300 rounded-2xl focus:outline-hidden focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 focus:bg-white transition-all placeholder:text-slate-400 shadow-2xs font-medium"
            />
          </div>

          <button
            id="send-message-btn"
            type="submit"
            disabled={!inputText.trim() || isLoading}
            className="p-3.5 sm:px-5 sm:py-3.5 rounded-2xl bg-linear-to-r from-teal-600 via-teal-700 to-emerald-600 hover:from-teal-700 hover:to-emerald-700 disabled:opacity-40 text-white font-bold text-xs sm:text-sm transition-all shadow-xs hover:shadow-md flex items-center justify-center gap-1.5 shrink-0 active:scale-95 cursor-pointer disabled:cursor-not-allowed"
            title="Send message (Enter)"
          >
            {isLoading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <>
                <span className="hidden sm:inline">Send</span>
                <Send className="w-4 h-4" />
              </>
            )}
          </button>
        </form>
        <p className="text-[11px] text-slate-400 text-center mt-2 font-medium">
          Press <kbd className="font-mono bg-slate-100 px-1.5 py-0.5 rounded text-slate-600 border border-slate-200">Enter</kbd> to send, <kbd className="font-mono bg-slate-100 px-1.5 py-0.5 rounded text-slate-600 border border-slate-200">Shift + Enter</kbd> for new line.
        </p>
      </div>
    </div>
  );
}
