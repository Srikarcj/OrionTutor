import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";
import {
  Copy,
  Download,
  Send,
  Play,
  BookOpen,
  LayoutDashboard,
  FileText,
  MessageCircle,
  Network,
  Layers,
  StickyNote,
  Image,
  Library as LibraryIcon,
  Youtube,
  Bot,
} from "lucide-react";
import { Modal } from "../components/ui";
import { AppShell } from "../components/layout/app-shell";
import { Button, Input, Textarea, Skeleton, Alert, Spinner } from "../components/ui";
import { SectionCard, SkeletonLines } from "../components/feature-panels";
import type { Notes } from "../lib/types";
import { fetchJson, type LibraryResponse, type PlanResponse, type VideoDetailResponse } from "../lib/client/api";
import { StudyOutput } from "../components/study-output";
import { AnswerOutput } from "../components/answer-output";
import { MindMap } from "../components/mind-map";
import { Flashcards } from "../components/flashcards";
import { NotesPanel } from "../components/notes-panel";
import { VideoPlayer } from "../components/video-player";
import { parseTranscriptSegments } from "../lib/client/formatting";
import { VisualInsights } from "../components/visual-insights";

type ProcessResponse = {
  video_id: string;
  source_video_id?: string;
  title: string;
  thumbnail: string;
  notes: Notes;
  transcript: string;
  summary: string;
  mindmap?: any;
  flashcards?: Array<{ question: string; answer: string; category?: string; difficulty?: string; bullets?: string[] }>;
  visual_insights?: Array<{
    timestamp?: string;
    seconds?: number;
    visual_type?: string;
    title?: string;
    image_url?: string;
    ai_explanation?: string;
    bullets?: string[];
    tags?: string[];
    key_moment?: boolean;
  }>;
  chapters: string[];
  quiz: string[];
  pdf_url: string | null;
  pending?: boolean;
  plan: "free" | "pro";
  usage: {
    monthUsage: number;
    monthlyLimit: number | null;
  };
};

const TAB_ITEMS = [
  { label: "Summary", icon: LayoutDashboard },
  { label: "Transcript", icon: FileText },
  { label: "Ask AI", icon: MessageCircle },
  { label: "Mind Map", icon: Network },
  { label: "Flashcards", icon: Layers },
  { label: "Notes", icon: StickyNote },
  { label: "Visual Insights", icon: Image },
];

const FIVE_HOURS_SECONDS = 5 * 60 * 60;
const SHORT_VIDEO_DELAY_MS = 3000;
const LONG_VIDEO_DELAY_MS = 5500;

function getVideoDurationSeconds(transcript: string): number {
  if (!transcript) return 0;
  let maxSeconds = 0;
  const lines = transcript.split("\n");
  for (const line of lines) {
    const match = line.match(/^(\d+):(\d{2})(?::(\d{2}))?\s/);
    if (!match) continue;
    if (match[3] !== undefined) {
      const hours = parseInt(match[1], 10) || 0;
      const minutes = parseInt(match[2], 10) || 0;
      const seconds = parseInt(match[3], 10) || 0;
      maxSeconds = Math.max(maxSeconds, hours * 3600 + minutes * 60 + seconds);
    } else {
      const minutes = parseInt(match[1], 10) || 0;
      const seconds = parseInt(match[2], 10) || 0;
      maxSeconds = Math.max(maxSeconds, minutes * 60 + seconds);
    }
  }
  return maxSeconds;
}

