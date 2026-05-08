<p align="center">
  <h1 align="center">🏥 MediCore</h1>
  <p align="center">
    <strong>AI-Powered, HIPAA/DPDP-Compliant Healthcare Platform</strong>
  </p>
  <p align="center">
    <em>Smart patient profiles · Emergency QR access · Real-time vitals · AI-driven insights</em>
  </p>
</p>

<p align="center">
  <a href="#features">Features</a> •
  <a href="#architecture">Architecture</a> •
  <a href="#modules">Modules</a> •
  <a href="#tech-stack">Tech Stack</a> •
  <a href="#getting-started">Getting Started</a> •
  <a href="#security--compliance">Security</a> •
  <a href="#contributing">Contributing</a> •
  <a href="#license">License</a>
</p>

---

## 🌟 Overview

**MediCore** is a multi-tenant SaaS healthcare platform that puts patients in control of their health data while enabling seamless collaboration with doctors and hospitals. Built with a security-first architecture, MediCore is designed to be fully compliant with **HIPAA** and **India's DPDP Act** from day one.

The platform's flagship feature — the **Emergency QR Access System** — allows any person to scan a patient's QR code and instantly view critical medical information (blood type, allergies, medications, emergency contacts) on a static, CDN-served page that loads in under 8 seconds on 3G — **no login required, no backend dependency**.

## ✨ Features

### 🔐 Patient Profile & Identity
- Secure registration and login via **Keycloak** (OAuth2 PKCE flow)
- Comprehensive health profiles: demographics, blood group, emergency contacts, insurance
- Allergy tracking with severity levels (mild → anaphylactic)
- Medication management with **RxNorm** code integration
- Vaccination records and family history
- Document upload (PDF, JPEG, DICOM) via S3 pre-signed URLs
- Profile completeness scoring
- Immutable audit logging on every PHI access event

### 🚨 Emergency QR Access (Core Value Proposition)
- One-scan emergency medical summary — **works offline, no login needed**
- **Modernized "Stitch" Design System** providing a professional, clinical, and high-contrast UI
- Cloud deployed via Vercel ensuring high availability for critical situations
- Independent from the main backend — works even if the API is completely down
- QR token rotation for security, rate-limited at the WAF layer
- Push notifications to patients when their QR is scanned
- Apple Wallet / Google Wallet digital Medical ID card
- Printable Medical ID card PDF generation
- **PWA offline caching** for the patient's own emergency summary

### 👨‍⚕️ Doctor EHR & Consent System
- Consent-token-based access: patients generate time-limited tokens for doctors
- Instant consent revocation — takes effect on the next API call
- SOAP-format clinical notes with **ICD-10** coded diagnoses
- Prescription management with real-time **drug interaction checking** (via openFDA)
- Major interaction warnings are non-dismissable without clinical justification
- Specialist referral with automated context bundles
- Natural language search over patient history

### 📊 Vitals Ingestion & IoT Pipeline
- Real-time vitals streaming from wearables via **Kafka** event pipeline
- Apple HealthKit and Google Health Connect integration
- **TimescaleDB** hypertables with continuous aggregates (hourly, daily, weekly rollups)
- WebSocket live streaming for clinical settings
- Rule-based alert engine with tiered severity:
  - **Tier 3**: HR > 150 bpm sustained 5 min, SpO2 < 92%, BP > 180/120
  - **Tier 4 Emergency**: SpO2 < 90% + HR > 130 sustained
- Symptom journaling and medication adherence tracking

### 🧠 AI Intelligence Layer
- **Gemini AI Integration** for real-time health chat, symptom analysis, and risk assessment functionality
- **LSTM Autoencoder** for personalized vitals anomaly detection (activates after 30 days of patient data)
- **XGBoost + SHAP** risk scoring for cardiovascular disease, Type 2 Diabetes, and hypertension
- Every risk score accompanied by top-5 SHAP explanations in plain English
- **RAG Health Advisor** powered by Gemini with constitutional safety constraints:
  - Never provides diagnoses — only observations and recommendations
  - Immediate crisis protocol for self-harm mentions
  - All responses cite patient records or retrieved medical guidelines
