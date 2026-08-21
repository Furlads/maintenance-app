import Link from 'next/link'

const opportunities = [
  {
    id: 'TC-1048',
    title: 'Full room re-plaster',
    trade: 'Plastering',
    area: 'Newport area',
    price: '£850',
    status: 'Awaiting replies',
    sent: '3 contractors',
    replies: '1 interested',
    tone: 'amber',
  },
  {
    id: 'TC-1047',
    title: 'Consumer unit & kitchen first fix',
    trade: 'Electrical',
    area: 'Market Drayton area',
    price: 'Quote requested',
    status: 'Quote requested',
    sent: '2 contractors',
    replies: '2 viewed',
    tone: 'blue',
  },
  {
    id: 'TC-1045',
    title: 'Bathroom pipework alterations',
    trade: 'Plumbing',
    area: 'Telford area',
    price: '£620',
    status: 'Contractor agreed',
    sent: '1 contractor',
    replies: 'Accepted by Dan',
    tone: 'green',
  },
]

const contractors = [
  { name: 'Dan R', trade: 'Plumber', area: 'Shropshire', active: 'Available', jobs: '4 jobs' },
  { name: 'Mark P', trade: 'Plasterer', area: 'Newport / Telford', active: 'Available', jobs: '2 jobs' },
  { name: 'Liam E', trade: 'Electrician', area: 'North Shropshire', active: 'Busy this week', jobs: '3 jobs' },
]

function statusStyle(tone: string) {
  if (tone === 'green') return { background: '#eaf5d6', color: '#314816', borderColor: '#bdd87e' }
  if (tone === 'blue') return { background: '#edf5ff', color: '#28517c', borderColor: '#bed7f2' }
  return { background: '#fff5da', color: '#735719', borderColor: '#ead28b' }
}

