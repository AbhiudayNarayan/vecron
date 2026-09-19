import React from 'react'
import { Link } from 'react-router-dom'
import BrandMark from './BrandMark'

// Lucide removed brand glyphs, so the social marks are inline SVGs (currentColor).
function LinkedinIcon({ className }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path d="M20.45 20.45h-3.55v-5.57c0-1.33-.02-3.04-1.85-3.04-1.85 0-2.14 1.45-2.14 2.94v5.67H9.35V9h3.41v1.56h.05c.47-.9 1.64-1.85 3.37-1.85 3.6 0 4.27 2.37 4.27 5.46v6.28zM5.34 7.43a2.06 2.06 0 1 1 0-4.12 2.06 2.06 0 0 1 0 4.12zM7.12 20.45H3.56V9h3.56v11.45zM22.22 0H1.77C.79 0 0 .77 0 1.73v20.54C0 23.23.79 24 1.77 24h20.45c.98 0 1.78-.77 1.78-1.73V1.73C24 .77 23.2 0 22.22 0z" />
    </svg>
  )
}

function GithubIcon({ className }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path d="M12 .5C5.37.5 0 5.87 0 12.5c0 5.3 3.44 9.8 8.21 11.39.6.11.82-.26.82-.58v-2.03c-3.34.73-4.04-1.61-4.04-1.61-.55-1.39-1.34-1.76-1.34-1.76-1.09-.75.08-.73.08-.73 1.2.08 1.84 1.24 1.84 1.24 1.07 1.84 2.81 1.31 3.5 1 .11-.78.42-1.31.76-1.61-2.67-.3-5.47-1.34-5.47-5.95 0-1.31.47-2.39 1.24-3.23-.13-.3-.54-1.52.12-3.18 0 0 1.01-.32 3.3 1.23a11.5 11.5 0 0 1 6 0c2.29-1.55 3.3-1.23 3.3-1.23.66 1.66.25 2.88.12 3.18.77.84 1.23 1.92 1.23 3.23 0 4.62-2.81 5.64-5.49 5.94.43.37.81 1.1.81 2.22v3.29c0 .32.22.7.83.58A12.01 12.01 0 0 0 24 12.5C24 5.87 18.63.5 12 .5z" />
    </svg>
  )
}

const Footer = () => {
  return (
    <footer className="mt-auto border-t border-line bg-surface">
      <div className="container-page flex flex-col items-center gap-6 py-10 sm:flex-row sm:justify-between">
        {/* Brand + tagline */}
        <div className="flex flex-col items-center gap-3 sm:items-start">
          <Link to="/" className="flex items-center gap-2.5" aria-label="Edgenix home">
            <BrandMark className="h-9 w-9" />
            <span className="text-xl font-extrabold tracking-tight text-ink">Edgenix</span>
          </Link>
          <p className="max-w-xs text-center text-sm text-muted sm:text-left">
            Find the right AI capability. Run it where you need it.
          </p>
        </div>

        {/* Quick links */}
        <nav className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm font-medium text-muted">
          <Link to="/catalog" className="transition-colors hover:text-accent">AI Catalog</Link>
          <Link to="/workflows" className="transition-colors hover:text-accent">Workflows</Link>
          <Link to="/resume" className="transition-colors hover:text-accent">Resume</Link>
          <Link to="/register" className="transition-colors hover:text-accent">Get started</Link>
        </nav>

        {/* Socials */}
        <div className="flex items-center gap-2">
          <a
            href="https://www.linkedin.com/in/abhiuday-narayan-a44153327/"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="LinkedIn"
            className="flex h-9 w-9 items-center justify-center rounded-pill text-muted transition-colors hover:bg-surface-2 hover:text-accent"
          >
            <LinkedinIcon className="h-[18px] w-[18px]" />
          </a>
          <a
            href="https://github.com/"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="GitHub"
            className="flex h-9 w-9 items-center justify-center rounded-pill text-muted transition-colors hover:bg-surface-2 hover:text-accent"
          >
            <GithubIcon className="h-[18px] w-[18px]" />
          </a>
        </div>
      </div>

      <div className="border-t border-line">
        <div className="container-page flex flex-col items-center justify-between gap-2 py-4 text-xs text-faint sm:flex-row">
          <p>© 2026 Edgenix. All rights reserved.</p>
          <p>
            Built by{' '}
            <a
              href="https://www.linkedin.com/in/abhiuday-narayan-a44153327/"
              target="_blank"
              rel="noopener noreferrer"
              className="font-semibold text-accent hover:text-accent-strong"
            >
              @abhiuday
            </a>
          </p>
        </div>
      </div>
    </footer>
  )
}

export default Footer
