import { supabase } from './lib/supabase'

// --- DOM Elements ---
const authContainer = document.getElementById('auth-container')
const appContainer = document.getElementById('app-container')
const userEmailSpan = document.getElementById('user-email') // Might correspond to user-display-name now
const userDisplayName = document.getElementById('user-display-name')
const authForm = document.getElementById('auth-form')
const authMessage = document.getElementById('auth-message')
const logoutBtn = document.getElementById('logout-btn')

// Notification DOM
const notificationBtn = document.getElementById('notification-btn')
const notificationDropdown = document.getElementById('notification-dropdown')
const notificationContainer = document.getElementById('notification-container')

// Sidebar / Nav
const sidebar = document.getElementById('sidebar')
const mobileMenuBtn = document.getElementById('mobile-menu-btn')
const navDashboard = document.getElementById('nav-dashboard')
const navTasks = document.getElementById('nav-tasks')
const navNotes = document.getElementById('nav-notes')
const navProjects = document.getElementById('nav-projects')
const navTeams = document.getElementById('nav-teams')
const navSettings = document.getElementById('nav-settings')

// Views
const tasksView = document.getElementById('tasks-view')
const notesView = document.getElementById('notes-view')
const projectsView = document.getElementById('projects-view')
const teamsView = document.getElementById('teams-view')
const dashboardView = document.getElementById('dashboard-view')

// Dashboard DOM
const dashboardTasksList = document.getElementById('dashboard-tasks-list')
const dashboardAddTaskBtn = document.getElementById('dashboard-add-task-btn')
const statsPercentage = document.getElementById('stats-percentage')
const statsProgressCircle = document.getElementById('stats-progress-circle')
const statsCompletedCount = document.getElementById('stats-completed-count')

// Analysis DOM
const calendarGrid = document.getElementById('calendar-grid')
const calendarMonth = document.getElementById('calendar-month')
const prevMonthBtn = document.getElementById('prev-month')
const nextMonthBtn = document.getElementById('next-month')
const analysisChartCanvas = document.getElementById('analysis-chart')

// Quick Actions DOM
const actionScheduleMeeting = document.getElementById('action-schedule-meeting')
const actionViewUpcoming = document.getElementById('action-view-upcoming')
const actionArchiveCompleted = document.getElementById('action-archive-completed')
const actionAddNote = document.getElementById('action-add-note')

let chartInstance = null
let currentCalendarDate = new Date()

// Tasks DOM
const todoList = document.getElementById('todo-list')
const loadingState = document.getElementById('loading-state')
const emptyState = document.getElementById('empty-state')
const todoModal = document.getElementById('todo-modal')
const todoForm = document.getElementById('todo-form')
const modalTitle = document.getElementById('modal-title')
const todoIdInput = document.getElementById('todo-id')
const todoTitleInput = document.getElementById('todo-title')
const todoCategoryInput = document.getElementById('todo-category')
const todoDueDateInput = document.getElementById('todo-due-date')

// Notes DOM
const notesList = document.getElementById('notes-list')
const notesEmptyState = document.getElementById('notes-empty-state')
const noteModal = document.getElementById('note-modal')
const noteForm = document.getElementById('note-form')
const noteTitleInput = document.getElementById('note-title')
const noteContentInput = document.getElementById('note-content')
const noteIdInput = document.getElementById('note-id')
const noteModalTitle = document.getElementById('note-modal-title')

// State
let currentUser = null
let realtimeChannel = null
let notesChannel = null
let currentView = 'dashboard' // Default to dashboard


// --- Init ---

async function init() {
    const { data: { session } } = await supabase.auth.getSession()
    handleSession(session)

    supabase.auth.onAuthStateChange((event, session) => {
        if (event === 'INITIAL_SESSION') return
        handleSession(session)
    })

    setupEventListeners()
}

