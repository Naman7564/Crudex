import { supabase } from './lib/supabase'

const authContainer = document.getElementById('auth-container')
const appContainer = document.getElementById('app-container')
const userEmailSpan = document.getElementById('user-email')
const authForm = document.getElementById('auth-form')
const authMessage = document.getElementById('auth-message')
const logoutBtn = document.getElementById('logout-btn')
const todoList = document.getElementById('todo-list')
const loadingState = document.getElementById('loading-state')
const emptyState = document.getElementById('empty-state')
const modal = document.getElementById('todo-modal')
const todoForm = document.getElementById('todo-form')
const modalTitle = document.getElementById('modal-title')
const todoIdInput = document.getElementById('todo-id')
const todoTitleInput = document.getElementById('todo-title')
const themeToggleBtn = document.getElementById('theme-toggle')
const sunIcon = document.getElementById('sun-icon')
const moonIcon = document.getElementById('moon-icon')

// Notes DOM Elements
const tasksView = document.getElementById('tasks-view')
const notesView = document.getElementById('notes-view')
const tabTasks = document.getElementById('tab-tasks')
const tabNotes = document.getElementById('tab-notes')
const notesList = document.getElementById('notes-list')
const notesEmptyState = document.getElementById('notes-empty-state')
const noteModal = document.getElementById('note-modal')
const noteForm = document.getElementById('note-form')
const noteTitleInput = document.getElementById('note-title')
const noteContentInput = document.getElementById('note-content')
const noteIdInput = document.getElementById('note-id')
const noteModalTitle = document.getElementById('note-modal-title')

// Set initial icon state based on current class (set by inline script)
if (document.documentElement.classList.contains('dark')) {
    sunIcon.classList.remove('hidden')
    moonIcon.classList.add('hidden')
} else {
    sunIcon.classList.add('hidden')
    moonIcon.classList.remove('hidden')
}

// State
let currentUser = null
let isModalOpen = false

// --- Theme ---

function toggleTheme() {
    const isDark = document.documentElement.classList.toggle('dark')
    localStorage.setItem('theme', isDark ? 'dark' : 'light')

    if (isDark) {
        sunIcon.classList.remove('hidden')
        moonIcon.classList.add('hidden')
    } else {
        sunIcon.classList.add('hidden')
        moonIcon.classList.remove('hidden')
    }
}

// --- Initialization ---

async function init() {
    // initTheme() handled in index.html to prevent flash
    const { data: { session } } = await supabase.auth.getSession()
    handleSession(session)

    // Listen for auth changes, but skip the INITIAL_SESSION event 
    // since we already handled it above with getSession()
    supabase.auth.onAuthStateChange((event, session) => {
        if (event === 'INITIAL_SESSION') return
        handleSession(session)
    })

    setupEventListeners()
}

let realtimeChannel = null
let notesChannel = null
let currentTab = 'tasks'

function handleSession(session) {
    if (session) {
        currentUser = session.user
        userEmailSpan.textContent = currentUser.email
        authContainer.classList.add('hidden')
        appContainer.classList.remove('hidden')
        fetchTodos()
        fetchNotes()
        subscribeToRealtime()
        subscribeToNotes()
    } else {
        currentUser = null
        if (realtimeChannel) {
            supabase.removeChannel(realtimeChannel)
            realtimeChannel = null
        }
        if (notesChannel) {
            supabase.removeChannel(notesChannel)
            notesChannel = null
        }
        authContainer.classList.remove('hidden')
        appContainer.classList.add('hidden')
        todoList.innerHTML = ''
        notesList.innerHTML = ''
    }
}

// --- Event Listeners ---

