/**
 * Daily Task & Progress Tracker
 * Fully Client-Side JS with LocalStorage Data Persistence
 */

// --- CONFIGURATION: Point Values ---
// Easily update these constants to change scoring logic across the app
const POINTS_PER_COMPLETED_TASK = 1;
const POINTS_PER_UNCOMPLETED_TASK = 0;

// Achievement Configuration Definition
const ACHIEVEMENTS_DEF = [
    { id: 'first_step', title: '🏆 First Step', desc: 'Complete your first task', condition: (data) => data.totalCompleted >= 1 },
    { id: 'streak_3', title: '🔥 3-Day Streak', desc: 'Maintain activity for 3 consecutive days', condition: (data) => data.currentStreak >= 3 },
    { id: 'streak_7', title: '🔥 7-Day Streak', desc: 'Maintain activity for 7 consecutive days', condition: (data) => data.currentStreak >= 7 },
    { id: 'perfect_day', title: '💯 Perfect Day', desc: 'Complete 100% of tasks in a single day', condition: (data) => data.hasPerfectDay },
    { id: 'active_7', title: '📈 7 Days Active', desc: 'Use the tracker across 7 different days', condition: (data) => data.activeDays >= 7 },
    { id: 'active_30', title: '🏆 30 Days Active', desc: 'Use the tracker across 30 different days', condition: (data) => data.activeDays >= 30 }
];

// --- APP STATE ---
let state = {
    tasks: [],             // Global list of task objects: [{ id, name }]
    history: {},           // Daily logs: { 'YYYY-MM-DD': { taskId: 'done' | 'not-done' } }
    unlockedAchievements: []
};

let selectedDate = getTodayKey();
let calendarViewDate = new Date();
let chartInstance = null;

// --- INITIALIZATION ---
document.addEventListener('DOMContentLoaded', () => {
    loadDataFromStorage();
    initEventListeners();
    renderAll();
});

