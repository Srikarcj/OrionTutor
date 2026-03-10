import Link from "next/link";
import Head from "next/head";
import { useRouter } from "next/router";
import { Menu, PanelLeft } from "lucide-react";
import { SignedIn, SignedOut, SignInButton, UserButton } from "@clerk/nextjs";
import { ReactNode, useMemo, useState } from "react";

const navItems = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/library", label: "Library" },
  { href: "/summarize", label: "Summarize" },
  { href: "/ask", label: "Ask AI" },
  { href: "/features", label: "Features" },
  { href: "/how-it-works", label: "How It Works" },
  { href: "/documentation", label: "Documentation" },
  { href: "/about", label: "About" },
  { href: "/contact", label: "Contact" },
];

export function AppShell({
  title,
  subtitle,
  children,
  onMenuToggle,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  onMenuToggle?: () => void;
}) {
  const router = useRouter();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  const links = useMemo(
    () =>
      navItems.map((item) => {
        const active = router.pathname === item.href;
        return (
          <Link key={item.href} href={item.href} className={`app-nav-link ${active ? "active" : ""}`}>
            <span>{item.label}</span>
          </Link>
        );
      }),
    [router.pathname]
  );

  const pageTitle = title ? `${title} — OrionTutor` : "OrionTutor";

  return (
    <div className="shell-app">
      <Head>
        <title>{pageTitle}</title>
        <meta
          name="description"
          content="OrionTutor turns YouTube videos into transcripts, structured notes, flashcards, mind maps, and AI-powered explanations."
        />
        <link rel="icon" href="/oriontutor-favicon.svg" />
        <link rel="apple-touch-icon" href="/oriontutor-mark.svg" />
      </Head>
      <header className="app-header">
        <div className="app-header-left">
          <Link href="/" className="app-brand">
            <span className="app-brand-mark" aria-hidden="true">
              <img src="/oriontutor-mark.svg" alt="" />
            </span>
            <span className="app-brand-text">OrionTutor</span>
          </Link>
        </div>

        <nav className="app-nav">{links}</nav>

        <div className="app-header-right">
          {onMenuToggle ? (
            <button
              className="app-workspace-toggle"
              aria-label="Toggle workspace sidebar"
              onClick={onMenuToggle}
            >
              <PanelLeft size={18} />
            </button>
          ) : null}
          <button
            className="app-menu-toggle"
            aria-label="Toggle navigation"
            onClick={() => setMobileNavOpen((prev) => !prev)}
          >
            <Menu size={18} />
          </button>
          <SignedOut>
            <SignInButton mode="modal">
              <button className="app-ghost-btn">Sign in</button>
            </SignInButton>
          </SignedOut>
          <SignedIn>
            <UserButton afterSignOutUrl="/" />
          </SignedIn>
        </div>
      </header>

      <div className={`app-mobile-nav ${mobileNavOpen ? "open" : ""}`}>
        <nav className="app-mobile-links" onClick={() => setMobileNavOpen(false)}>
          {links}
        </nav>
        <div className="app-mobile-actions">
          <SignedOut>
            <SignInButton mode="modal">
              <button className="app-ghost-btn">Sign in</button>
            </SignInButton>
          </SignedOut>
          <SignedIn>
            <Link href="/dashboard" className="app-mobile-cta" onClick={() => setMobileNavOpen(false)}>
              Go to Dashboard
            </Link>
          </SignedIn>
        </div>
      </div>

      <main className="app-main">
        {title ? (
          <section className="shell-header-card">
            <h1>{title}</h1>
            {subtitle ? <p>{subtitle}</p> : null}
          </section>
        ) : null}
        {children}
      </main>

      <footer className="app-footer">
        <div className="app-footer-shell">
          <div className="app-footer-brand">
            <div className="app-footer-logo">
              <span className="app-brand-sigil" aria-hidden="true">
                <img src="/oriontutor-sigil.svg" alt="" />
              </span>
              <strong>OrionTutor</strong>
            </div>
            <p>
              The AI learning studio that transforms every video into structured notes, mind maps, flashcards,
              and explainers.
            </p>
            <div className="app-footer-cta">
              <SignedOut>
                <SignInButton mode="modal">
                  <button className="app-footer-btn">Sign in</button>
                </SignInButton>
              </SignedOut>
              <SignedIn>
                <Link href="/dashboard" className="app-footer-btn">
                  Go to Dashboard
                </Link>
              </SignedIn>
              <Link href="/features" className="app-footer-btn ghost">
                Explore Features
              </Link>
            </div>
          </div>
          <div className="app-footer-grid">
            <div>
              <h4>Product</h4>
              <Link href="/features">Features</Link>
              <Link href="/how-it-works">How It Works</Link>
              <Link href="/summarize">Summarize</Link>
              <Link href="/ask">Ask AI</Link>
            </div>
            <div>
              <h4>Resources</h4>
              <Link href="/documentation">Documentation</Link>
              <Link href="/library">Library</Link>
              <Link href="/about">About</Link>
              <Link href="/contact">Contact</Link>
            </div>
            <div>
              <h4>Legal</h4>
              <Link href="/privacy">Privacy Policy</Link>
              <Link href="/terms">Terms &amp; Conditions</Link>
            </div>
            <div>
              <h4>Social</h4>
              <a href="https://www.youtube.com" target="_blank" rel="noreferrer">
                YouTube
              </a>
              <a href="https://www.linkedin.com" target="_blank" rel="noreferrer">
                LinkedIn
              </a>
              <a href="https://www.x.com" target="_blank" rel="noreferrer">
                X (Twitter)
              </a>
            </div>
          </div>
        </div>
        <div className="app-footer-bottom">
          <span>&copy; {new Date().getFullYear()} OrionTutor. All rights reserved.</span>
          <span>Built for focused learners worldwide.</span>
        </div>
      </footer>
    </div>
  );
}
