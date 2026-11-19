import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { api, type ChatQueryResponse } from '../../services/api';

const PRESET_QUESTIONS = [
  'What needs my attention today?',
  'Show overdue approvals',
  'Show pending Purchase requests',
  'Show pending Maintenance requests',
  'Which requests are pending at Finance?',
  'Which requests have no assigned approver?',
  'Which department has the highest pending workload?',
  'Which requests have been waiting more than 24 hours?',
];

interface ChatMessage {
  id: string;
  sender: 'user' | 'assistant';
  text: string;
  verifiedData?: ChatQueryResponse['verifiedData'];
  disclaimer?: string;
  suggestedFollowUps?: string[];
  timestamp: string;
}

export const ApprovalIntelligenceChat: React.FC = () => {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      sender: 'assistant',
      text: 'Hello Administrator. I am your read-only Approval Intelligence Assistant. Ask me questions regarding pending hospital approval queues, bottlenecked departments, or specific request delays.',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      suggestedFollowUps: [
        'What needs my attention today?',
        'Show overdue approvals',
        'Which requests are potentially stuck?',
      ],
    },
  ]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSend = async (queryToSend?: string) => {
    const q = (queryToSend || inputText).trim();
    if (!q || isLoading) return;

    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      sender: 'user',
      text: q,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputText('');
    setIsLoading(true);

    try {
      const res = await api.postIntelligenceChat(q);
      const assistantMsg: ChatMessage = {
        id: `assistant-${Date.now()}`,
        sender: 'assistant',
        text: res.data.textAnswer,
        verifiedData: res.data.verifiedData,
        disclaimer: res.data.disclaimer,
        suggestedFollowUps: res.data.suggestedFollowUps,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages((prev) => [...prev, assistantMsg]);
    } catch (err: any) {
      const errorMsg: ChatMessage = {
        id: `err-${Date.now()}`,
        sender: 'assistant',
        text: `Error processing query: ${err.message || 'Unable to retrieve answer'}. Please try again.`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-xs flex flex-col h-[600px] overflow-hidden text-left">
      {/* Header */}
      <div className="p-4 border-b border-slate-100 bg-slate-50/75 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-blue-700 text-white flex items-center justify-center font-bold text-sm shadow-xs">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
            </svg>
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900">
              Approval Intelligence Assistant
            </h3>
            <p className="text-[11px] text-slate-500">
              Constrained Factual Administrative Q&A • Strictly Read-Only
            </p>
          </div>
        </div>
        <span className="text-[10px] font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200 px-2 py-0.5 rounded">
          Active
        </span>
      </div>

      {/* Preset Starters Bar */}
      <div className="px-4 py-2 bg-slate-50 border-b border-slate-100 flex items-center gap-1.5 overflow-x-auto text-xs scrollbar-none">
        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex-shrink-0">
          Quick Queries:
        </span>
        {PRESET_QUESTIONS.map((pq, idx) => (
          <button
            key={idx}
            type="button"
            disabled={isLoading}
            onClick={() => handleSend(pq)}
            className="px-2.5 py-1 bg-white hover:bg-blue-50 hover:text-blue-700 hover:border-blue-200 text-slate-600 text-[11px] font-medium rounded-full border border-slate-200 transition-colors whitespace-nowrap shadow-2xs"
          >
            {pq}
          </button>
        ))}
      </div>

      {/* Messages Thread */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((m) => {
          const isUser = m.sender === 'user';
          return (
            <div
              key={m.id}
              className={`flex flex-col ${isUser ? 'items-end' : 'items-start'}`}
            >
              <div
                className={`max-w-2xl rounded-xl p-3.5 text-xs ${
                  isUser
                    ? 'bg-blue-700 text-white rounded-br-none shadow-xs'
                    : 'bg-slate-50 border border-slate-200 text-slate-800 rounded-bl-none shadow-2xs'
                }`}
              >
                <p className="leading-relaxed whitespace-pre-wrap">{m.text}</p>

                {/* Verified Data Records Embed */}
                {m.verifiedData?.requests && m.verifiedData.requests.length > 0 && (
                  <div className="mt-3 pt-2.5 border-t border-slate-200 space-y-2">
                    <span className="text-[10px] font-bold text-slate-500 uppercase block">
                      Verified System Records ({m.verifiedData.requests.length}):
                    </span>
                    <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
                      {m.verifiedData.requests.map((r) => (
                        <div
                          key={r.id}
                          className="p-2 bg-white rounded border border-slate-200 flex items-center justify-between text-[11px]"
                        >
                          <div className="min-w-0 flex-1 pr-2">
                            <span className="font-mono font-bold text-slate-800 mr-2">
                              {r.referenceNumber}
                            </span>
                            <span className="text-slate-600 truncate">{r.title}</span>
                            <span className="text-slate-400 block text-[10px]">
                              {r.departmentName} • {r.currentStageName} ({r.timeAtCurrentStageFormatted})
                            </span>
                          </div>
                          <Link
                            to={`/request/${r.id}`}
                            className="px-2 py-1 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded text-[10px] font-bold flex-shrink-0"
                          >
                            View →
                          </Link>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Department Workload Embed */}
                {m.verifiedData?.metrics?.departments && (
                  <div className="mt-3 pt-2.5 border-t border-slate-200 space-y-1 text-[11px]">
                    <span className="text-[10px] font-bold text-slate-500 uppercase block">
                      Department Pending Volume:
                    </span>
                    {m.verifiedData.metrics.departments.map((d: any, idx: number) => (
                      <div
                        key={idx}
                        className="flex justify-between py-1 border-b border-slate-100 last:border-0"
                      >
                        <span className="font-medium text-slate-700">{d.name}</span>
                        <span className="font-bold text-slate-900">{d.count} pending</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Disclaimer */}
                {m.disclaimer && (
                  <p className="mt-2 text-[10px] text-slate-400 italic flex items-center gap-1">
                    <svg className="w-3 h-3 text-slate-400 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                    </svg>
                    <span>{m.disclaimer}</span>
                  </p>
                )}
              </div>

              {/* Follow-up suggestions */}
              {m.suggestedFollowUps && m.suggestedFollowUps.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {m.suggestedFollowUps.map((fu, idx) => (
                    <button
                      key={idx}
                      type="button"
                      disabled={isLoading}
                      onClick={() => handleSend(fu)}
                      className="text-[10px] text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 px-2 py-0.5 rounded-full font-medium transition-colors"
                    >
                      {fu}
                    </button>
                  ))}
                </div>
              )}

              <span className="text-[10px] text-slate-400 mt-1 px-1">
                {m.timestamp}
              </span>
            </div>
          );
        })}

        {isLoading && (
          <div className="flex items-center gap-2 text-xs text-slate-500 p-3 bg-slate-50 rounded-xl border border-slate-200 max-w-xs">
            <div className="w-4 h-4 border-2 border-blue-700 border-t-transparent rounded-full animate-spin" />
            <span>Consulting hospital records...</span>
          </div>
        )}
      </div>

      {/* Input Bar */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleSend();
        }}
        className="p-3 border-t border-slate-200 bg-white flex items-center gap-2"
      >
        <input
          type="text"
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          placeholder="Ask about hospital approval queues, delays, or specific requests..."
          className="flex-1 px-3 py-2 text-xs border border-slate-300 rounded-md focus:outline-none focus:border-blue-700 bg-white"
          disabled={isLoading}
        />
        <button
          type="submit"
          disabled={isLoading || !inputText.trim()}
          className="px-4 py-2 bg-blue-700 hover:bg-blue-800 disabled:bg-slate-300 text-white text-xs font-semibold rounded-md transition-colors shadow-xs"
        >
          Send
        </button>
      </form>
    </div>
  );
};
