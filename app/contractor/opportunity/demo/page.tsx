'use client'

import { useState } from 'react'
import Image from 'next/image'

export default function ContractorOpportunityDemoPage() {
  const [response, setResponse] = useState<'interested' | 'declined' | null>(null)

  return (
    <main className="contractor-opportunity-page">
      <style>{`
        .contractor-opportunity-page {
          min-height: 100dvh;
          background:
            radial-gradient(circle at 85% 8%, rgba(171,207,69,.18), transparent 28%),
            linear-gradient(180deg,#eef2e9 0%,#f7f8f5 46%,#ffffff 100%);
          color:#162111;
          padding:18px;
          display:flex;
          align-items:center;
          justify-content:center;
        }
        .contractor-shell {
          width:100%;
          max-width:760px;
          margin:0 auto;
        }
        .contractor-hero {
          position:relative;
          overflow:hidden;
          background:linear-gradient(145deg,#13220f 0%,#223718 62%,#30491c 100%);
          color:#fff;
          border-radius:30px;
          padding:24px;
          box-shadow:0 24px 60px rgba(29,52,19,.22);
        }
        .contractor-hero:after {
          content:'';
          position:absolute;
          width:260px;
          height:260px;
          border-radius:50%;
          background:rgba(174,211,73,.09);
          right:-110px;
          top:-110px;
          pointer-events:none;
        }
        .contractor-top {
          position:relative;
          z-index:1;
          display:flex;
          justify-content:space-between;
          align-items:flex-start;
          gap:18px;
        }
        .contractor-brand {
          width:150px;
          max-width:42vw;
          background:#fff;
          border-radius:17px;
          padding:9px 12px;
          box-shadow:0 10px 28px rgba(0,0,0,.18);
        }
        .contractor-pill {
          display:inline-flex;
          align-items:center;
          gap:7px;
          padding:8px 11px;
          background:rgba(255,255,255,.1);
          border:1px solid rgba(255,255,255,.14);
          border-radius:999px;
          font-size:12px;
          font-weight:850;
          color:#ddebba;
          white-space:nowrap;
        }
        .contractor-kicker {
          position:relative;
          z-index:1;
          margin-top:26px;
          color:#b8d874;
          font-size:12px;
          font-weight:900;
          text-transform:uppercase;
          letter-spacing:.9px;
        }
        .contractor-title {
          position:relative;
          z-index:1;
          margin:7px 0 0;
          max-width:590px;
          font-size:clamp(34px,7vw,54px);
          line-height:.98;
          letter-spacing:-1.8px;
          font-weight:950;
        }
        .contractor-intro {
          position:relative;
          z-index:1;
          margin:14px 0 0;
          max-width:570px;
          color:#dce6d6;
          font-size:16px;
          line-height:1.5;
          font-weight:600;
        }
        .contractor-grid {
          position:relative;
          z-index:1;
          display:grid;
          grid-template-columns:repeat(3,minmax(0,1fr));
          gap:10px;
          margin-top:24px;
        }
        .contractor-stat {
          background:rgba(255,255,255,.085);
          border:1px solid rgba(255,255,255,.12);
          border-radius:18px;
          padding:14px;
          min-height:92px;
        }
        .contractor-stat-label {
          font-size:10px;
          font-weight:900;
          letter-spacing:.8px;
          color:#b8d874;
          text-transform:uppercase;
        }
        .contractor-stat-value {
          margin-top:7px;
          font-size:17px;
          line-height:1.2;
          font-weight:900;
        }
        .contractor-body {
          margin-top:14px;
          display:grid;
          grid-template-columns:1.25fr .75fr;
          gap:14px;
        }
        .contractor-card {
          background:#fff;
          border:1px solid #dfe6d7;
          border-radius:24px;
          padding:20px;
          box-shadow:0 14px 38px rgba(31,52,22,.08);
        }
        .contractor-card-label {
          margin:0;
          color:#6d852f;
          font-size:11px;
          font-weight:950;
          text-transform:uppercase;
          letter-spacing:.85px;
        }
        .contractor-card h2 {
          margin:7px 0 0;
          font-size:24px;
          line-height:1.08;
          letter-spacing:-.5px;
        }
        .contractor-scope {
          margin:14px 0 0;
          color:#4c5547;
          font-size:15px;
          line-height:1.55;
          font-weight:600;
        }
        .contractor-privacy {
          margin-top:17px;
          padding:13px 14px;
          border-radius:15px;
          background:#f0f5e8;
          border:1px solid #d8e5c2;
          display:flex;
          gap:10px;
          align-items:flex-start;
          color:#435334;
          font-size:13px;
          line-height:1.4;
          font-weight:700;
        }
        .contractor-price-card {
          background:#f7f9f2;
          border-color:#d7e4bf;
          display:flex;
          flex-direction:column;
          justify-content:space-between;
        }
        .contractor-price {
          margin-top:9px;
          font-size:44px;
          line-height:1;
          letter-spacing:-1.5px;
          font-weight:950;
          color:#1f3215;
        }
        .contractor-price-note {
          margin-top:8px;
          color:#66705e;
          font-size:13px;
          line-height:1.4;
          font-weight:650;
        }
        .contractor-actions {
          display:grid;
          grid-template-columns:1fr 1fr;
          gap:10px;
          margin-top:14px;
        }
        .contractor-action {
          min-height:58px;
          border-radius:17px;
          border:0;
          padding:12px 14px;
          font-size:15px;
          font-weight:950;
          cursor:pointer;
        }
        .contractor-action-primary {
          background:#91b83d;
          color:#17220f;
          box-shadow:0 10px 24px rgba(94,128,34,.25);
        }
        .contractor-action-secondary {
          background:#fff;
          color:#4c5547;
          border:1px solid #d8ddd3;
        }
        .contractor-response {
          margin-top:14px;
          border-radius:18px;
          padding:16px;
          font-size:14px;
          line-height:1.45;
          font-weight:800;
        }
        .contractor-response.interested {
          background:#eaf5d6;
          border:1px solid #b9d77d;
          color:#314816;
        }
        .contractor-response.declined {
          background:#f3f3f1;
          border:1px solid #deded9;
          color:#575752;
        }
        .contractor-footer {
          text-align:center;
          margin:14px 0 0;
          color:#7b8375;
          font-size:12px;
          font-weight:650;
        }
        @media (max-width:620px) {
          .contractor-opportunity-page { padding:10px; align-items:flex-start; }
          .contractor-shell { max-width:none; }
          .contractor-hero { border-radius:24px; padding:18px; }
          .contractor-brand { width:132px; border-radius:14px; }
          .contractor-pill { font-size:10px; padding:7px 9px; }
          .contractor-kicker { margin-top:22px; }
          .contractor-title { font-size:38px; }
          .contractor-intro { font-size:14px; }
          .contractor-grid { grid-template-columns:1fr; gap:8px; }
          .contractor-stat { min-height:0; display:flex; align-items:center; justify-content:space-between; gap:12px; padding:12px 13px; }
          .contractor-stat-value { margin-top:0; text-align:right; font-size:15px; }
          .contractor-body { grid-template-columns:1fr; gap:10px; }
          .contractor-card { border-radius:20px; padding:17px; }
          .contractor-price-card { min-height:0; }
          .contractor-actions { grid-template-columns:1fr; }
          .contractor-action { min-height:56px; }
        }
      `}</style>

      <div className="contractor-shell">
        <section className="contractor-hero">
          <div className="contractor-top">
            <div className="contractor-brand">
              <Image
                src="/branding/threecounties-logo.png"
                alt="Three Counties Property Care"
                width={260}
                height={100}
                priority
                style={{ width:'100%', height:'auto', objectFit:'contain' }}
              />
            </div>
            <div className="contractor-pill">🔒 Private opportunity</div>
          </div>

          <div className="contractor-kicker">New work opportunity</div>
          <h1 className="contractor-title">Interested in this job?</h1>
          <p className="contractor-intro">
            We’re checking availability before sharing any customer information. Have a look at the outline below and tell us if you’d like the full details.
          </p>

          <div className="contractor-grid">
            <div className="contractor-stat">
              <div className="contractor-stat-label">Trade</div>
              <div className="contractor-stat-value">Plastering</div>
            </div>
            <div className="contractor-stat">
              <div className="contractor-stat-label">Rough area</div>
              <div className="contractor-stat-value">Newport area</div>
            </div>
            <div className="contractor-stat">
              <div className="contractor-stat-label">Likely duration</div>
              <div className="contractor-stat-value">2–3 days</div>
            </div>
          </div>
        </section>

        <div className="contractor-body">
          <section className="contractor-card">
            <p className="contractor-card-label">Job outline</p>
            <h2>Full room re-plaster</h2>
            <p className="contractor-scope">
              Existing room requires preparation and a full skim finish to walls and ceiling. Standard occupied residential property. This is the initial opportunity only — exact measurements, photos, customer details and access information are held back until you ask to see more.
            </p>

            <div className="contractor-privacy">
              <span>🛡️</span>
              <span>No customer name, address, contact details or identifying photos have been shared at this stage.</span>
            </div>
          </section>

          <aside className="contractor-card contractor-price-card">
            <div>
              <p className="contractor-card-label">Trade price</p>
              <div className="contractor-price">£850</div>
              <div className="contractor-price-note">Proposed fixed subcontractor price for the described works. Final scope would be shown before you formally accept the job.</div>
            </div>
          </aside>
        </div>

        <div className="contractor-actions">
          <button className="contractor-action contractor-action-primary" onClick={() => setResponse('interested')}>
            I’m interested — show me more
          </button>
          <button className="contractor-action contractor-action-secondary" onClick={() => setResponse('declined')}>
            Not for me
          </button>
        </div>

        {response === 'interested' && (
          <div className="contractor-response interested">
            ✅ Great — in the live version this records your interest and unlocks the detailed job page, including the information you need to decide whether to formally accept.
          </div>
        )}
        {response === 'declined' && (
          <div className="contractor-response declined">
            No problem — in the live version Three Counties would record the decline and you wouldn’t receive any customer details for this opportunity.
          </div>
        )}

        <div className="contractor-footer">Three Counties Property Care Ltd · Contractor opportunity preview</div>
      </div>
    </main>
  )
}
