'use client';

import { useState, useEffect, useCallback } from 'react';
import api from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { BarChart3, Heart, Activity, AlertTriangle, Info, TrendingUp, Shield, Sparkles } from 'lucide-react';

export default function RiskScoresPage() {
  const { user } = useAuth();
  const [patientId, setPatientId] = useState('');
  const [riskScores, setRiskScores] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const storedPatientId = typeof window !== 'undefined' ? localStorage.getItem('clinicalPatientId') : null;

  useEffect(() => {
    if (storedPatientId) {
      setPatientId(storedPatientId);
      fetchRiskScores(storedPatientId);
    }
  }, [storedPatientId]);

  const fetchRiskScores = async (pid: string) => {
    setLoading(true);
    try {
      const res = await api.get(`/patients/${pid}/ai/risk-scores`);
      setRiskScores(res.data);
    } catch {}
    setLoading(false);
  };

  const handleSubmit = () => {
    if (patientId.length > 10) fetchRiskScores(patientId);
  };

  const riskColor = (level: string) =>
    level === 'high' ? '#ba1a1a' : level === 'moderate' ? '#E8533A' : '#4CAF82';
  const riskBg = (level: string) =>
    level === 'high' ? '#ffdad6' : level === 'moderate' ? 'rgba(232,83,58,0.08)' : 'rgba(76,175,130,0.08)';
  const riskBarColor = (level: string) =>
    level === 'high' ? '#ba1a1a' : level === 'moderate' ? '#E8533A' : '#4CAF82';

  const riskCategories = riskScores ? [
    { key: 'cardiovascular', label: 'Cardiovascular', icon: Heart, description: '10-year cardiovascular disease risk based on Framingham Risk Score model.' },
    { key: 'type2Diabetes', label: 'Type 2 Diabetes', icon: Activity, description: 'Risk assessment based on fasting glucose, BMI, family history, and lifestyle factors.' },
  ] : [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#191c1d]">Risk Score Overview</h1>
        <p className="text-sm text-[#3e4948] mt-1">AI-powered clinical risk assessment for cardiovascular disease and diabetes.</p>
      </div>

      {/* Patient ID Input */}
      <div className="bg-white rounded-lg shadow-[0px_12px_32px_rgba(25,28,29,0.04)] p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-9 h-9 rounded-lg bg-[#005454]/10 flex items-center justify-center">
            <BarChart3 className="w-5 h-5 text-[#005454]" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-[#191c1d]">Patient Risk Analysis</h2>
            <p className="text-xs text-[#6e7979]">Enter a patient ID to generate risk scores</p>
          </div>
        </div>
        <div className="flex gap-3">
          <input
            type="text"
            value={patientId}
            onChange={(e) => setPatientId(e.target.value)}
            placeholder="Enter patient UUID..."
            className="flex-1 px-4 py-3 rounded-lg text-sm text-[#191c1d] font-mono placeholder:text-[#bec9c8] placeholder:font-sans focus:outline-none focus:ring-2 focus:ring-[#005454]"
            style={{ backgroundColor: '#e1e3e4' }}
          />
          <button
            onClick={handleSubmit}
            disabled={loading || patientId.length < 10}
            className="px-6 py-3 bg-gradient-to-r from-[#005454] to-[#0d6e6e] text-white text-sm font-semibold rounded-lg hover:shadow-lg disabled:opacity-50 transition-all"
          >
            {loading ? 'Analyzing...' : 'Analyze'}
          </button>
        </div>
      </div>

      {/* Risk Scores */}
      {riskScores && (
        <div className="grid gap-6 md:grid-cols-2">
          {riskCategories.map(({ key, label, icon: Icon, description }) => {
            const score = riskScores[key];
            if (!score) return null;
            return (
              <div key={key} className="bg-white rounded-lg shadow-[0px_12px_32px_rgba(25,28,29,0.04)] p-6">
                <div className="flex items-center gap-3 mb-5">
                  <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${riskColor(score.level)}15` }}>
                    <Icon className="w-5 h-5" style={{ color: riskColor(score.level) }} />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-base font-semibold text-[#191c1d]">{label}</h3>
                    <p className="text-xs text-[#6e7979]">{description}</p>
                  </div>
                </div>

                {/* Score Display */}
                <div className="text-center py-4">
                  <p className="text-5xl font-bold font-mono" style={{ color: riskColor(score.level) }}>
                    {score.score}
                    <span className="text-lg">%</span>
                  </p>
                  <span className="inline-block mt-2 px-3 py-1 rounded-full text-xs font-bold uppercase" style={{ backgroundColor: riskBg(score.level), color: riskColor(score.level) }}>
                    {score.level} risk
                  </span>
                </div>

                {/* Progress Bar */}
                <div className="mt-4">
                  <div className="w-full bg-[#e6e8e9] rounded-full h-2.5">
                    <div
                      className="h-2.5 rounded-full transition-all duration-700"
                      style={{ width: `${score.score}%`, backgroundColor: riskBarColor(score.level) }}
                    />
                  </div>
                  <div className="flex justify-between mt-1.5">
                    <span className="text-[10px] text-[#4CAF82] font-semibold">Low</span>
                    <span className="text-[10px] text-[#E8533A] font-semibold">Moderate</span>
                    <span className="text-[10px] text-[#ba1a1a] font-semibold">High</span>
                  </div>
                </div>

                {/* Contributing Factors */}
                {score.factors && score.factors.length > 0 && (
                  <div className="mt-5 space-y-2">
                    <p className="text-xs font-semibold text-[#3e4948]">Contributing Factors</p>
                    {score.factors.map((factor: string, i: number) => (
                      <div key={i} className="flex items-start gap-2 text-xs text-[#3e4948] py-1">
                        <TrendingUp className="w-3 h-3 text-[#6e7979] mt-0.5 flex-shrink-0" />
                        {factor}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Disclaimer */}
      {riskScores && (
        <div className="bg-[#f2f4f5] rounded-lg p-5 flex items-start gap-3">
          <Info className="w-4 h-4 text-[#6e7979] mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-xs text-[#3e4948] font-medium">Clinical Disclaimer</p>
            <p className="text-xs text-[#6e7979] mt-1">
              {riskScores.disclaimer || 'These risk scores are AI-generated estimates for clinical decision support only. They are not diagnostic and should be verified by a licensed healthcare professional.'}
            </p>
          </div>
        </div>
      )}

      {/* Empty State */}
      {!riskScores && !loading && (
        <div className="bg-white rounded-lg shadow-[0px_12px_32px_rgba(25,28,29,0.04)] p-12 text-center">
          <BarChart3 className="w-12 h-12 mx-auto text-[#bec9c8] mb-4" />
          <h3 className="text-base font-semibold text-[#191c1d] mb-1">No risk data yet</h3>
          <p className="text-sm text-[#6e7979] max-w-sm mx-auto">
            Enter a patient ID above to generate AI-powered risk scores for cardiovascular disease and type 2 diabetes.
          </p>
        </div>
      )}
    </div>
  );
}