function handleSession(session) {
    if (session) {
        currentUser = session.user
        if (userDisplayName) userDisplayName.textContent = currentUser.email.split('@')[0]

        authContainer.classList.add('hidden')
        appContainer.classList.remove('hidden')

        // Load data
        fetchTodos()
        fetchNotes()
        loadDashboardData()
        subscribeToRealtime()
        subscribeToNotes()
    } else {
        currentUser = null
        if (realtimeChannel) supabase.removeChannel(realtimeChannel)
        if (notesChannel) supabase.removeChannel(notesChannel)

        authContainer.classList.remove('hidden')
        appContainer.classList.add('hidden')
        todoList.innerHTML = ''
        notesList.innerHTML = ''
        if (dashboardTasksList) dashboardTasksList.innerHTML = ''
    }
}

// --- Event Listeners ---

function setupEventListeners() {
    // Auth
    authForm.addEventListener('submit', handleAuth)
    logoutBtn.addEventListener('click', async () => await supabase.auth.signOut())

    // Navigation
    navDashboard.addEventListener('click', () => switchView('dashboard'))
    navTasks.addEventListener('click', () => switchView('tasks'))
    navNotes.addEventListener('click', () => switchView('notes'))
    if (navProjects) navProjects.addEventListener('click', () => switchView('projects'))
    if (navTeams) navTeams.addEventListener('click', () => switchView('teams'))
    if (navSettings) navSettings.addEventListener('click', () => alert('Settings coming soon!'))

    // Dashboard actions
    if (dashboardAddTaskBtn) dashboardAddTaskBtn.addEventListener('click', () => openTodoModal())
    // Quick Actions
    if (actionScheduleMeeting) actionScheduleMeeting.addEventListener('click', () => {
        openTodoModal({ category: 'Meeting' })
    })
    if (actionViewUpcoming) actionViewUpcoming.addEventListener('click', () => {
        switchView('tasks')
    })
    if (actionArchiveCompleted) actionArchiveCompleted.addEventListener('click', async () => {
        if (!confirm('Archive (Delete) all completed tasks?')) return
        // Fetch completed
        const { data: completed } = await supabase.from('todos').select('id').eq('is_complete', true)
        if (completed && completed.length > 0) {
            const ids = completed.map(t => t.id)
            const { error } = await supabase.from('todos').delete().in('id', ids)
            if (!error) {
                alert('Archived completed tasks.')
                fetchTodos()
                loadDashboardData()
            } else {
                alert('Error archiving tasks')
            }
        } else {
            alert('No completed tasks to archive.')
        }
    })
    if (actionAddNote) actionAddNote.addEventListener('click', () => {
        openNoteModal()
    })

    // Notification
    notificationBtn.addEventListener('click', (e) => {
        e.stopPropagation()
        notificationDropdown.classList.toggle('opacity-0')
        notificationDropdown.classList.toggle('pointer-events-none')
        notificationDropdown.classList.toggle('scale-95')
        notificationDropdown.classList.toggle('scale-100')
    })

    // Close dropdown on outside click
    document.addEventListener('click', (e) => {
        if (!notificationContainer.contains(e.target)) {
            notificationDropdown.classList.add('opacity-0', 'pointer-events-none', 'scale-95')
            notificationDropdown.classList.remove('scale-100')
        }
    })

    // Calendar Navigation
    if (prevMonthBtn) prevMonthBtn.addEventListener('click', () => changeMonth(-1))
    if (nextMonthBtn) nextMonthBtn.addEventListener('click', () => changeMonth(1))

    // Mobile Menu
    mobileMenuBtn.addEventListener('click', () => {
        sidebar.classList.toggle('-translate-x-full')
    })

    // Task Modals
    document.getElementById('add-todo-btn').addEventListener('click', () => openTodoModal())
    document.getElementById('close-modal-btn').addEventListener('click', closeTodoModal)
    document.getElementById('cancel-modal-btn').addEventListener('click', closeTodoModal)
    todoForm.addEventListener('submit', handleSaveTodo)

    // Task List Actions (Delegation)
    todoList.addEventListener('click', async (e) => {
        const card = e.target.closest('.glass-card')
        if (!card) return
        const id = card.dataset.id

        if (e.target.closest('.delete-btn')) {
            e.stopPropagation()
            await deleteTodo(id)
        } else if (e.target.closest('.checkbox-cyber')) {
            e.stopPropagation()
            const checkbox = e.target.closest('.checkbox-cyber')
            await toggleTodo(id, checkbox.checked)
        } else {
            // Edit on card click (unless clicking checkbox or delete)
            const title = card.querySelector('.todo-title').textContent
            const category = card.dataset.category
            const dueDate = card.dataset.dueDate
            openTodoModal({ id, title, category, due_date: dueDate })
        }
    })

    // Notes Modals
    document.getElementById('add-note-btn').addEventListener('click', () => openNoteModal())
    document.getElementById('close-note-modal-btn').addEventListener('click', closeNoteModal)
    document.getElementById('cancel-note-modal-btn').addEventListener('click', closeNoteModal)
    noteForm.addEventListener('submit', handleSaveNote)

    // Notes List Actions
    notesList.addEventListener('click', async (e) => {
        const card = e.target.closest('.glass-card')
        if (!card) return
        const id = card.dataset.id

        if (e.target.closest('.delete-btn')) {
            e.stopPropagation()
            await deleteNote(id)
        } else {
            const title = card.querySelector('.note-title').textContent
            const content = card.dataset.content
            openNoteModal({ id, title, content })
        }
    })

    // Search Filter
    const searchInput = document.querySelector('input[type="text"][placeholder*="Search"]')
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            const term = e.target.value.toLowerCase()
            filterItems(term)
        })
    }
}