- **BioBERT**-based medication extraction from clinical notes
- Pre-consultation brief auto-generation before appointments
- **MLflow** experiment tracking and **Evidently AI** drift monitoring

### 🏥 Hospital SaaS Workspace
- Multi-tenant hospital onboarding with subdomain isolation
- Department management and staff assignment
- Patient admission/discharge with bed management
- Appointment scheduling with SMS (Twilio), email, and push reminders
- Secure internal messaging within tenant boundaries
- Custom intake form builder (drag-and-drop)
- Hospital analytics dashboard (patient flow, readmission rates, diagnosis trends)
- AI-powered readmission prediction and outbreak cluster detection

## 🏗️ Architecture

```
┌────────────────────────────────────────────────────────────────┐
│                      PATIENT / DOCTOR / HOSPITAL               │
│                    (Next.js Web + React Native Mobile)          │
└──────────────────────────────┬─────────────────────────────────┘
                               │
               ┌───────────────┼───────────────┐
               │               │               │
      ┌────────▼──────┐  ┌────▼─────┐  ┌──────▼───────┐
      │   CloudFront  │  │  Istio   │  │  WebSocket   │
      │  (Emergency   │  │  mTLS    │  │  (Real-time  │
      │   CDN Path)   │  │  Gateway │  │   Vitals)    │
      └───────┬───────┘  └────┬─────┘  └──────┬───────┘
              │               │               │
      ┌───────▼───────┐  ┌────▼─────────────────▼──────┐
      │  S3 Static    │  │     NestJS API Server        │
      │  Emergency    │  │  (TypeScript + OpenAPI)      │
      │  Snapshots    │  └────┬─────────┬──────┬───────┘
      └───────────────┘       │         │      │
                              │    ┌────▼────┐ │
                         ┌────▼──┐ │ Kafka   │ │
                         │Keycloak│ │ (MSK)  │ │
                         │(Auth) │ └────┬────┘ │
                         └───────┘      │      │
                              │    ┌────▼────┐ │
                         ┌────▼──────────────▼─▼───────┐
                         │   PostgreSQL 16 + RLS        │
                         │   TimescaleDB (Vitals)       │
                         │   Redis Sentinel (Cache)     │
                         └──────────────────────────────┘
                                       │
                         ┌─────────────▼───────────────┐
                         │   Python FastAPI AI Service  │
                         │  (LSTM · XGBoost · RAG)      │
                         │  MLflow · Evidently AI       │
                         └─────────────────────────────┘
```

## 📦 Modules

The platform is built as **7 independently deployable modules**, each with its own test gate:

| Module | Name | Description | Key Deliverable |
|--------|------|-------------|-----------------|
| **M0** | Foundation & Infrastructure | Cloud environment, security, CI/CD, database baseline | `terraform apply` → working VPC, EKS, RDS, Redis, S3 |
| **M1** | Patient Profile & Auth | Patient registration, profiles, document upload | Full patient portal with audit logging |
| **M2** | Emergency QR Access | Critical — the core value proposition | QR scan → emergency page in < 8s on 3G |
| **M3** | Doctor EHR & Consent | Consent-based EHR access, prescriptions, drug interactions | Doctor portal with interaction warnings |
| **M4** | Vitals & IoT Pipeline | Real-time vitals from wearables via Kafka | 10K concurrent events, zero data loss |
| **M5** | AI Intelligence Layer | Anomaly detection, risk scoring, RAG advisor | Personalized AI with SHAP explainability |
| **M6** | Hospital SaaS Workspace | Multi-tenant hospital management | Full hospital admin with analytics |

> **Build Order**: Modules are built sequentially (M0 → M6). Each module must pass its test gate before the next one begins.

## 🛠️ Tech Stack

| Layer | Technology |
|-------|-----------|
| **Backend** | Node.js + NestJS + TypeScript |
| **Frontend** | Next.js 14 + TypeScript + Tailwind CSS |
| **Database** | PostgreSQL 16 (Neon Serverless) |
| **Cache** | Redis (Upstash) |
| **Auth** | Manual JWT + bcrypt |
| **File Storage** | Database Blob Storage |
| **AI Integration** | Google Gemini AI |
| **Infrastructure** | Vercel (Frontend), Render (Backend), Docker Compose (Local) |
| **CI/CD** | GitHub Actions |