export default function SubcontractorsPage() {
  return (
    <div className="sub-page">
      <style>{`
        .sub-page { padding: 4px 0 18px; }
        .sub-hero { position: relative; overflow: hidden; border-radius: 28px; padding: 30px; color: white; background: linear-gradient(135deg,#152315 0%,#273c1d 65%,#3b5625 100%); box-shadow: 0 22px 55px rgba(24,45,17,.17); }
        .sub-hero:after { content: ''; position: absolute; width: 330px; height: 330px; border-radius: 50%; right: -125px; top: -170px; background: rgba(176,211,80,.10); }
        .sub-eyebrow { position:relative; z-index:1; color:#b8d874; text-transform:uppercase; letter-spacing:.9px; font-size:12px; font-weight:900; }
        .sub-title { position:relative; z-index:1; margin:8px 0 0; max-width:720px; font-size:clamp(34px,5vw,52px); line-height:1; letter-spacing:-1.7px; font-weight:950; }
        .sub-copy { position:relative; z-index:1; max-width:720px; margin:14px 0 0; color:#dce6d6; line-height:1.55; font-weight:600; }
        .sub-actions { position:relative; z-index:1; display:flex; gap:10px; flex-wrap:wrap; margin-top:22px; }
        .sub-btn { min-height:46px; display:inline-flex; align-items:center; justify-content:center; border-radius:14px; padding:0 16px; font-size:14px; font-weight:900; text-decoration:none; }
        .sub-btn-primary { background:#a9cc4b; color:#17220f; }
        .sub-btn-secondary { color:white; border:1px solid rgba(255,255,255,.18); background:rgba(255,255,255,.08); }
        .sub-stats { display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); gap:12px; margin-top:15px; }
        .sub-stat { background:white; border:1px solid #e3e9de; border-radius:20px; padding:18px; box-shadow:0 9px 30px rgba(31,52,22,.06); }
        .sub-stat-label { color:#718066; font-size:11px; font-weight:900; text-transform:uppercase; letter-spacing:.75px; }
        .sub-stat-value { margin-top:7px; color:#1a2815; font-size:26px; line-height:1; font-weight:950; letter-spacing:-.7px; }
        .sub-section { margin-top:18px; background:white; border:1px solid #e3e9de; border-radius:24px; padding:22px; box-shadow:0 10px 32px rgba(31,52,22,.055); }
        .sub-section-head { display:flex; align-items:flex-end; justify-content:space-between; gap:16px; margin-bottom:14px; }
        .sub-section-kicker { color:#789333; text-transform:uppercase; letter-spacing:.8px; font-size:10px; font-weight:950; }
        .sub-section-title { margin:5px 0 0; font-size:24px; line-height:1.05; font-weight:950; letter-spacing:-.5px; color:#182314; }
        .sub-section-link { color:#3f5d21; font-size:13px; font-weight:850; text-decoration:none; white-space:nowrap; }
        .sub-list { display:grid; gap:10px; }
        .sub-opportunity { display:grid; grid-template-columns:minmax(0,1.5fr) .8fr .7fr .9fr; align-items:center; gap:14px; border:1px solid #e7ebe3; border-radius:17px; padding:14px 15px; background:#fbfcfa; }
        .sub-id { color:#899281; font-size:10px; font-weight:900; text-transform:uppercase; letter-spacing:.7px; }
        .sub-job { margin-top:4px; color:#1d2819; font-size:16px; font-weight:900; }
        .sub-meta { margin-top:4px; color:#6d7666; font-size:12px; font-weight:650; }
        .sub-cell-label { color:#8b9386; font-size:10px; font-weight:850; text-transform:uppercase; letter-spacing:.6px; }
        .sub-cell-value { margin-top:4px; color:#313a2d; font-size:13px; font-weight:800; }
        .sub-status { display:inline-flex; margin-top:5px; border:1px solid; border-radius:999px; padding:6px 9px; font-size:11px; font-weight:900; }
        .sub-two-col { display:grid; grid-template-columns:1.15fr .85fr; gap:18px; }
        .sub-contractor { display:grid; grid-template-columns:minmax(0,1fr) .8fr .65fr; align-items:center; gap:12px; padding:13px 0; border-bottom:1px solid #edf0ea; }
        .sub-contractor:last-child { border-bottom:0; }
        .sub-name { font-size:14px; font-weight:900; color:#202b1c; }
        .sub-small { margin-top:3px; color:#778072; font-size:11px; font-weight:650; }
        .sub-available { color:#53751c; font-size:11px; font-weight:900; }
        .sub-note { background:#f2f6eb; border:1px solid #dbe6cb; border-radius:18px; padding:17px; color:#495742; font-size:13px; line-height:1.5; font-weight:650; }
        .sub-note strong { color:#26351f; }
        @media (max-width:900px) { .sub-stats { grid-template-columns:repeat(2,minmax(0,1fr)); } .sub-two-col { grid-template-columns:1fr; } .sub-opportunity { grid-template-columns:1fr 1fr; } }
        @media (max-width:620px) { .sub-hero { padding:22px; border-radius:23px; } .sub-title { font-size:38px; } .sub-stats { grid-template-columns:1fr 1fr; gap:8px; } .sub-stat { padding:15px; border-radius:17px; } .sub-stat-value { font-size:22px; } .sub-section { padding:17px; border-radius:20px; } .sub-section-head { align-items:flex-start; } .sub-opportunity { grid-template-columns:1fr; gap:11px; } .sub-actions .sub-btn { width:100%; } }
      `}</style>

      <section className="sub-hero">
        <div className="sub-eyebrow">Trade network</div>
        <h1 className="sub-title">Subcontractors</h1>
        <p className="sub-copy">Send work out without exposing customer details, agree a trade price or request a quote, and keep every response attached to the job.</p>
        <div className="sub-actions">
          <Link className="sub-btn sub-btn-primary" href="/admin/subcontractors/new">+ Send an opportunity</Link>
          <Link className="sub-btn sub-btn-secondary" href="/contractor/opportunity/demo" target="_blank">Preview contractor view ↗</Link>
        </div>
      </section>

      <section className="sub-stats" aria-label="Subcontractor summary">
        <div className="sub-stat"><div className="sub-stat-label">Open opportunities</div><div className="sub-stat-value">3</div></div>
        <div className="sub-stat"><div className="sub-stat-label">Awaiting reply</div><div className="sub-stat-value">4</div></div>
        <div className="sub-stat"><div className="sub-stat-label">Active contractors</div><div className="sub-stat-value">11</div></div>
        <div className="sub-stat"><div className="sub-stat-label">Placed this month</div><div className="sub-stat-value">6</div></div>
      </section>

      <section className="sub-section">
        <div className="sub-section-head"><div><div className="sub-section-kicker">Live work</div><h2 className="sub-section-title">Current opportunities</h2></div><Link className="sub-section-link" href="/admin/subcontractors/new">Send another →</Link></div>
        <div className="sub-list">
          {opportunities.map((opportunity) => (
            <div className="sub-opportunity" key={opportunity.id}>
              <div><div className="sub-id">{opportunity.id}</div><div className="sub-job">{opportunity.title}</div><div className="sub-meta">{opportunity.trade} · {opportunity.area}</div></div>
              <div><div className="sub-cell-label">Trade price</div><div className="sub-cell-value">{opportunity.price}</div></div>
              <div><div className="sub-cell-label">Sent to</div><div className="sub-cell-value">{opportunity.sent}</div><div className="sub-meta">{opportunity.replies}</div></div>
              <div><div className="sub-cell-label">Status</div><div className="sub-status" style={statusStyle(opportunity.tone)}>{opportunity.status}</div></div>
            </div>
          ))}
        </div>
      </section>

      <div className="sub-two-col">
        <section className="sub-section">
          <div className="sub-section-head"><div><div className="sub-section-kicker">Network</div><h2 className="sub-section-title">Regular contractors</h2></div></div>
          {contractors.map((contractor) => (
            <div className="sub-contractor" key={contractor.name}>
              <div><div className="sub-name">{contractor.name}</div><div className="sub-small">{contractor.trade} · {contractor.area}</div></div>
              <div><div className="sub-available">{contractor.active}</div></div>
              <div><div className="sub-cell-value">{contractor.jobs}</div><div className="sub-small">placed</div></div>
            </div>
          ))}
        </section>

        <section className="sub-section">
          <div className="sub-section-head"><div><div className="sub-section-kicker">Privacy first</div><h2 className="sub-section-title">What contractors see</h2></div></div>
          <div className="sub-note"><strong>Initial opportunity:</strong> trade, rough area, plain-English job description, likely duration and either a proposed subcontract price or “quote requested”.<br /><br />Customer name, exact address, phone number, email and identifying photos stay hidden until the contractor asks for more details and you choose to release them.</div>
        </section>
      </div>
    </div>
  )
}
