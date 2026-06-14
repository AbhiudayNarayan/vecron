import React from 'react';

/**
 * BrandMark — Kriya's logo mark. A soft rounded saffron tile with a stylised
 * "k" / spark glyph. Shared by Navbar and Footer so the brand is identical
 * everywhere. Colors come from the design tokens (honey fill + dark ink).
 */
export default function BrandMark({ className = 'h-9 w-9' }) {
    return (
        <span
            className={`inline-flex items-center justify-center rounded-xl bg-primary text-on-primary shadow-soft ${className}`}
            aria-hidden="true"
        >
            <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={2.2}
                strokeLinecap="round"
                strokeLinejoin="round"
                className="h-1/2 w-1/2"
            >
                {/* stylised 'k' */}
                <path d="M8 4v16" />
                <path d="M16 5l-7 7 7 7" />
            </svg>
        </span>
    );
}
