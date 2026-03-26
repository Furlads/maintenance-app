'use client'

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'

type ChasUiMessage = {
  id: string
  role: 'user' | 'assistant'
  text: string
  createdAt: string
  imageDataUrl?: string
}

function formatChasTimestamp(value: string) {
  const date = new Date(value)

  if (Number.isNaN(date.getTime())) return ''

  return date.toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
  })
}

function createChasSessionId() {
  return `chas-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

async function fileToDataUrl(file: File): Promise<string> {
  return await new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result || ''))
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

const cardStyle: React.CSSProperties = {
  background: '#ffffff',
  border: '1px solid #e5e7eb',
  borderRadius: 20,
  padding: 16,
  boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  minHeight: 48,
  padding: '12px 14px',
  borderRadius: 14,
  border: '1px solid #d1d5db',
  background: '#ffffff',
  fontSize: 16,
  outline: 'none',
  boxSizing: 'border-box',
  fontFamily: 'inherit',
}

const quickLinkStyle: React.CSSProperties = {
  minHeight: 56,
  borderRadius: 16,
  border: '1px solid #e5e7eb',
  background: '#f9fafb',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  textAlign: 'center',
  textDecoration: 'none',
  color: '#111827',
  fontSize: 14,
  fontWeight: 800,
  padding: '10px 12px',
  minWidth: 0,
  wordBreak: 'break-word',
  overflowWrap: 'break-word',
}

export default function ChasPage() {
  const [workerId, setWorkerId] = useState<number | null>(null)
  const [workerName, setWorkerName] = useState('')
  const [company, setCompany] = useState('furlads')

  const [sessionId, setSessionId] = useState('')
  const [question, setQuestion] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [messages, setMessages] = useState<ChasUiMessage[]>([])
  const [imageDataUrl, setImageDataUrl] = useState('')
  const [imageName, setImageName] = useState('')

  const messagesEndRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const savedWorkerId = localStorage.getItem('workerId')
    const savedWorkerName = localStorage.getItem('workerName')
    const savedCompany = localStorage.getItem('company')

    if (savedWorkerId) {
      const parsed = Number(savedWorkerId)
      if (Number.isInteger(parsed) && parsed > 0) {
        setWorkerId(parsed)
      }
    }

    if (savedWorkerName) {
      setWorkerName(savedWorkerName)
    }

    if (savedCompany) {
      setCompany(savedCompany)
    }

    setSessionId(createChasSessionId())
  }, [])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, busy])

  async function handleImageChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]

    if (!file) return

    try {
      setError('')
      const dataUrl = await fileToDataUrl(file)
      setImageDataUrl(dataUrl)
      setImageName(file.name)
    } catch (err) {
      console.error(err)
      setError('Failed to load image.')
    } finally {
      event.target.value = ''
    }
  }

  function clearImage() {
    setImageDataUrl('')
    setImageName('')
  }

  function startNewChat() {
    setMessages([])
    setQuestion('')
    setError('')
    clearImage()
    setSessionId(createChasSessionId())
  }

  async function handleSend() {
    const trimmed = question.trim()

    if (!trimmed) {
      setError('Please type a message for Chas.')
      return
    }

    if (!workerName) {
      setError('No worker is logged in on this device.')
      return
    }

    const userMessage: ChasUiMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      text: trimmed,
      createdAt: new Date().toISOString(),
      imageDataUrl: imageDataUrl || undefined,
    }

    const nextMessages = [...messages, userMessage]
    setMessages(nextMessages)
    setBusy(true)
    setError('')

    try {
      const res = await fetch('/api/chas/ask', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          company,
          worker: workerName,
          workerId,
          sessionId,
          question: trimmed,
          imageDataUrl: imageDataUrl || '',
        }),
      })

      const data = await res.json().catch(() => null)

      if (!res.ok) {
        throw new Error(data?.error || 'Failed to ask Chas.')
      }

      const answer =
        typeof data?.answer === 'string'
          ? data.answer
          : typeof data?.reply === 'string'
            ? data.reply
            : typeof data?.message === 'string'
              ? data.message
              : typeof data?.result === 'string'
                ? data.result
                : 'Chas did not return a reply.'

      const assistantMessage: ChasUiMessage = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        text: answer,
        createdAt: new Date().toISOString(),
      }

      setMessages([...nextMessages, assistantMessage])
      setQuestion('')
      clearImage()
    } catch (err: any) {
      console.error(err)
      setError(String(err?.message || 'Failed to get a reply from Chas.'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <main
      style={{
        minHeight: '100dvh',
        background: '#f3f4f6',
        padding: '16px 0 120px',
        fontFamily: 'sans-serif',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 720,
          margin: '0 auto',
          padding: '0 16px',
          boxSizing: 'border-box',
        }}
      >
        <div
          style={{
            background: '#111827',
            color: '#ffffff',
            borderRadius: 24,
            padding: 20,
            marginBottom: 16,
          }}
        >
          <div
            style={{
              fontSize: 12,
              opacity: 0.78,
              textTransform: 'uppercase',
              fontWeight: 800,
              letterSpacing: '0.08em',
            }}
          >
            Worker support
          </div>

          <h1
            style={{
              margin: '8px 0 6px',
              fontSize: 30,
              lineHeight: 1.05,
              fontWeight: 900,
              wordBreak: 'break-word',
            }}
          >
            CHAS
          </h1>

          <div
            style={{
              opacity: 0.86,
              fontSize: 15,
              lineHeight: 1.45,
              wordBreak: 'break-word',
            }}
          >
            Ask for help from site. Plant questions, rough guidance, safe next
            steps, or help wording something for Kelly.
          </div>

          <div
            style={{
              marginTop: 10,
              fontSize: 14,
              opacity: 0.84,
              wordBreak: 'break-word',
            }}
          >
            Logged in as {workerName || 'Worker'}
          </div>

          <div
            style={{
              marginTop: 16,
              display: 'grid',
              gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
              gap: 10,
            }}
          >
            <Link href="/today" style={quickLinkStyle}>
              Today
            </Link>
            <Link href="/my-visits" style={quickLinkStyle}>
              My Visits
            </Link>
            <Link href="/worker" style={quickLinkStyle}>
              More
            </Link>
          </div>
        </div>

        <section style={{ ...cardStyle, marginBottom: 16 }}>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: 12,
              flexWrap: 'wrap',
              marginBottom: 12,
            }}
          >
            <div>
              <div
                style={{
                  fontWeight: 900,
                  fontSize: 22,
                  color: '#111827',
                }}
              >
                Chat with CHAS
              </div>
              <div
                style={{
                  marginTop: 4,
                  fontSize: 14,
                  color: '#4b5563',
                  lineHeight: 1.45,
                }}
              >
                Keep it short and practical so workers can use it quickly on
                site.
              </div>
            </div>

            <button
              type="button"
              onClick={startNewChat}
              style={{
                minHeight: 44,
                padding: '0 14px',
                borderRadius: 12,
                border: '1px solid #d1d5db',
                background: '#ffffff',
                color: '#111827',
                fontWeight: 800,
                cursor: 'pointer',
              }}
            >
              New chat
            </button>
          </div>

          <div
            style={{
              border: '1px solid #e5e7eb',
              borderRadius: 18,
              overflow: 'hidden',
              background: '#ffffff',
            }}
          >
            <div
              style={{
                padding: 16,
                borderBottom: '1px solid #e5e7eb',
                background: 'linear-gradient(180deg, #fafafa 0%, #f4f4f4 100%)',
              }}
            >
              <div
                style={{
                  padding: 18,
                  borderRadius: 18,
                  background: '#fffdf3',
                  border: '1px solid #f0e2a1',
                  fontSize: 14,
                  lineHeight: 1.6,
                  boxShadow: '0 10px 24px rgba(0,0,0,0.04)',
                  color: '#111827',
                }}
              >
                <div style={{ fontWeight: 800, marginBottom: 8 }}>
                  Ask CHAS anything from site
                </div>
                <div style={{ opacity: 0.88 }}>
                  • Rough guide price for a small job
                  <br />
                  • What plant is this?
                  <br />
                  • What’s the safest way to tackle this?
                  <br />
                  • Help pulling customer details together for Kelly
                </div>
              </div>
            </div>

            <div
              style={{
                minHeight: 260,
                maxHeight: '45dvh',
                overflowY: 'auto',
                padding: 16,
                background: 'linear-gradient(180deg, #fafafa 0%, #f4f4f4 100%)',
              }}
            >
              {messages.length === 0 ? (
                <div
                  style={{
                    color: '#6b7280',
                    fontSize: 14,
                    lineHeight: 1.5,
                  }}
                >
                  No messages yet. Ask CHAS something to get started.
                </div>
              ) : (
                messages.map((message) => (
                  <div
                    key={message.id}
                    style={{
                      marginBottom: 12,
                      display: 'flex',
                      justifyContent:
                        message.role === 'user' ? 'flex-end' : 'flex-start',
                    }}
                  >
                    <div
                      style={{
                        maxWidth: '86%',
                        padding: 14,
                        borderRadius: 18,
                        background:
                          message.role === 'user' ? '#111827' : '#fffdf5',
                        color: message.role === 'user' ? '#ffffff' : '#111827',
                        border:
                          message.role === 'user'
                            ? '1px solid #111827'
                            : '1px solid #eee0a2',
                        boxShadow:
                          message.role === 'user'
                            ? '0 12px 28px rgba(0,0,0,0.12)'
                            : '0 10px 24px rgba(0,0,0,0.05)',
                        wordBreak: 'break-word',
                        overflowWrap: 'break-word',
                      }}
                    >
                      {message.imageDataUrl && (
                        <img
                          src={message.imageDataUrl}
                          alt="Attached"
                          style={{
                            width: '100%',
                            maxWidth: 220,
                            borderRadius: 12,
                            marginBottom: 10,
                            display: 'block',
                          }}
                        />
                      )}

                      <div style={{ whiteSpace: 'pre-wrap', lineHeight: 1.55 }}>
                        {message.text}
                      </div>

                      <div
                        style={{
                          marginTop: 8,
                          fontSize: 11,
                          opacity: 0.7,
                        }}
                      >
                        {formatChasTimestamp(message.createdAt)}
                      </div>
                    </div>
                  </div>
                ))
              )}

              {busy && (
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'flex-start',
                  }}
                >
                  <div
                    style={{
                      maxWidth: '86%',
                      padding: 14,
                      borderRadius: 18,
                      background: '#fffdf5',
                      color: '#111827',
                      border: '1px solid #eee0a2',
                      boxShadow: '0 10px 24px rgba(0,0,0,0.05)',
                    }}
                  >
                    CHAS is replying...
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>

            <div
              style={{
                padding: 16,
                borderTop: '1px solid #e5e7eb',
                background: '#ffffff',
              }}
            >
              {imageDataUrl && (
                <div
                  style={{
                    marginBottom: 12,
                    padding: 12,
                    borderRadius: 14,
                    border: '1px solid #d1d5db',
                    background: '#fafafa',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      marginBottom: 8,
                      gap: 12,
                      flexWrap: 'wrap',
                    }}
                  >
                    <div
                      style={{
                        fontSize: 13,
                        fontWeight: 800,
                        color: '#111827',
                        wordBreak: 'break-word',
                      }}
                    >
                      Attached image{imageName ? `: ${imageName}` : ''}
                    </div>

                    <button
                      type="button"
                      onClick={clearImage}
                      style={{
                        minHeight: 40,
                        padding: '0 12px',
                        borderRadius: 10,
                        border: '1px solid #d1d5db',
                        background: '#ffffff',
                        cursor: 'pointer',
                        fontWeight: 700,
                      }}
                    >
                      Remove
                    </button>
                  </div>

                  <img
                    src={imageDataUrl}
                    alt="Preview"
                    style={{
                      width: 140,
                      height: 140,
                      objectFit: 'cover',
                      borderRadius: 12,
                      border: '1px solid #d1d5db',
                    }}
                  />
                </div>
              )}

              <textarea
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                placeholder="Ask CHAS for help from site..."
                style={{
                  ...inputStyle,
                  minHeight: 110,
                  resize: 'vertical',
                }}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && !event.shiftKey) {
                    event.preventDefault()
                    if (!busy) {
                      handleSend()
                    }
                  }
                }}
              />

              {error && (
                <div
                  style={{
                    marginTop: 8,
                    borderRadius: 12,
                    padding: '10px 12px',
                    fontSize: 13,
                    fontWeight: 700,
                    background: '#fef2f2',
                    border: '1px solid #fecaca',
                    color: '#991b1b',
                    wordBreak: 'break-word',
                  }}
                >
                  {error}
                </div>
              )}

              <div
                style={{
                  marginTop: 12,
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: 12,
                  flexWrap: 'wrap',
                }}
              >
                <label
                  style={{
                    minHeight: 48,
                    padding: '0 16px',
                    borderRadius: 12,
                    border: '1px solid #d1d5db',
                    background: '#ffffff',
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 800,
                    color: '#111827',
                  }}
                >
                  Add Photo
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleImageChange}
                    style={{ display: 'none' }}
                  />
                </label>

                <button
                  type="button"
                  onClick={handleSend}
                  disabled={busy}
                  style={{
                    minHeight: 48,
                    padding: '0 18px',
                    borderRadius: 12,
                    border: '1px solid #111827',
                    background: '#111827',
                    color: '#ffffff',
                    cursor: busy ? 'not-allowed' : 'pointer',
                    opacity: busy ? 0.7 : 1,
                    fontWeight: 900,
                    minWidth: 140,
                  }}
                >
                  {busy ? 'Sending...' : 'Send to CHAS'}
                </button>
              </div>
            </div>
          </div>
        </section>

        <section style={cardStyle}>
          <div
            style={{
              fontWeight: 900,
              fontSize: 20,
              marginBottom: 10,
              color: '#111827',
            }}
          >
            Quick help
          </div>

          <div
            style={{
              display: 'grid',
              gap: 10,
              color: '#374151',
              lineHeight: 1.5,
              fontSize: 14,
            }}
          >
            <div>• Use CHAS for quick on-site guidance and rough help.</div>
            <div>
              • For risky work or anything uncertain, CHAS should stay cautious.
            </div>
            <div>
              • Kelly confirms final quotes, and Trevor handles higher-risk
              judgement calls.
            </div>
          </div>
        </section>
      </div>
    </main>
  )
}