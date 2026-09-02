'use client'

import { FormEvent, useState } from 'react'

const trades = ['Landscaping', 'Groundworks', 'Fencing', 'Paving', 'Porcelain', 'Brickwork', 'Carpentry', 'Plastering', 'Plumbing', 'Electrical', 'Roofing', 'Garden maintenance']

export default function SubcontractorApplicationPage() {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setBusy(true)
    setError('')
    const form = new FormData(event.currentTarget)
    try {
      const response = await fetch('/api/subcontractor-application', { method: 'POST', body: form })
      const data = await response.json().catch(() => null)
      if (!response.ok) throw new Error(data?.error || 'Could not submit application.')
      setDone(true)
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not submit application.')
    } finally {
      setBusy(false)
    }
  }

  if (done) {
    return <main className="min-h-dvh bg-[#eef2e9] px-4 py-10 text-[#162111]"><div className="mx-auto max-w-2xl rounded-[30px] bg-white p-8 shadow-xl"><div className="text-xs font-black uppercase tracking-[0.16em] text-[#789333]">Application received</div><h1 className="mt-2 text-4xl font-black">Thanks — we’ve got it.</h1><p className="mt-4 text-base font-semibold leading-7 text-zinc-600">We’ll review your details, insurance and experience before adding you to our subcontractor network. If approved, we’ll complete any remaining CIS verification details before you are marked ready for work. Submitting this form does not guarantee work or create an employment relationship.</p></div></main>
  }

  return <main className="min-h-dvh bg-[#eef2e9] px-3 py-5 text-[#162111] sm:px-5 sm:py-8">
    <form onSubmit={submit} className="mx-auto max-w-4xl space-y-5">
      <section className="rounded-[30px] p-6 shadow-xl sm:p-8" style={{ backgroundColor: '#1f3218', color: '#ffffff' }}>
        <div className="text-xs font-black uppercase tracking-[0.18em]" style={{ color: '#c7e678' }}>Furlads & Three Counties</div>
        <h1 className="mt-2 text-4xl font-black sm:text-5xl" style={{ color: '#ffffff' }}>Apply to join our subcontractor network</h1>
        <p className="mt-4 max-w-3xl text-sm font-semibold leading-6 sm:text-base" style={{ color: '#ffffff' }}>Tell us what you do, where you work and what cover/qualifications you hold. We use this to decide which jobs may be suitable for you. You remain responsible for how you carry out accepted subcontract work and for your own tax, insurance and business obligations.</p>
      </section>

      <Section title="1. Your details">
        <Grid>
          <Input name="firstName" label="First name" required />
          <Input name="lastName" label="Last name" required />
          <Input name="tradingName" label="Trading / business name" />
          <Input name="phone" label="Mobile number" required inputMode="tel" />
          <Input name="email" label="Email address" required type="email" />
          <Input name="postcode" label="Home/business postcode" />
          <div className="sm:col-span-2"><Input name="address" label="Business / correspondence address" /></div>
          <Input name="companyNumber" label="Company number (if applicable)" />
          <Input name="vatNumber" label="VAT number (if applicable)" />
        </Grid>
      </Section>

      <Section title="2. Trade & experience">
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{trades.map((trade) => <label key={trade} className="flex items-center gap-3 rounded-2xl border border-zinc-200 bg-zinc-50 p-3 text-sm font-bold"><input type="checkbox" name="trades" value={trade} className="h-5 w-5" />{trade}</label>)}</div>
        <div className="mt-4 grid gap-4 sm:grid-cols-2"><Input name="otherTrade" label="Other trade / specialism" /><Input name="yearsExperience" label="Years of experience" type="number" min="0" /></div>
        <div className="mt-4"><Textarea name="qualifications" label="Qualifications, tickets, cards or memberships" placeholder="e.g. CSCS, NPTC, City & Guilds, NICEIC, Gas Safe etc." /></div>
        <div className="mt-4"><Textarea name="preferredWork" label="What sort of work are you best at / looking for?" /></div>
      </Section>

      <Section title="3. Area, transport & how you work">
        <Grid>
          <Input name="coverageArea" label="Areas you cover" placeholder="e.g. Shropshire, Cheshire, Staffordshire" />
          <Input name="maxTravelMiles" label="Typical maximum travel distance (miles)" type="number" min="0" />
        </Grid>
        <Checks items={[
          ['canDrive', 'I can drive'], ['hasOwnVehicle', 'I have my own suitable vehicle'], ['suppliesTools', 'I normally supply my own tools'], ['suppliesMaterials', 'I can supply materials when agreed'], ['worksForOthers', 'I work for other customers/businesses as well'], ['comfortableFixedPrice', 'I am comfortable accepting fixed-price jobs'], ['fixesOwnDefects', 'I will return to remedy defects in my own work where reasonably required'], ['hasEmployees', 'I may use my own employees/labourers'],
        ]} />
        <div className="mt-4"><Textarea name="availability" label="Typical availability" placeholder="e.g. Mon–Thu, ad hoc Fridays, 1–2 weeks notice" /></div>
        <div className="mt-4"><Input name="dayRate" label="Typical day rate / costing guide (optional)" inputMode="decimal" placeholder="This is only a guide; jobs may be offered at fixed prices" /></div>
      </Section>

      <Section title="4. CIS, tax & insurance">
        <div className="mb-4 rounded-2xl border border-blue-200 bg-blue-50 p-4 text-sm font-semibold leading-6 text-blue-900">
          Your UTR is used for CIS verification if you are approved to join the network. You can leave it blank at application stage, but we will need it before you can be marked ready for CIS work.
        </div>
        <Grid>
          <Input name="utrNumber" label="UTR — required for CIS verification" placeholder="Optional at application stage" />
          <Input name="publicLiabilityInsurer" label="Public liability insurer" />
          <Input name="publicLiabilityPolicyNumber" label="Policy number" />
          <Input name="publicLiabilityExpiresAt" label="Policy expiry date" type="date" />
          <Input name="publicLiabilityCover" label="Level of public liability cover" placeholder="e.g. £2m / £5m" />
        </Grid>
        <Checks items={[["cisRegistered", "I am registered for CIS"]]} />
      </Section>

      <Section title="5. References & documents">
        <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
          <div className="text-sm font-black text-zinc-900">Trade references are optional</div>
          <p className="mt-1 text-xs font-semibold leading-5 text-zinc-600">If you choose to provide a referee, only give us the details needed to contact them. Please make sure they know you are naming them as a referee and that Furlads / Three Counties may contact them about your work.</p>
        </div>
        <div className="mt-4 grid gap-4 sm:grid-cols-2"><Textarea name="referenceOne" label="Trade reference 1 (optional)" placeholder="Name, business/company, relationship to you and phone/email" /><Textarea name="referenceTwo" label="Trade reference 2 (optional)" placeholder="Name, business/company, relationship to you and phone/email" /></div>
        <label className="mt-4 flex items-start gap-3 rounded-2xl border border-zinc-200 bg-white p-4 text-sm font-semibold leading-6 text-zinc-700"><input type="checkbox" name="refereeAwarenessConfirmed" value="true" className="mt-1 h-5 w-5" /><span>If I have provided referee details, I confirm those people are aware I am using them as a reference and that Furlads / Three Counties may contact them.</span></label>
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <FileField name="insuranceDocument" label="Public liability certificate" />
          <FileField name="utrDocument" label="UTR / CIS evidence (optional at application stage)" />
          <FileField name="qualificationDocuments" label="Qualifications / tickets" multiple />
          <FileField name="workPhotos" label="Examples of your work" multiple accept="image/jpeg,image/png,image/webp" />
        </div>
        <p className="mt-3 text-xs font-semibold text-zinc-500">PDF, JPG, PNG or WebP. Maximum 10MB per file. Documents are stored privately and used for subcontractor vetting/compliance.</p>
      </Section>

      <Section title="6. Anything else">
        <Textarea name="additionalNotes" label="Anything we should know?" placeholder="Team size, specialist equipment, access limitations, preferred job types, lead times etc." />
      </Section>

      <Section title="Declaration & privacy">
        <div className="space-y-3 text-sm font-semibold leading-6 text-zinc-700">
          <label className="flex items-start gap-3"><input required type="checkbox" name="privacyConsent" value="true" className="mt-1 h-5 w-5" /><span>I agree that Furlads / Three Counties may use the information and documents supplied here to assess my application, verify compliance and contact me about subcontract work. If I provide referee details, I understand those details will only be used for checking my suitability and should only be retained for as long as reasonably needed.</span></label>
          <label className="flex items-start gap-3"><input required type="checkbox" name="declarationAccepted" value="true" className="mt-1 h-5 w-5" /><span>I confirm the information supplied is accurate. I understand this is an application to join a subcontractor network, not an offer of employment or a guarantee of work, and that any work I later accept will be governed by the specific work order/terms agreed for that job.</span></label>
        </div>
      </Section>

      {error ? <div className="rounded-2xl bg-red-50 p-4 text-sm font-bold text-red-700">{error}</div> : null}
      <button disabled={busy} className="w-full rounded-2xl bg-[#a8ca4a] px-5 py-4 text-lg font-black text-[#18220f] shadow-sm disabled:opacity-50">{busy ? 'Submitting application…' : 'Submit subcontractor application'}</button>
    </form>
  </main>
}

