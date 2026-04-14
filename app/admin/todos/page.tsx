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

  const outstanding = todos.filter(t => !t.completed)
  const completed = todos.filter(t => t.completed)

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold">To-Do List</h1>

      {/* Add new */}
      <div className="flex gap-2 flex-wrap">
        <input
          value={description}
          onChange={e => setDescription(e.target.value)}
          placeholder="New task..."
          className="border p-2 rounded flex-1 min-w-[200px]"
        />

        <select
          value={assignedTo}
          onChange={e => setAssignedTo(e.target.value)}
          className="border p-2 rounded"
        >
          <option>Kelly</option>
          <option>Trevor</option>
        </select>

        <input
          type="date"
          value={dueDate}
          onChange={e => setDueDate(e.target.value)}
          className="border p-2 rounded"
        />

        <button
          onClick={addTodo}
          className="bg-black text-white px-4 rounded"
        >
          Add
        </button>
      </div>

      {/* Outstanding */}
      <div>
        <h2 className="font-bold mb-2">
          Outstanding ({outstanding.length})
        </h2>

        <div className="space-y-2">
          {outstanding.map(todo => (
            <div
              key={todo.id}
              className="flex items-center justify-between border p-3 rounded"
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
                    <div className="text-xs text-red-500">
                      Due: {formatDate(todo.dueDate)}
                    </div>
                  )}
                </div>
              </div>

              <span className="text-sm text-gray-500">
                {todo.assignedTo}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Completed */}
      <div>
        <h2 className="font-bold mb-2">Completed</h2>

        <div className="space-y-2">
          {completed.map(todo => (
            <div
              key={todo.id}
              className="flex items-center justify-between border p-3 rounded opacity-60"
            >
              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  checked
                  onChange={() => toggleTodo(todo)}
                />
                <div className="line-through">
                  {todo.description}
                </div>
              </div>

              <span className="text-sm">
                {todo.assignedTo}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}