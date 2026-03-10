from typing import Any, Dict
import re

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, HttpUrl

from backend.services.transcript_service import get_clean_transcript, TranscriptError, extract_video_id
from backend.services.chunk_service import build_chunks
from backend.services.pdf_service import generate_notes_pdf
from backend.config import get_settings
from backend.vectorstore.faiss_store import VectorStoreError
from backend.services.cache_service import load_cached_video, save_cached_video
from backend.llm.groq_client import get_groq_client


router = APIRouter()


class VideoProcessRequest(BaseModel):
    youtube_url: HttpUrl
    transcript_text: str | None = None


class NotesSchema(BaseModel):
    title: str
    overview: str
    main_concepts: list[str]
    detailed_explanation: str
    examples: list[str]
    key_takeaways: list[str]


class VideoProcessResponse(BaseModel):
    video_id: str
    notes: NotesSchema
    transcript: str
    summary: str
    mindmap: dict | None = None
    flashcards: list[dict] | None = None
    visual_insights: list[dict] | None = None
    pdf_url: str


def _fallback_notes_from_transcript(transcript: str, video_id: str) -> Dict[str, Any]:
    text = re.sub(r"\s+", " ", (transcript or "").strip())
    overview = text[:1200] if text else "Transcript processed, but AI notes generation failed."
    chunks = [c.strip() for c in re.split(r"(?<=[.!?])\s+", text) if c.strip()]
    concepts = chunks[:5] if chunks else ["Main concept extraction unavailable"]
    takeaways = chunks[-3:] if len(chunks) >= 3 else concepts[:3]
    return {
        "title": f"Study Notes ({video_id})",
        "overview": overview,
        "main_concepts": concepts,
        "detailed_explanation": "Generated using fallback mode due temporary AI service issue.",
        "examples": [],
        "key_takeaways": takeaways,
    }


def _ensure_notes_schema(notes: Dict[str, Any] | None, transcript: str, video_id: str) -> Dict[str, Any]:
    if not isinstance(notes, dict):
        return _fallback_notes_from_transcript(transcript, video_id)
    return {
        "title": notes.get("title") or f"Study Notes ({video_id})",
        "overview": notes.get("overview") or (transcript[:1200] if transcript else ""),
        "main_concepts": notes.get("main_concepts") or [],
        "detailed_explanation": notes.get("detailed_explanation") or "",
        "examples": notes.get("examples") or [],
        "key_takeaways": notes.get("key_takeaways") or [],
    }


def _build_manual_transcript_payload(video_id: str, transcript_text: str) -> Dict[str, Any]:
    text = re.sub(r"\s+\n", "\n", transcript_text or "").strip()
    if not text:
        raise HTTPException(status_code=400, detail="Transcript text is empty.")

    lines = [line.strip() for line in text.splitlines() if line.strip()]
    timestamp_regex = re.compile(r"^(?:(\d+):)?(\d{1,2}):(\d{2})\s+(.+)$")
    has_timestamps = any(timestamp_regex.match(line) for line in lines)

    raw_entries: list[dict] = []
    timestamped_lines: list[str] = []
    last_start = 0.0
    default_duration = 5.0

    if has_timestamps:
        for line in lines:
            match = timestamp_regex.match(line)
            if match:
                hours = int(match.group(1) or 0)
                minutes = int(match.group(2) or 0)
                seconds = int(match.group(3) or 0)
                start = hours * 3600 + minutes * 60 + seconds
                text_value = match.group(4).strip()
            else:
                start = last_start + default_duration
                text_value = line
            start = max(start, last_start)
            raw_entries.append({"text": text_value, "start": float(start), "duration": default_duration})
            mins = int(start) // 60
            secs = int(start) % 60
            timestamped_lines.append(f"{mins:02d}:{secs:02d} {text_value}")
            last_start = start
    else:
        sentences = [s.strip() for s in re.split(r"(?<=[.!?])\s+", " ".join(lines)) if s.strip()]
        for idx, sentence in enumerate(sentences):
            start = float(idx) * default_duration
            raw_entries.append({"text": sentence, "start": start, "duration": default_duration})
            mins = int(start) // 60
            secs = int(start) % 60
            timestamped_lines.append(f"{mins:02d}:{secs:02d} {sentence}")

    cleaned_text = " ".join([entry.get("text", "") for entry in raw_entries]).strip()
    timestamped_text = "\n".join(timestamped_lines)

    return {
        "video_id": video_id,
        "raw_entries": raw_entries,
        "cleaned_text": cleaned_text,
        "timestamped_text": timestamped_text,
    }