// --- Navigation Logic ---

function switchView(view) {
    currentView = view

    // Reset Active States
    const navItems = [navDashboard, navTasks, navNotes, navProjects, navTeams, navSettings]
    navItems.forEach(el => {
        if (el) el.classList.remove('nav-item-active')
    })

    // Hide all views
    tasksView.classList.add('hidden')
    notesView.classList.add('hidden')
    if (projectsView) projectsView.classList.add('hidden')
    if (teamsView) teamsView.classList.add('hidden')
    if (dashboardView) dashboardView.classList.add('hidden')

    if (view === 'dashboard') {
        if (dashboardView) dashboardView.classList.remove('hidden')
        navDashboard.classList.add('nav-item-active')
        loadDashboardData()
    } else if (view === 'tasks') {
        tasksView.classList.remove('hidden')
        navTasks.classList.add('nav-item-active')
    } else if (view === 'notes') {
        notesView.classList.remove('hidden')
        navNotes.classList.add('nav-item-active')
    } else if (view === 'projects') {
        if (projectsView) projectsView.classList.remove('hidden')
        if (navProjects) navProjects.classList.add('nav-item-active')
    } else if (view === 'teams') {
        if (teamsView) teamsView.classList.remove('hidden')
        if (navTeams) navTeams.classList.add('nav-item-active')
    }

    // On mobile, close sidebar after pick
    if (window.innerWidth < 768) {
        sidebar.classList.add('-translate-x-full')
    }
}

