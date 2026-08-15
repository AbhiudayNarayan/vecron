import { useState } from "react";
import { ArrowRight, Bell, Camera, FileText, ShieldCheck, Workflow } from "lucide-react";

const workflows = [
    { title: "Fire Alert", steps: ["Camera feed", "Fire Detection", "Notification"], icons: [Camera, ShieldCheck, Bell] },
    { title: "Invoice Scanner", steps: ["Document", "OCR", "Inventory"], icons: [FileText, Workflow, Bell] },
    { title: "Safety Monitor", steps: ["Camera", "Person Detection", "Zone alert"], icons: [Camera, ShieldCheck, Bell] },
];

export default function WorkflowsPage() {
    const [noticeOpen, setNoticeOpen] = useState(false);

    return (
        <main className="flex-1 bg-canvas text-ink">
            <section className="container-page py-14 md:py-20">
                <div className="mx-auto max-w-2xl text-center">
                    <span className="badge badge-brand">Coming soon</span>
                    <h1 className="mt-4 text-4xl font-extrabold tracking-tight md:text-5xl">Workflows</h1>
                    <p className="mt-4 text-lg text-muted">Connect AI capabilities to automate real-world tasks.</p>
                </div>

                <div className="mt-12 grid gap-6 lg:grid-cols-3">
                    {workflows.map(({ title, steps, icons }) => (
                        <article key={title} className="card card-pad">
                            <h2 className="text-xl font-bold">{title}</h2>
                            <div className="mt-7 flex items-center justify-between gap-2">
                                {steps.map((step, index) => {
                                    const Icon = icons[index];
                                    return (
                                        <div key={step} className="flex min-w-0 items-center gap-2">
                                            {index > 0 && <ArrowRight className="h-4 w-4 shrink-0 text-accent" aria-hidden="true" />}
                                            <div className="min-w-0 text-center">
                                                <span className="mx-auto flex h-10 w-10 items-center justify-center rounded-xl bg-primary-soft text-accent"><Icon className="h-5 w-5" /></span>
                                                <p className="mt-2 text-xs font-semibold text-muted">{step}</p>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </article>
                    ))}
                </div>

                <div className="mt-12 text-center">
                    <button type="button" className="btn btn-primary btn-lg" onClick={() => setNoticeOpen(true)}>
                        Create workflow <ArrowRight className="h-4 w-4" />
                    </button>
                </div>
            </section>

            {noticeOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/30 p-5" role="dialog" aria-modal="true" aria-labelledby="workflow-notice-title">
                    <div className="card w-full max-w-md card-pad shadow-float">
                        <span className="badge badge-brand">Coming soon</span>
                        <h2 id="workflow-notice-title" className="mt-3 text-xl font-bold">Workflow builder is on its way</h2>
                        <p className="mt-2 text-sm text-muted">Workflow creation is not available yet. Check back soon for a way to connect capabilities into repeatable tasks.</p>
                        <button type="button" className="btn btn-primary mt-6" onClick={() => setNoticeOpen(false)}>Got it</button>
                    </div>
                </div>
            )}
        </main>
    );
}
