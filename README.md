# scoring_k — AI Batch Exam Grader

> **AI-powered batch grading for scanned multiple-choice exams.**  
> Upload a PDF, provide an answer key, and let Gemini 1.5 Pro grade papers instantly.  
> Ambiguous answers are flagged for a quick teacher review.

---

## ✨ Features

| Feature | Description |
|---|---|
| 📤 Batch PDF Upload | Upload one PDF containing many student papers |
| 🤖 AI Grading | Gemini 1.5 Pro grades each bubble sheet, returns confidence scores |
| 🚩 Ambiguity Flagging | Multiple marks, crossed-out answers, or low-confidence auto-flagged |
| 👁️ Manual Review | Side-by-side crop image + answer key view with ✓/✗ buttons |
| 📊 Results Dashboard | Score summaries, pass rates, expandable per-question table |
| 📥 CSV Export | One-click export of all student scores |

---

## 🚀 Quick Start

### 1. Backend (FastAPI)

```powershell
cd backend
python -m venv venv
.\venv\Scripts\activate
pip install -r requirements.txt

# Copy and fill in your Gemini API key
copy .env.example .env
# Edit .env and set GEMINI_API_KEY=your_key_here

# Start server (demo mode works without a key)
python main.py
```

> **Note**: `pdf2image` requires [Poppler for Windows](https://github.com/oschwartz10612/poppler-windows/releases).  
> Download, extract, and add the `bin/` folder to your PATH.

### 2. Frontend (React + Vite)

```powershell
cd frontend
npm install
npm run dev
```

Open **http://localhost:5173**

---

## 🎭 Demo Mode

If `GEMINI_API_KEY` is not set in `.env`, the backend runs in **Demo Mode**:
- Randomly generates realistic grading results (~80% correct, ~5% flagged)
- No Gemini API call is made
- Perfect for UI testing without an API key

---

## 📋 Answer Key Format

Upload the answer key as a JSON string in the UI:

```json
{
  "1": "A",
  "2": "B",
  "3": "C",
  "4": "D",
  "5": "A"
}
```

---

## 🏗️ Architecture

```
scoring_k/
├── backend/
│   ├── main.py                  # FastAPI app
│   ├── models.py                # Pydantic schemas
│   ├── job_store.py             # In-memory job queue
│   ├── routers/
│   │   ├── upload.py            # POST /upload
│   │   ├── jobs.py              # GET /jobs, GET /jobs/{id}
│   │   └── review.py            # GET /review/{id}/flagged, POST override
│   └── services/
│       ├── pdf_splitter.py      # PDF → per-student image sets
│       ├── image_extractor.py   # Crop question regions
│       ├── gemini_grader.py     # Gemini 1.5 Pro grading
│       └── pipeline.py          # Orchestrates the full pipeline
└── frontend/
    └── src/
        ├── pages/
        │   ├── Dashboard.jsx     # Upload + job list
        │   ├── ReviewPage.jsx    # Manual review interface
        │   └── ResultsPage.jsx   # Student score cards
        └── components/
            ├── BatchUpload.jsx
            ├── JobDashboard.jsx
            ├── ReviewInterface.jsx
            └── ScoreCard.jsx
```

---

## 🔧 Configuration

| Variable | Default | Description |
|---|---|---|
| `GEMINI_API_KEY` | (none) | Gemini API key; leave blank for demo mode |
| `PAGES_PER_STUDENT` | `2` | How many PDF pages = one student paper |
| `MAX_QUESTIONS` | `40` | Max questions on a single paper |
| `UPLOAD_DIR` | `uploads` | Directory for PDFs and images |

---

## 📦 Tech Stack

- **Backend**: FastAPI · pdf2image · Pillow · google-generativeai · Pydantic v2
- **Frontend**: React 18 · Vite 4 · Tailwind CSS 3 · React Router 6 · Axios · Lucide Icons