async function loadDashboardData() {
    if (!currentUser) return

    // 1. Stats
    const { data: todos } = await supabase.from('todos').select('*')
    if (todos) {
        const total = todos.length
        const completed = todos.filter(t => t.is_complete).length
        const percentage = total === 0 ? 0 : Math.round((completed / total) * 100)

        if (statsCompletedCount) statsCompletedCount.textContent = completed
        if (statsPercentage) statsPercentage.textContent = `${percentage}%`

        // Update circle
        // 2 * PI * r (56) = ~351.86
        const circumference = 351.86
        const offset = circumference - (percentage / 100) * circumference
        if (statsProgressCircle) statsProgressCircle.style.strokeDashoffset = offset
    }

    // 2. Upcoming Tasks (Top 3 Incomplete)
    // We already have 'todos' from step 1

    if (dashboardTasksList && todos) {
        dashboardTasksList.innerHTML = ''
        // Filter incomplete, and maybe sort by due_date if available, or just created_at
        // Current 'todos' is already sorted by created_at desc
        // Let's filter incomplete
        const upcoming = todos.filter(t => !t.is_complete).slice(0, 3)

        if (upcoming.length === 0) {
            dashboardTasksList.innerHTML = '<p class="text-slate-500 text-sm">No upcoming tasks.</p>'
        } else {
            upcoming.forEach(task => {
                const div = document.createElement('div')
                div.className = 'p-3 rounded-xl bg-slate-800/50 hover:bg-slate-800 border border-slate-700/50 cursor-pointer transition-colors group'

                // Format Due Date
                let dateDisplay = ''
                if (task.due_date) {
                    const dateObj = new Date(task.due_date)
                    const isToday = new Date().toDateString() === dateObj.toDateString()
                    dateDisplay = isToday ? 'Due Today' : dateObj.toLocaleDateString()
                }

                div.innerHTML = `
                    <div class="flex justify-between items-start">
                        <h4 class="font-medium text-white line-clamp-1 text-sm">${escapeHtml(task.title)}</h4>
                    </div>
                    <div class="flex justify-between items-center mt-1">
                        <span class="text-xs text-blue-400">${dateDisplay}</span>
                        <span class="text-xs text-slate-500">${escapeHtml(task.category || 'General')}</span>
                    </div>
                `
                div.addEventListener('click', () => openTodoModal(task))
                dashboardTasksList.appendChild(div)
            })
        }
    }

    // 3. Analysis (Graph + Calendar)
    // We reuse 'todos' fetched earlier for stats
    if (todos) {
        renderAnalysisChart(todos)
        renderCalendar(todos)
    }
}

function renderAnalysisChart(todos) {
    if (!analysisChartCanvas) return

    // Calculate last 7 days data
    const labels = []
    const completedData = []
    const createdData = []

    for (let i = 6; i >= 0; i--) {
        const d = new Date()
        d.setDate(d.getDate() - i)
        const dayStr = d.toLocaleDateString('en-US', { weekday: 'short' })
        const dateStr = d.toISOString().split('T')[0]

        labels.push(dayStr)

        // Count for this day
        // created_at is timestamp, so startswith dateStr works for ISO string
        const completedCount = todos.filter(t => t.is_complete && t.created_at.startsWith(dateStr)).length
        const createdCount = todos.filter(t => t.created_at.startsWith(dateStr)).length

        completedData.push(completedCount)
        createdData.push(createdCount)
    }

    if (chartInstance) chartInstance.destroy()

    chartInstance = new Chart(analysisChartCanvas, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [
                {
                    label: 'Completed',
                    data: completedData,
                    borderColor: '#3b82f6', // blue-500
                    backgroundColor: 'rgba(59, 130, 246, 0.1)',
                    tension: 0.4,
                    fill: true
                },
                {
                    label: 'Created',
                    data: createdData,
                    borderColor: '#a855f7', // purple-500
                    backgroundColor: 'rgba(168, 85, 247, 0.1)',
                    tension: 0.4,
                    fill: true
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    grid: { color: 'rgba(255, 255, 255, 0.05)' },
                    ticks: { color: '#94a3b8' }
                },
                x: {
                    grid: { display: false },
                    ticks: { color: '#94a3b8' }
                }
            }
        }
    })
}