## 🛤️ Current Development & Future Plans

**Phase 1: Core Portal & Emergency Access (Completed ✅)**
- End-to-end Patient and Doctor profiles with secure authentication and consent tokens
- Emergency Medical Data page redesign with the professional "Stitch" design system
- Cloud deployments completed across Vercel (Frontend), Render (Backend), Neon (DB), and Upstash (Redis)
- Real-time Gemini AI chat and risk assessment integrated into patient modules

**Phase 2: Vitals & Advanced Monitoring (In Progress 🚧)**
- Integrate Kafka event pipeline for continuous vitals streaming
- Implement TimescaleDB for metrics aggregation
- Finalize the rule-based alert engine for tiered severities

**Phase 3: Hospital SaaS Workspace (Planned 🗓️)**
- Multi-tenant hospital onboarding and department management
- Live patient admission, discharge, and bed management
- Hospital analytics dashboard and outbreak cluster detection

## 🚀 Getting Started

### Prerequisites

- **Node.js** >= 18.x
- **Docker** & **Docker Compose**

### Project Structure

```
medicore/
├── apps/
│   ├── backend/      # NestJS API server
│   └── frontend/     # Next.js 14 web app
├── docker-compose.yml
├── .env.example
└── README.md
```

### Local Development

```bash
# Clone the repository
git clone https://github.com/Roy005/medicore.git
cd medicore

# Create your environment file
cp .env.example .env

# Start PostgreSQL & Redis
docker-compose up -d

# Verify services are healthy
docker-compose ps

# Install backend dependencies & start
cd apps/backend
npm install
npm run dev

# In a new terminal — start the frontend
cd apps/frontend
npm install
npm run dev
```

### Stopping Services

```bash
docker-compose down        # stop containers
docker-compose down -v     # stop + remove volumes (reset data)
```

## 🔒 Security & Compliance

MediCore is built with **security as a foundational requirement**, not an afterthought:

| Requirement | Implementation |
|-------------|---------------|
| **Encryption at Rest** | AES-256 via AWS KMS CMK |
| **Encryption in Transit** | TLS 1.3 everywhere |
| **Zero Trust** | mTLS between all services (Istio) |
| **Access Control** | Row-Level Security at PostgreSQL level |
| **Audit Trail** | Immutable `audit_log` on every PHI access |
| **Secrets** | AWS Secrets Manager — never in code or env vars |
| **Multi-Tenancy** | Data isolation enforced at DB level, not application |
| **AI Safety** | Constitutional constraints, no diagnosis, crisis protocol |
| **Container Security** | Trivy scanning on every build |
| **Code Security** | Semgrep SAST on every PR |

### CI/CD Test Pyramid

Every pull request must pass **5 levels** before merge:

1. **Code Quality** — ESLint + Prettier + TypeScript strict mode (< 60s)
2. **Unit Tests** — Jest ≥ 80% coverage, Pytest ≥ 75% (< 3 min)
3. **Integration Tests** — Full API flows with real DB via testcontainers (< 8 min)
4. **Security Scan** — Semgrep + Trivy + Dependabot — zero high/critical findings
5. **E2E Tests** — Playwright for 7 critical user journeys (staging only, < 20 min)

## 🤝 Contributing

We welcome contributions! Please read our contributing guidelines before submitting PRs.

1. **Fork** the repository
2. **Create** a feature branch (`git checkout -b feature/amazing-feature`)
3. **Commit** your changes (`git commit -m 'feat: add amazing feature'`)
4. **Push** to the branch (`git push origin feature/amazing-feature`)
5. **Open** a Pull Request

Please ensure your PR:
- Passes all CI checks
- Includes tests for new functionality
- Follows the existing code style
- Updates documentation if needed

## 📄 License

This project is licensed under the **MIT License** — see the [LICENSE](LICENSE) file for details.

---

<p align="center">
  <strong>MediCore</strong> — Because healthcare data should be secure, accessible, and intelligent.
</p>
