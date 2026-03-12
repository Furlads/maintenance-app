'use client'

import React, { useEffect, useMemo, useRef } from 'react'

type ChasMessage = {
  id: number
  question: string
  answer: string
  imageDataUrl?: string | null
  createdAt?: string
}

type TodayJob = {
  id: number
  title: string
}

type Props = {
  open: boolean
  worker: string
  todaysJobs: TodayJob[]
  chasMessages: ChasMessage[]
  chasInput: string
  chasBusy: boolean
  chasError: string
  chasJobId: number | null
  chasImageDataUrl: string
  onClose: () => void
  onChangeInput: (value: string) => void
  onChangeJobId: (value: number | null) => void
  onRemovePhoto: () => void
  onPickPhoto: (file: File) => void | Promise<void>
  onSend: () => void | Promise<void>
}

function bubbleUser(): React.CSSProperties {
  return {
    background: '#111111',
    color: '#ffffff',
    padding: '12px 14px',
    borderRadius: 18,
    maxWidth: '86%',
    whiteSpace: 'pre-wrap',
    lineHeight: 1.45,
    fontSize: 14,
    boxShadow: '0 8px 24px rgba(0,0,0,0.10)'
  }
}

function bubbleChas(): React.CSSProperties {
  return {
    background: '#fffdf5',
    color: '#111111',
    padding: '12px 14px',
    borderRadius: 18,
    maxWidth: '86%',
    whiteSpace: 'pre-wrap',
    lineHeight: 1.5,
    fontSize: 14,
    border: '1px solid #f1e4a3',
    boxShadow: '0 8px 24px rgba(0,0,0,0.05)'
  }
}

function dotStyle(delayMs: number): React.CSSProperties {
  return {
    width: 8,
    height: 8,
    borderRadius: 999,
    background: '#111',
    opacity: 0.25,
    animation: `chasDotPulse 1.2s infinite`,
    animationDelay: `${delayMs}ms`
  }
}

