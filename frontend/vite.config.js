import { defineConfig } from 'vite'
import { resolve } from 'node:path'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { resumeData } from './src/data/resumeData.js'

const escapeHtml = (value) => String(value)
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;')
  .replaceAll("'", '&#039;')

const list = (items) => `<ul>${items.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul>`

function resumeStaticFallbackPlugin() {
  const { name, contacts, education, skills, experience, projects, achievements } = resumeData
  const staticFallback = `
    <article id="resume-static-fallback" aria-label="${escapeHtml(name)} resume">
      <header>
        <h1>${escapeHtml(name)}</h1>
        <p>${contacts.map((contact) => `<a href="${escapeHtml(contact.href)}">${escapeHtml(contact.label)}</a>`).join(' | ')}</p>
      </header>
      <section><h2>Education</h2><p><strong>${escapeHtml(education.institution)}</strong>, ${escapeHtml(education.location)}</p><p>${escapeHtml(education.qualification)} | ${escapeHtml(education.detail)} | ${escapeHtml(education.graduation)}</p><p>${escapeHtml(education.secondary)}</p></section>
      <section><h2>Technical Skills</h2><dl>${skills.map((skill) => `<div><dt>${escapeHtml(skill.label)}</dt><dd>${escapeHtml(skill.items)}</dd></div>`).join('')}</dl></section>
      <section><h2>Experience</h2>${experience.map((item) => `<article><h3>${escapeHtml(item.title)}</h3><p>${escapeHtml(item.date)}</p><p>${escapeHtml(item.organization)}, ${escapeHtml(item.location)}</p>${list(item.bullets)}</article>`).join('')}</section>
      <section><h2>Projects</h2>${projects.map((project) => `<article><h3>${escapeHtml(project.title)}</h3><p>${escapeHtml(project.technologies)}</p>${list(project.bullets)}</article>`).join('')}</section>
      <section><h2>Achievements &amp; Leadership</h2>${list(achievements)}</section>
    </article>`
  const jsonLd = JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'Person',
    name,
    url: 'https://www.edgenix.dev/resume',
    email: contacts.find((contact) => contact.href.startsWith('mailto:'))?.href.replace('mailto:', ''),
    telephone: contacts.find((contact) => contact.href.startsWith('tel:'))?.href.replace('tel:', ''),
    sameAs: contacts.filter((contact) => contact.href.startsWith('https://')).map((contact) => contact.href),
    alumniOf: { '@type': 'CollegeOrUniversity', name: education.institution },
    jobTitle: experience[0]?.title,
    knowsAbout: skills.flatMap((skill) => skill.items.split(', ')),
  }).replaceAll('<', '\\u003c')

  return {
    name: 'resume-static-fallback',
    transformIndexHtml: {
      order: 'pre',
      handler(html, context) {
        if (!html.includes('<!-- resume-static-fallback -->')) return html

        const withStaticFallback = html.replace('<!-- resume-static-fallback -->', staticFallback)
        return context.path.startsWith('/resume')
          ? withStaticFallback.replace('<!-- resume-json-ld -->', `<script type="application/ld+json">${jsonLd}</script>`)
          : withStaticFallback
      },
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss(), resumeStaticFallbackPlugin()],
  build: {
    rollupOptions: {
      input: {
        main: resolve(import.meta.dirname, 'index.html'),
        resume: resolve(import.meta.dirname, 'resume/index.html'),
      },
    },
  },
})