function setupEventListeners() {
    // Theme Toggle
    themeToggleBtn.addEventListener('click', toggleTheme)

    // Auth
    authForm.addEventListener('submit', handleAuth)
    logoutBtn.addEventListener('click', async () => {
        await supabase.auth.signOut()
    })

    // Modal
    document.getElementById('add-todo-btn').addEventListener('click', () => openModal())
    document.getElementById('close-modal-btn').addEventListener('click', closeModal)
    document.getElementById('cancel-modal-btn').addEventListener('click', closeModal)
    todoForm.addEventListener('submit', handleSaveTodo)

    // Notes Events
    tabTasks.addEventListener('click', () => switchTab('tasks'))
    tabNotes.addEventListener('click', () => switchTab('notes'))
    document.getElementById('add-note-btn').addEventListener('click', () => openNoteModal())
    document.getElementById('close-note-modal-btn').addEventListener('click', closeNoteModal)
    document.getElementById('cancel-note-modal-btn').addEventListener('click', closeNoteModal)
    noteForm.addEventListener('submit', handleSaveNote)

    // Notes List Delegation
    notesList.addEventListener('click', async (e) => {
        const item = e.target.closest('.note-card')
        if (!item) return
        const id = item.dataset.id

        if (e.target.closest('.delete-btn')) {
            e.stopPropagation()
            await deleteNote(id)
        } else {
            // Edit on click
            const title = item.querySelector('.note-title').textContent
            const content = item.dataset.content // Store content in data attribute for easy retrieval
            openNoteModal({ id, title, content })
        }
    })

    // Todo items (delegation)
    todoList.addEventListener('click', async (e) => {
        const item = e.target.closest('.todo-item')
        if (!item) return
        const id = item.dataset.id

        if (e.target.closest('.delete-btn')) {
            await deleteTodo(id)
        } else if (e.target.closest('.edit-btn')) {
            const title = item.querySelector('.todo-title').textContent
            openModal({ id, title })
        } else if (e.target.closest('.toggle-checkbox')) {
            const checked = e.target.closest('.toggle-checkbox').checked
            await toggleTodo(id, checked)
        }
    })
}

// --- Auth Logic ---

async function handleAuth(e) {
    e.preventDefault()
    const email = document.getElementById('email').value
    const password = document.getElementById('password').value

    authMessage.textContent = 'Authenticating...'
    authMessage.classList.remove('hidden', 'text-red-500')
    authMessage.classList.add('text-gray-500')

    // Try Login
    let { error } = await supabase.auth.signInWithPassword({ email, password })

    if (error) {
        // If login failed, try signup
        console.log('Login failed, trying signup:', error.message)
        const { error: signUpError } = await supabase.auth.signUp({ email, password })

        if (signUpError) {
            authMessage.textContent = signUpError.message
            authMessage.classList.remove('text-gray-500')
            authMessage.classList.add('text-red-500')
        } else {
            authMessage.textContent = 'Account created! Signing in...'
            // Auto login usually happens after signup unless email confirmation is on (which is default for Supabase, but let's hope it works or prompts check email)
            // Actually for this demo, if email confirm is on, they can't login immediately. 
            // NOTE: Usually local dev/demo supabase projects might have email confirm on. 
            // I'll assume standard flow.
        }
    } else {
        authMessage.classList.add('hidden')
    }
}

// --- CRUD Operations ---

async function fetchTodos() {
    loadingState.classList.remove('hidden')
    emptyState.classList.add('hidden')
    todoList.innerHTML = ''

    const { data, error } = await supabase
        .from('todos')
        .select('*')
        .order('created_at', { ascending: false })

    loadingState.classList.add('hidden')

    if (error) {
        console.error('Error fetching todos:', error)
        return
    }

    if (data.length === 0) {
        emptyState.classList.remove('hidden')
    } else {
        data.forEach(renderTodoItem)
    }
}

