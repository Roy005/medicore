'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import api from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { Bot, Send, User, AlertTriangle, Info, Sparkles } from 'lucide-react';

interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
  safetyFlags?: string[];
  timestamp: Date;
}

export default function AIAdvisorPage() {
  const { user } = useAuth();
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'system',
      content: 'Welcome to MediCore AI Health Advisor. I can help analyze patient data, check medication interactions, and provide clinical decision support. All responses require clinical verification.',
      timestamp: new Date(),
    },
  ]);
  const [input, setInput] = useState('');
  const [patientId, setPatientId] = useState('');
  const [loading, setLoading] = useState(false);
  const [riskScores, setRiskScores] = useState<any>(null);
  const [aiAlerts, setAiAlerts] = useState<any>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Auto-fill patient ID for self
  useEffect(() => {
    if (user?.id && !patientId) {
      handleSetPatient(user.id);
    }
  }, [user]);

  const fetchRiskScores = useCallback(async (pid: string) => {
    try {
      const res = await api.get(`/patients/${pid}/ai/risk-scores`);
      setRiskScores(res.data);
    } catch { }
  }, []);

  const fetchAiAlerts = useCallback(async (pid: string) => {
    try {
      const res = await api.get(`/patients/${pid}/ai/alerts`);
      setAiAlerts(res.data);
    } catch { }
  }, []);

  const handleSetPatient = (pid: string) => {
    setPatientId(pid);
    if (pid.length > 10) {
      fetchRiskScores(pid);
      fetchAiAlerts(pid);
    }
  };

  const handleSend = async () => {
    if (!input.trim() || !patientId) return;

    const userMsg: Message = { role: 'user', content: input, timestamp: new Date() };
    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    try {
      // Map previous messages to conversationHistory format requested by backend
      const conversationHistory = messages
        .filter(m => m.role !== 'system') // Maybe exclude system? Or Keep it
        .map(m => ({ role: m.role, content: m.content }));

      const res = await api.post(`/patients/${patientId}/ai/chat`, {
        message: input,
        conversationHistory,
      });

      const assistantMsg: Message = {
        role: 'assistant',
        content: res.data.reply,
        safetyFlags: res.data.safetyFlag ? ['Safety Alert Triggered'] : undefined,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, assistantMsg]);
    } catch (err: any) {
      console.error(err);
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: 'Sorry, the AI service is temporarily unavailable. Please try again later.',
          timestamp: new Date(),
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const riskColor = (level: string) =>
    level === 'high' ? 'text-[#ba1a1a]' : level === 'moderate' ? 'text-orange-500' : 'text-[#4CAF82]';
  const riskBg = (level: string) =>
    level === 'high' ? 'bg-[#ffdad6]' : level === 'moderate' ? 'bg-orange-50' : 'bg-green-50';

  return (
    <div className="flex gap-6 h-[calc(100vh-8rem)]">
      {/* Chat Panel */}
      <div className="flex-1 flex flex-col bg-white rounded-lg shadow-[0px_12px_32px_rgba(25,28,29,0.04)] overflow-hidden">
        {/* Chat Header */}
        <div className="px-6 py-4 border-b border-[#e6e8e9] flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-[#005454] to-[#0d6e6e] flex items-center justify-center">
            <Bot className="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 className="font-semibold text-[#191c1d]">AI Health Advisor</h2>
            <p className="text-xs text-[#6e7979]">Clinical decision support · Not a diagnosis tool</p>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-[#005454]" />
            <span className="text-xs text-[#6e7979]">Powered by MediCore AI</span>
          </div>
        </div>

        {/* Patient ID Input */}
        <div className="px-6 py-3 bg-[#f8fafb] border-b border-[#e6e8e9]">
          <div className="flex items-center gap-2">
            <label className="text-xs font-semibold text-[#3e4948]">Patient ID:</label>
            <input
              type="text"
              value={patientId}
              onChange={(e) => handleSetPatient(e.target.value)}
              className="flex-1 bg-[#e1e3e4] rounded px-3 py-1.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-[#005454]"
              placeholder="Enter patient UUID..."
              style={{ fontFamily: 'JetBrains Mono, monospace' }}
            />
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {messages.map((msg, i) => (
            <div key={i} className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : ''}`}>
              {msg.role !== 'user' && (
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                  msg.role === 'system' ? 'bg-[#4c5f7e]/10' : 'bg-gradient-to-br from-[#005454] to-[#0d6e6e]'
                }`}>
                  {msg.role === 'system' ? (
                    <Info className="w-4 h-4 text-[#4c5f7e]" />
                  ) : (
                    <Bot className="w-4 h-4 text-white" />
                  )}
                </div>
              )}
              <div className={`max-w-[75%] rounded-lg px-4 py-3 ${
                msg.role === 'user'
                  ? 'bg-gradient-to-r from-[#005454] to-[#0d6e6e] text-white'
                  : msg.role === 'system'
                  ? 'bg-[#f2f4f5] text-[#3e4948]'
                  : 'bg-[#f8fafb] text-[#191c1d] border border-[#e6e8e9]'
              }`}>
                <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                {msg.safetyFlags && msg.safetyFlags.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {msg.safetyFlags.map((flag, fi) => (
                      <span key={fi} className="inline-flex items-center gap-1 text-xs bg-[#ffdad6] text-[#ba1a1a] rounded px-2 py-0.5">
                        <AlertTriangle className="w-3 h-3" />
                        {flag}
                      </span>
                    ))}
                  </div>
                )}
                <span className="text-[10px] opacity-50 mt-1 block font-mono" style={{ fontFamily: 'JetBrains Mono, monospace' }}>
                  {msg.timestamp.toLocaleTimeString()}
                </span>
              </div>
              {msg.role === 'user' && (
                <div className="w-8 h-8 rounded-lg bg-[#E8533A] flex items-center justify-center flex-shrink-0">
                  <User className="w-4 h-4 text-white" />
                </div>
              )}
            </div>
          ))}
          {loading && (
            <div className="flex gap-3">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#005454] to-[#0d6e6e] flex items-center justify-center">
                <Bot className="w-4 h-4 text-white" />
              </div>
              <div className="bg-[#f8fafb] rounded-lg px-4 py-3 border border-[#e6e8e9]">
                <div className="flex gap-1">
                  <div className="w-2 h-2 bg-[#005454] rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                  <div className="w-2 h-2 bg-[#005454] rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                  <div className="w-2 h-2 bg-[#005454] rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input Bar */}
        <div className="px-6 py-4 border-t border-[#e6e8e9] bg-white">
          <div className="flex gap-3">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
              className="flex-1 bg-[#e1e3e4] rounded-lg px-4 py-3 text-sm text-[#191c1d] focus:outline-none focus:ring-2 focus:ring-[#005454]"
              placeholder={patientId ? 'Ask about this patient...' : 'Enter a Patient ID first...'}
              disabled={!patientId || loading}
            />
            <button
              onClick={handleSend}
              disabled={!input.trim() || !patientId || loading}
              className="px-4 py-3 bg-gradient-to-r from-[#005454] to-[#0d6e6e] text-white rounded-lg disabled:opacity-50 hover:shadow-lg transition-all"
            >
              <Send className="w-5 h-5" />
            </button>
          </div>
          <p className="text-[10px] text-[#bec9c8] mt-2 text-center">
            AI-generated responses require clinical verification. This is not a diagnostic tool.
          </p>
        </div>
      </div>

      {/* Side Panel — Risk Scores & AI Alerts */}
      <div className="w-80 flex-shrink-0 space-y-4 overflow-y-auto">
        {/* Risk Scores */}
        <div className="bg-white rounded-lg shadow-[0px_12px_32px_rgba(25,28,29,0.04)] p-5">
          <h3 className="font-semibold text-[#191c1d] text-sm mb-3">Risk Assessment</h3>
          {riskScores ? (
            <div className="space-y-4">
              {['cardiovascular', 'diabetes'].map((key) => {
                const score = riskScores[key];
                if (!score) return null;
                return (
                  <div key={key}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs text-[#3e4948] capitalize">{key === 'diabetes' ? 'Diabetes' : key}</span>
                      <span className={`text-xs font-bold uppercase ${riskColor(score.level)}`}>{score.level}</span>
                    </div>
                    <div className="w-full bg-[#e6e8e9] rounded-full h-2">
                      <div
                        className={`h-2 rounded-full transition-all duration-500 ${
                          score.level === 'high' ? 'bg-[#ba1a1a]' :
                          score.level === 'moderate' ? 'bg-orange-500' : 'bg-[#4CAF82]'
                        }`}
                        style={{ width: `${score.score}%` }}
                      />
                    </div>
                    <span className="text-lg font-mono font-bold text-[#191c1d]" style={{ fontFamily: 'JetBrains Mono, monospace' }}>
                      {score.score}%
                    </span>
                  </div>
                );
              })}
              <p className="text-[10px] text-[#bec9c8] italic">{riskScores.cardiovascular?.explanation || riskScores.disclaimer}</p>
            </div>
          ) : (
            <p className="text-xs text-[#6e7979]">{patientId ? 'Loading...' : 'Enter a Patient ID to view risk scores.'}</p>
          )}
        </div>

        {/* AI Alerts */}
        <div className="bg-white rounded-lg shadow-[0px_12px_32px_rgba(25,28,29,0.04)] p-5">
          <h3 className="font-semibold text-[#191c1d] text-sm mb-3">AI Flags</h3>
          {aiAlerts ? (
            <div className="space-y-2">
              {aiAlerts.flags?.map((flag: string, i: number) => (
                <div key={i} className="text-xs text-[#3e4948] bg-[#f8fafb] rounded-lg px-3 py-2 flex items-start gap-2">
                  <Sparkles className="w-3 h-3 text-[#005454] mt-0.5 flex-shrink-0" />
                  {flag}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-[#6e7979]">{patientId ? 'Loading...' : 'Enter a Patient ID to view AI flags.'}</p>
          )}
        </div>

        {/* Quick Actions */}
        <div className="bg-white rounded-lg shadow-[0px_12px_32px_rgba(25,28,29,0.04)] p-5">
          <h3 className="font-semibold text-[#191c1d] text-sm mb-3">Quick Prompts</h3>
          <div className="space-y-2">
            {[
              'Check drug interactions for current medications',
              'Summarize latest vital trends',
              'Any allergy cross-reactivity concerns?',
              'Review blood pressure history',
            ].map((prompt, i) => (
              <button
                key={i}
                onClick={() => {
                  setInput(prompt);
                }}
                className="w-full text-left text-xs py-2 px-3 bg-[#f8fafb] rounded-lg hover:bg-[#e6e8e9] text-[#3e4948] transition-colors"
              >
                {prompt}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
