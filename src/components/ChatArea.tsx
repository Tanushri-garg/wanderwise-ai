import React, { useState, useRef, useEffect } from 'react';
import Markdown from 'react-markdown';
import { Send, Bot, User, Sparkles, MapPin, DollarSign, Calendar, ArrowRight, Loader2, RefreshCw } from 'lucide-react';
import { ChatMessage, CompleteTripPlan } from '../types';

interface ChatAreaProps {
  messages: ChatMessage[];
  isLoading: boolean;
  onSendMessage: (text: string) => void;
  onViewPlan: (plan: CompleteTripPlan) => void;
  latestPlan?: CompleteTripPlan;
}

const STARTER_PROMPTS = [
  {
    label: 'Paris (3 Days, $1,200)',
    text: 'I want to plan a 3-day trip to Paris from London for 2 travelers with a total budget of $1200 USD. We love sightseeing, local food, and walking tours.',
  },
  {
    label: 'Tokyo (5 Days, $2,000)',
    text: 'Plan a 5-day cultural and foodie trip to Tokyo starting from San Francisco for 1 person with a total budget of $2000 USD in October.',
  },
  {
    label: 'Bali (7 Days, $900)',
    text: 'Help me plan a 7-day budget relaxation trip to Bali starting from Singapore for 2 people with a budget of $900 USD. We want beaches, nature, and relaxation.',
  },
  {
    label: 'Rome (4 Days, €1,100)',
    text: 'Plan a 4-day trip to Rome for 2 travelers starting from Berlin with a total budget of 1100 EUR. We want historical monuments, pizza, and walking tours.',
  },
];