function subscribeToRealtime() {
    if (realtimeChannel) {
        supabase.removeChannel(realtimeChannel)
    }

    realtimeChannel = supabase
        .channel('todos-channel')
        .on(
            'postgres_changes',
            { event: '*', schema: 'public', table: 'todos' },
            (payload) => {
                const { eventType, new: newRecord, old: oldRecord } = payload

                if (eventType === 'INSERT') {
                    // Only add if it belongs to current user
                    if (newRecord.user_id === currentUser.id) {
                        // Check if already exists (optimistic update might have added it)
                        const exists = document.querySelector(`.todo-item[data-id="${newRecord.id}"]`)
                        if (!exists) {
                            if (todoList.children.length === 0) emptyState.classList.add('hidden')
                            renderTodoItem(newRecord, true)
                        }
                    }
                } else if (eventType === 'UPDATE') {
                    const item = document.querySelector(`.todo-item[data-id="${newRecord.id}"]`)
                    if (item) {
                        // Update title
                        item.querySelector('.todo-title').textContent = newRecord.title
                        // Update checkbox and styles
                        const titleEl = item.querySelector('.todo-title')
                        const checkbox = item.querySelector('.toggle-checkbox')
                        checkbox.checked = newRecord.is_complete
                        if (newRecord.is_complete) {
                            titleEl.classList.add('line-through', 'text-gray-400', 'dark:text-gray-500')
                            titleEl.classList.remove('text-gray-800', 'dark:text-gray-100')
                        } else {
                            titleEl.classList.remove('line-through', 'text-gray-400', 'dark:text-gray-500')
                            titleEl.classList.add('text-gray-800', 'dark:text-gray-100')
                        }
                    }
                } else if (eventType === 'DELETE') {
                    const item = document.querySelector(`.todo-item[data-id="${oldRecord.id}"]`)
                    if (item) item.remove()
                    if (todoList.children.length === 0) emptyState.classList.remove('hidden')
                }
            }
        )
        .subscribe()
}

async function handleSaveTodo(e) {
    e.preventDefault()

    // Prevent double submission
    const submitBtn = todoForm.querySelector('button[type="submit"]')
    if (submitBtn.disabled) return

    submitBtn.disabled = true
    const originalText = submitBtn.textContent
    submitBtn.textContent = 'Saving...'

    const title = todoTitleInput.value
    const id = todoIdInput.value

    try {
        if (id) {
            await updateTodo(id, title)
        } else {
            await createTodo(title)
        }
        closeModal()
    } catch (err) {
        console.error('Error saving:', err)
    } finally {
        submitBtn.disabled = false
        submitBtn.textContent = originalText
    }
}

async function createTodo(title) {
    const { data, error } = await supabase
        .from('todos')
        .insert([{ title, user_id: currentUser.id }])
        .select()

    if (error) {
        console.error('Error creating todo:', error)
        alert('Error creating task')
    } else {
        // Optimistic or refetch? Refetch is safer for order.
        // simpler: prepend to list
        if (todoList.children.length === 0) emptyState.classList.add('hidden')
        renderTodoItem(data[0], true)
    }
}

async function updateTodo(id, title) {
    const { error } = await supabase
        .from('todos')
        .update({ title })
        .eq('id', id)

    if (error) {
        console.error('Error updating todo:', error)
        alert('Failed to update')
    } else {
        fetchTodos() // Reload to refresh list easily
    }
}

async function toggleTodo(id, is_complete) {
    const { error } = await supabase
        .from('todos')
        .update({ is_complete })
        .eq('id', id)

    if (error) {
        console.error('Error toggling:', error)
        // revert UI state if needed, but we'll just reload or ignore
    } else {
        const item = document.querySelector(`.todo-item[data-id="${id}"]`)
        if (item) {
            const title = item.querySelector('.todo-title')
            if (is_complete) {
                title.classList.add('line-through', 'text-gray-400', 'dark:text-gray-500')
                title.classList.remove('text-gray-800', 'dark:text-gray-100')
            } else {
                title.classList.remove('line-through', 'text-gray-400', 'dark:text-gray-500')
                title.classList.add('text-gray-800', 'dark:text-gray-100')
            }
        }
    }
}

async function deleteTodo(id) {
    if (!confirm('Are you sure you want to delete this task?')) return

    const { error } = await supabase
        .from('todos')
        .delete()
        .eq('id', id)

    if (error) {
        console.error('Error deleting:', error)
        alert('Failed to delete')
    } else {
        const item = document.querySelector(`.todo-item[data-id="${id}"]`)
        if (item) item.remove()
        if (todoList.children.length === 0) emptyState.classList.remove('hidden')
    }
}

// --- UI Helpers ---

