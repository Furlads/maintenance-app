'use client'

import { useEffect, useState } from 'react'

type Todo = {
  id: number
  description: string
  assignedTo: string
  completed: boolean
  dueDate: string | null
}

export default function TodosPage() {
  const [todos, setTodos] = useState<Todo[]>([])
  const [description, setDescription] = useState('')
  const [assignedTo, setAssignedTo] = useState('Kelly')
  const [dueDate, setDueDate] = useState('')

  async function loadTodos() {
    const res = await fetch('/api/todos', { cache: 'no-store' })
    const data = await res.json()
    setTodos(data)
  }

  useEffect(() => {
    loadTodos()
  }, [])

  async function addTodo() {
    if (!description.trim()) return

    await fetch('/api/todos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        description,
        assignedTo,
        dueDate: dueDate || null,
      }),
    })

    setDescription('')
    setDueDate('')
    loadTodos()
  }

  async function toggleTodo(todo: Todo) {
    await fetch(`/api/todos/${todo.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        completed: !todo.completed,
      }),
    })

    loadTodos()
  }

  function formatDate(date: string | null) {
    if (!date) return null
    return new Date(date).toLocaleDateString('en-GB')
  }

  function getDueState(date: string | null) {
    if (!date) return 'none'

    const due = new Date(date)
    const today = new Date()

    const dueOnly = new Date(due.getFullYear(), due.getMonth(), due.getDate())
    const todayOnly = new Date(today.getFullYear(), today.getMonth(), today.getDate())

    if (dueOnly.getTime() < todayOnly.getTime()) return 'overdue'
    if (dueOnly.getTime() === todayOnly.getTime()) return 'today'
    return 'future'
  }

  function getCardClasses(date: string | null) {
    const state = getDueState(date)

    if (state === 'overdue') {
      return 'border-red-300 bg-red-50'
    }

    if (state === 'today') {
      return 'border-amber-300 bg-amber-50'
    }

    return 'border-zinc-200 bg-white'
  }

  function getDueTextClasses(date: string | null) {
    const state = getDueState(date)

    if (state === 'overdue') {
      return 'text-red-700'
    }

    if (state === 'today') {
      return 'text-amber-700'
    }

    return 'text-zinc-500'
  }

  function getDueLabel(date: string | null) {
    if (!date) return null

    const formatted = formatDate(date)
    const state = getDueState(date)

    if (state === 'overdue') return `Overdue: ${formatted}`
    if (state === 'today') return `Due today: ${formatted}`
    return `Due: ${formatted}`
  }

  const outstanding = todos.filter((t) => !t.completed)
  const completed = todos.filter((t) => t.completed)

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold">To-Do List</h1>

      <div className="flex gap-2 flex-wrap">
        <input
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="New task..."
          className="border p-2 rounded flex-1 min-w-[220px]"
        />

        <select
          value={assignedTo}
          onChange={(e) => setAssignedTo(e.target.value)}
          className="border p-2 rounded"
        >
          <option>Kelly</option>
          <option>Trevor</option>
        </select>

        <input
          type="date"
          value={dueDate}
          onChange={(e) => setDueDate(e.target.value)}
          className="border p-2 rounded"
        />

        <button
          onClick={addTodo}
          className="bg-black text-white px-4 rounded"
        >
          Add
        </button>
      </div>

      <div>
        <h2 className="font-bold mb-2">Outstanding ({outstanding.length})</h2>

        <div className="space-y-2">
          {outstanding.length === 0 ? (
            <div className="border border-dashed border-zinc-300 rounded p-4 text-sm text-zinc-500">
              No outstanding tasks.
            </div>
          ) : (
            outstanding.map((todo) => (
              <div
                key={todo.id}
                className={`flex items-center justify-between border p-3 rounded ${getCardClasses(todo.dueDate)}`}
              >
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={todo.completed}
                    onChange={() => toggleTodo(todo)}
                  />
                  <div>
                    <div>{todo.description}</div>
                    {todo.dueDate && (
                      <div className={`text-xs font-medium ${getDueTextClasses(todo.dueDate)}`}>
                        {getDueLabel(todo.dueDate)}
                      </div>
                    )}
                  </div>
                </div>

                <span className="text-sm text-gray-500">{todo.assignedTo}</span>
              </div>
            ))
          )}
        </div>
      </div>

      <div>
        <h2 className="font-bold mb-2">Completed</h2>

        <div className="space-y-2">
          {completed.length === 0 ? (
            <div className="border border-dashed border-zinc-300 rounded p-4 text-sm text-zinc-500">
              No completed tasks yet.
            </div>
          ) : (
            completed.map((todo) => (
              <div
                key={todo.id}
                className="flex items-center justify-between border border-zinc-200 bg-zinc-50 p-3 rounded opacity-60"
              >
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked
                    onChange={() => toggleTodo(todo)}
                  />
                  <div>
                    <div className="line-through">{todo.description}</div>
                    {todo.dueDate && (
                      <div className="text-xs text-zinc-500">
                        Due: {formatDate(todo.dueDate)}
                      </div>
                    )}
                  </div>
                </div>

                <span className="text-sm">{todo.assignedTo}</span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}