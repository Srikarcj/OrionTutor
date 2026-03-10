## YouTube AI Study - Full Stack App

Turn long-form YouTube videos into structured learning material and enable question answering over the transcript using a RAG pipeline.

### Architecture overview

The system has two services.

- Frontend: Next.js + TailwindCSS UI, deployed to Vercel.
- Backend: FastAPI service that handles transcript ingestion, RAG indexing, Groq calls, and PDF generation.

Data flow (high level):
1. Frontend sends a YouTube URL to the backend.
2. Backend fetches and cleans the transcript.
3. Transcript is chunked and embedded for FAISS indexing.
4. Groq is called to generate notes, summary, mind map, flashcards, and visual insights.
5. A PDF is rendered and served from `/static`.
6. Frontend loads results from the backend and renders the workspace.

### Features

- Structured notes and summaries.
- Timestamped transcript and transcript search.
- Mind map generation.
- Flashcards for spaced repetition.
- Visual insights from transcript moments.
- PDF export of notes and summary.
- RAG-based Q&A over the transcript.

### Project layout

- `frontend`: Next.js app, UI and client-side logic.
- `backend`: FastAPI app, ingestion, RAG, and AI workflows.

Backend modules (key):
- `config.py`: environment and path configuration.
- `main.py`: FastAPI app setup, routes, static files.
- `routes/video_routes.py`: video processing endpoint.
- `routes/qa_routes.py`: question-answering endpoint.
- `services/transcript_service.py`: YouTube transcript fetch and cleaning.
- `services/chunk_service.py`: transcript chunking.
- `services/embedding_service.py`: embeddings with `all-MiniLM-L6-v2`.
- `services/rag_service.py`: FAISS indexing and retrieval.
- `services/pdf_service.py`: PDF generation via reportlab.
- `vectorstore/faiss_store.py`: FAISS index and metadata per video.
- `llm/groq_client.py`: Groq LLM wrapper for summarization, notes, and QA.

### Backend - local development

```bash
cd backend
python -m venv .venv
source .venv/bin/activate  # On Windows: .venv\Scripts\activate
pip install -r requirements.txt
```

Set the Groq API key (Unix/macOS):

```bash
export GROQ_API_KEY="your_groq_api_key"
```

On Windows PowerShell:

```powershell
$env:GROQ_API_KEY = "your_groq_api_key"
```

Run the API:

```bash
uvicorn backend.main:app --reload --port 8000
```

The FastAPI docs will be at `http://localhost:8000/docs`.

### Frontend - local development

```bash
cd frontend
npm install
npm run dev
```

The app defaults to calling the backend at `http://localhost:8000`. To point at a hosted backend, set:

```bash
NEXT_PUBLIC_API_BASE_URL="https://your-backend.onrender.com"
```

You can set this in `frontend/.env.local`.

### API surface

Backend endpoints (common):
- `POST /api/video/process` body: `{ "youtube_url": "https://..." }`
- `POST /api/qa/ask` body: `{ "video_id": "<youtube-id>", "question": "..." }`
- `GET /api/videos/[id]` fetch a processed video and its artifacts.
- `GET /api/library` fetch the user library list.
- `GET /api/user/plan` fetch plan and usage.
- `GET /api/stats` fetch live platform stats.

### Main UX

- Paste YouTube URL and click **Analyze Video**.
- View structured notes, transcript, mind map, flashcards, and visual insights.
- Download PDF via **Download PDF**.
- Ask follow-up questions in the QA panel (RAG over FAISS + Groq).

UI timing behavior:
- Initial load/analysis display is intentionally delayed.
- < 5 hours: ~3 seconds.
- > 5 hours: ~5 to 6 seconds.

### Backend - Docker and Render deployment

Build and run locally:

```bash
cd backend
docker build -t youtube-ai-study-backend .
docker run -p 8000:8000 -e GROQ_API_KEY="your_groq_api_key" youtube-ai-study-backend
```

Render deployment (high level):
1. Create a new Web Service from your Git repo, pointing to the `backend` directory.
2. Set Build Command: `pip install -r backend/requirements.txt`.
3. Set Start Command: `uvicorn backend.main:app --host 0.0.0.0 --port 8000`.
4. Add environment variable `GROQ_API_KEY`.
5. Expose port `8000`.

### Frontend - Vercel deployment

1. Push this project to GitHub.
2. In Vercel, import the repo and set project root to `frontend`.
3. Build command: `npm run build`.
4. Output directory: `.next`.
5. Set `NEXT_PUBLIC_API_BASE_URL` to the public backend URL.

### Operational notes

- FAISS index and metadata are persisted per video under `backend/vectorstore`.
- Generated PDFs are served from `/static/...` and stored under `backend/generated_pdfs`.
- Cached runs are stored under `backend/cache` to speed up repeated requests.
- Transcript availability depends on YouTube captions for the requested video.

### Troubleshooting

- 400 on `/api/video/process`: invalid URL or transcript unavailable.
- Slow analysis: LLM latency, transcript fetch, or PDF rendering.
- Missing QA answers: FAISS indexing failed or transcript was empty.

### Production readiness

- Environment variables: Groq key is never hard-coded.
- Local embeddings: sentence-transformers model is loaded once and cached.
- RAG pipeline: question -> local embedding -> FAISS search -> Groq answer constrained to retrieved context.
