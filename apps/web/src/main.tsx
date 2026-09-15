import React from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';

function App() {
  return (
    <main className="shell">
      <header className="header">
        <div className="brand">LIFEOS</div>
        <div className="tagline">Everything about your life. One intelligent place.</div>
      </header>
      <section className="hero">
        <p className="eyebrow">PERSONAL OPERATING SYSTEM</p>
        <h1>Ask your life.</h1>
        <p className="subtitle">Search your documents, memories, tasks, assets and everything that matters.</p>
        <div className="search">Ask anything about your life… <span>⌕</span></div>
      </section>
      <section className="grid">
        <article><strong>Today</strong><p>Tasks and reminders will appear here.</p></article>
        <article><strong>Documents</strong><p>Upload receipts, warranties, policies and important files.</p></article>
        <article><strong>Memories</strong><p>LIFEOS will remember the things you choose to keep.</p></article>
        <article><strong>Assets</strong><p>Track products, warranties and ownership details.</p></article>
      </section>
    </main>
  );
}

createRoot(document.getElementById('root')!).render(<React.StrictMode><App /></React.StrictMode>);