function renderTodoItem(todo, prepend = false) {
    const div = document.createElement('div')
    div.className = 'todo-item group'
    div.dataset.id = todo.id

    const isChecked = todo.is_complete ? 'checked' : ''
    const textClass = todo.is_complete ? 'line-through text-gray-400 dark:text-gray-500' : 'text-gray-800 dark:text-gray-100'

    div.innerHTML = `
    <div class="flex items-center space-x-4">
      <input type="checkbox" class="toggle-checkbox w-5 h-5 rounded border-gray-300 text-brand-600 focus:ring-brand-500 cursor-pointer" ${isChecked}>
      <span class="todo-title text-base font-medium ${textClass}">${escapeHtml(todo.title)}</span>
    </div>
    <div class="flex items-center space-x-2 opacity-0 group-hover:opacity-100 transition-opacity">
      <button class="edit-btn p-2 text-gray-400 hover:text-brand-600 transition" title="Edit">
        <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
        </svg>
      </button>
      <button class="delete-btn p-2 text-gray-400 hover:text-red-600 transition" title="Delete">
        <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
        </svg>
      </button>
    </div>
  `

    if (prepend) {
        todoList.prepend(div)
    } else {
        todoList.appendChild(div)
    }
}

function openModal(todo = null) {
    if (todo) {
        modalTitle.textContent = 'Edit Task'
        todoTitleInput.value = todo.title
        todoIdInput.value = todo.id
    } else {
        modalTitle.textContent = 'Add New Task'
        todoTitleInput.value = ''
        todoIdInput.value = ''
    }

    modal.classList.remove('hidden')
    // Small delay for fade in animation
    setTimeout(() => {
        modal.classList.remove('opacity-0')
        modal.querySelector('div').classList.remove('scale-95')
        modal.querySelector('div').classList.add('scale-100')
    }, 10)

    todoTitleInput.focus()
    isModalOpen = true
}

function closeModal() {
    modal.classList.add('opacity-0')
    modal.querySelector('div').classList.remove('scale-100')
    modal.querySelector('div').classList.add('scale-95')

    setTimeout(() => {
        modal.classList.add('hidden')
    }, 300)
    isModalOpen = false
}