export default function ChasModal(props: Props) {
  const {
    open,
    worker,
    todaysJobs,
    chasMessages,
    chasInput,
    chasBusy,
    chasError,
    chasJobId,
    chasImageDataUrl,
    onClose,
    onChangeInput,
    onChangeJobId,
    onRemovePhoto,
    onPickPhoto,
    onSend
  } = props

  const fileRef = useRef<HTMLInputElement | null>(null)
  const endRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!open) return
    const t = window.setTimeout(() => {
      endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
    }, 50)
    return () => window.clearTimeout(t)
  }, [open, chasMessages.length, chasBusy])

  const hasMessages = chasMessages.length > 0

  const helperText = useMemo(() => {
    if (chasBusy) return 'Chas is working on it...'
    return 'Ask about plants, hedge cuts, rough prices or site questions.'
  }, [chasBusy])

  if (!open) return null

  return (
    <>
      <style>{`
        @keyframes chasDotPulse {
          0%, 80%, 100% { transform: translateY(0); opacity: 0.25; }
          40% { transform: translateY(-3px); opacity: 1; }
        }
      `}</style>

      <div
        onClick={onClose}
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.42)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          padding: 12,
          zIndex: 60
        }}
      >
        <div
          onClick={(e) => e.stopPropagation()}
          style={{
            width: '100%',
            maxWidth: 920,
            height: '82vh',
            background: '#ffffff',
            borderRadius: 22,
            border: '1px solid #e7e7e7',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            boxShadow: '0 20px 60px rgba(0,0,0,0.22)'
          }}
        >
          <div
            style={{
              padding: 14,
              borderBottom: '1px solid #ececec',
              background: 'linear-gradient(180deg, #111111 0%, #1b1b1b 100%)',
              color: '#ffffff',
              display: 'flex',
              justifyContent: 'space-between',
              gap: 12,
              flexWrap: 'wrap',
              alignItems: 'center'
            }}
          >
            <div>
              <div style={{ fontWeight: 1000, fontSize: 18 }}>Chas 💬</div>
              <div style={{ fontSize: 12, opacity: 0.8 }}>
                Helping <b>{worker || 'worker'}</b> on site
              </div>
            </div>

            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
              <select
                value={chasJobId ?? ''}
                onChange={(e) => onChangeJobId(e.target.value ? Number(e.target.value) : null)}
                style={{
                  padding: '10px 12px',
                  borderRadius: 14,
                  border: '1px solid rgba(255,255,255,0.18)',
                  background: '#2a2a2a',
                  color: '#fff',
                  minWidth: 220
                }}
              >
                <option value="">No job context</option>
                {todaysJobs.map((j) => (
                  <option key={j.id} value={j.id}>
                    #{j.id} — {j.title}
                  </option>
                ))}
              </select>

              <button
                onClick={onClose}
                style={{
                  padding: '10px 12px',
                  borderRadius: 14,
                  border: '1px solid rgba(255,255,255,0.2)',
                  background: 'transparent',
                  color: '#fff',
                  fontWeight: 900,
                  cursor: 'pointer'
                }}
              >
                Close
              </button>
            </div>
          </div>

          <div
            style={{
              flex: 1,
              padding: 14,
              overflowY: 'auto',
              background: 'linear-gradient(180deg, #fafafa 0%, #f5f5f5 100%)'
            }}
          >
            {!hasMessages ? (
              <div
                style={{
                  maxWidth: 520,
                  margin: '24px auto 0',
                  border: '1px solid #f0e3a2',
                  background: '#fffdf3',
                  borderRadius: 18,
                  padding: 16,
                  fontSize: 14,
                  lineHeight: 1.5,
                  color: '#222'
                }}
              >
                <div style={{ fontWeight: 900, marginBottom: 6 }}>Ask Chas anything</div>
                <div>
                  Send a message or a photo for plant ID, cutting advice, safety help or rough site pricing.
                </div>
              </div>
            ) : null}

            {chasMessages.map((m) => (
              <div key={m.id} style={{ marginBottom: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                  <div style={bubbleUser()}>
                    {m.question}
                    {m.imageDataUrl ? (
                      <div style={{ marginTop: 10 }}>
                        <img
                          src={m.imageDataUrl}
                          alt="attached"
                          style={{
                            width: 240,
                            maxWidth: '100%',
                            borderRadius: 14,
                            display: 'block',
                            border: '1px solid rgba(255,255,255,0.15)'
                          }}
                        />
                      </div>
                    ) : null}
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-start', marginTop: 8 }}>
                  <div style={bubbleChas()}>{m.answer || '...'}</div>
                </div>
              </div>
            ))}

            {chasBusy ? (
              <div style={{ marginBottom: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
                  <div style={bubbleChas()}>
                    <div style={{ fontWeight: 900, marginBottom: 8 }}>Chas is thinking…</div>
                    <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                      <span style={dotStyle(0)} />
                      <span style={dotStyle(180)} />
                      <span style={dotStyle(360)} />
                    </div>
                    <div style={{ marginTop: 10, fontSize: 12, opacity: 0.75 }}>
                      This can take a few seconds on longer answers.
                    </div>
                  </div>
                </div>
              </div>
            ) : null}

            <div ref={endRef} />
          </div>

          <div
            style={{
              padding: 14,
              borderTop: '1px solid #ececec',
              background: '#ffffff'
            }}
          >
            {chasImageDataUrl ? (
              <div
                style={{
                  marginBottom: 12,
                  display: 'flex',
                  gap: 10,
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  padding: 10,
                  borderRadius: 16,
                  background: '#fff8d9',
                  border: '1px solid #f2e08d'
                }}
              >
                <img
                  src={chasImageDataUrl}
                  alt="preview"
                  style={{
                    width: 72,
                    height: 72,
                    objectFit: 'cover',
                    borderRadius: 14,
                    border: '1px solid #ddd'
                  }}
                />
                <div style={{ flex: 1, minWidth: 140 }}>
                  <div style={{ fontWeight: 900, fontSize: 13 }}>Photo attached</div>
                  <div style={{ fontSize: 12, opacity: 0.7 }}>Ready to send with your message</div>
                </div>
                <button
                  type="button"
                  onClick={onRemovePhoto}
                  disabled={chasBusy}
                  style={{
                    padding: '10px 12px',
                    borderRadius: 12,
                    border: '1px solid #d9c864',
                    background: '#fff',
                    cursor: chasBusy ? 'not-allowed' : 'pointer',
                    opacity: chasBusy ? 0.6 : 1,
                    fontWeight: 800
                  }}
                >
                  Remove photo
                </button>
              </div>
            ) : null}

            <div
              style={{
                border: '1px solid #e7e7e7',
                borderRadius: 20,
                padding: 10,
                background: '#fcfcfc',
                boxShadow: '0 6px 20px rgba(0,0,0,0.04)'
              }}
            >
              <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  disabled={chasBusy}
                  style={{
                    width: 46,
                    height: 46,
                    borderRadius: 14,
                    border: '1px solid #ddd',
                    background: '#fff',
                    cursor: chasBusy ? 'not-allowed' : 'pointer',
                    opacity: chasBusy ? 0.6 : 1,
                    fontSize: 20,
                    fontWeight: 900
                  }}
                  title="Attach photo"
                >
                  📸
                </button>

                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  style={{ display: 'none' }}
                  onChange={async (e) => {
                    const f = e.target.files?.[0]
                    if (!f) return
                    await onPickPhoto(f)
                    e.currentTarget.value = ''
                  }}
                />

                <textarea
                  value={chasInput}
                  onChange={(e) => onChangeInput(e.target.value)}
                  placeholder="Message Chas…"
                  disabled={chasBusy}
                  style={{
                    flex: 1,
                    minHeight: 58,
                    maxHeight: 130,
                    padding: 12,
                    borderRadius: 16,
                    border: '1px solid #e2e2e2',
                    resize: 'none',
                    fontSize: 15,
                    background: chasBusy ? '#f6f6f6' : '#fff'
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault()
                      if (!chasBusy) onSend()
                    }
                  }}
                />

                <button
                  type="button"
                  onClick={onSend}
                  disabled={chasBusy || !chasInput.trim()}
                  style={{
                    minWidth: 108,
                    height: 46,
                    padding: '0 16px',
                    borderRadius: 14,
                    border: '1px solid #111',
                    background: '#111',
                    color: '#fff',
                    fontWeight: 1000,
                    cursor: chasBusy || !chasInput.trim() ? 'not-allowed' : 'pointer',
                    opacity: chasBusy || !chasInput.trim() ? 0.65 : 1
                  }}
                >
                  {chasBusy ? 'Sending…' : 'Send'}
                </button>
              </div>

              {chasError ? (
                <div
                  style={{
                    marginTop: 10,
                    color: 'crimson',
                    fontSize: 13,
                    whiteSpace: 'pre-wrap'
                  }}
                >
                  {chasError}
                </div>
              ) : null}

              <div style={{ marginTop: 10, fontSize: 12, opacity: 0.68 }}>
                {helperText} • Enter to send • Shift+Enter for new line
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}