// Helper: Format Date object to YYYY-MM-DD
function formatDateKey(dateObj) {
    const year = dateObj.getFullYear();
    const month = String(dateObj.getMonth() + 1).padStart(2, '0');
    const day = String(dateObj.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function getTodayKey() {
    return formatDateKey(new Date());
}

// --- DATA PERSISTENCE (LocalStorage) ---
function saveDataToStorage() {
    localStorage.setItem('tracker_tasks', JSON.stringify(state.tasks));
    localStorage.setItem('tracker_history', JSON.stringify(state.history));
    localStorage.setItem('tracker_achievements', JSON.stringify(state.unlockedAchievements));
}

function loadDataFromStorage() {
    const savedTasks = localStorage.getItem('tracker_tasks');
    const savedHistory = localStorage.getItem('tracker_history');
    const savedAchievements = localStorage.getItem('tracker_achievements');

    if (savedTasks) state.tasks = JSON.parse(savedTasks);
    if (savedHistory) state.history = JSON.parse(savedHistory);
    if (savedAchievements) state.unlockedAchievements = JSON.parse(savedAchievements);
}

// --- CORE RENDER FUNCTION ---
function renderAll() {
    renderDashboardAndStreaks();
    renderTasks();
    renderChart();
    renderCalendar();
    renderAchievements();
}

// --- TASK MANAGERS & STATUS HANDLERS ---
function setTaskStatus(taskId, status) {
    const todayStr = getTodayKey();
    if (selectedDate > todayStr) return; // Protect future dates

    if (!state.history[selectedDate]) {
        state.history[selectedDate] = {};
    }

    // Toggle logic: tapping selected item again deselects it
    if (state.history[selectedDate][taskId] === status) {
        delete state.history[selectedDate][taskId];
    } else {
        state.history[selectedDate][taskId] = status;
    }

    saveDataToStorage();
    renderAll();
}

function renderTasks() {
    const taskListEl = document.getElementById('task-list');
    const emptyStateEl = document.getElementById('empty-state');
    const dateLabel = document.getElementById('selected-date-display');
    const historyBanner = document.getElementById('history-banner');
    const historyDateLabel = document.getElementById('history-date-label');

    const todayStr = getTodayKey();
    const isToday = selectedDate === todayStr;

    // Show or hide History View Indicator Banner
    if (isToday) {
        historyBanner.classList.add('hidden');
        dateLabel.textContent = `Today (${selectedDate})`;
    } else {
        historyBanner.classList.remove('hidden');
        historyDateLabel.textContent = selectedDate;
        dateLabel.textContent = `Historical View`;
    }

    taskListEl.innerHTML = '';

    if (state.tasks.length === 0) {
        emptyStateEl.classList.remove('hidden');
        return;
    } else {
        emptyStateEl.classList.add('hidden');
    }

    const dayRecord = state.history[selectedDate] || {};

    state.tasks.forEach(task => {
        const currentStatus = dayRecord[task.id]; // 'done', 'not-done', or undefined

        const taskEl = document.createElement('div');
        taskEl.className = `task-item ${currentStatus === 'done' ? 'status-done' : ''} ${currentStatus === 'not-done' ? 'status-not-done' : ''}`;

        taskEl.innerHTML = `
            <span class="task-name">${escapeHTML(task.name)}</span>
            <div class="task-actions">
                <button class="status-btn ${currentStatus === 'done' ? 'active-done' : ''}" 
                        onclick="setTaskStatus('${task.id}', 'done')">✅ Done</button>
                <button class="status-btn ${currentStatus === 'not-done' ? 'active-not-done' : ''}" 
                        onclick="setTaskStatus('${task.id}', 'not-done')">❌ Not Done</button>
            </div>
        `;
        taskListEl.appendChild(taskEl);
    });
}

// --- DASHBOARD & STREAK CALCULATIONS ---
function renderDashboardAndStreaks() {
    const todayStr = getTodayKey();
    const dayRecord = state.history[todayStr] || {};
    
    let todayCompleted = 0;
    const totalTasks = state.tasks.length;

    state.tasks.forEach(task => {
        if (dayRecord[task.id] === 'done') todayCompleted++;
    });

    const todayPercentage = totalTasks > 0 ? Math.round((todayCompleted / totalTasks) * 100) : 0;
    const todayPoints = todayCompleted * POINTS_PER_COMPLETED_TASK;
    const maxPoints = totalTasks * POINTS_PER_COMPLETED_TASK;

    // Dashboard values
    document.getElementById('dash-progress').textContent = `${todayPercentage}%`;
    document.getElementById('dash-points').textContent = `${todayPoints} / ${maxPoints}`;

    // Global Statistics Calculation
    let totalPointsAllTime = 0;
    let totalCompletedTasksAllTime = 0;
    let hasPerfectDay = false;
    const activeDates = Object.keys(state.history).filter(d => d <= todayStr);

    activeDates.forEach(dateKey => {
        const rec = state.history[dateKey];
        let dayDone = 0;
        Object.keys(rec).forEach(tId => {
            if (rec[tId] === 'done') {
                dayDone++;
                totalCompletedTasksAllTime++;
            }
        });
        totalPointsAllTime += (dayDone * POINTS_PER_COMPLETED_TASK);
        
        if (totalTasks > 0 && dayDone === totalTasks) {
            hasPerfectDay = true;
        }
    });

    document.getElementById('dash-total-points').textContent = totalPointsAllTime;

    // Streak Calculation
    const currentStreak = calculateStreak();
    document.getElementById('dash-streak').textContent = `${currentStreak} 🔥`;

    // Process & Evaluate Achievements
    evaluateAchievements({
        totalCompleted: totalCompletedTasksAllTime,
        currentStreak: currentStreak,
        hasPerfectDay: hasPerfectDay,
        activeDays: activeDates.length
    });
}

function calculateStreak() {
    let streak = 0;
    let checkDate = new Date();

    while (true) {
        const key = formatDateKey(checkDate);
        const record = state.history[key];
        
        if (!record) {
            // Allow active streak continuation if today isn't recorded yet but yesterday was done
            if (key === getTodayKey()) {
                checkDate.setDate(checkDate.getDate() - 1);
                continue;
            }
            break;
        }

        let hasDoneTask = false;
        Object.keys(record).forEach(taskId => {
            if (record[taskId] === 'done') hasDoneTask = true;
        });

        if (hasDoneTask) {
            streak++;
            checkDate.setDate(checkDate.getDate() - 1);
        } else {
            if (key === getTodayKey()) {
                checkDate.setDate(checkDate.getDate() - 1);
                continue;
            }
            break;
        }
    }
    return streak;
}

// --- PROGRESS CHART ---
function renderChart() {
    const ctx = document.getElementById('progressChart').getContext('2d');
    
    // Generate array of last 7 calendar days
    const labels = [];
    const percentages = [];

    for (let i = 6; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const key = formatDateKey(d);
        
        labels.push(`${d.getMonth() + 1}/${d.getDate()}`);

        const dayRecord = state.history[key] || {};
        const total = state.tasks.length;
        let done = 0;

        if (total > 0) {
            state.tasks.forEach(task => {
                if (dayRecord[task.id] === 'done') done++;
            });
            percentages.push(Math.round((done / total) * 100));
        } else {
            percentages.push(0);
        }
    }

    if (chartInstance) {
        chartInstance.destroy();
    }

    chartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'Completion Rate %',
                data: percentages,
                borderColor: '#00ff66',
                backgroundColor: 'rgba(0, 255, 102, 0.08)',
                borderWidth: 2,
                fill: true,
                tension: 0.3,
                pointBackgroundColor: '#00ff66'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
                y: { min: 0, max: 100, ticks: { color: '#666' }, grid: { color: '#222' } },
                x: { ticks: { color: '#666' }, grid: { display: false } }
            }
        }
    });
}