function Section({ title, children }: { title: string; children: React.ReactNode }) { return <section className="rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm sm:p-6"><h2 className="mb-5 text-2xl font-black">{title}</h2>{children}</section> }
function Grid({ children }: { children: React.ReactNode }) { return <div className="grid gap-4 sm:grid-cols-2">{children}</div> }
function Input(props: React.InputHTMLAttributes<HTMLInputElement> & { label: string }) { const { label, ...rest } = props; return <label className="block"><span className="mb-2 block text-[11px] font-black uppercase tracking-wider text-zinc-600">{label}</span><input {...rest} className="w-full rounded-xl border border-zinc-300 bg-white px-3 py-3 text-sm font-semibold text-zinc-950 outline-none focus:border-[#789333] focus:ring-2 focus:ring-[#dce8bd]" /></label> }
function Textarea({ name, label, placeholder }: { name: string; label: string; placeholder?: string }) { return <label className="block"><span className="mb-2 block text-[11px] font-black uppercase tracking-wider text-zinc-600">{label}</span><textarea name={name} placeholder={placeholder} className="min-h-28 w-full resize-y rounded-xl border border-zinc-300 bg-white px-3 py-3 text-sm font-semibold text-zinc-950 outline-none focus:border-[#789333] focus:ring-2 focus:ring-[#dce8bd]" /></label> }
function Checks({ items }: { items: string[][] }) { return <div className="mt-4 grid gap-2 sm:grid-cols-2">{items.map(([name, label]) => <label key={name} className="flex items-center gap-3 rounded-xl border border-zinc-200 bg-white p-3 text-sm font-bold text-zinc-900"><input type="checkbox" name={name} value="true" className="h-5 w-5" />{label}</label>)}</div> }
function FileField({ name, label, multiple, accept = 'application/pdf,image/jpeg,image/png,image/webp' }: { name: string; label: string; multiple?: boolean; accept?: string }) { return <label className="block rounded-2xl border border-dashed border-zinc-300 bg-white p-4"><span className="block text-sm font-black text-zinc-900">{label}</span><input type="file" name={name} multiple={multiple} accept={accept} className="mt-3 block w-full text-sm text-zinc-900" /></label> }