export function ChatArea({
  messages,
  isLoading,
  onSendMessage,
  onViewPlan,
  latestPlan,
}: ChatAreaProps) {
  const [inputText, setInputText] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Auto-scroll on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

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
    <div className="flex flex-col h-[calc(100vh-68px)] bg-slate-50/50">
      {/* Message Stream */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
        {messages.length === 0 ? (
          <div className="max-w-xl mx-auto my-auto text-center py-8 space-y-5">
            <div className="w-14 h-14 rounded-2xl bg-teal-600 text-white mx-auto flex items-center justify-center shadow-md">
              <Sparkles className="w-7 h-7 text-teal-100" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-900 tracking-tight">
                Welcome to WanderWise AI!
              </h2>
              <p className="text-sm text-slate-600 mt-1.5 leading-relaxed max-w-md mx-auto">
                Tell me where you want to go and your budget. I’ll craft a personalized itinerary, hotel recommendations, live weather, and budget breakdown.
              </p>
            </div>

            {/* Quick Starters */}
            <div className="pt-2 text-left">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 text-center">
                Try one of these popular trips
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {STARTER_PROMPTS.map((starter, i) => (
                  <button
                    key={i}
                    onClick={() => onSendMessage(starter.text)}
                    className="p-3 rounded-xl bg-white border border-slate-200 text-left hover:border-teal-400 hover:shadow-xs transition-all group"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-900 group-hover:text-teal-700">
                        {starter.label}
                      </span>
                      <ArrowRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-teal-600 group-hover:translate-x-0.5 transition-transform" />
                    </div>
                    <p className="text-[11px] text-slate-500 line-clamp-2 mt-1">
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
              <div
                key={msg.id}
                className={`flex gap-3 max-w-2xl ${isBot ? 'mr-auto' : 'ml-auto flex-row-reverse'}`}
              >
                {/* Avatar */}
                <div
                  className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 shadow-xs ${
                    isBot ? 'bg-teal-600 text-white' : 'bg-slate-800 text-white'
                  }`}
                >
                  {isBot ? <Bot className="w-4 h-4" /> : <User className="w-4 h-4" />}
                </div>

                {/* Message Bubble */}
                <div className={`space-y-2.5 max-w-[85%] ${isBot ? 'text-slate-800' : 'text-slate-900'}`}>
                  <div
                    className={`p-4 rounded-2xl text-xs sm:text-sm leading-relaxed shadow-xs ${
                      isBot
                        ? 'bg-white border border-slate-200 text-slate-800 rounded-tl-xs'
                        : 'bg-teal-600 text-white rounded-tr-xs'
                    }`}
                  >
                    {isBot ? (
                      <div className="prose prose-sm max-w-none text-slate-800 space-y-2">
                        <Markdown>{msg.content}</Markdown>
                      </div>
                    ) : (
                      <p className="whitespace-pre-wrap">{msg.content}</p>
                    )}
                  </div>

                  {/* Plan attached card badge if assistant generated a plan */}
                  {isBot && msg.tripPlan && (
                    <div className="bg-white border border-teal-200 rounded-xl p-3 shadow-xs flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-lg bg-teal-50 text-teal-700 flex items-center justify-center shrink-0">
                          <MapPin className="w-4 h-4" />
                        </div>
                        <div>
                          <div className="text-xs font-bold text-slate-900">
                            {msg.tripPlan.destination} ({msg.tripPlan.days} Days)
                          </div>
                          <div className="text-[11px] text-slate-500">
                            Estimated: {msg.tripPlan.currency || '$'}{msg.tripPlan.budgetBreakdown.totalEstimated.toLocaleString()} / Budget: {msg.tripPlan.currency || '$'}{msg.tripPlan.userBudget.toLocaleString()}
                          </div>
                        </div>
                      </div>
                      <button
                        onClick={() => onViewPlan(msg.tripPlan!)}
                        className="px-3 py-1.5 rounded-lg bg-teal-600 hover:bg-teal-700 text-white text-xs font-medium shrink-0 transition-colors flex items-center gap-1"
                      >
                        View Plan <ArrowRight className="w-3 h-3" />
                      </button>
                    </div>
                  )}

                  <span className="text-[10px] text-slate-400 block px-1">
                    {msg.timestamp}
                  </span>
                </div>
              </div>
            );
          })
        )}

        {/* Loading Bubble */}
        {isLoading && (
          <div className="flex gap-3 mr-auto max-w-2xl">
            <div className="w-8 h-8 rounded-xl bg-teal-600 text-white flex items-center justify-center shrink-0 shadow-xs">
              <Bot className="w-4 h-4 animate-spin-slow" />
            </div>
            <div className="p-4 rounded-2xl bg-white border border-slate-200 text-slate-700 text-xs sm:text-sm rounded-tl-xs shadow-xs flex items-center gap-2.5">
              <Loader2 className="w-4 h-4 animate-spin text-teal-600" />
              <span>WanderWise AI is crafting your travel plan & checking live data...</span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Suggested Next Questions if a plan is loaded */}
      {latestPlan && (
        <div className="px-4 sm:px-6 py-2 bg-white/80 border-t border-slate-200 flex items-center gap-2 overflow-x-auto no-scrollbar">
          <span className="text-[11px] text-slate-400 font-medium shrink-0">Quick Ask:</span>
          {[
            'Can we make the hotel cheaper?',
            'Suggest free walking spots',
            'What if we reduce budget by $200?',
            'Recommend best local food dishes',
          ].map((prompt, i) => (
            <button
              key={i}
              onClick={() => onSendMessage(prompt)}
              className="text-xs text-slate-600 bg-slate-100 hover:bg-teal-50 hover:text-teal-700 px-2.5 py-1 rounded-full border border-slate-200/80 transition-colors shrink-0"
            >
              {prompt}
            </button>
          ))}
        </div>
      )}

      {/* Input Area */}
      <div className="p-4 sm:p-5 bg-white border-t border-slate-200">
        <form onSubmit={handleSubmit} className="max-w-4xl mx-auto flex items-end gap-2.5">
          <div className="flex-1 relative">
            <textarea
              ref={inputRef}
              id="chat-input"
              rows={2}
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask WanderWise AI to plan your next trip..."
              className="w-full resize-none p-3 pr-10 text-xs sm:text-sm text-slate-900 bg-slate-50 border border-slate-300 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-teal-500 focus:bg-white transition-all placeholder:text-slate-400"
            />
          </div>

          <button
            id="send-message-btn"
            type="submit"
            disabled={!inputText.trim() || isLoading}
            className="p-3 sm:px-5 sm:py-3 rounded-xl bg-teal-600 hover:bg-teal-700 disabled:opacity-50 text-white font-medium text-xs sm:text-sm transition-all shadow-xs flex items-center justify-center gap-1.5 shrink-0"
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
        <p className="text-[10px] text-slate-400 text-center mt-2">
          Press <kbd className="font-mono bg-slate-100 px-1 py-0.5 rounded text-slate-600">Enter</kbd> to send, <kbd className="font-mono bg-slate-100 px-1 py-0.5 rounded text-slate-600">Shift + Enter</kbd> for new line.
        </p>
      </div>
    </div>
  );
}