@router.post("/process", response_model=VideoProcessResponse)
async def process_video(request: VideoProcessRequest) -> Dict[str, Any]:
    """
    End-to-end video processing:
    - fetch + clean transcript
    - chunk transcript
    - generate embeddings & persist in FAISS
    - call Groq to generate structured notes
    - render a PDF and expose its URL
    """
    video_id = ""
    try:
        video_id = extract_video_id(str(request.youtube_url))
    except TranscriptError as exc:
        raise HTTPException(status_code=400, detail=str(exc))

    cached = None if request.transcript_text and request.transcript_text.strip() else load_cached_video(video_id)
    if cached and cached.get("notes") and cached.get("transcript"):
        cached_transcript = cached.get("transcript", "")
        safe_notes = _ensure_notes_schema(cached.get("notes"), cached_transcript, video_id)
        return {
            "video_id": cached.get("video_id", video_id),
            "notes": safe_notes,
            "transcript": cached_transcript,
            "summary": cached.get("summary", "") or safe_notes.get("overview", ""),
            "mindmap": cached.get("mindmap", None),
            "flashcards": cached.get("flashcards", None),
            "visual_insights": cached.get("visual_insights", None),
            "pdf_url": cached.get("pdf_url", ""),
        }

    try:
        if request.transcript_text and request.transcript_text.strip():
            transcript_payload = _build_manual_transcript_payload(video_id, request.transcript_text)
        else:
            transcript_payload = get_clean_transcript(str(request.youtube_url))
    except TranscriptError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Transcript processing failed: {exc}")

    video_id = transcript_payload["video_id"]
    raw_entries = transcript_payload["raw_entries"]
    cleaned_text: str = transcript_payload["cleaned_text"]
    timestamped_text: str = transcript_payload.get("timestamped_text", cleaned_text)

    # Lazy import keeps app startup fast and avoids long cold-start on /health and /docs.
    from backend.services.rag_service import index_video_transcript, generate_notes_from_transcript

    # Build semantic chunks and index them
    try:
        chunks = build_chunks(video_id=video_id, raw_entries=raw_entries)
        if not chunks:
            raise HTTPException(status_code=400, detail="Transcript was fetched but produced no usable text chunks.")
        index_video_transcript(video_id=video_id, chunks=chunks)
    except VectorStoreError as exc:
        # Do not block note generation if vector indexing fails.
        print(f"WARNING: Vector index operation failed for {video_id}: {exc}")
    except HTTPException:
        raise
    except Exception as exc:
        # Keep processing path alive; QA may be unavailable for this video.
        print(f"WARNING: Chunking/embedding failed for {video_id}: {exc}")

    # Generate structured notes from the full cleaned transcript text
    try:
        notes_dict = generate_notes_from_transcript(cleaned_text)
    except Exception as exc:
        print(f"WARNING: LLM notes generation failed for {video_id}: {exc}")
        notes_dict = _fallback_notes_from_transcript(cleaned_text, video_id=video_id)

    # Generate concise summary
    summary_text = ""
    try:
        client = get_groq_client()
        summary_text = client.summarise_video(cleaned_text)
    except Exception as exc:
        print(f"WARNING: LLM summary generation failed for {video_id}: {exc}")
        summary_text = notes_dict.get("overview", "")

    # Generate mind map + flashcards
    mindmap_payload = None
    flashcards_payload = None
    try:
        client = get_groq_client()
        mindmap_payload = client.generate_mindmap(notes_dict, summary_text, cleaned_text)
        flashcards_payload = client.generate_flashcards(notes_dict, summary_text, cleaned_text)
    except Exception as exc:
        print(f"WARNING: Mindmap/flashcards generation failed for {video_id}: {exc}")

    # Generate visual insights (lightweight heuristic extraction)
    visual_insights_payload = None
    try:
        from backend.services.visual_insights_service import generate_visual_insights
        visual_insights_payload = generate_visual_insights(video_id=video_id, transcript_text=timestamped_text)
    except Exception as exc:
        print(f"WARNING: Visual insights generation failed for {video_id}: {exc}")

    # Generate PDF
    pdf_url = ""
    try:
        pdf_path = generate_notes_pdf(video_id=video_id, notes=notes_dict, summary=summary_text, transcript=cleaned_text)
        settings = get_settings()
        pdf_filename = pdf_path.replace(settings.pdf_output_dir, "").lstrip("\\/")  # normalise for URL
        pdf_url = f"/static/{pdf_filename}"
    except Exception as exc:
        print(f"WARNING: PDF generation failed for {video_id}: {exc}")

    save_cached_video(
        video_id,
        {
            "video_id": video_id,
            "notes": notes_dict,
            "transcript": timestamped_text,
            "summary": summary_text,
            "mindmap": mindmap_payload,
            "flashcards": flashcards_payload,
            "visual_insights": visual_insights_payload,
            "pdf_url": pdf_url,
        },
    )

    return {
        "video_id": video_id,
        "notes": notes_dict,
        "transcript": timestamped_text,
        "summary": summary_text,
        "mindmap": mindmap_payload,
        "flashcards": flashcards_payload,
        "visual_insights": visual_insights_payload,
        "pdf_url": pdf_url,
    }

