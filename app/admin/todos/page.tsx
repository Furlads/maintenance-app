'use client'

import { useEffect, useMemo, useState } from 'react'

type Todo = {
  id: number
  description: string
  assignedTo: string
  completed: boolean
  dueDate: string | null
  completedAt?: string | null
  createdAt?: string | null
}

function formatDate(date: string | null) {
  if (!date) return null

  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date(date))
}

function getDateOnly(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate())
}

function getDueState(date: string | null) {
  if (!date) return 'none' as const

  const due = getDateOnly(new Date(date))
  const today = getDateOnly(new Date())

  if (due.getTime() < today.getTime()) return 'overdue' as const
  if (due.getTime() === today.getTime()) return 'today' as const
  return 'future' as const
}

function dueBadgeClasses(date: string | null) {
  const state = getDueState(date)

  if (state === 'overdue') {
    return 'bg-red-50 text-red-700 ring-red-200'
  }

  if (state === 'today') {
    return 'bg-amber-50 text-amber-700 ring-amber-200'
  }

  if (state === 'future') {
    return 'bg-blue-50 text-blue-700 ring-blue-200'
  }

  return 'bg-zinc-100 text-zinc-600 ring-zinc-200'
}

function cardClasses(date: string | null, completed: boolean) {
  if (completed) {
    return 'border-zinc-200 bg-zinc-50'
  }

  const state = getDueState(date)

  if (state === 'overdue') {
    return 'border-red-200 bg-red-50/60'
  }

  if (state === 'today') {
    return 'border-amber-200 bg-amber-50/60'
  }

  return 'border-zinc-200 bg-white'
}

function dueLabel(date: string | null) {
  if (!date) return 'No due date'

  const formatted = formatDate(date)
  const state = getDueState(date)

  if (state === 'overdue') return `Overdue · ${formatted}`
  if (state === 'today') return `Due today · ${formatted}`
  return `Due · ${formatted}`
}

function StatCard({
  label,
  value,
  tone = 'default',
}: {
  label: string
  value: number
  tone?: 'default' | 'red' | 'amber' | 'blue' | 'green'
}) {
  const toneClasses =
    tone === 'red'
      ? 'border-red-200 bg-red-50'
      : tone === 'amber'
        ? 'border-amber-200 bg-amber-50'
        : tone === 'blue'
          ? 'border-blue-200 bg-blue-50'
          : tone === 'green'
            ? 'border-green-200 bg-green-50'
            : 'border-zinc-200 bg-white'

  return (
    <div className={`rounded-2xl border p-4 shadow-sm ${toneClasses}`}>
      <div className="text-[11px] font-black uppercase tracking-[0.16em] text-zinc-500">
        {label}
      </div>
      <div className="mt-2 text-3xl font-bold tracking-tight text-zinc-900">{value}</div>
    </div>
  )
}