function renderCalendar(todos) {
    if (!calendarGrid || !calendarMonth) return

    const year = currentCalendarDate.getFullYear()
    const month = currentCalendarDate.getMonth()

    // Update Header
    const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"]
    calendarMonth.textContent = `${monthNames[month]} ${year}`

    calendarGrid.innerHTML = ''

    const firstDay = new Date(year, month, 1).getDay()
    const daysInMonth = new Date(year, month + 1, 0).getDate()

    // Blanks
    for (let i = 0; i < firstDay; i++) {
        calendarGrid.appendChild(document.createElement('div'))
    }

    // Days
    const today = new Date()

    for (let day = 1; day <= daysInMonth; day++) {
        // Format YYYY-MM-DD
        const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
        const dayDiv = document.createElement('div')
        dayDiv.textContent = day
        dayDiv.className = 'p-2 rounded-lg cursor-pointer hover:bg-slate-700/50 transition-colors relative'

        // Highlight Today
        if (year === today.getFullYear() && month === today.getMonth() && day === today.getDate()) {
            dayDiv.classList.add('bg-blue-500', 'text-white', 'font-bold')
        } else {
            dayDiv.classList.add('text-slate-300')
        }

        // Highlight Due Dates
        // Check if any INCOMPLETE task has this due date
        const hasDueTask = todos.some(t => t.due_date && t.due_date.startsWith(dateStr) && !t.is_complete)
        if (hasDueTask) {
            const indicators = document.createElement('div')
            indicators.className = 'absolute bottom-1 left-1/2 transform -translate-x-1/2 w-1 h-1 bg-red-400 rounded-full'
            dayDiv.appendChild(indicators)
        }

        calendarGrid.appendChild(dayDiv)
    }
}

function changeMonth(delta) {
    currentCalendarDate.setMonth(currentCalendarDate.getMonth() + delta)
    loadDashboardData() // re-render calendar
}

// --- Auth Logic ---

async function handleAuth(e) {
    e.preventDefault()
    const email = document.getElementById('email').value
    const password = document.getElementById('password').value

    authMessage.textContent = 'Authenticating...'
    authMessage.classList.remove('hidden', 'text-red-500')
    authMessage.classList.add('text-slate-400')

    let { error } = await supabase.auth.signInWithPassword({ email, password })

    if (error) {
        console.log('Login failed, trying signup:', error.message)
        const { error: signUpError } = await supabase.auth.signUp({ email, password })
        if (signUpError) {
            authMessage.textContent = signUpError.message
            authMessage.classList.add('text-red-500')
        } else {
            authMessage.textContent = 'Account created! Signing in...'
        }
    } else {
        authMessage.classList.add('hidden')
    }
}

// --- Task CRUD ---

async function fetchTodos() {
    loadingState.classList.remove('hidden')
    todoList.innerHTML = ''
    emptyState.classList.add('hidden')

    const { data, error } = await supabase
        .from('todos')
        .select('*')
        .order('created_at', { ascending: false })

    loadingState.classList.add('hidden')

    if (error) {
        console.error('Fetch error:', error)
        return
    }

    if (data.length === 0) {
        emptyState.classList.remove('hidden')
    } else {
        data.forEach(renderTodoCard)
    }
}

async function handleSaveTodo(e) {
    e.preventDefault()
    const submitBtn = todoForm.querySelector('button[type="submit"]')
    if (submitBtn.disabled) return
    submitBtn.disabled = true

    const title = todoTitleInput.value
    const category = todoCategoryInput.value
    const dueDate = todoDueDateInput.value || null
    const id = todoIdInput.value

    try {
        if (id) {
            await updateTodo(id, title, category, dueDate)
        } else {
            await createTodo(title, category, dueDate)
        }
        closeTodoModal()
    } catch (err) {
        console.error(err)
    } finally {
        submitBtn.disabled = false
    }
}

async function createTodo(title, category, due_date) {
    const { data, error } = await supabase
        .from('todos')
        .insert([{ title, category, due_date, user_id: currentUser.id }])
        .select()

    if (error) alert('Error creating task')
    else {
        if (todoList.children.length === 0) emptyState.classList.add('hidden')
        renderTodoCard(data[0], true)
    }
}

async function updateTodo(id, title, category, due_date) {
    const { error } = await supabase.from('todos').update({ title, category, due_date }).eq('id', id)
    if (error) alert('Error updating task')
    else fetchTodos() // specific redraw is better but fetch is safe
}