function escapeHtml(text) {
    const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    };
    return text.replace(/[&<>"']/g, function (m) { return map[m]; });
}

// Start
// --- Tabs Logic ---

function switchTab(tab) {
    currentTab = tab
    if (tab === 'tasks') {
        tasksView.classList.remove('hidden')
        notesView.classList.add('hidden')
        tabTasks.classList.add('nav-tab-active')
        tabNotes.classList.remove('nav-tab-active')
    } else {
        tasksView.classList.add('hidden')
        notesView.classList.remove('hidden')
        tabTasks.classList.remove('nav-tab-active')
        tabNotes.classList.add('nav-tab-active')
    }
}

// --- Notes CRUD ---

async function fetchNotes() {
    notesList.innerHTML = ''
    notesEmptyState.classList.add('hidden')

    const { data, error } = await supabase
        .from('notes')
        .select('*')
        .order('created_at', { ascending: false })

    if (error) {
        console.error('Error fetching notes:', error)
        return
    }

    if (data.length === 0) {
        notesEmptyState.classList.remove('hidden')
    } else {
        data.forEach(renderNoteItem)
    }
}

function subscribeToNotes() {
    if (notesChannel) {
        supabase.removeChannel(notesChannel)
    }

    notesChannel = supabase
        .channel('notes-channel')
        .on(
            'postgres_changes',
            { event: '*', schema: 'public', table: 'notes' },
            (payload) => {
                const { eventType, new: newRecord, old: oldRecord } = payload

                if (eventType === 'INSERT') {
                    if (newRecord.user_id === currentUser.id) {
                        const exists = document.querySelector(`.note-card[data-id="${newRecord.id}"]`)
                        if (!exists) {
                            if (notesList.children.length === 0) notesEmptyState.classList.add('hidden')
                            renderNoteItem(newRecord, true)
                        }
                    }
                } else if (eventType === 'UPDATE') {
                    const item = document.querySelector(`.note-card[data-id="${newRecord.id}"]`)
                    if (item) {
                        item.querySelector('.note-title').textContent = newRecord.title
                        item.querySelector('.note-content').textContent = newRecord.content
                        item.dataset.content = newRecord.content
                    }
                } else if (eventType === 'DELETE') {
                    const item = document.querySelector(`.note-card[data-id="${oldRecord.id}"]`)
                    if (item) item.remove()
                    if (notesList.children.length === 0) notesEmptyState.classList.remove('hidden')
                }
            }
        )
        .subscribe()
}

async function handleSaveNote(e) {
    e.preventDefault()

    const submitBtn = noteForm.querySelector('button[type="submit"]')
    if (submitBtn.disabled) return

    submitBtn.disabled = true
    const originalText = submitBtn.textContent
    submitBtn.textContent = 'Saving...'

    const title = noteTitleInput.value
    const content = noteContentInput.value
    const id = noteIdInput.value

    try {
        if (id) {
            await updateNote(id, title, content)
        } else {
            await createNote(title, content)
        }
        closeNoteModal()
    } catch (err) {
        console.error('Error saving note:', err)
    } finally {
        submitBtn.disabled = false
        submitBtn.textContent = originalText
    }
}

async function createNote(title, content) {
    const { data, error } = await supabase
        .from('notes')
        .insert([{ title, content, user_id: currentUser.id }])
        .select()

    if (error) {
        console.error('Error creating note:', error)
        alert('Error creating note')
    } else {
        if (notesList.children.length === 0) notesEmptyState.classList.add('hidden')
        renderNoteItem(data[0], true)
    }
}

async function updateNote(id, title, content) {
    const { error } = await supabase
        .from('notes')
        .update({ title, content })
        .eq('id', id)

    if (error) {
        console.error('Error updating note:', error)
        alert('Failed to update note')
    } else {
        // Optimistic update handled by realtime is mostly sufficient, 
        // but local update is good for responsiveness if realtime is slow.
        // We'll rely on realtime or fetch. Fetch is safest.
        fetchNotes()
    }
}

async function deleteNote(id) {
    if (!confirm('Delete this note?')) return

    const { error } = await supabase
        .from('notes')
        .delete()
        .eq('id', id)

    if (error) {
        console.error('Error deleting note:', error)
        alert('Failed to delete note')
    } else {
        const item = document.querySelector(`.note-card[data-id="${id}"]`)
        if (item) item.remove()
        if (notesList.children.length === 0) notesEmptyState.classList.remove('hidden')
    }
}

function renderNoteItem(note, prepend = false) {
    const div = document.createElement('div')
    div.className = 'note-card group cursor-pointer'
    div.dataset.id = note.id
    div.dataset.content = note.content || ''

    div.innerHTML = `
        <div class="flex justify-between items-start mb-2">
            <h3 class="note-title text-lg font-bold text-gray-800 dark:text-white line-clamp-1">${escapeHtml(note.title)}</h3>
            <button class="delete-btn opacity-0 group-hover:opacity-100 p-1 text-gray-400 hover:text-red-600 transition" title="Delete">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
            </button>
        </div>
        <div class="note-content text-gray-600 dark:text-gray-300 text-sm whitespace-pre-wrap line-clamp-4 leading-relaxed">${escapeHtml(note.content || '')}</div>
        <div class="mt-auto pt-4 text-xs text-gray-400 dark:text-gray-500 font-medium">
            ${new Date(note.created_at).toLocaleDateString()}
        </div>
    `

    if (prepend) {
        notesList.prepend(div)
    } else {
        notesList.appendChild(div)
    }
}

function openNoteModal(note = null) {
    if (note) {
        noteModalTitle.textContent = 'Edit Note'
        noteTitleInput.value = note.title
        noteContentInput.value = note.content
        noteIdInput.value = note.id
    } else {
        noteModalTitle.textContent = 'Add New Note'
        noteTitleInput.value = ''
        noteContentInput.value = ''
        noteIdInput.value = ''
    }

    noteModal.classList.remove('hidden')
    setTimeout(() => {
        noteModal.classList.remove('opacity-0')
        noteModal.querySelector('div').classList.remove('scale-95')
        noteModal.querySelector('div').classList.add('scale-100')
    }, 10)

    noteTitleInput.focus()
}

function closeNoteModal() {
    noteModal.classList.add('opacity-0')
    noteModal.querySelector('div').classList.remove('scale-100')
    noteModal.querySelector('div').classList.add('scale-95')

    setTimeout(() => {
        noteModal.classList.add('hidden')
    }, 300)
}

// Start
init()