// --- CALENDAR RENDERER ---
function renderCalendar() {
    const calendarDaysEl = document.getElementById('calendar-days');
    const monthYearEl = document.getElementById('calendar-month-year');
    
    calendarDaysEl.innerHTML = '';

    const year = calendarViewDate.getFullYear();
    const month = calendarViewDate.getMonth();

    const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
    monthYearEl.textContent = `${monthNames[month]} ${year}`;

    const firstDayIndex = new Date(year, month, 1).getDay();
    const totalDaysInMonth = new Date(year, month + 1, 0).getDate();
    const todayStr = getTodayKey();

    // Render empty layout spacer blocks
    for (let i = 0; i < firstDayIndex; i++) {
        const emptyDiv = document.createElement('div');
        emptyDiv.className = 'calendar-day empty';
        calendarDaysEl.appendChild(emptyDiv);
    }

    // Render interactive date cells
    for (let day = 1; day <= totalDaysInMonth; day++) {
        const dateObj = new Date(year, month, day);
        const dateKey = formatDateKey(dateObj);

        const dayEl = document.createElement('div');
        dayEl.className = 'calendar-day';
        dayEl.textContent = day;

        if (dateKey === todayStr) {
            dayEl.classList.add('today');
        }

        if (dateKey > todayStr) {
            dayEl.classList.add('locked');
        } else {
            // Apply performance color border indicators for present/past days
            const dayRecord = state.history[dateKey];
            if (dayRecord && state.tasks.length > 0) {
                let done = 0;
                state.tasks.forEach(t => { if (dayRecord[t.id] === 'done') done++; });
                const pct = Math.round((done / state.tasks.length) * 100);

                if (pct >= 80) dayEl.classList.add('perf-excellent');
                else if (pct > 0) dayEl.classList.add('perf-partial');
                else dayEl.classList.add('perf-poor');
            }

            dayEl.addEventListener('click', () => {
                selectedDate = dateKey;
                renderTasks();
            });
        }

        calendarDaysEl.appendChild(dayEl);
    }
}

