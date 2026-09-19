import { useEffect, useRef, useState } from 'react'
import { Download } from 'lucide-react'
import { resumeData } from '../../data/resumeData'

const description = 'Resume of Abhiuday Narayan — Electrical Engineering student and machine learning developer.'

function useResumeMetadata() {
  useEffect(() => {
    const previousTitle = document.title
    const updates = [['name', 'description', description], ['property', 'og:title', 'Abhiuday Narayan | Resume'], ['property', 'og:description', description], ['property', 'og:type', 'profile'], ['property', 'og:url', `${window.location.origin}/resume`]]
    const created = []
    document.title = 'Abhiuday Narayan | Resume | Edgenix'
    updates.forEach(([attribute, value, content]) => {
      let tag = document.head.querySelector(`meta[${attribute}="${value}"]`)
      if (!tag) { tag = document.createElement('meta'); tag.setAttribute(attribute, value); document.head.appendChild(tag); created.push(tag) }
      tag.setAttribute('content', content)
    })
    return () => { document.title = previousTitle; created.forEach((tag) => tag.remove()) }
  }, [])
}

function Section({ title, children }) {
  const id = `resume-${title.toLowerCase().replaceAll(' ', '-')}`
  return <section className="resume-section" aria-labelledby={id}><h2 id={id} className="resume-section-title">{title}</h2>{children}</section>
}

const ResumePage = () => {
  useResumeMetadata()
  const [isDownloadCoolingDown, setIsDownloadCoolingDown] = useState(false)
  const downloadCoolingDownRef = useRef(false)
  const { name, contacts, education, skills, experience, projects, achievements } = resumeData
  const handleDownload = (event) => {
    if (downloadCoolingDownRef.current) {
      event.preventDefault()
      return
    }

    downloadCoolingDownRef.current = true
    setIsDownloadCoolingDown(true)
    window.setTimeout(() => {
      downloadCoolingDownRef.current = false
      setIsDownloadCoolingDown(false)
    }, 10_000)
  }

  return <div className="resume-page"><div className="container-page resume-page-inner">
    <div className="resume-actions print-hidden">
      <a className="btn btn-primary" href="/resume.pdf" download onClick={handleDownload} aria-disabled={isDownloadCoolingDown}>
        <Download className="h-4 w-4" aria-hidden="true" />
        {isDownloadCoolingDown ? 'Available in 10 seconds' : 'Download PDF'}
      </a>
      <p className="sr-only" aria-live="polite">{isDownloadCoolingDown ? 'PDF download is available again in 10 seconds.' : ''}</p>
    </div>
    <article className="resume-document" aria-label={`${name}'s resume`}>
      <header className="resume-header"><h1>{name}</h1><address className="resume-contacts">{contacts.map((contact, index) => <span key={contact.href}>{index > 0 && <span className="resume-contact-separator" aria-hidden="true">|</span>}<a href={contact.href} target={contact.href.startsWith('http') ? '_blank' : undefined} rel={contact.href.startsWith('http') ? 'noopener noreferrer' : undefined}>{contact.label}</a></span>)}</address></header>
      <Section title="Education"><div className="resume-entry"><div className="resume-entry-heading"><strong>{education.institution}</strong><span>{education.location}</span></div><div className="resume-entry-heading"><span>{education.qualification} <span className="resume-divider">|</span> {education.detail}</span><span>{education.graduation}</span></div><p>{education.secondary}</p></div></Section>
      <Section title="Technical Skills"><dl className="resume-skills">{skills.map((skill) => <div key={skill.label}><dt>{skill.label}:</dt><dd>{skill.items}</dd></div>)}</dl></Section>
      <Section title="Experience">{experience.map((item) => <div className="resume-entry" key={item.title}><div className="resume-entry-heading"><strong>{item.title}</strong><span>{item.date}</span></div><div className="resume-entry-heading"><em>{item.organization}</em><span>{item.location}</span></div><ul>{item.bullets.map((bullet) => <li key={bullet}>{bullet}</li>)}</ul></div>)}</Section>
      <Section title="Projects">{projects.map((project) => <div className="resume-entry" key={project.title}><p><strong>{project.title}</strong><span className="resume-divider">|</span> <em>{project.technologies}</em></p><ul>{project.bullets.map((bullet) => <li key={bullet}>{bullet}</li>)}</ul></div>)}</Section>
      <Section title="Achievements & Leadership"><ul className="resume-achievements">{achievements.map((achievement) => <li key={achievement}>{achievement}</li>)}</ul></Section>
    </article>
  </div></div>
}

export default ResumePage
