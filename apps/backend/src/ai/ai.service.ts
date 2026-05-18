import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { GoogleGenerativeAI } from '@google/generative-ai';
import axios from 'axios';

import { Medication, Allergy, Diagnosis, Vital, PatientProfile, AuditLog } from '../entities';
import { Document } from '../entities/document.entity';

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);

  private getAiServiceUrl(): string {
    return this.configService.get<string>('AI_SERVICE_URL') || 'http://localhost:8001';
  }

  constructor(
    @InjectRepository(Medication)
    private readonly medicationRepo: Repository<Medication>,
    @InjectRepository(Allergy)
    private readonly allergyRepo: Repository<Allergy>,
    @InjectRepository(Diagnosis)
    private readonly diagnosisRepo: Repository<Diagnosis>,
    @InjectRepository(Vital)
    private readonly vitalRepo: Repository<Vital>,
    @InjectRepository(PatientProfile)
    private readonly profileRepo: Repository<PatientProfile>,
    @InjectRepository(AuditLog)
    private readonly auditRepo: Repository<AuditLog>,
    @InjectRepository(Document)
    private readonly documentRepo: Repository<Document>,
    private readonly configService: ConfigService,
  ) {}

  private async getPatientContext(patientId: string) {
    const profile = await this.profileRepo.findOne({ where: { user_id: patientId } });
    const activeMedications = await this.medicationRepo.find({ where: { patient_id: patientId, is_active: true } });
    let allergies: Allergy[] = [];
    try { allergies = await this.allergyRepo.find({ where: { patient_id: patientId } }); } catch(e) {}
    
    let activeConditions: Diagnosis[] = [];
    try { activeConditions = await this.diagnosisRepo.find({ where: { patient_id: patientId, status: 'active' as any } }); } catch(e) {}

    const metrics = ['heart_rate', 'blood_pressure_systolic', 'blood_pressure_diastolic', 'spo2', 'blood_glucose', 'weight'];
    const vitalsPromises = metrics.map(metric => 
      this.vitalRepo.findOne({
        where: { patient_id: patientId, metric_type: metric },
        order: { recorded_at: 'DESC' },
      })
    );
    const resolvedVitals = await Promise.all(vitalsPromises);
    
    const latestVitals: Record<string, any> = {
      heart_rate: null,
      bp_systolic: null,
      bp_diastolic: null,
      spo2: null,
      glucose: null,
      weight: null,
    };
    
    resolvedVitals.forEach(v => {
      if (!v) return;
      let key = '';
      if (v.metric_type === 'heart_rate') key = 'heart_rate';
      if (v.metric_type === 'blood_pressure_systolic') key = 'bp_systolic';
      if (v.metric_type === 'blood_pressure_diastolic') key = 'bp_diastolic';
      if (v.metric_type === 'spo2') key = 'spo2';
      if (v.metric_type === 'blood_glucose') key = 'glucose';
      if (v.metric_type === 'weight') key = 'weight';
      if (key) {
        latestVitals[key] = {
          value: v.value,
          unit: v.unit,
          recordedAt: v.recorded_at,
        };
      }
    });

    let age: number | null = null;
    if (profile && profile.date_of_birth) {
      const dob = new Date(profile.date_of_birth);
      const diff = Date.now() - dob.getTime();
      age = Math.floor(diff / (1000 * 60 * 60 * 24 * 365.25));
    }

    // 7. Uploaded Documents (extracted text)
    let uploadedDocs: {name: string; type: string; content: string}[] = [];
    try {
      const documents = await this.documentRepo.find({
        where: { patient_id: patientId, extraction_status: 'completed' },
        select: ['original_name', 'document_type', 'extracted_text', 'upload_date'],
        order: { upload_date: 'DESC' },
        take: 10,
      });
      uploadedDocs = documents
        .filter(d => d.extracted_text)
        .map(d => ({
          name: d.original_name,
          type: d.document_type,
          content: d.extracted_text!.substring(0, 2000),
        }));
    } catch (e) {
      // documents table may not have extracted_text column yet
    }

    return {
      bloodGroup: profile?.blood_group || 'Unknown',
      age,
      activeMedications: activeMedications.map(m => ({
        name: m.drug_name,
        dosage: m.dosage,
        frequency: m.frequency,
      })),
      allergies: allergies.map(a => ({
        allergen: a.allergen,
        severity: a.severity,
        reaction: a.reaction_description,
      })),
      activeConditions: activeConditions.map(c => ({
        icd10_code: c.icd10_code,
        description: c.icd10_description,
      })),
      latestVitals,
      uploadedDocs,
    };
  }

  async chat(patientId: string, message: string, conversationHistory: {role: string, content: string}[]) {
    // 1. Try Python AI Service
    try {
      const aiServiceUrl = this.getAiServiceUrl();
      const response = await axios.post(`${aiServiceUrl}/ai/advisor/chat`, {
        patientId,
        message,
        conversationHistory
      }, { timeout: 15000 });
      
      if (response.data && response.data.reply) {
        return {
          reply: response.data.reply,
          safetyFlag: response.data.safetyFlag || false,
          sources: response.data.sources ? response.data.sources.map((s: any) => s.title) : [],
        };
      }
    } catch (error: any) {
      const isRateLimit = error?.response?.status === 429;
      this.logger.warn(`Python AI service unavailable for chat (${isRateLimit ? 'rate limited' : error.message}), falling back to local adapter`);
      if (isRateLimit) {
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }

    // 2. Fallback: Local Dual-LLM (Gemini primary → OpenRouter)
    try {
      const context = await this.getPatientContext(patientId);

      const contextString = `
Blood Type: ${context.bloodGroup}
Age: ${context.age ?? 'Unknown'}

ACTIVE MEDICATIONS:
${context.activeMedications.length > 0 
  ? context.activeMedications.map(m => 
    `- ${m.name} ${m.dosage || ''} ${m.frequency || ''}`).join('\n')
  : '- None recorded'}

ALLERGIES:
${context.allergies.length > 0
  ? context.allergies.map(a => 
    `- ${a.allergen} (${a.severity})${a.reaction ? ': ' + a.reaction : ''}`).join('\n')
  : '- None recorded'}

ACTIVE CONDITIONS:
${context.activeConditions.length > 0
  ? context.activeConditions.map(d => 
    `- ${d.description} (${d.icd10_code})`).join('\n')
  : '- None recorded'}

RECENT VITALS:
${Object.entries(context.latestVitals)
  .filter(([_, v]) => v !== null)
  .map(([metric, v]) => `- ${metric}: ${v.value} ${v.unit}`)
  .join('\n') || '- No recent vitals'}

UPLOADED DOCUMENTS:
${context.uploadedDocs.length > 0
  ? context.uploadedDocs.map(d =>
    `--- ${d.name} (${d.type}) ---\n${d.content}`).join('\n\n')
  : '- No documents uploaded'}
`;

      const SYSTEM_PROMPT = `You are MediCore Health Advisor, a health information assistant. You have access to this patient's personal health records shown below.

ABSOLUTE RULES — violating any rule is a critical failure:
1. NEVER diagnose. Say "I notice X in your records" — NEVER say "You have X" or "This means you have X" or "You may have X"
2. ALWAYS recommend physician consultation for any clinical question
3. NEVER suggest changing a prescribed dosage under any circumstances
4. If the patient mentions self-harm, suicide, wanting to die, or giving up on life: respond ONLY with exactly this message: "I'm concerned about what you've shared. Please contact iCall at 9152987821 or a trusted person right now. I cannot help with this — a real person can." — nothing else
5. Keep responses under 3 paragraphs
6. End every response that involves a clinical question with: "Please discuss this with your doctor before making any changes."
7. Express uncertainty explicitly: use "Based on your records, I can see..." not "This means..." or "You should..."
8. For questions about THIS PATIENT: base every claim on the patient records below.
   For GENERAL medical questions (drug info, disease basics, health tips): use your medical knowledge and clearly label it as general information, not specific to this patient.

PATIENT HEALTH RECORDS:
${contextString}`;

      const messages = [
        { role: 'system', content: SYSTEM_PROMPT },
        ...conversationHistory.map(msg => ({
          role: msg.role === 'assistant' ? 'assistant' : 'user',
          content: msg.content,
        })),
        { role: 'user', content: message },
      ];

      // 2a. Try Gemini first
      const geminiKey = this.configService.get<string>('GEMINI_API_KEY');
      if (geminiKey) {
        try {
          const genAI = new GoogleGenerativeAI(geminiKey);
          const model = genAI.getGenerativeModel({ 
            model: 'gemini-2.5-flash',
            systemInstruction: SYSTEM_PROMPT,
            generationConfig: {
              maxOutputTokens: 1000,
              temperature: 0.3,
            }
          });

          const history = conversationHistory.map(msg => ({
            role: msg.role === 'assistant' ? 'model' : 'user',
            parts: [{ text: msg.content }]
          }));

          const chat = model.startChat({ history });
          const result = await chat.sendMessage(message);
          const reply = result.response.text();

          const safetyKeywords = ['icall', '9152987821', 'concerned about what you shared', 'real person can'];
          const safetyFlag = safetyKeywords.some(keyword => reply.toLowerCase().includes(keyword.toLowerCase()));

          this.logger.log('✓ Response from Gemini fallback adapter');
          return { reply, safetyFlag, sources: ['Patient Health Records'] };
        } catch (geminiErr: any) {
          this.logger.warn(`Gemini fallback failed (${geminiErr.message}), trying OpenRouter...`);
        }
      }

      // 2b. Fallback to OpenRouter
      const openrouterKey = this.configService.get<string>('OPENROUTER_API_KEY') || '';
      const openrouterModel = this.configService.get<string>('OPENROUTER_MODEL') || 'nvidia/nemotron-3-nano-30b-a3b:free';

      // Truncate system prompt for smaller model context window
      const truncatedMessages = [
        { role: 'system', content: SYSTEM_PROMPT.length > 6000 ? SYSTEM_PROMPT.substring(0, 6000) + '\n...(truncated)' : SYSTEM_PROMPT },
        ...conversationHistory.slice(-6).map(msg => ({
          role: msg.role === 'assistant' ? 'assistant' : 'user',
          content: msg.content,
        })),
        { role: 'user', content: message },
      ];

      const response = await axios.post(
        'https://openrouter.ai/api/v1/chat/completions',
        {
          model: openrouterModel,
          messages: truncatedMessages,
          max_tokens: 800,
          temperature: 0.3,
        },
        {
          headers: {
            'Authorization': `Bearer ${openrouterKey}`,
            'Content-Type': 'application/json',
            'HTTP-Referer': 'https://medicore-ebon.vercel.app',
            'X-Title': 'MediCore AI Health Advisor',
          },
          timeout: 30000,
        },
      );

      const reply = response.data.choices[0].message.content;

      const safetyKeywords = ['icall', '9152987821', 'concerned about what you shared', 'real person can'];
      const safetyFlag = safetyKeywords.some(keyword => 
        reply.toLowerCase().includes(keyword.toLowerCase())
      );

      this.logger.log('✓ Response from OpenRouter fallback adapter');
      return { reply, safetyFlag, sources: ['Patient Health Records'] };
    } catch (error: any) {
      this.logger.error('All LLM providers failed', error?.response?.data || error?.message || error);
      return { 
        reply: "I'm temporarily unavailable. Please try again shortly.", 
        safetyFlag: false, 
        sources: [] 
      };
    }
  }

  async getRiskScores(patientId: string) {
    // 1. Try Python AI Service
    try {
      const aiServiceUrl = this.getAiServiceUrl();
      const response = await axios.get(`${aiServiceUrl}/ai/patients/${patientId}/risk-scores`, {
        timeout: 8000
      });
      
      if (response.data && response.data.cardiovascular && response.data.diabetes) {
        return response.data;
      }
    } catch (error: any) {
      this.logger.warn(`Python AI service unavailable for risk scores, falling back to local logic: ${error.message}`);
    }

    // 2. Fallback to Local Scoring Algorithm
    try {
      const profile = await this.profileRepo.findOne({ where: { user_id: patientId } });
      let activeDiagnoses: Diagnosis[] = [];
      try { activeDiagnoses = await this.diagnosisRepo.find({ where: { patient_id: patientId, status: 'active' as any } }); } catch(e) {}
      
      let activeMedications: Medication[] = [];
      try { activeMedications = await this.medicationRepo.find({ where: { patient_id: patientId, is_active: true } }); } catch(e) {}
      
      const bpVitals = await this.vitalRepo.find({
        where: { patient_id: patientId, metric_type: 'blood_pressure_systolic' },
        order: { recorded_at: 'DESC' },
        take: 30,
      });

      const glucoseVitals = await this.vitalRepo.find({
        where: { patient_id: patientId, metric_type: 'blood_glucose' },
        order: { recorded_at: 'DESC' },
        take: 30,
      });

      let age = 45;
      if (profile && profile.date_of_birth) {
        const dob = new Date(profile.date_of_birth);
        const diff = Date.now() - dob.getTime();
        age = Math.floor(diff / (1000 * 60 * 60 * 24 * 365.25));
      }

      // CARDIOVASCULAR SCORE
      let cvScore = 0;
      const cvFactors: any[] = [];

      let avgBP = 120;
      if (bpVitals.length > 0) {
        avgBP = bpVitals.reduce((sum, v) => sum + Number(v.value), 0) / bpVitals.length;
      }

      if (avgBP > 180) {
        cvScore += 30;
        cvFactors.push({ factor: "Blood pressure", contribution: 30, direction: "high", explanation: `Average systolic BP ${Math.round(avgBP)} mmHg — severely elevated` });
      } else if (avgBP > 160) {
        cvScore += 22;
        cvFactors.push({ factor: "Blood pressure", contribution: 22, direction: "high", explanation: `Average systolic BP ${Math.round(avgBP)} mmHg — significantly elevated` });
      } else if (avgBP > 140) {
        cvScore += 15;
        cvFactors.push({ factor: "Blood pressure", contribution: 15, direction: "high", explanation: `Average systolic BP ${Math.round(avgBP)} mmHg — elevated` });
      } else if (avgBP > 130) {
        cvScore += 8;
        cvFactors.push({ factor: "Blood pressure", contribution: 8, direction: "high", explanation: `Average systolic BP ${Math.round(avgBP)} mmHg — borderline elevated` });
      }

      if (age > 65) {
        cvScore += 20;
        cvFactors.push({ factor: "Age", contribution: 20, direction: "high", explanation: "Age over 65 increases risk" });
      } else if (age > 55) {
        cvScore += 15;
        cvFactors.push({ factor: "Age", contribution: 15, direction: "high", explanation: "Age over 55 increases risk" });
      } else if (age > 45) {
        cvScore += 10;
        cvFactors.push({ factor: "Age", contribution: 10, direction: "high", explanation: "Age over 45 increases risk" });
      } else if (age > 35) {
        cvScore += 5;
        cvFactors.push({ factor: "Age", contribution: 5, direction: "high", explanation: "Age over 35 slightly increases risk" });
      }

      const hasDiabetes = activeDiagnoses.some(d => d.icd10_code.startsWith('E11') || d.icd10_code.startsWith('E10'));
      if (hasDiabetes) {
        cvScore += 10;
        cvFactors.push({ factor: "Diabetes diagnosis", contribution: 10, direction: "high", explanation: "Existing diabetes diagnosis increases cardiovascular risk" });
      }

      const hasHypertension = activeDiagnoses.some(d => d.icd10_code === 'I10');
      if (hasHypertension) {
        cvScore += 5;
        cvFactors.push({ factor: "Hypertension diagnosis", contribution: 5, direction: "high", explanation: "Existing hypertension diagnosis noted" });
      }

      const hasStatin = activeMedications.some(m => 
        m.drug_name.toLowerCase().includes('atorvastatin') ||
        m.drug_name.toLowerCase().includes('rosuvastatin') ||
        m.drug_name.toLowerCase().includes('simvastatin')
      );
      if (hasStatin) {
        cvScore -= 8;
        cvFactors.push({ factor: "Statin medication", contribution: -8, direction: "protective", explanation: "Current statin therapy provides cardiovascular protection" });
      }

      cvScore = Math.max(0, Math.min(100, cvScore));

      let cvLevel = "low";
      if (cvScore < 30) cvLevel = "low";
      else if (cvScore < 60) cvLevel = "moderate";
      else cvLevel = "high";

      cvFactors.sort((a, b) => Math.abs(b.contribution) - Math.abs(a.contribution));
      const cvTopFactors = cvFactors.slice(0, 4);
      const cvExplanation = `Your cardiovascular risk score is ${cvScore}/100 — ${cvLevel} risk. ${cvFactors.filter(f => f.direction === 'high').slice(0,2).map(f => f.explanation).join('. ')}.`;

      // DIABETES SCORE
      let t2dScore = 0;
      const t2dFactors: any[] = [];

      if (hasDiabetes) {
        return {
          cardiovascular: { score: cvScore, level: cvLevel, topFactors: cvTopFactors, explanation: cvExplanation },
          diabetes: {
            score: 100,
            level: "diagnosed",
            topFactors: [{ factor: "Active diagnosis", contribution: 100, direction: "high", explanation: "Type 2 Diabetes Mellitus is an active diagnosis on record" }],
            explanation: "You have an active Type 2 Diabetes diagnosis recorded by your doctor."
          }
        };
      }

      if (glucoseVitals.length >= 10) {
        const recent10 = glucoseVitals.slice(0, 10);
        const old10 = glucoseVitals.slice(-10);
        const recent10avg = recent10.reduce((sum, v) => sum + Number(v.value), 0) / 10;
        const old10avg = old10.reduce((sum, v) => sum + Number(v.value), 0) / 10;
        const slope = recent10avg - old10avg;
        
        if (slope > 15) {
          t2dScore += 35;
          t2dFactors.push({ factor: "Glucose trend", contribution: 35, direction: "high", explanation: `Fasting glucose rising significantly over recent readings (trend: +${Math.round(slope)} mg/dL)` });
        } else if (slope > 8) {
          t2dScore += 20;
          t2dFactors.push({ factor: "Glucose trend", contribution: 20, direction: "high", explanation: `Fasting glucose showing upward trend (+${Math.round(slope)} mg/dL)` });
        } else if (slope > 3) {
          t2dScore += 10;
          t2dFactors.push({ factor: "Glucose trend", contribution: 10, direction: "high", explanation: `Fasting glucose slightly increasing (+${Math.round(slope)} mg/dL)` });
        }
      }

      if (glucoseVitals.length > 0) {
        const latestGlucose = Number(glucoseVitals[0].value);
        if (latestGlucose > 126) {
          t2dScore += 25;
          t2dFactors.push({ factor: "Current glucose", contribution: 25, direction: "high", explanation: `Latest glucose reading ${latestGlucose} mg/dL — above normal threshold` });
        } else if (latestGlucose > 100) {
          t2dScore += 15;
          t2dFactors.push({ factor: "Current glucose", contribution: 15, direction: "high", explanation: `Latest glucose reading ${latestGlucose} mg/dL — borderline elevated` });
        }
      }

      if (age > 45) {
        t2dScore += 10;
        t2dFactors.push({ factor: "Age", contribution: 10, direction: "high", explanation: "Age over 45 increases risk" });
      } else if (age > 35) {
        t2dScore += 5;
        t2dFactors.push({ factor: "Age", contribution: 5, direction: "high", explanation: "Age over 35 slightly increases risk" });
      }

      const hasMetformin = activeMedications.some(m => m.drug_name.toLowerCase().includes('metformin'));
      if (hasMetformin) {
        t2dFactors.push({ factor: "Metformin", contribution: 0, direction: "protective", explanation: "Metformin prescription suggests active glucose management" });
      }

      t2dScore = Math.max(0, Math.min(100, t2dScore));

      let t2dLevel = "low";
      if (t2dScore < 30) t2dLevel = "low";
      else if (t2dScore < 60) t2dLevel = "moderate";
      else t2dLevel = "high";

      t2dFactors.sort((a, b) => Math.abs(b.contribution) - Math.abs(a.contribution));
      const t2dTopFactors = t2dFactors.slice(0, 4);
      const t2dExplanation = `Your diabetes risk score is ${t2dScore}/100 — ${t2dLevel} risk. ${t2dFactors.filter(f => f.direction === 'high').slice(0,2).map(f => f.explanation).join('. ')}.`;

      return {
        cardiovascular: { score: cvScore, level: cvLevel, topFactors: cvTopFactors, explanation: cvExplanation },
        diabetes: { score: t2dScore, level: t2dLevel, topFactors: t2dTopFactors, explanation: t2dExplanation }
      };

    } catch (error: any) {
      this.logger.error('Error calculating risk scores', error);
      require('fs').appendFileSync('ai-debug.log', 'RISK SCORE ERROR: ' + (error.stack || error.message || String(error)) + '\n');
      return {
        cardiovascular: { score: 0, level: "low", topFactors: [], explanation: "Unable to calculate — insufficient data" },
        diabetes: { score: 0, level: "low", topFactors: [], explanation: "Unable to calculate — insufficient data" }
      };
    }
  }
}