function getTargetDelayMs(durationSeconds: number): number {
  if (durationSeconds > FIVE_HOURS_SECONDS) return LONG_VIDEO_DELAY_MS;
  return SHORT_VIDEO_DELAY_MS;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export default function DashboardPage() {
  const router = useRouter();
  const [youtubeUrl, setYoutubeUrl] = useState("");
  const [question, setQuestion] = useState("");
  const [plan, setPlan] = useState<PlanResponse | null>(null);
  const [library, setLibrary] = useState<LibraryResponse["items"]>([]);
  const [activeVideoId, setActiveVideoId] = useState<string | null>(null);
  const [video, setVideo] = useState<VideoDetailResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isAsking, setIsAsking] = useState(false);
  const [answer, setAnswer] = useState("");
  const [visualQuestion, setVisualQuestion] = useState("");
  const [visualAnswer, setVisualAnswer] = useState("");
  const [isVisualAsking, setIsVisualAsking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingVideoId, setPendingVideoId] = useState<string | null>(null);
  const [showTranscriptModal, setShowTranscriptModal] = useState(false);
  const [activeTab, setActiveTab] = useState("Summary");
  const [seekTo, setSeekTo] = useState<((s: number) => void) | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  async function hydrate(keepSelection = false) {
    setIsLoading(true);
    try {
      const [planRes, libRes] = await Promise.all([
        fetchJson<PlanResponse>("/api/user/plan"),
        fetchJson<LibraryResponse>("/api/library"),
      ]);
      setPlan(planRes);
      setLibrary(libRes.items);
      const firstId = libRes.items[0]?.id || null;
      setActiveVideoId((prev) => {
        if (keepSelection && prev) return prev;
        if (!prev) return firstId;
        const stillExists = libRes.items.some((item) => item.id === prev);
        return stillExists ? prev : firstId;
      });
    } catch (e: any) {
      setError(e.message || "Failed to load dashboard data.");
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    hydrate(false);
  }, []);

  useEffect(() => {
    const tab = typeof router.query.tab === "string" ? router.query.tab : "";
    const vid = typeof router.query.videoId === "string" ? router.query.videoId : "";
    if (tab) {
      setActiveTab(tab);
    }
    if (vid) {
      setActiveVideoId(vid);
    }
  }, [router.query.tab, router.query.videoId]);

  useEffect(() => {
    if (!activeVideoId) {
      setVideo(null);
      return;
    }
    if (video?.id === activeVideoId) {
      return;
    }
    const valid = library.some((item) => item.id === activeVideoId);
    if (!valid) {
      if (video?.id !== activeVideoId) {
        setVideo(null);
      }
      return;
    }

    let cancelled = false;
    const startedAt = Date.now();

    fetchJson<VideoDetailResponse>(`/api/videos/${activeVideoId}`)
      .then(async (data) => {
        const durationSeconds = getVideoDurationSeconds(data.transcript || "");
        const targetDelayMs = getTargetDelayMs(durationSeconds);
        const elapsed = Date.now() - startedAt;
        const remaining = Math.max(0, targetDelayMs - elapsed);
        if (remaining) {
          await sleep(remaining);
        }
        if (!cancelled) {
          setVideo(data);
        }
      })
      .catch((e: any) => setError(e.message || "Failed to load video"));

    return () => {
      cancelled = true;
    };
  }, [activeVideoId, library, video?.id]);

  useEffect(() => {
    if (!pendingVideoId) return;

    let cancelled = false;
    const startedAt = Date.now();

    const tick = async () => {
      try {
        const latest = await fetchJson<VideoDetailResponse>(`/api/videos/${pendingVideoId}`);
        const summary = (latest.summary || "").toLowerCase();
        const ready =
          (summary && !summary.startsWith("processing")) ||
          Boolean(latest.pdf_url) ||
          Boolean(latest.transcript);

        if (!cancelled && ready) {
          setVideo(latest);
          setPendingVideoId(null);
          await hydrate(true).catch(() => null);
        }
      } catch {
        return;
      }
    };

    const interval = setInterval(() => {
      if (Date.now() - startedAt > 120000) {
        setPendingVideoId(null);
        return;
      }
      void tick();
    }, 2000);

    void tick();

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [pendingVideoId]);

  async function processVideo(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setAnswer("");
    setIsProcessing(true);
    const startedAt = Date.now();
    try {
      const data = await fetchJson<ProcessResponse>("/api/video/process", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ youtube_url: youtubeUrl }),
      });

      const durationSeconds = getVideoDurationSeconds(data.transcript || "");
      const targetDelayMs = getTargetDelayMs(durationSeconds);
      const elapsed = Date.now() - startedAt;
      const remaining = Math.max(0, targetDelayMs - elapsed);
      if (remaining) {
        await sleep(remaining);
      }

      setVideo({
        id: data.video_id,
        title: data.title,
        thumbnail: data.thumbnail || "",
        youtube_url: youtubeUrl,
        created_at: new Date().toISOString(),
        transcript: data.transcript || "",
        summary: data.summary,
        notes: data.notes,
        mindmap: data.mindmap,
        flashcards: data.flashcards,
        visual_insights: data.visual_insights,
        chapters: data.chapters || [],
        quiz: data.quiz || [],
        pdf_url: data.pdf_url,
        plan: data.plan,
      });
      setActiveVideoId(data.video_id);
      setLibrary((prev) => {
        const exists = prev.some((item) => item.id === data.video_id);
        if (exists) return prev;
        return [
          {
            id: data.video_id,
            youtube_url: youtubeUrl,
            title: data.title || "Processed Video",
            thumbnail: data.thumbnail || "",
            created_at: new Date().toISOString(),
            content: {
              summary: data.summary,
              notes: data.notes,
              chapters: data.chapters || [],
              quiz: data.quiz || [],
              pdf_url: data.pdf_url,
              mindmap: data.mindmap,
              flashcards: data.flashcards,
              visual_insights: data.visual_insights,
            },
          },
          ...prev,
        ];
      });
      setYoutubeUrl("");
      if (data.pending) {
        setPendingVideoId(data.video_id);
      } else {
        setPendingVideoId(null);
      }
      await hydrate(true).catch(() => null);
    } catch (e: any) {
      setError(e.message || "Unable to analyze video.");
    } finally {
      setIsProcessing(false);
    }
  }

  async function askQuestion(e: FormEvent) {
    e.preventDefault();
    if (!activeVideoId || !question.trim()) return;

    setIsAsking(true);
    setError(null);
    setAnswer("");
    const streamUrl = `${process.env.NEXT_PUBLIC_API_BASE_URL || ""}/api/qa/stream?video_id=${encodeURIComponent(activeVideoId)}&question=${encodeURIComponent(question)}`;
    if (typeof window !== "undefined" && "EventSource" in window) {
      const es = new EventSource(streamUrl);
      let buffer = "";
      let received = false;
      es.onmessage = (event) => {
        if (event.data === "[DONE]") {
          es.close();
          setIsAsking(false);
          setQuestion("");
          return;
        }
        received = true;
        buffer += event.data;
        setAnswer(buffer);
      };
      es.onerror = () => {
        es.close();
        if (!received) {
          fetchJson<{ answer: string }>("/api/qa/ask", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ video_id: activeVideoId, question }),
          })
            .then((data) => setAnswer(data.answer))
            .catch((e: any) => setError(e.message || "Unable to ask question."))
            .finally(() => setIsAsking(false));
          return;
        }
        setIsAsking(false);
      };
      return;
    }

    try {
      const data = await fetchJson<{ answer: string }>("/api/qa/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ video_id: activeVideoId, question }),
      });
      setAnswer(data.answer);
      setQuestion("");
    } catch (e: any) {
      setError(e.message || "Unable to ask question.");
    } finally {
      setIsAsking(false);
    }
  }

  async function askVisualInsight() {
    if (!activeVideoId || !visualQuestion.trim()) return;
    setIsVisualAsking(true);
    setVisualAnswer("");
    const streamUrl = `${process.env.NEXT_PUBLIC_API_BASE_URL || ""}/api/qa/stream?video_id=${encodeURIComponent(activeVideoId)}&question=${encodeURIComponent(visualQuestion)}`;
    if (typeof window !== "undefined" && "EventSource" in window) {
      const es = new EventSource(streamUrl);
      let buffer = "";
      let received = false;
      es.onmessage = (event) => {
        if (event.data === "[DONE]") {
          es.close();
          setIsVisualAsking(false);
          return;
        }
        received = true;
        buffer += event.data;
        setVisualAnswer(buffer);
      };
      es.onerror = () => {
        es.close();
        if (!received) {
          fetchJson<{ answer: string }>("/api/qa/ask", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ video_id: activeVideoId, question: visualQuestion }),
          })
            .then((data) => setVisualAnswer(data.answer))
            .catch((e: any) => setError(e.message || "Unable to ask question."))
            .finally(() => setIsVisualAsking(false));
          return;
        }
        setIsVisualAsking(false);
      };
      return;
    }

    try {
      const data = await fetchJson<{ answer: string }>("/api/qa/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ video_id: activeVideoId, question: visualQuestion }),
      });
      setVisualAnswer(data.answer);
    } catch (e: any) {
      setError(e.message || "Unable to ask question.");
    } finally {
      setIsVisualAsking(false);
    }
  }

  const usageLabel = useMemo(() => {
    if (!plan) return "";
    if (plan.usage.monthlyLimit === null) return `Videos analyzed this month: ${plan.usage.monthUsage}`;
    return `Videos analyzed this month: ${plan.usage.monthUsage}`;
  }, [plan]);

  const transcriptSegments = useMemo(
    () => parseTranscriptSegments(video?.transcript || ""),
    [video?.transcript]
  );

  async function copyNotes() {
    if (!video?.notes) return;
    await navigator.clipboard.writeText(JSON.stringify(video.notes, null, 2));
  }

  async function downloadPdf() {
    if (!video?.pdf_url) return;
    const url = video.pdf_url.startsWith("/")
      ? `${process.env.NEXT_PUBLIC_API_BASE_URL || ""}${video.pdf_url}`
      : video.pdf_url;
    const res = await fetch(url);
    if (!res.ok) return;
    const blob = await res.blob();
    const blobUrl = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = blobUrl;
    link.download = `${video.title || "study-notes"}.pdf`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(blobUrl);
  }

  return (
    <AppShell title="" subtitle={usageLabel} onMenuToggle={() => setSidebarOpen((prev) => !prev)}>
      <section className="hero">
        <div className="hero-content">
          <h2>OrionTutor Learning Assistant</h2>
          <p>Analyze YouTube videos, generate transcripts, summaries, and interact with AI to understand content faster.</p>
          <form onSubmit={processVideo} className="hero-form">
              <div className="hero-input">
                <Youtube size={18} />
                <Input
                  type="url"
                  required
                  value={youtubeUrl}
                  onChange={(e) => setYoutubeUrl(e.target.value)}
                  placeholder="Paste a YouTube link..."
                />
              </div>
            <Button
              variant="default"
              size="lg"
              type="submit"
              disabled={isProcessing}
              className="hero-cta btn-analyze"
            >
              {isProcessing ? (
                <>
                  <Spinner />
                  Analyzing...
                </>
              ) : (
                <>
                  <Play className="h-4 w-4" />
                  Analyze Video
                </>
              )}
            </Button>
          </form>
          {isProcessing ? (
            <div className="hero-loading">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-3/4" />
            </div>
          ) : null}
        </div>
      </section>

      <div className={`console-layout ${sidebarOpen ? "sidebar-open" : ""}`}>
        <aside className="console-sidebar">
          <div className="sidebar-section">
            <h4>Workspace</h4>
            {TAB_ITEMS.map((tab) => (
              <button
                key={tab.label}
                className={`sidebar-link ${activeTab === tab.label ? "active" : ""}`}
                onClick={() => setActiveTab(tab.label)}
              >
                <tab.icon size={16} />
                {tab.label}
              </button>
            ))}
            <button className="sidebar-link" onClick={() => router.push("/library")}>
              <LibraryIcon size={16} />
              Library
            </button>
          </div>
          <div className="sidebar-section">
            <h4>Library</h4>
            {isLoading ? <SkeletonLines count={4} /> : null}
            {library.slice(0, 6).map((item) => (
              <button
                key={item.id}
                className={`video-item ${activeVideoId === item.id ? "active" : ""}`}
                onClick={() => setActiveVideoId(item.id)}
              >
                <img src={item.thumbnail || "/favicon.ico"} alt={item.title} />
                <span>{item.title}</span>
              </button>
            ))}
          </div>
        </aside>

        <section className="console-center">
          <SectionCard title={<><Play className="h-5 w-5 mr-2" />Video Workspace</>}>
            {video ? (
              <>
                <VideoPlayer youtubeUrl={video.youtube_url} onReady={(seek) => setSeekTo(() => seek)} />
                {pendingVideoId ? (
                  <Alert>Analysis is in progress. Results will appear automatically within a few moments.</Alert>
                ) : null}
                {activeTab === "Summary" ? (
                  <StudyOutput
                    title={video.title}
                    summary={video.summary}
                    notes={video.notes}
                    transcript={video.transcript}
                    showTranscript={false}
                    sourceUrl={video.youtube_url}
                  />
                ) : null}
                {activeTab === "Transcript" ? (
                  <div className="transcript-panel">
                    <h4>Transcript with Timestamps</h4>
                    <div className="transcript-list">
                      {transcriptSegments.length ? (
                        transcriptSegments.map((seg, idx) => (
                          <button
                            key={`${seg.timestamp}-${idx}`}
                            className="transcript-row"
                            onClick={() => seekTo && seg.seconds ? seekTo(seg.seconds) : null}
                          >
                            <span className="ts">{seg.timestamp || "--:--"}</span>
                            <span>{seg.line}</span>
                          </button>
                        ))
                      ) : (
                        <p className="muted">Transcript will appear after analysis.</p>
                      )}
                    </div>
                  </div>
                ) : null}
                {activeTab === "Mind Map" ? (
                  <MindMap notes={video.notes} summary={video.summary} mindmap={video.mindmap as any} />
                ) : null}
                {activeTab === "Flashcards" ? (
                  <Flashcards
                    notes={video.notes}
                    summary={video.summary}
                    transcript={video.transcript}
                    flashcards={video.flashcards as Array<{ question: string; answer: string }> | undefined}
                  />
                ) : null}
                {activeTab === "Notes" ? (
                  <NotesPanel notes={video.notes} summary={video.summary} />
                ) : null}
                {activeTab === "Visual Insights" ? (
                  <div className="visual-insights">
                    <VisualInsights
                      insights={video.visual_insights as any}
                      onSeek={seekTo || undefined}
                      question={visualQuestion}
                      onQuestionChange={setVisualQuestion}
                      onAsk={askVisualInsight}
                      answer={visualAnswer}
                      loading={isVisualAsking}
                    />
                  </div>
                ) : null}
                {activeTab === "Ask AI" ? (
                  <div className="ask-ai-focus">
                    <p className="muted">Use the chat panel on the right to ask questions.</p>
                  </div>
                ) : null}
              </>
            ) : (
              <div className="empty-state">Analyze a video to unlock the workspace.</div>
            )}
          </SectionCard>
        </section>

        <aside className="console-right">
          <SectionCard
            title={<><BookOpen className="h-5 w-5 mr-2" />AI Learning Assistant</>}
            actions={
              <div className="dash-actions assistant-actions">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={copyNotes}
                  disabled={!video?.notes}
                  className="btn-utility"
                >
                  <Copy className="h-4 w-4" /> Copy Notes
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={downloadPdf}
                  disabled={!video?.pdf_url}
                  className="btn-primary"
                >
                  <Download className="h-4 w-4" /> Download PDF
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setShowTranscriptModal(true)}
                  disabled={!video}
                  className="btn-secondary"
                >
                  FULL TRANSCRIPT
                </Button>
              </div>
            }
          >
            <form onSubmit={askQuestion} className="stack-sm assistant-form">
              <div className="assistant-input-wrap">
                <Bot size={16} />
                <Textarea
                  value={question}
                  onChange={(e) => setQuestion(e.target.value)}
                  placeholder="Ask a question about the selected video"
                  className="assistant-input"
                />
              </div>
              <Button
                variant="default"
                size="lg"
                type="submit"
                disabled={isAsking || !activeVideoId}
                className="assistant-cta btn-ask"
              >
                {isAsking ? (
                  <>
                    <Spinner />
                    <span className="ml-2">Thinking...</span>
                  </>
                ) : (
                  <>
                    <Send className="h-4 w-4" />
                    Ask&nbsp;AI
                  </>
                )}
              </Button>
            </form>
            <div className="answer-box">
              {isAsking ? (
                <div className="thinking-row">
                  <span className="thinking-dots">
                    <span />
                    <span />
                    <span />
                  </span>
                  <span>Analyzing and composing a response...</span>
                </div>
              ) : answer ? (
                <AnswerOutput answer={answer} />
              ) : (
                "Answers will appear here. Ask a question to get started."
              )}
            </div>
            <div className="suggested-questions">
              <button onClick={() => setQuestion("Summarize the key concepts.")}>Summarize the key concepts</button>
              <button onClick={() => setQuestion("What are the main takeaways?")}>What are the main takeaways?</button>
              <button onClick={() => setQuestion("Explain the core idea in simple terms.")}>Explain the core idea in simple terms</button>
            </div>
          </SectionCard>
        </aside>
      </div>

      {error ? <p className="error-text">{error}</p> : null}

      <Modal
        open={showTranscriptModal}
        title="Full Transcript"
        onClose={() => setShowTranscriptModal(false)}
      >
        {video ? (
          <StudyOutput
            title={video.title}
            summary={video.summary}
            notes={video.notes}
            transcript={video.transcript}
            showTranscript={true}
            sourceUrl={video.youtube_url}
          />
        ) : (
          <p className="muted">No video selected.</p>
        )}
      </Modal>
    </AppShell>
  );
}
