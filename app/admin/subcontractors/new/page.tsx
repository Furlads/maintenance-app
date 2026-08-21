'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'

const contractors = [
  { id: 'mark', name: 'Mark P', trade: 'Plasterer', area: 'Newport / Telford' },
  { id: 'dan', name: 'Dan R', trade: 'Plumber', area: 'Shropshire' },
  { id: 'liam', name: 'Liam E', trade: 'Electrician', area: 'North Shropshire' },
]

export default function NewSubcontractorOpportunityPage() {
  const [selected, setSelected] = useState<string[]>(['mark'])
  const [mode, setMode] = useState<'price' | 'quote'>('price')

  const selectedNames = useMemo(
    () => contractors.filter((contractor) => selected.includes(contractor.id)).map((contractor) => contractor.name),
    [selected]
  )

  function toggleContractor(id: string) {
    setSelected((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id])
  }

  return (
    <div className="send-page">
      <style>{`
        .send-page { padding: 4px 0 26px; }
        .send-back { display:inline-flex; margin-bottom:12px; color:#57634f; text-decoration:none; font-size:13px; font-weight:800; }
        .send-layout { display:grid; grid-template-columns:minmax(0,1.2fr) minmax(320px,.8fr); gap:18px; align-items:start; }
        .send-card { background:white; border:1px solid #e1e8dc; border-radius:24px; padding:22px; box-shadow:0 12px 34px rgba(31,52,22,.06); }
        .send-kicker { color:#789333; font-size:10px; font-weight:950; letter-spacing:.8px; text-transform:uppercase; }
        .send-title { margin:6px 0 0; font-size:30px; line-height:1.05; letter-spacing:-.8px; color:#1b2717; font-weight:950; }
        .send-copy { margin:10px 0 0; color:#65705f; font-size:14px; line-height:1.5; font-weight:600; }
        .send-form { display:grid; gap:16px; margin-top:20px; }
        .send-grid { display:grid; grid-template-columns:1fr 1fr; gap:12px; }
        .send-label { display:block; margin-bottom:7px; color:#4f5d48; font-size:11px; text-transform:uppercase; letter-spacing:.7px; font-weight:900; }
        .send-input, .send-textarea, .send-select { width:100%; border:1px solid #d8dfd3; background:#fbfcfa; border-radius:14px; padding:12px 13px; color:#1f2a1b; font:inherit; font-size:14px; font-weight:650; outline:none; box-sizing:border-box; }
        .send-input:focus, .send-textarea:focus, .send-select:focus { border-color:#9fbe55; box-shadow:0 0 0 3px rgba(159,190,85,.14); }
        .send-textarea { min-height:125px; resize:vertical; line-height:1.5; }
        .send-choice { display:grid; grid-template-columns:1fr 1fr; gap:9px; }
        .send-choice button { min-height:48px; border-radius:14px; border:1px solid #d8dfd3; background:#fbfcfa; color:#4f5a49; font:inherit; font-size:13px; font-weight:900; cursor:pointer; }
        .send-choice button.active { background:#1d2c17; color:white; border-color:#1d2c17; box-shadow:0 8px 20px rgba(29,44,23,.18); }
        .send-contractors { display:grid; gap:8px; }
        .send-contractor { width:100%; display:grid; grid-template-columns:auto 1fr auto; align-items:center; gap:11px; text-align:left; padding:12px; border-radius:15px; border:1px solid #e0e6db; background:#fbfcfa; cursor:pointer; }
        .send-contractor.selected { background:#f0f6e6; border-color:#bcd17e; }
        .send-check { width:20px; height:20px; border-radius:6px; display:flex; align-items:center; justify-content:center; background:white; border:1px solid #cbd5c3; color:#36511b; font-size:12px; font-weight:950; }
        .send-contractor.selected .send-check { background:#a8ca4a; border-color:#8dae37; }
        .send-name { color:#263220; font-size:13px; font-weight:900; }
        .send-meta { margin-top:2px; color:#7a8374; font-size:11px; font-weight:650; }
        .send-pill { padding:6px 8px; border-radius:999px; background:#edf3e4; color:#59712c; font-size:10px; font-weight:900; }
        .send-preview { position:sticky; top:92px; background:linear-gradient(145deg,#142311 0%,#23381a 62%,#30491d 100%); color:white; border:0; overflow:hidden; }
        .send-preview:after { content:''; position:absolute; width:250px; height:250px; border-radius:50%; background:rgba(174,211,73,.09); right:-120px; top:-120px; }
        .send-preview-inner { position:relative; z-index:1; }
        .send-preview-label { color:#b9d974; font-size:10px; text-transform:uppercase; letter-spacing:.8px; font-weight:950; }
        .send-preview h2 { margin:7px 0 0; font-size:26px; line-height:1.05; letter-spacing:-.6px; }
        .send-preview-box { margin-top:15px; border:1px solid rgba(255,255,255,.12); background:rgba(255,255,255,.07); border-radius:16px; padding:14px; }
        .send-preview-row { display:flex; justify-content:space-between; gap:12px; padding:8px 0; border-bottom:1px solid rgba(255,255,255,.09); font-size:12px; }
        .send-preview-row:last-child { border-bottom:0; }
        .send-preview-row span:first-child { color:#bcd0b3; font-weight:700; }
        .send-preview-row span:last-child { color:white; text-align:right; font-weight:900; }
        .send-wa { margin-top:15px; background:white; color:#263220; border-radius:16px; padding:14px; }
        .send-wa-title { font-size:11px; color:#6f7c68; font-weight:900; text-transform:uppercase; letter-spacing:.6px; }
        .send-wa-copy { margin-top:7px; font-size:13px; line-height:1.45; font-weight:700; }
        .send-footer-actions { display:flex; gap:9px; flex-wrap:wrap; margin-top:17px; }
        .send-btn { min-height:47px; display:inline-flex; align-items:center; justify-content:center; border:0; border-radius:14px; padding:0 16px; font:inherit; font-size:13px; font-weight:950; text-decoration:none; cursor:pointer; }
        .send-btn-primary { background:#a8ca4a; color:#18220f; }
        .send-btn-secondary { background:#f5f7f2; border:1px solid #dce2d7; color:#4a5545; }
        .send-note { margin-top:12px; color:#7b8575; font-size:11px; line-height:1.45; font-weight:650; }
        @media (max-width:900px) { .send-layout { grid-template-columns:1fr; } .send-preview { position:relative; top:auto; } }
        @media (max-width:620px) { .send-card { padding:17px; border-radius:20px; } .send-grid, .send-choice { grid-template-columns:1fr; } .send-footer-actions .send-btn { width:100%; } }
      `}</style>

      <Link href="/admin/subcontractors" className="send-back">← Back to subcontractors</Link>

      <div className="send-layout">
        <section className="send-card">
          <div className="send-kicker">New opportunity</div>
          <h1 className="send-title">Send work to subcontractors</h1>
          <p className="send-copy">Keep the first message vague enough to protect the customer, but useful enough for a contractor to decide whether they want to look at it.</p>

          <div className="send-form">
            <div className="send-grid">
              <label><span className="send-label">Company</span><select className="send-select" defaultValue="three-counties"><option value="three-counties">Three Counties Property Care</option><option value="furlads">Furlads</option></select></label>
              <label><span className="send-label">Source</span><select className="send-select" defaultValue="job"><option value="job">Existing job</option><option value="quote">Quote / enquiry</option><option value="manual">Manual opportunity</option></select></label>
            </div>

            <div className="send-grid">
              <label><span className="send-label">Trade</span><select className="send-select" defaultValue="Plastering"><option>Plastering</option><option>Electrical</option><option>Plumbing</option><option>Carpentry</option><option>Roofing</option><option>Groundworks</option><option>Landscaping</option></select></label>
              <label><span className="send-label">Rough area only</span><input className="send-input" defaultValue="Newport area" /></label>
            </div>

            <label><span className="send-label">Opportunity title</span><input className="send-input" defaultValue="Full room re-plaster" /></label>
            <label><span className="send-label">Public job description</span><textarea className="send-textarea" defaultValue="Existing room requires preparation and a full skim finish to walls and ceiling. Standard occupied residential property." /></label>

            <div className="send-grid">
              <label><span className="send-label">Likely duration</span><input className="send-input" defaultValue="2–3 days" /></label>
              <label><span className="send-label">Target timing</span><input className="send-input" defaultValue="Within the next 2 weeks" /></label>
            </div>

            <div>
              <span className="send-label">How are we pricing this?</span>
              <div className="send-choice">
                <button type="button" className={mode === 'price' ? 'active' : ''} onClick={() => setMode('price')}>Offer a fixed subcontract price</button>
                <button type="button" className={mode === 'quote' ? 'active' : ''} onClick={() => setMode('quote')}>Ask them to quote</button>
              </div>
            </div>

            {mode === 'price' ? (
              <label><span className="send-label">Subcontractor price</span><input className="send-input" defaultValue="£850" /></label>
            ) : (
              <label><span className="send-label">Quote guidance</span><input className="send-input" placeholder="e.g. Price labour and standard materials" /></label>
            )}

            <div>
              <span className="send-label">Send to</span>
              <div className="send-contractors">
                {contractors.map((contractor) => {
                  const isSelected = selected.includes(contractor.id)
                  return (
                    <button type="button" key={contractor.id} className={`send-contractor${isSelected ? ' selected' : ''}`} onClick={() => toggleContractor(contractor.id)}>
                      <span className="send-check">{isSelected ? '✓' : ''}</span>
                      <span><span className="send-name">{contractor.name}</span><span className="send-meta">{contractor.trade} · {contractor.area}</span></span>
                      <span className="send-pill">WhatsApp</span>
                    </button>
                  )
                })}
              </div>
            </div>
          </div>
        </section>

        <aside className="send-card send-preview">
          <div className="send-preview-inner">
            <div className="send-preview-label">Before you send</div>
            <h2>Contractor preview</h2>
            <div className="send-preview-box">
              <div className="send-preview-row"><span>Trade</span><span>Plastering</span></div>
              <div className="send-preview-row"><span>Rough area</span><span>Newport area</span></div>
              <div className="send-preview-row"><span>Duration</span><span>2–3 days</span></div>
              <div className="send-preview-row"><span>{mode === 'price' ? 'Trade price' : 'Pricing'}</span><span>{mode === 'price' ? '£850' : 'Quote requested'}</span></div>
            </div>

            <div className="send-wa">
              <div className="send-wa-title">WhatsApp message</div>
              <div className="send-wa-copy">Hi — we’ve got a new Plastering opportunity around the Newport area. Tap the link below to see the outline and let us know if you’re interested.</div>
            </div>

            <div className="send-footer-actions">
              <button type="button" className="send-btn send-btn-primary">Send on WhatsApp</button>
              <Link href="/contractor/opportunity/demo" target="_blank" className="send-btn send-btn-secondary">Open preview ↗</Link>
            </div>
            <div className="send-note">Selected: {selectedNames.length ? selectedNames.join(', ') : 'No contractors yet'}. Live sending will create a unique private link per contractor so every view, interest, decline and acceptance can be tracked separately.</div>
          </div>
        </aside>
      </div>
    </div>
  )
}
