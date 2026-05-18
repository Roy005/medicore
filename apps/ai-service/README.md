# MediCore AI Service

AI-powered health advisor, risk scoring, vitals anomaly detection, and emergency flag generation for the MediCore health platform.

## Features

| Feature | Endpoint | Description |
|---|---|---|
| **Health Advisor** | `POST /ai/advisor/chat` | RAG-powered chat with patient records, crisis detection, and safety constraints |
| **Risk Scores** | `GET /ai/patients/{id}/risk-scores` | Cardiovascular (Framingham-inspired) and Type 2 Diabetes (FINDRISC-inspired) scoring |
| **Vitals Analysis** | `POST /ai/vitals/analyze` | Anomaly detection with personalized thresholds for HR, BP, SpO2, temperature, blood sugar |
| **Emergency Flags** | `GET /ai/patients/{id}/emergency-flags` | Combines critical vitals, risk scores, medication interactions, and missing medications |
| **Conversations** | `GET /ai/patients/{id}/conversations` | Paginated conversation history per patient |
| **Patient Summary** | `GET /ai/patients/{id}/summary` | Combined view: demographics + risks + flags + conversations |
| **Service Stats** | `GET /ai/stats` | Uptime, conversation counts, safety trigger counts |

## Safety Constraints (Non-Negotiable)

1. **Never diagnose** — Uses "I notice X" not "You have X"
2. **Always recommend physician consultation** for clinical questions
3. **Never suggest changing** a prescribed dosage
4. **Crisis detection** — Suicide/self-harm keywords trigger iCall helpline (9152987821)
5. **Base every claim** on patient records only
6. **Max 3 paragraphs** per response, ends with physician disclaimer

## Quick Start

```bash
# 1. Create and activate virtual environment
python -m venv venv
.\venv\Scripts\Activate.ps1     # Windows
# source venv/bin/activate      # Linux/Mac

# 2. Install dependencies
pip install -r requirements.txt

# 3. Configure environment
cp .env.example .env
# Edit .env and set your OPENROUTER_API_KEY

# 4. Run the server
uvicorn main:app --host 127.0.0.1 --port 8001

# 5. Open API docs
# http://127.0.0.1:8001/docs
```

## Docker

```bash
docker build -t medicore-ai-service .
docker run -p 8001:8001 --env-file .env medicore-ai-service
```

## Environment Variables

| Variable | Required | Default | Description |
|---|---|---|---|
| `OPENROUTER_API_KEY` | Yes | — | OpenRouter API key for AI responses |
| `OPENROUTER_MODEL` | No | `google/gemma-4-26b-a4b-it:free` | OpenRouter model identifier |
| `DATABASE_URL` | No | `postgresql://...localhost:5432/medicore` | PostgreSQL connection string |
| `PORT` | No | `8001` | Server port |
| `DEBUG` | No | `false` | Enable debug logging |

## Testing

```bash
# Run all tests (87 total)
python -m pytest tests/ -v

# Safety tests only (44 tests)
python -m pytest tests/test_safety.py -v

# Integration tests only (43 tests)
python -m pytest tests/test_integration.py -v
```

## Project Structure

```
ai-service/
├── main.py                      # FastAPI app, middleware, error handlers
├── config.py                    # Environment config (Settings class)
├── database.py                  # Asyncpg connection pool
├── models/
│   └── schemas.py               # Pydantic v2 request/response models
├── routers/
│   ├── advisor.py               # Chat, conversations, patient summary
│   ├── risk_scores.py           # Risk score computation endpoint
│   ├── vitals.py                # Vitals anomaly detection endpoint
│   └── emergency.py             # Emergency flags endpoint
├── services/
│   ├── llm_service.py           # OpenRouter API wrapper, safety rules, crisis detection
│   ├── patient_context.py       # Patient data aggregation + caching
│   ├── risk_service.py          # CV + T2D risk scoring algorithms
│   ├── vitals_service.py        # Vitals anomaly detection engine
│   ├── emergency_service.py     # Emergency flag generation
│   └── conversation_service.py  # Per-patient conversation history
├── tests/
│   ├── test_safety.py           # 44 safety constraint tests
│   └── test_integration.py      # 43 integration tests (all endpoints)
├── Dockerfile
├── requirements.txt
└── .env.example
```

## API Examples

### Chat with the advisor
```bash
curl -X POST http://localhost:8001/ai/advisor/chat \
  -H "Content-Type: application/json" \
  -d '{"patientId": "p-123", "message": "What do my glucose levels look like?"}'
```

### Get risk scores
```bash
curl http://localhost:8001/ai/patients/p-123/risk-scores
```

### Analyze vitals
```bash
curl -X POST http://localhost:8001/ai/vitals/analyze \
  -H "Content-Type: application/json" \
  -d '{"patientId": "p-123", "recentVitals": [{"metric": "heart_rate", "value": 130}]}'
```

### Get patient summary
```bash
curl http://localhost:8001/ai/patients/p-123/summary
```

## Tech Stack

- **Framework**: FastAPI + Uvicorn
- **AI/LLM**: OpenRouter API (google/gemma-4-26b-a4b-it:free)
- **Database**: PostgreSQL via asyncpg
- **Validation**: Pydantic v2
- **Testing**: pytest + pytest-asyncio