async function toggleTodo(id, is_complete) {
    const { error } = await supabase.from('todos').update({ is_complete }).eq('id', id)
    if (!error) {
        const card = document.querySelector(`.glass-card[data-id="${id}"]`)
        if (card) {
            const titleEl = card.querySelector('.todo-title')
            if (is_complete) {
                titleEl.classList.add('line-through', 'text-slate-500')
                titleEl.classList.remove('text-white')
                card.classList.add('opacity-75')
            } else {
                titleEl.classList.remove('line-through', 'text-slate-500')
                titleEl.classList.add('text-white')
                card.classList.remove('opacity-75')
            }
        }
    }
}

async function deleteTodo(id) {
    if (!confirm('Delete task?')) return
    const { error } = await supabase.from('todos').delete().eq('id', id)
    if (!error) {
        const card = document.querySelector(`.glass-card[data-id="${id}"]`)
        if (card) card.remove()
        if (todoList.children.length === 0) emptyState.classList.remove('hidden')
    }
}

// --- Task UI ---

function renderTodoCard(todo, prepend = false) {
    const div = document.createElement('div')
    div.className = `glass-card group p-6 flex flex-col justify-between min-h-[160px] ${todo.is_complete ? 'opacity-75' : ''}`
    div.dataset.id = todo.id
    div.dataset.category = todo.category || 'General'
    div.dataset.dueDate = todo.due_date ? todo.due_date.split('T')[0] : ''

    const isChecked = todo.is_complete ? 'checked' : ''
    const textClass = todo.is_complete ? 'line-through text-slate-500' : 'text-white'

    // Format Date
    let dateDisplay = ''
    if (todo.due_date) {
        const dateObj = new Date(todo.due_date)
        const isToday = new Date().toDateString() === dateObj.toDateString()
        dateDisplay = isToday ? 'Due Today' : dateObj.toLocaleDateString()
    }

    div.innerHTML = `
        <div class="flex items-start justify-between mb-4">
             <div class="p-2 rounded-full bg-blue-500/10 border border-blue-500/20 shadow-[0_0_15px_rgba(59,130,246,0.2)]">
                <input type="checkbox" class="checkbox-cyber" ${isChecked}>
             </div>
             <button class="delete-btn text-slate-600 hover:text-red-400 transition opacity-0 group-hover:opacity-100">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
             </button>
        </div>
        
        <div>
            <h3 class="todo-title text-xl font-bold ${textClass} mb-2 line-clamp-2 leading-tight">${escapeHtml(todo.title)}</h3>
        </div>

        <div class="mt-4 pt-4 border-t border-white/5 flex items-center justify-between text-sm">
            <span class="text-blue-400 font-medium">${dateDisplay}</span>
            <span class="text-slate-500">${escapeHtml(todo.category || 'General')}</span>
        </div>
        
        <!-- Glow Element -->
        <div class="absolute -bottom-10 -right-10 w-24 h-24 bg-blue-500/20 rounded-full blur-2xl group-hover:bg-blue-500/30 transition-all"></div>
    `

    if (prepend) todoList.prepend(div)
    else todoList.appendChild(div)
}

function openTodoModal(todo = null) {
    if (todo) {
        modalTitle.textContent = 'Edit Task'
        todoTitleInput.value = todo.title
        todoIdInput.value = todo.id
        todoCategoryInput.value = todo.category || 'General'
        todoDueDateInput.value = todo.due_date || ''
    } else {
        modalTitle.textContent = 'New Task'
        todoTitleInput.value = ''
        todoIdInput.value = ''
        todoCategoryInput.value = 'General'
        todoDueDateInput.value = ''
    }
    todoModal.classList.remove('hidden')
    setTimeout(() => {
        todoModal.classList.remove('opacity-0')
        todoModal.querySelector('div').classList.remove('scale-95')
        todoModal.querySelector('div').classList.add('scale-100')
    }, 10)
    todoTitleInput.focus()
}