// --- ACHIEVEMENTS SYSTEM ---
function evaluateAchievements(stats) {
    ACHIEVEMENTS_DEF.forEach(ach => {
        if (!state.unlockedAchievements.includes(ach.id)) {
            if (ach.condition(stats)) {
                state.unlockedAchievements.push(ach.id);
            }
        }
    });
    saveDataToStorage();
}

function renderAchievements() {
    const grid = document.getElementById('achievements-list');
    grid.innerHTML = '';

    ACHIEVEMENTS_DEF.forEach(ach => {
        const isUnlocked = state.unlockedAchievements.includes(ach.id);
        const card = document.createElement('div');
        card.className = `achievement-card ${isUnlocked ? 'unlocked' : ''}`;
        card.innerHTML = `
            <div class="achievement-title">${isUnlocked ? ach.title : '🔒 Locked'}</div>
            <div class="achievement-desc">${ach.desc}</div>
            <div class="achievement-status">${isUnlocked ? 'UNLOCKED' : 'LOCKED'}</div>
        `;
        grid.appendChild(card);
    });
}

// --- MODAL CONTROLS & LISTENERS ---
function initEventListeners() {
    // Add Task Modal
    const taskModal = document.getElementById('task-modal');
    const taskInput = document.getElementById('task-name-input');
    
    document.getElementById('open-add-modal-btn').addEventListener('click', () => {
        taskInput.value = '';
        taskModal.classList.remove('hidden');
        taskInput.focus();
    });

    document.getElementById('close-modal-btn').addEventListener('click', () => {
        taskModal.classList.add('hidden');
    });

    document.getElementById('save-task-btn').addEventListener('click', () => {
        const name = taskInput.value.trim();
        if (name) {
            state.tasks.push({ id: 'task_' + Date.now(), name: name });
            saveDataToStorage();
            taskModal.classList.add('hidden');
            renderAll();
        }
    });

    // Return to Today Handler
    document.getElementById('return-today-btn').addEventListener('click', () => {
        selectedDate = getTodayKey();
        renderTasks();
    });

    // Calendar Navigation
    document.getElementById('prev-month-btn').addEventListener('click', () => {
        calendarViewDate.setMonth(calendarViewDate.getMonth() - 1);
        renderCalendar();
    });

    document.getElementById('next-month-btn').addEventListener('click', () => {
        calendarViewDate.setMonth(calendarViewDate.getMonth() + 1);
        renderCalendar();
    });

    // Manage Tasks Drawer
    const manageModal = document.getElementById('manage-modal');
    document.getElementById('open-manage-modal-btn').addEventListener('click', () => {
        renderManageList();
        manageModal.classList.remove('hidden');
    });

    document.getElementById('close-manage-modal-btn').addEventListener('click', () => {
        manageModal.classList.add('hidden');
    });
}

function renderManageList() {
    const container = document.getElementById('manage-task-list');
    container.innerHTML = '';

    if (state.tasks.length === 0) {
        container.innerHTML = '<p class="subtext">No tasks created yet.</p>';
        return;
    }

    state.tasks.forEach(task => {
        const item = document.createElement('div');
        item.className = 'manage-task-item';
        item.innerHTML = `
            <span>${escapeHTML(task.name)}</span>
            <button class="btn btn-small" style="background: var(--accent-red); color:#fff;" onclick="deleteTask('${task.id}')">Delete</button>
        `;
        container.appendChild(item);
    });
}

function deleteTask(taskId) {
    state.tasks = state.tasks.filter(t => t.id !== taskId);
    saveDataToStorage();
    renderManageList();
    renderAll();
}

// Safety utility for text rendering
function escapeHTML(str) {
    return str.replace(/[&<>'"]/g, 
        tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag] || tag)
    );
      }