export default function TodosPage() {
  const [todos, setTodos] = useState<Todo[]>([])
  const [description, setDescription] = useState('')
  const [assignedTo, setAssignedTo] = useState('Kelly')
  const [dueDate, setDueDate] = useState('')
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function loadTodos() {
    try {
      setLoading(true)
      setError('')

      const res = await fetch('/api/todos', { cache: 'no-store' })
      const data = await res.json()

      if (!res.ok) {
        throw new Error(data?.error || 'Failed to load todos')
      }

      setTodos(Array.isArray(data) ? data : [])
    } catch (err) {
      console.error(err)
      setError('Could not load the to-do list.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadTodos()
  }, [])

  async function addTodo() {
    if (!description.trim()) return

    try {
      setSaving(true)
      setError('')

      const res = await fetch('/api/todos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          description: description.trim(),
          assignedTo,
          dueDate: dueDate || null,
        }),
      })

      const data = await res.json().catch(() => null)

      if (!res.ok) {
        throw new Error(data?.error || 'Failed to add todo')
      }

      setDescription('')
      setAssignedTo('Kelly')
      setDueDate('')
      await loadTodos()
    } catch (err) {
      console.error(err)
      setError('Could not save the new to-do.')
    } finally {
      setSaving(false)
    }
  }

  async function toggleTodo(todo: Todo) {
    try {
      setError('')

      const res = await fetch(`/api/todos/${todo.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          completed: !todo.completed,
        }),
      })

      const data = await res.json().catch(() => null)

      if (!res.ok) {
        throw new Error(data?.error || 'Failed to update todo')
      }

      await loadTodos()
    } catch (err) {
      console.error(err)
      setError('Could not update the to-do.')
    }
  }

  const outstanding = useMemo(() => todos.filter((t) => !t.completed), [todos])
  const completed = useMemo(() => todos.filter((t) => t.completed), [todos])

  const overdueCount = useMemo(
    () => outstanding.filter((t) => getDueState(t.dueDate) === 'overdue').length,
    [outstanding]
  )

  const dueTodayCount = useMemo(
    () => outstanding.filter((t) => getDueState(t.dueDate) === 'today').length,
    [outstanding]
  )

  const futureCount = useMemo(
    () => outstanding.filter((t) => getDueState(t.dueDate) === 'future').length,
    [outstanding]
  )

  return (
    <div className="space-y-4">
      <section className="overflow-hidden rounded-3xl border border-zinc-200 bg-gradient-to-br from-zinc-950 via-zinc-900 to-zinc-800 p-5 text-white shadow-sm">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
          <div className="min-w-0">
            <div className="text-xs font-black uppercase tracking-[0.22em] text-zinc-300">
              Office tasks
            </div>
            <h1 className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl">
              To-do list for Kelly and Trevor
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-300">
              Standalone office actions with owners, due dates and a clean view of what still
              needs doing.
            </p>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <StatCard label="Outstanding" value={outstanding.length} />
        <StatCard label="Overdue" value={overdueCount} tone="red" />
        <StatCard label="Due today" value={dueTodayCount} tone="amber" />
        <StatCard label="Upcoming" value={futureCount} tone="blue" />
      </section>

      <section className="overflow-hidden rounded-3xl border border-zinc-200 bg-white shadow-sm">
        <div className="border-b border-zinc-200 px-4 py-4">
          <h2 className="text-base font-bold text-zinc-900">Add a new to-do</h2>
          <p className="text-xs text-zinc-500">
            Keep it short and clear so it is easy to action quickly.
          </p>
        </div>

        <div className="p-4">
          {error ? (
            <div className="mb-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          ) : null}

          <div className="grid gap-3 lg:grid-cols-[1.5fr_220px_220px_140px]">
            <input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Example: Ring supplier about stone delivery"
              className="min-h-[48px] rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none transition focus:border-zinc-500"
            />

            <select
              value={assignedTo}
              onChange={(e) => setAssignedTo(e.target.value)}
              className="min-h-[48px] rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none transition focus:border-zinc-500"
            >
              <option value="Kelly">Kelly</option>
              <option value="Trevor">Trevor</option>
            </select>

            <input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="min-h-[48px] rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none transition focus:border-zinc-500"
            />

            <button
              onClick={addTodo}
              disabled={saving}
              className="inline-flex min-h-[48px] items-center justify-center rounded-xl bg-zinc-900 px-4 py-3 text-sm font-bold text-white transition hover:bg-black disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saving ? 'Adding...' : 'Add to-do'}
            </button>
          </div>
        </div>
      </section>

      <div className="grid gap-4 xl:grid-cols-12">
        <section className="xl:col-span-7">
          <div className="overflow-hidden rounded-3xl border border-zinc-200 bg-white shadow-sm">
            <div className="border-b border-zinc-200 px-4 py-4">
              <h2 className="text-base font-bold text-zinc-900">Outstanding tasks</h2>
              <p className="text-xs text-zinc-500">
                The live list of what still needs doing.
              </p>
            </div>

            <div className="p-4">
              {loading ? (
                <div className="rounded-2xl border border-dashed border-zinc-300 bg-zinc-50 p-5 text-sm text-zinc-600">
                  Loading to-dos...
                </div>
              ) : outstanding.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-zinc-300 bg-zinc-50 p-5 text-sm text-zinc-600">
                  No outstanding tasks right now.
                </div>
              ) : (
                <div className="space-y-3">
                  {outstanding.map((todo) => (
                    <div
                      key={todo.id}
                      className={`rounded-2xl border p-4 ${cardClasses(todo.dueDate, false)}`}
                    >
                      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                        <div className="flex min-w-0 gap-3">
                          <div className="pt-0.5">
                            <input
                              type="checkbox"
                              checked={todo.completed}
                              onChange={() => toggleTodo(todo)}
                              className="h-5 w-5 rounded border-zinc-300"
                            />
                          </div>

                          <div className="min-w-0">
                            <div className="text-sm font-semibold leading-6 text-zinc-900">
                              {todo.description}
                            </div>

                            <div className="mt-2 flex flex-wrap items-center gap-2">
                              <span className="rounded-full bg-zinc-100 px-2.5 py-1 text-[11px] font-semibold text-zinc-700 ring-1 ring-inset ring-zinc-200">
                                {todo.assignedTo}
                              </span>

                              <span
                                className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1 ring-inset ${dueBadgeClasses(todo.dueDate)}`}
                              >
                                {dueLabel(todo.dueDate)}
                              </span>
                            </div>
                          </div>
                        </div>

                        <button
                          onClick={() => toggleTodo(todo)}
                          className="inline-flex items-center justify-center rounded-xl border border-zinc-300 bg-white px-4 py-2 text-sm font-semibold text-zinc-800 transition hover:bg-zinc-100"
                        >
                          Mark done
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </section>

        <section className="xl:col-span-5">
          <div className="overflow-hidden rounded-3xl border border-zinc-200 bg-white shadow-sm">
            <div className="border-b border-zinc-200 px-4 py-4">
              <h2 className="text-base font-bold text-zinc-900">Completed tasks</h2>
              <p className="text-xs text-zinc-500">
                Recently ticked off and out of the way.
              </p>
            </div>

            <div className="p-4">
              {loading ? (
                <div className="rounded-2xl border border-dashed border-zinc-300 bg-zinc-50 p-5 text-sm text-zinc-600">
                  Loading completed tasks...
                </div>
              ) : completed.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-zinc-300 bg-zinc-50 p-5 text-sm text-zinc-600">
                  No completed tasks yet.
                </div>
              ) : (
                <div className="space-y-3">
                  {completed.map((todo) => (
                    <div
                      key={todo.id}
                      className={`rounded-2xl border p-4 opacity-80 ${cardClasses(todo.dueDate, true)}`}
                    >
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div className="flex min-w-0 gap-3">
                          <div className="pt-0.5">
                            <input
                              type="checkbox"
                              checked
                              onChange={() => toggleTodo(todo)}
                              className="h-5 w-5 rounded border-zinc-300"
                            />
                          </div>

                          <div className="min-w-0">
                            <div className="text-sm font-semibold leading-6 text-zinc-700 line-through">
                              {todo.description}
                            </div>

                            <div className="mt-2 flex flex-wrap items-center gap-2">
                              <span className="rounded-full bg-white px-2.5 py-1 text-[11px] font-semibold text-zinc-700 ring-1 ring-inset ring-zinc-200">
                                {todo.assignedTo}
                              </span>

                              <span className="rounded-full bg-zinc-100 px-2.5 py-1 text-[11px] font-semibold text-zinc-600 ring-1 ring-inset ring-zinc-200">
                                {dueLabel(todo.dueDate)}
                              </span>
                            </div>
                          </div>
                        </div>

                        <button
                          onClick={() => toggleTodo(todo)}
                          className="inline-flex items-center justify-center rounded-xl border border-zinc-300 bg-white px-4 py-2 text-sm font-semibold text-zinc-800 transition hover:bg-zinc-100"
                        >
                          Re-open
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}