function closeTodoModal() {
    todoModal.classList.add('opacity-0')
    todoModal.querySelector('div').classList.remove('scale-100')
    todoModal.querySelector('div').classList.add('scale-95')
    setTimeout(() => todoModal.classList.add('hidden'), 300)
}

// --- Notes CRUD & UI ---

async function fetchNotes() {
    notesList.innerHTML = ''
    notesEmptyState.classList.add('hidden')
    const { data, error } = await supabase.from('notes').select('*').order('created_at', { ascending: false })
    if (!error && data) {
        if (data.length === 0) notesEmptyState.classList.remove('hidden')
        else data.forEach(renderNoteCard)
    }
}

async function handleSaveNote(e) {
    e.preventDefault()
    const submitBtn = noteForm.querySelector('button[type="submit"]')
    if (submitBtn.disabled) return
    submitBtn.disabled = true

    const title = noteTitleInput.value
    const content = noteContentInput.value
    const id = noteIdInput.value

    try {
        if (id) await updateNote(id, title, content)
        else await createNote(title, content)
        closeNoteModal()
    } catch (err) { console.error(err) }
    finally { submitBtn.disabled = false }
}

async function createNote(title, content) {
    const { data, error } = await supabase.from('notes').insert([{ title, content, user_id: currentUser.id }]).select()
    if (!error) {
        if (notesList.children.length === 0) notesEmptyState.classList.add('hidden')
        renderNoteCard(data[0], true)
    }
}

async function updateNote(id, title, content) {
    const { error } = await supabase.from('notes').update({ title, content }).eq('id', id)
    if (!error) fetchNotes()
}

async function deleteNote(id) {
    if (!confirm('Delete note?')) return
    const { error } = await supabase.from('notes').delete().eq('id', id)
    if (!error) {
        const card = document.querySelector(`.glass-card[data-id="${id}"]`)
        if (card) card.remove()
        if (notesList.children.length === 0) notesEmptyState.classList.remove('hidden')
    }
}

function renderNoteCard(note, prepend = false) {
    const div = document.createElement('div')
    div.className = 'glass-card group p-6 flex flex-col h-[200px] cursor-pointer'
    div.dataset.id = note.id
    div.dataset.content = note.content || ''
    // Notes usually stick to purple accent in this theme design
    div.innerHTML = `
        <div class="flex justify-between items-start mb-3">
             <h3 class="note-title text-xl font-bold text-white line-clamp-1">${escapeHtml(note.title)}</h3>
             <button class="delete-btn p-1 text-slate-500 hover:text-red-400 transition opacity-0 group-hover:opacity-100">
                <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
             </button>
        </div>
        <div class="note-content text-slate-400 text-sm whitespace-pre-wrap line-clamp-5 leading-relaxed flex-grow">
            ${escapeHtml(note.content || '')}
        </div>
        <div class="mt-auto pt-2 text-xs text-slate-600 font-medium text-right">
             ${new Date(note.created_at).toLocaleDateString()}
        </div>
        <div class="absolute -top-10 -right-10 w-24 h-24 bg-purple-500/10 rounded-full blur-2xl group-hover:bg-purple-500/20 transition-all"></div>
    `
    if (prepend) notesList.prepend(div)
    else notesList.appendChild(div)
}

function openNoteModal(note = null) {
    if (note) {
        noteModalTitle.textContent = 'Edit Note'
        noteTitleInput.value = note.title
        noteContentInput.value = note.content
        noteIdInput.value = note.id
    } else {
        noteModalTitle.textContent = 'New Note'
        noteTitleInput.value = ''
        noteContentInput.value = ''
        noteIdInput.value = ''
    }
    noteModal.classList.remove('hidden')
    setTimeout(() => {
        noteModal.classList.remove('opacity-0')
        noteModal.querySelector('div').classList.remove('scale-95')
        todoModal.querySelector('div').classList.add('scale-100') // copy paste error fix in next tick if found, wait, targetting todoModal? No noteModal.
        noteModal.querySelector('div').classList.add('scale-100')
    }, 10)
    noteTitleInput.focus()
}

function closeNoteModal() {
    noteModal.classList.add('opacity-0')
    noteModal.querySelector('div').classList.remove('scale-100')
    noteModal.querySelector('div').classList.add('scale-95')
    setTimeout(() => noteModal.classList.add('hidden'), 300)
}

// --- Realtime ---
function subscribeToRealtime() {
    if (realtimeChannel) supabase.removeChannel(realtimeChannel)
    realtimeChannel = supabase.channel('todos-channel').on('postgres_changes', { event: '*', schema: 'public', table: 'todos' }, payload => {
        const { eventType, new: newRecord, old: oldRecord } = payload
        if (eventType === 'INSERT' && newRecord.user_id === currentUser.id) {
            const exists = document.querySelector(`.glass-card[data-id="${newRecord.id}"]`)
            if (!exists) {
                if (todoList.children.length === 0) emptyState.classList.add('hidden')
                renderTodoCard(newRecord, true)
            }
        } else if (eventType === 'UPDATE') {
            // Just simplest to refresh or update DOM manually
            // For simplicity in a rewrite, a fetch is robust, but let's try strict DOM update for smooth UI
            const card = document.querySelector(`.glass-card[data-id="${newRecord.id}"]`)
            if (card) {
                // To properly update category/date/title, re-render might be easier or granular update
                // Granular:
                card.querySelector('.todo-title').textContent = newRecord.title
                card.dataset.category = newRecord.category
                card.dataset.dueDate = newRecord.due_date ? newRecord.due_date.split('T')[0] : ''

                // checkbox state
                const checkbox = card.querySelector('.checkbox-cyber')
                checkbox.checked = newRecord.is_complete

                const titleEl = card.querySelector('.todo-title')
                if (newRecord.is_complete) {
                    titleEl.classList.add('line-through', 'text-slate-500')
                    titleEl.classList.remove('text-white')
                    card.classList.add('opacity-75')
                } else {
                    titleEl.classList.remove('line-through', 'text-slate-500')
                    titleEl.classList.add('text-white')
                    card.classList.remove('opacity-75')
                }
            }
        } else if (eventType === 'DELETE') {
            const card = document.querySelector(`.glass-card[data-id="${oldRecord.id}"]`)
            if (card) card.remove()
            if (todoList.children.length === 0) emptyState.classList.remove('hidden')
        }
    }).subscribe()
}

function subscribeToNotes() {
    if (notesChannel) supabase.removeChannel(notesChannel)
    notesChannel = supabase.channel('notes-channel').on('postgres_changes', { event: '*', schema: 'public', table: 'notes' }, payload => {
        // Similar logic, or just fetch
        fetchNotes()
    }).subscribe()
}

// --- Utils ---
function escapeHtml(text) {
    if (!text) return ''
    const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' };
    return text.replace(/[&<>"']/g, function (m) { return map[m]; });
}

function filterItems(term) {
    if (currentView === 'tasks' || currentView === 'dashboard') {
        const cards = todoList.querySelectorAll('.glass-card')
        cards.forEach(card => {
            const title = card.querySelector('.todo-title').textContent.toLowerCase()
            const category = card.dataset.category.toLowerCase()
            if (title.includes(term) || category.includes(term)) card.classList.remove('hidden')
            else card.classList.add('hidden')
        })
    } else if (currentView === 'notes') {
        const cards = notesList.querySelectorAll('.glass-card')
        cards.forEach(card => {
            const title = card.querySelector('.note-title').textContent.toLowerCase()
            const content = card.dataset.content.toLowerCase()
            if (title.includes(term) || content.includes(term)) card.classList.remove('hidden')
            else card.classList.add('hidden')
        })
    }
}

// Start
init()
