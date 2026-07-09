// --- SISTEMA DE NOTIFICACIONES TOAST ---
function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) return;
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    let icon = 'ℹ️';
    if(type === 'success') icon = '✅';
    if(type === 'error') icon = '❌';
    if(type === 'warning') icon = '⚠️';
    toast.innerHTML = `<span>${icon}</span> <span>${message}</span>`;
    
    container.appendChild(toast);
    setTimeout(() => {
        toast.classList.add('toast-fadeout');
        setTimeout(() => toast.remove(), 400); 
    }, 4000);
}

// Variables Globales
let undoStack = [];
const MAX_UNDO = 50;
let isFullscreen = false;
function getStateKey() { return 'kronoAppState_v2_' + (selectedStore || 'UNKNOWN'); }
// Clave de administrador única por tienda: 123<TIENDA>456ADMIN (ej: 123AKB30456ADMIN)
function getAdminKey() { return '123' + (selectedStore || '').toUpperCase() + '456ADMIN'; }
let selectedStore = null;
let currentRole = null; // 'admin' | 'marcaciones'
let appState = {
    processedData: [], dateHeaders: [], weeks:[], fixedHeaders:[], minStaff: 1,
    holidays: new Set(), weeksToHighlight: new Set(), noveltyWeeks: new Set(),
    aisleDifficulties: {},
    swappedSeats: new Set(),
    lockedAisles: new Set(),
    lockedPersons: new Set(),
    workerMasterData: [],
    aisleChangeDate: null,
    pendingSwaps: [],
    rotationEffectiveDate: null,
    subgroups: [],
    leftoverAisles: [],
    dailyTasks: {},          // key: `${workerExcelId}_${date}` → task object
    taskNotes:  {},          // key: `${workerExcelId}_${date}` → string observación
    taskCustomNames: {},     // key: `${workerExcelId}_${date}` → custom name for isEditable tasks
    dailyTasks2: {}          // key: `${workerExcelId}_${date}` → second task object (opcional)
};

// 5 tareas predeterminadas
const PREDEFINED_TASKS = [
    { id: 1, name: 'Recuperación de huevos', shortName: 'Huevos',        icon: '🥚', color: '#2e7d32', fg: '#ffffff' },
    { id: 2, name: 'Remarque',               shortName: 'Remarque',      icon: '🏷️', color: '#212121', fg: '#ffffff' },
    { id: 3, name: 'Aseo',                   shortName: 'Aseo',          icon: '🧹', color: '#f9a825', fg: '#000000' },
    { id: 4, name: 'Inventario',             shortName: 'Inventario',    icon: '📋', color: '#1565c0', fg: '#ffffff' },
    { id: 5, name: 'Cajas',                  shortName: 'Cajas',         icon: '🚀', color: '#7b1fa2', fg: '#ffffff' },
    { id: 6, name: 'Reporte Fechas',         shortName: 'Rpt. Fechas',   icon: '📅', color: '#c62828', fg: '#ffffff' },
    { id: 7, name: 'Cursos',                 shortName: 'Cursos',        icon: '📚', color: '#f57c00', fg: '#ffffff' },
    { id: 8, name: 'Exámenes Médicos',       shortName: 'Exám. Méd.',    icon: '🏥', color: '#7c3aed', fg: '#ffffff' },
    { id: 9, name: 'Personalizada',          shortName: 'Personalizada', icon: '✏️', color: '#00bcd4', fg: '#ffffff', isEditable: true },
];
let _taskSyncTimer = null;
let compactShiftView = false;
let specialShiftFilter = null;
let selectedMonthsFilter = new Set();
let _tasksReportTaskFilter  = null; // taskId o null — filtra el informe por tarea
let _tasksReportMonthFilter = null; // 'YYYY-MM' o null — filtra el informe por mes

// Estado del Picker Manual de Rotación
let _mpSeatIdA = null;
let _mpTempUnlocked = new Set();
let _mpSelectedB = null;
const MONTH_NAMES_ES = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
const dayAbbreviations =['do', 'lu', 'ma', 'mi', 'ju', 'vi', 'sá'];
const allShifts = {}; 
let dynamicStyles = ''; 
let shiftOptionsHTML = '';
const NUM_FIXED_COLUMNS = 3;

// Mapas base
const masterShiftList = [
    // Aperturas (A)
    '7A5.3-12.3', '6.5A5.3-12',  '8A5.3-13.3',
    '7A6-13',     '6.5A6-12.3',  '8A6-14',
    '7A6.3-13.3', '6.5A6.3-13',  '8A6.3-14.3',
    '7A7-14',     '6.5A7-13.3',  '8A7-15',
    '7A7.3-14.3', '6.5A7.3-14',
    '6.5A8-14.3',
    // Intermedios (i)
    '6.5i7-14.3',  '7i7-15',       '8i7-16',
    '8i7.3-16.3',
    '7i8-16',      '6.5i8-15.3',   '8i8-17',
    '7i8.3-16.3',  '6.5i8.3-16',   '8i8.3-17.3',
    '7i9-17',      '6.5i9-16.3',   '8i9-18',
    '7i9.3-17.3',  '6.5i9.3-17',   '8i9.3-18.3',
    '7i10-18',     '6.5i10-17.3',  '8i10-19',
    '7i10.3-18.3', '6.5i10.3-18',  '8i10.3-19.3',
    '7i11-19',     '6.5i11-18.3',  '8i11-20',
    '7i11.3-19.3', '6.5i11.3-19',  '8i11.3-20.3',
    '7i12-20',     '6.5i12-19.3',  '8i12-21',
    '7i12.3-20.3', '6.5i12.3-20',  '8i12.3-21.3',
    '6.5i13-20.3',
    // Cierres (C)
    '7C13-20',     '6.5C13-19.3',  '8C13-21',
    '7C13.3-20.3', '6.5C13.3-20',  '8C13.3-21.3',
    '7C14-21',     '6.5C14-20.3',  '8C14-22',
    '7C14.3-21.3', '6.5C14.3-21',
    '8C14.3-22.3', '7C15-22',  '6.5C15-21.3',
    // Noches (N)
    '6.5N22-5.3', '7N22-6', '8N22-7', '8N21.3-6.3', '7I10-6',
    // Especiales
    'COMP', 'LBRE', 'VC', 'LIC', 'INC', 'DF', 'CAP', '0SP'
].filter((v, i, a) => a.indexOf(v) === i);
const csvInputMap = { '1.1': '6.5A6-12.3', '2.2': '6.5C15-21.3', '3.3': 'LBRE', '4.4': '6.5N22-5.3', '5.5': 'COMP', '0': '0SP' };
const shift7hTo8hMap = {};
const shift8hTo7hMap = {};

// Equivalencias del turno base de 6.5h (código 1.1/2.2/4.4) según el día de la semana.
// La lógica semanal (lunes a domingo) decide si cada día se queda en 6.5h, sube a 8h o pasa a 7h.
const shift65To7Map = {
    '6.5A6-12.3':  '7A6-13',
    '6.5C15-21.3': '7C14.3-21.3',
    '6.5N22-5.3':  '7N22-6'
};
const shift65To8Map = {
    '6.5A6-12.3':  '8A6-14',
    '6.5C15-21.3': '8C13.3-21.3',
    '6.5N22-5.3':  '8N21.3-6.3'
};

function applyVerMiMallaMode() {
    // Ocultar todo el sidebar excepto info de tienda y logout
    const hideIds = [
        'plantManagerBtn', 'plantHealthBtn', 'coverageBtn', 'distributionBtn', 'staffDistributionBtn',
        'krebsReportBtn', 'tasksReportBtn', 'correctionBtn', 'seasonBtn', 'massChangeBtn', 'equidadBtn', 'horasPromedioBtn',
        'sheetsSyncBtn', 'sheetsConfigBtn', 'restoreSessionBtn', 'downloadBtn', 'loadFromProgBtn'
    ];
    hideIds.forEach(id => { const el = document.getElementById(id); if (el) el.style.display = 'none'; });

    document.querySelectorAll('.sidebar-group').forEach(group => {
        const header = group.querySelector('.sidebar-group-header');
        if (!header) return;
        group.style.display = 'none';
    });

    // Ocultar panel de configuración inicial y barra de meses
    const initPanel = document.getElementById('initialConfigPanel');
    if (initPanel) initPanel.style.display = 'none';
    const progBar = document.getElementById('progInfoBar');
    if (progBar) progBar.style.display = 'none';
    const monthBar = document.getElementById('monthFilterBar');
    if (monthBar) monthBar.style.display = 'none';

    // Ocultar filtros avanzados, dejar solo búsqueda por nombre
    const filterControls = document.getElementById('filterControls');
    if (filterControls) {
        filterControls.querySelectorAll('.filter-group').forEach((fg, i) => {
            if (i !== 2) fg.style.display = 'none'; // solo búsqueda por nombre (índice 2)
        });
        const clearBtn = document.getElementById('clearFiltersBtn');
        if (clearBtn) clearBtn.style.display = 'none';
    }

    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) logoutBtn.textContent = '⏻ Salir';

    const dashHeader = document.querySelector('.dashboard-header h1');
    if (dashHeader) dashHeader.textContent = 'Mi Programación';

    const saveInd = document.getElementById('saveIndicator');
    if (saveInd) saveInd.style.display = 'none';

    const syncBar = document.querySelector('.sidebar-sync-bar');
    if (syncBar) syncBar.style.display = 'none';
}

function applyMarcacionesMode() {
    // Ocultar herramientas de edición del sidebar
    const hideIds = [
        'plantManagerBtn', 'plantHealthBtn', 'coverageBtn', 'distributionBtn', 'staffDistributionBtn',
        'krebsReportBtn', 'tasksReportBtn', 'correctionBtn', 'seasonBtn', 'massChangeBtn', 'equidadBtn', 'horasPromedioBtn',
        'sheetsSyncBtn', 'sheetsConfigBtn', 'restoreSessionBtn'
    ];
    hideIds.forEach(id => { const el = document.getElementById(id); if (el) el.style.display = 'none'; });

    // Ocultar grupos de sidebar que no aplican (MI PLANTA, PANEL Y ANÁLISIS)
    document.querySelectorAll('.sidebar-group').forEach(group => {
        const header = group.querySelector('.sidebar-group-header');
        if (!header) return;
        const txt = header.textContent.trim();
        if (txt === 'MI PLANTA' || txt === 'PANEL Y ANÁLISIS') group.style.display = 'none';
    });

    // Ocultar panel de configuración inicial (no aplica en lectura)
    const initPanel = document.getElementById('initialConfigPanel');
    if (initPanel) initPanel.style.display = 'none';
    const progBar = document.getElementById('progInfoBar');
    if (progBar) progBar.style.display = 'none';

    // Cambiar título del botón de logout
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) logoutBtn.textContent = '⏻ Cerrar Sesión';

    // Indicar modo solo lectura en el header
    const dashHeader = document.querySelector('.dashboard-header h1');
    if (dashHeader) dashHeader.textContent = 'Visualización de Horarios — Solo Lectura';

    // Ocultar indicador de guardado
    const saveInd = document.getElementById('saveIndicator');
    if (saveInd) saveInd.style.display = 'none';
}

function initShifts() {
    masterShiftList.forEach(name => {
        if (allShifts[name]) return;
        const match = name.match(/^(\d+(?:\.\d+)?)/);
        const hours = match ? parseFloat(match[1]) : 0;
        const className = `turno-${name.replace(/[^a-zA-Z0-9]/g, '-')}`;
        const isCoverageShift = hours > 0 || name === '0SP';
        allShifts[name] = { name, hours, className, isCoverageShift };

        // Chip: color va en .shift-select y .shift-ro-text (fondo + borde de categoría)
        if (name === 'COMP')       dynamicStyles += `.${className} .shift-select,.${className} .shift-ro-text { background:#f0f0f0 !important; border-color:#9e9e9e !important; color:#1a0067 !important; font-weight:700; }\n`;
        else if (name === 'LBRE')  dynamicStyles += `.${className} .shift-select,.${className} .shift-ro-text { background:#fff5f0 !important; border-color:#fd4a03 !important; color:#c62800 !important; font-weight:700; }\n`;
        else if (name === '0SP')   dynamicStyles += `.${className} .shift-select,.${className} .shift-ro-text { background:#fafafa !important; border-color:#ddd !important; color:#bbb !important; }\n`;
        else if (name === 'VC')    dynamicStyles += `.${className} .shift-select,.${className} .shift-ro-text { background:#fce4ec !important; border-color:#e91e8c !important; color:#880e4f !important; font-weight:700; }\n`;
        else if (name === 'LIC' || name === 'INC' || name === 'CAP' || name === 'DF') dynamicStyles += `.${className} .shift-select,.${className} .shift-ro-text { background:#f9fbe7 !important; border-color:#8bc34a !important; color:#33691e !important; font-weight:700; }\n`;
        else if (/^\d+(?:\.\d+)?A/.test(name))    dynamicStyles += `.${className} .shift-select,.${className} .shift-ro-text { background:#ffe0b2 !important; border-color:#f57c00 !important; color:#5d2e00 !important; font-weight:700; }\n`; // Apertura — naranja
        else if (/^\d+(?:\.\d+)?i/.test(name))    dynamicStyles += `.${className} .shift-select,.${className} .shift-ro-text { background:#bbdefb !important; border-color:#1565c0 !important; color:#0d3666 !important; font-weight:700; }\n`; // Intermedio — azul
        else if (/^\d+(?:\.\d+)?C/.test(name))    dynamicStyles += `.${className} .shift-select,.${className} .shift-ro-text { background:#c8e6c9 !important; border-color:#388e3c !important; color:#1b5e20 !important; font-weight:700; }\n`; // Cierre — verde
        else if (/^\d+(?:\.\d+)?[NI]/.test(name)) dynamicStyles += `.${className} .shift-select,.${className} .shift-ro-text { background:#d1c4e9 !important; border-color:#6a1b9a !important; color:#311b92 !important; font-weight:700; }\n`; // Noche — morado
        else if (hours > 0) dynamicStyles += `.${className} .shift-select,.${className} .shift-ro-text { background:#eeeeee !important; border-color:#bbb !important; color:#555 !important; }\n`;
        else dynamicStyles += `.${className} .shift-select,.${className} .shift-ro-text { background:#fafafa !important; border-color:#e0e0e0 !important; color:#aaa !important; }\n`;
    });
    const styleEl = document.getElementById('dynamic-styles');
    if (styleEl) styleEl.textContent = dynamicStyles;
    shiftOptionsHTML = _buildShiftOptionsHTML();
}

function _buildShiftOptionsHTML() {
    const groups = [
        { label: '── Aperturas (A) ──', re: /^\d+(?:\.\d+)?A/ },
        { label: '── Intermedios (I) ──', re: /^\d+(?:\.\d+)?i/ },
        { label: '── Cierres (C) ──', re: /^\d+(?:\.\d+)?C/ },
        { label: '── Noches (N) ──', re: /^\d+(?:\.\d+)?[NI]/ },
    ];
    const specialNames = new Set(['COMP','LBRE','VC','LIC','INC','DF','CAP','0SP']);
    const shifts = Object.values(allShifts);
    const seen = new Set();
    let html = '';
    groups.forEach(g => {
        const items = shifts.filter(s => !seen.has(s.name) && g.re.test(s.name));
        if (!items.length) return;
        html += `<optgroup label="${g.label}">`;
        items.forEach(s => { html += `<option value="${s.name}">${s.name}</option>`; seen.add(s.name); });
        html += '</optgroup>';
    });
    const rest = shifts.filter(s => !seen.has(s.name));
    if (rest.length) {
        html += '<optgroup label="── Especiales ──">';
        rest.forEach(s => { html += `<option value="${s.name}">${s.name}</option>`; seen.add(s.name); });
        html += '</optgroup>';
    }
    return html;
}

function getColombianHolidays(year) {
    const holidays = new Set(); const formatDate = (date) => date.toISOString().split('T')[0]; const moveToNextMonday = (date) => { const day = date.getDay(); if (day === 1) return date; const offset = day === 0 ? 1 : 8 - day; date.setDate(date.getDate() + offset); return date; };
    const getEaster = (y) => { const a = y % 19, b = Math.floor(y / 100), c = y % 100, d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30, i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451), month = Math.floor((h + l - 7 * m + 114) / 31), day = ((h + l - 7 * m + 114) % 31) + 1; return new Date(y, month - 1, day); };
    const easter = getEaster(year); const addHoliday = (date) => holidays.add(formatDate(date));
    addHoliday(new Date(year, 0, 1)); addHoliday(new Date(year, 4, 1)); addHoliday(new Date(year, 6, 13)); addHoliday(new Date(year, 6, 20)); addHoliday(new Date(year, 7, 7)); addHoliday(new Date(year, 11, 8)); addHoliday(new Date(year, 11, 25));
    addHoliday(moveToNextMonday(new Date(year, 0, 6))); addHoliday(moveToNextMonday(new Date(year, 2, 19))); addHoliday(moveToNextMonday(new Date(year, 5, 29))); addHoliday(moveToNextMonday(new Date(year, 7, 15))); addHoliday(moveToNextMonday(new Date(year, 9, 12))); addHoliday(moveToNextMonday(new Date(year, 10, 1))); addHoliday(moveToNextMonday(new Date(year, 10, 11)));
    const addDays = (date, days) => new Date(date.getTime() + days * 86400000);
    addHoliday(addDays(easter, -3)); addHoliday(addDays(easter, -2)); addHoliday(moveToNextMonday(addDays(easter, 43))); addHoliday(moveToNextMonday(addDays(easter, 64))); addHoliday(moveToNextMonday(addDays(easter, 71)));
    return holidays;
}

function readFileAsText(file) { return new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.onerror = () => reject(reader.error); reader.readAsText(file, 'UTF-8'); }); }
function readFileAsArrayBuffer(file) { return new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.onerror = () => reject(reader.error); reader.readAsArrayBuffer(file); }); }
function formatExcelDate(val) { if (!val) return ''; const d = new Date(val); if (isNaN(d.getTime())) return ''; return d.toISOString().split('T')[0]; }

function saveAppState() {
    if (currentRole === 'marcaciones' || currentRole === 'vermimalla') return; // lectura: no persistir nada
    try {
        const stateToSave = {
            ...appState,
            holidays: Array.from(appState.holidays),
            weeksToHighlight: Array.from(appState.weeksToHighlight),
            noveltyWeeks: Array.from(appState.noveltyWeeks || []),
            swappedSeats: Array.from(appState.swappedSeats),
            lockedAisles: Array.from(appState.lockedAisles),
            lockedPersons: Array.from(appState.lockedPersons)
        };
        const inputsToSave = { startDate: document.getElementById('startDate').value, numDays: document.getElementById('numDays').value, minStaff: document.getElementById('minStaff').value };
        localStorage.setItem(getStateKey(), JSON.stringify({ state: stateToSave, inputs: inputsToSave }));
        const ind = document.getElementById('saveIndicator');
        if(ind) { ind.style.opacity = 1; setTimeout(() => ind.style.opacity = 0, 1500); }
        scheduleSheetsSync();
        scheduleDistSync();
    } catch (e) { showToast("Error guardando progreso localmente", "error"); }
}

function loadAppState() {
    try {
        const raw = localStorage.getItem(getStateKey()); if (!raw) return;
        const data = JSON.parse(raw);
        // startDate y numDays siempre inician vacíos — el usuario debe ingresarlos cada vez
        document.getElementById('startDate').value = '';
        document.getElementById('numDays').value = '';
        document.getElementById('minStaff').value = data.inputs?.minStaff || 1;
        appState = data.state;
        appState.holidays = new Set(data.state.holidays);
        appState.weeksToHighlight = new Set(data.state.weeksToHighlight);
        appState.noveltyWeeks = new Set(data.state.noveltyWeeks || []);
        appState.aisleDifficulties = data.state.aisleDifficulties || {};
        appState.swappedSeats = new Set(data.state.swappedSeats ||[]);
        appState.lockedAisles = new Set(data.state.lockedAisles ||[]);
        appState.lockedPersons = new Set(data.state.lockedPersons ||[]);
        appState.workerMasterData = data.state.workerMasterData || [];
        appState.aisleChangeDate = data.state.aisleChangeDate || null;
        appState.pendingSwaps = data.state.pendingSwaps || [];
        appState.rotationEffectiveDate = data.state.rotationEffectiveDate || null;
        appState.subgroups = data.state.subgroups || [];
        appState.leftoverAisles = data.state.leftoverAisles || [];
        appState.dailyTasks      = data.state.dailyTasks      || {};
        appState.taskNotes       = data.state.taskNotes       || {};
        appState.taskCustomNames = data.state.taskCustomNames || {};
        appState.dailyTasks2     = data.state.dailyTasks2     || {};
        
        document.getElementById('sidebar-tools').style.display = 'block';
        document.getElementById('filterControls').style.display = 'flex';
        populateFilters();
        renderAll();
        document.getElementById('message').textContent = '✅ Sesión restaurada correctamente.';
        document.getElementById('message').className = 'success';
        document.getElementById('restoreSessionBtn').style.display = 'none';
        showToast("Sesión restaurada correctamente", "success");
    } catch (e) { showToast("No se pudo restaurar la sesión previa.", "error"); }
}

// == MÓDULO DE TAREAS DIARIAS ==

async function syncTasksToSheets() {
    const url = getSheetsUrl();
    if (!url || !selectedStore) return;
    const sheetName = `TAREAS_${selectedStore}`;
    const headers = ['TRABAJADOR_ID', 'NOMBRE', 'PASILLO', 'FECHA', 'TAREA_ID', 'TAREA_NOMBRE', 'TAREA_ICONO', 'OBSERVACION', 'SLOT'];
    const rows = [];
    Object.entries(appState.dailyTasks).forEach(([key, task]) => {
        const sepIdx = key.indexOf('_');
        const workerExcelId = key.substring(0, sepIdx);
        const date = key.substring(sepIdx + 1);
        const worker = appState.processedData.find(w => String(w.workerExcelId) === String(workerExcelId));
        const nombre  = worker ? worker.fixedData[0] : workerExcelId;
        const pasillo = worker ? (worker.fixedData[1] || '') : '';
        const obs = appState.taskNotes[key] || '';
        rows.push([workerExcelId, nombre, pasillo, date, task.id, task.name, task.icon, obs, 1]);
    });
    Object.entries(appState.dailyTasks2 || {}).forEach(([key, task]) => {
        const sepIdx = key.indexOf('_');
        const workerExcelId = key.substring(0, sepIdx);
        const date = key.substring(sepIdx + 1);
        const worker = appState.processedData.find(w => String(w.workerExcelId) === String(workerExcelId));
        const nombre  = worker ? worker.fixedData[0] : workerExcelId;
        const pasillo = worker ? (worker.fixedData[1] || '') : '';
        rows.push([workerExcelId, nombre, pasillo, date, task.id, task.name, task.icon, '', 2]);
    });
    rows.sort((a, b) => a[3].localeCompare(b[3]) || a[8] - b[8]);
    try {
        await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain' },
            body: JSON.stringify({ sheetName, headers, rows, store: selectedStore, metaTitle: 'Tareas Diarias', frozenCols: 2 })
        });
    } catch(e) { /* silent */ }
}

async function loadTasksFromSheets() {
    const url = getSheetsUrl();
    if (!url || !selectedStore) return;
    const sheetName = `TAREAS_${selectedStore}`;
    try {
        const resp = await fetch(`${url}?action=getData&sheet=${encodeURIComponent(sheetName)}`).then(r => r.json());
        if (!resp.success || !resp.data || resp.data.length < 3) return;
        appState.dailyTasks  = {};
        appState.dailyTasks2 = {};
        appState.taskNotes   = {};
        // columnas: [0]TRABAJADOR_ID [1]NOMBRE [2]PASILLO [3]FECHA [4]TAREA_ID [5]TAREA_NOMBRE [6]TAREA_ICONO [7]OBSERVACION [8]SLOT
        resp.data.slice(2).forEach(row => {
            const workerExcelId = String(row[0] || '').trim();
            const date   = String(row[3] || '').trim();
            const taskId = row[4];
            const obs    = String(row[7] || '').trim();
            const slot   = row[8] ? parseInt(row[8]) : 1;
            if (!workerExcelId || !date || !taskId) return;
            const task = PREDEFINED_TASKS.find(t => String(t.id) === String(taskId));
            const key = `${workerExcelId}_${date}`;
            if (task) {
                if (slot === 2) appState.dailyTasks2[key] = task;
                else            appState.dailyTasks[key]  = task;
            }
            if (obs && slot !== 2) appState.taskNotes[key] = obs;
        });
    } catch(e) { /* silent — hoja aún no existe */ }
}

function scheduleSyncTasks() {
    clearTimeout(_taskSyncTimer);
    _taskSyncTimer = setTimeout(syncTasksToSheets, 2500);
}

function assignTask(excelId, dateStr, taskId) {
    const key = `${excelId}_${dateStr}`;
    if (taskId === null) {
        delete appState.dailyTasks[key];
        delete appState.dailyTasks2[key]; // Al quitar tarea 1 también se limpia la 2ª
    } else {
        const task = PREDEFINED_TASKS.find(t => t.id === taskId);
        if (task) appState.dailyTasks[key] = task;
    }
    refreshTaskBadgeInDOM(excelId, dateStr);
    scheduleSyncTasks();
}

function assignTask2(excelId, dateStr, taskId) {
    const key = `${excelId}_${dateStr}`;
    if (taskId === null) {
        delete appState.dailyTasks2[key];
    } else {
        const task = PREDEFINED_TASKS.find(t => t.id === taskId);
        if (task) appState.dailyTasks2[key] = task;
    }
    refreshTaskBadgeInDOM(excelId, dateStr);
    scheduleSyncTasks();
}

function saveTaskNote(excelId, dateStr, note) {
    const key = `${excelId}_${dateStr}`;
    if (note.trim()) {
        appState.taskNotes[key] = note.trim();
    } else {
        delete appState.taskNotes[key];
    }
    scheduleSyncTasks();
}

function getCompactShiftName(name) {
    if (!name || name === 'N/A' || name === '0SP') return '';
    const m = name.match(/^\d+(?:\.\d+)?([ACiNI])/);
    if (m) return m[1];
    if (name === 'LBRE') return 'L';
    if (name === 'COMP') return 'CO';
    return name; // VC, LIC, INC, DF, CAP ya son cortos
}

function toggleCompactView() {
    compactShiftView = !compactShiftView;
    renderAll();
}

function taskBadgeStyle(task) {
    const bg  = task.color;
    const fg  = task.fg || '#ffffff';
    const border = bg === '#ffffff' ? 'border:1px solid #f0d0d0;' : '';
    return `background:${bg};color:${fg};${border}`;
}
function taskDisplayName(task, key) {
    if (task.isEditable && appState.taskCustomNames?.[key]) return appState.taskCustomNames[key];
    return task.shortName;
}

function refreshTaskBadgeInDOM(excelId, dateStr) {
    const td = document.querySelector(`td.shift-td[data-excel-id="${excelId}"][data-date-str="${dateStr}"]`);
    if (!td) return;
    td.querySelectorAll('.task-badge-cell, .task-add-btn').forEach(el => el.remove());
    const sel = td.querySelector('.shift-select');
    if (!sel) return;
    const shift = allShifts[sel.value];
    if (!shift || shift.hours <= 0) return;
    const key   = `${excelId}_${dateStr}`;
    const task  = appState.dailyTasks[key];
    const task2 = appState.dailyTasks2?.[key];
    const hasNote = !!appState.taskNotes[key];
    const div = document.createElement('div');
    if (task) {
        div.className = 'task-badge-cell';
        div.dataset.excelId = excelId;
        div.dataset.dateStr = dateStr;
        div.style.cssText = taskBadgeStyle(task);
        div.innerHTML = `${task.icon} <span>${taskDisplayName(task, key)}</span>${hasNote ? ' <span style="font-size:0.8em;opacity:0.7;" title="Tiene observación">📝</span>' : ''}${task2 ? ' <span style="font-size:0.65em;opacity:0.85;font-weight:900;" title="Tiene 2ª tarea asignada">+2ª</span>' : ''}`;
    } else {
        div.className = 'task-add-btn';
        div.dataset.excelId = excelId;
        div.dataset.dateStr = dateStr;
        div.title = 'Asignar tarea';
        div.textContent = '+ tarea';
    }
    td.appendChild(div);
}

function openTaskPicker(excelId, dateStr, anchorEl) {
    closeTaskPicker();
    const key   = `${excelId}_${dateStr}`;
    const task  = appState.dailyTasks[key];
    const task2 = appState.dailyTasks2?.[key] || null;
    const note  = appState.taskNotes[key] || '';
    const popup = document.getElementById('taskPickerPopup');
    if (!popup) return;

    const customName = appState.taskCustomNames?.[key] || '';
    popup.innerHTML = `
        <div class="task-picker-header">📌 Asignar tarea</div>
        ${PREDEFINED_TASKS.map(t => {
            const bStyle = taskBadgeStyle(t);
            const isActive = task && task.id === t.id;
            return `<button class="task-picker-item ${isActive ? 'task-picker-active' : ''}" data-task-id="${t.id}" data-slot="1">
                <span class="task-picker-swatch" style="${bStyle};display:inline-flex;align-items:center;gap:4px;padding:2px 7px;border-radius:4px;font-size:0.82em;font-weight:700;">${t.icon} ${t.name}</span>
                ${isActive ? '<span class="task-picker-check" style="margin-left:auto;">✓</span>' : ''}
            </button>`;
        }).join('')}
        <button class="task-picker-clear" data-task-id="null" data-slot="1">✕ Quitar tarea</button>
        ${task ? `
        <div style="border-top:1px dashed #e0e0e0;margin-top:6px;padding-top:6px;">
            <div style="font-size:0.72em;color:#7b1fa2;font-weight:700;letter-spacing:0.5px;margin-bottom:4px;text-transform:uppercase;">➕ Segunda Tarea (opcional)</div>
            ${PREDEFINED_TASKS.map(t => {
                const isActive2 = task2 && task2.id === t.id;
                return `<button class="task-picker-item ${isActive2 ? 'task-picker-active' : ''}" data-task-id="${t.id}" data-slot="2" style="padding:4px 8px;">
                    <span style="display:inline-flex;align-items:center;gap:3px;font-size:0.78em;font-weight:700;">${t.icon} ${t.shortName}</span>
                    ${isActive2 ? '<span style="margin-left:auto;font-size:0.9em;">✓</span>' : ''}
                </button>`;
            }).join('')}
            <button class="task-picker-clear" data-task-id="null" data-slot="2">✕ Quitar 2ª tarea</button>
        </div>` : ''}
        <div id="taskCustomNameWrap" style="display:${task && task.isEditable ? 'block' : 'none'};border-top:1px solid #eee;margin-top:6px;padding-top:6px;">
            <div style="font-size:0.72em;color:#00bcd4;font-weight:700;letter-spacing:0.5px;margin-bottom:4px;text-transform:uppercase;">✏️ Nombre personalizado</div>
            <input id="taskCustomNameInput" type="text" maxlength="30" placeholder="Escribe el nombre de la tarea..." value="${customName}" style="width:100%;box-sizing:border-box;border:1px solid #00bcd4;border-radius:6px;font-size:0.85em;padding:5px 7px;font-family:inherit;color:#333;outline:none;">
        </div>
        <div style="border-top:1px solid #eee;margin-top:6px;padding-top:6px;">
            <div style="font-size:0.72em;color:#888;font-weight:700;letter-spacing:0.5px;margin-bottom:4px;text-transform:uppercase;">📝 Observación</div>
            <textarea id="taskNoteInput" rows="2" placeholder="Escribe una observación..." style="width:100%;box-sizing:border-box;border:1px solid #ddd;border-radius:6px;font-size:0.85em;padding:5px 7px;resize:vertical;font-family:inherit;color:#333;">${note}</textarea>
        </div>`;

    popup.dataset.excelId = excelId;
    popup.dataset.dateStr = dateStr;

    // Guardar observación y nombre personalizado al cambiar
    setTimeout(() => {
        const ta = document.getElementById('taskNoteInput');
        if (ta) ta.addEventListener('input', () => saveTaskNote(excelId, dateStr, ta.value));
        const cn = document.getElementById('taskCustomNameInput');
        if (cn) cn.addEventListener('input', () => {
            if (!appState.taskCustomNames) appState.taskCustomNames = {};
            if (cn.value.trim()) appState.taskCustomNames[key] = cn.value.trim();
            else delete appState.taskCustomNames[key];
            refreshTaskBadgeInDOM(excelId, dateStr);
            saveAppState();
        });
    }, 0);

    const rect = anchorEl.getBoundingClientRect();
    popup.style.left = '-9999px';
    popup.style.top  = '-9999px';
    popup.style.display = 'block';
    // Leer dimensiones reales del popup ya renderizado
    const pw = popup.offsetWidth  || 230;
    const ph = popup.offsetHeight || 350;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const margin = 8;
    // Preferir abajo del ancla; si no cabe, abrir arriba
    let top  = rect.bottom + 4;
    if (top + ph > vh - margin) top = rect.top - ph - 4;
    // Preferir alineado a la izquierda del ancla; si sale por la derecha, desplazar
    let left = rect.left;
    if (left + pw > vw - margin) left = vw - pw - margin;
    // Clampear para que nunca salga del viewport
    if (left < margin) left = margin;
    if (top  < margin) top  = margin;
    popup.style.left = left + 'px';
    popup.style.top  = top  + 'px';
}

function openTaskViewerRO(excelId, dateStr, anchorEl) {
    const key  = `${excelId}_${dateStr}`;
    const task = appState.dailyTasks[key];
    const note = appState.taskNotes[key] || '';
    if (!task) return;
    const popup = document.getElementById('taskPickerPopup');
    if (!popup) return;
    popup.innerHTML = `
        <div class="task-picker-header">📌 Tarea del día</div>
        <div style="display:flex;align-items:center;gap:8px;padding:10px 10px 6px;${taskBadgeStyle(task)};border-radius:8px;margin-bottom:6px;">
            <span style="font-size:1.8em;">${task.icon}</span>
            <div style="font-weight:800;font-size:0.95em;">${taskDisplayName(task, key)}</div>
        </div>
        ${note ? `<div style="border-top:1px solid #eee;margin-top:6px;padding-top:6px;">
            <div style="font-size:0.72em;color:#888;font-weight:700;letter-spacing:0.5px;margin-bottom:4px;text-transform:uppercase;">📝 Observación</div>
            <div style="font-size:0.88em;color:#333;background:#f9f9f9;border-radius:6px;padding:6px 8px;line-height:1.5;">${note.replace(/\n/g,'<br>')}</div>
        </div>` : '<div style="font-size:0.8em;color:#bbb;text-align:center;padding:4px 0;">Sin observación registrada</div>'}`;
    popup.dataset.excelId = excelId;
    popup.dataset.dateStr = dateStr;
    const rect = anchorEl.getBoundingClientRect();
    popup.style.display = 'block';
    const pw = popup.offsetWidth || 220;
    const ph = popup.offsetHeight || 180;
    let left = rect.left;
    let top = rect.bottom + 4;
    if (left + pw > window.innerWidth - 8) left = window.innerWidth - pw - 8;
    if (top + ph > window.innerHeight - 8) top = rect.top - ph - 4;
    popup.style.left = left + 'px';
    popup.style.top  = top  + 'px';
}

function closeTaskPicker() {
    const popup = document.getElementById('taskPickerPopup');
    if (popup) popup.style.display = 'none';
}

// Palabras reservadas: el trabajador es "placeholder" mientras su nombre las contenga como palabra completa
const PLACEHOLDER_KEYWORDS = ['VACANTE', 'CAMBIO', 'TEMPORAL', 'SADOFE'];
function isPlaceholderWorker(name) {
    const upper = (name || '').toUpperCase().trim();
    return PLACEHOLDER_KEYWORDS.some(kw => new RegExp(`\\b${kw}\\b`).test(upper));
}

function applyLegalHours() {
    // Lógica semanal (lunes a domingo) para los turnos base de 6.5h (códigos 1.1/2.2/4.4):
    // - Si el domingo de la semana es LBRE, todos los demás días de esa semana pasan al equivalente de 7h.
    // - Si no, sábado y domingo pasan al equivalente de 8h.
    // - Excepción: si algún día de la semana es feriado, ese día puntual sube a 8h y el sábado
    //   (cuando el feriado cae en otro día) pasa a 7h en vez de 8h.
    // - Entre semana, sin feriado, el turno se mantiene en su base de 6.5h.
    // Siempre se parte de worker.baseShifts (valor original importado) para que la función sea
    // idempotente sin importar cuántas veces se vuelva a ejecutar al cargar/extender datos.
    appState.weeks.forEach(weekDates => {
        const sundayDate    = weekDates.find(d => new Date(d + 'T00:00:00').getDay() === 0);
        const holidayInWeek = weekDates.some(d => appState.holidays.has(d));

        appState.processedData.forEach(worker => {
            if (worker.isPlaceholder || !worker.baseShifts) return;
            const master  = appState.workerMasterData.find(m => m.id === worker.id);
            const inicia  = master?.inicia || '';
            const finaliza = master?.finaliza || '';
            const sundayIsLBRE = !!(sundayDate && worker.baseShifts[sundayDate] === 'LBRE');

            weekDates.forEach(dateStr => {
                // Si el día cae en el periodo de vacaciones de la persona, no se toca: debe quedar en VC
                if (inicia && finaliza && dateStr >= inicia && dateStr <= finaliza) return;
                // También respeta si la celda ya está marcada como VC manualmente
                if (worker.dailyData[dateStr]?.name === 'VC') return;

                const baseName = worker.baseShifts[dateStr];
                if (!shift65To7Map[baseName] && !shift65To8Map[baseName]) return; // solo aplica a turnos base de 6.5h

                const dow = new Date(dateStr + 'T00:00:00').getDay(); // 0=domingo, 6=sábado
                const isHolidayHere = appState.holidays.has(dateStr);
                let targetName;

                if (sundayIsLBRE) {
                    targetName = shift65To7Map[baseName] || baseName;
                } else if (isHolidayHere) {
                    targetName = shift65To8Map[baseName] || baseName;
                } else if (dow === 6) {
                    targetName = holidayInWeek ? (shift65To7Map[baseName] || baseName) : (shift65To8Map[baseName] || baseName);
                } else if (dow === 0) {
                    targetName = shift65To8Map[baseName] || baseName;
                } else {
                    targetName = baseName;
                }

                if (targetName && allShifts[targetName]) {
                    const currentAisle = worker.dailyData[dateStr].aisle;
                    worker.dailyData[dateStr] = { ...allShifts[targetName], aisle: currentAisle };
                }
            });
        });
    });
}

function computeAndShowMetrics() {
    try {
        const dataToAnalyze = appState.processedData.filter(w => !w.isPlaceholder);
        const datesToAnalyze = appState.dateHeaders;
        const totalPossibleShifts = (dataToAnalyze.length || 0) * (datesToAnalyze.length || 0);
        let compOnHolidayCount = 0; let daysWithoutCoverageCount = 0;
        datesToAnalyze.forEach(dateStr => { if (appState.holidays.has(dateStr)) { dataToAnalyze.forEach(worker => { if (worker.dailyData[dateStr]?.name === 'COMP') compOnHolidayCount++; }); } });
        
        // Cobertura real por dailyAisle
        const allAisles = new Set();
        dataToAnalyze.forEach(w => datesToAnalyze.forEach(d => { if(w.dailyData[d]?.aisle) allAisles.add(w.dailyData[d].aisle); }));
        
        datesToAnalyze.forEach(dateStr => { 
            allAisles.forEach(aisleName => { 
                const workersInAisle = dataToAnalyze.filter(w => w.dailyData[dateStr]?.aisle === aisleName);
                if (!workersInAisle.some(w => w.dailyData[dateStr]?.isCoverageShift) && workersInAisle.length > 0) daysWithoutCoverageCount++; 
            }); 
        });
        
        const totalPenalties = compOnHolidayCount + daysWithoutCoverageCount;
        const accuracy = totalPossibleShifts === 0 ? 0 : ((totalPossibleShifts - totalPenalties) / totalPossibleShifts * 100);
        const html = `<p>Total de trabajadores: <strong>${dataToAnalyze.length}</strong></p><p>Días: <strong>${datesToAnalyze.length}</strong></p><p><strong>Total de turnos:</strong> ${totalPossibleShifts}</p><hr><p><strong>COMP en festivos:</strong> ${compOnHolidayCount}</p><p><strong>Días sin cobertura:</strong> ${daysWithoutCoverageCount}</p><p><strong>Penalizaciones:</strong> ${totalPenalties}</p><hr><p><strong>Indicador de exactitud:</strong> ${accuracy.toFixed(1)}%</p>`;
        document.getElementById('metricsBody').innerHTML = html;
        document.getElementById('metricsModal').style.display = 'flex';
    } catch (err) { console.error(err); }
}

function openMassChangeModal() {
    const { dataToRender, visibleDates } = applyAllFilters();
    const originContainer = document.getElementById('originShiftsContainer');
    const detectedShifts = new Set();
    dataToRender.forEach(worker => { visibleDates.forEach(dateStr => { if (worker.dailyData[dateStr]) detectedShifts.add(worker.dailyData[dateStr].name); }); });
    const searchInput = document.getElementById('originShiftSearch');
    if (searchInput) searchInput.value = '';
    originContainer.innerHTML = '';
    [...detectedShifts].sort().forEach(shiftName => {
        const div = document.createElement('div');
        div.style.cssText = 'padding:5px;border-bottom:1px solid #eee;';
        div.dataset.shift = shiftName.toLowerCase();
        div.innerHTML = `<label style="display:flex;align-items:center;gap:8px;cursor:pointer;font-weight:normal;color:#333;"><input type="checkbox" class="origin-shift-check" value="${shiftName}"><span class="turno-${shiftName.replace(/[^a-zA-Z0-9]/g, '-')}" style="padding:2px 6px;border-radius:3px;">${shiftName}</span></label>`;
        originContainer.appendChild(div);
    });
    const destSearch = document.getElementById('toShiftSearch');
    if (destSearch) destSearch.value = '';
    _buildDestSelect('');
    document.getElementById('massChangeModal').style.display = 'flex';
    document.getElementById('massChangeMessage').textContent = '';
}

function _buildDestSelect(query) {
    const q = (query || '').toLowerCase().trim();
    const sel = document.getElementById('toShiftSelect');
    const curVal = sel.value;
    const groupDefs = [
        { label: '── Aperturas (A) ──', re: /^\d+(?:\.\d+)?A/ },
        { label: '── Intermedios (I) ──', re: /^\d+(?:\.\d+)?i/ },
        { label: '── Cierres (C) ──', re: /^\d+(?:\.\d+)?C/ },
        { label: '── Noches (N) ──', re: /^\d+(?:\.\d+)?[NI]/ },
    ];
    const allNames = masterShiftList;
    const seen = new Set();
    let html = '<option value="">Seleccione Destino...</option>';
    groupDefs.forEach(g => {
        const items = allNames.filter(n => !seen.has(n) && g.re.test(n) && (!q || n.toLowerCase().includes(q)));
        if (!items.length) return;
        html += `<optgroup label="${g.label}">`;
        items.forEach(n => { html += `<option value="${n}">${n}</option>`; seen.add(n); });
        html += '</optgroup>';
    });
    const rest = allNames.filter(n => !seen.has(n) && (!q || n.toLowerCase().includes(q)));
    if (rest.length) {
        html += '<optgroup label="── Especiales ──">';
        rest.forEach(n => { html += `<option value="${n}">${n}</option>`; });
        html += '</optgroup>';
    }
    sel.innerHTML = html;
    if (curVal) sel.value = curVal;
}

function filterOriginShifts(query) {
    const q = (query || '').toLowerCase();
    document.querySelectorAll('#originShiftsContainer > div').forEach(div => {
        div.style.display = !q || (div.dataset.shift || '').includes(q) ? '' : 'none';
    });
}

function filterDestShifts(query) {
    _buildDestSelect(query);
}

function applyMassChange() {
    const selectedOrigins = Array.from(document.querySelectorAll('.origin-shift-check:checked')).map(cb => cb.value);
    const toShift = document.getElementById('toShiftSelect').value;
    const msgEl = document.getElementById('massChangeMessage');
    if (selectedOrigins.length === 0 || !toShift) { msgEl.textContent = '❌ Seleccione origen y destino.'; msgEl.style.color = 'red'; return; }
    const { dataToRender, visibleDates } = applyAllFilters();
    let changesCount = 0;
    dataToRender.forEach(worker => {
        const globalWorker = appState.processedData.find(w => w.id === worker.id);
        if (globalWorker) {
            visibleDates.forEach(dateStr => { 
                if (selectedOrigins.includes(globalWorker.dailyData[dateStr]?.name)) { 
                    globalWorker.dailyData[dateStr] = { ...allShifts[toShift], aisle: globalWorker.dailyData[dateStr].aisle }; 
                    changesCount++; 
                } 
            });
        }
    });
    if (changesCount > 0) { renderAll(); saveAppState(); showToast(`Éxito: Se transformaron ${changesCount} turnos.`, "success"); closeMassChangeModal(); }
    else { msgEl.textContent = '⚠️ No se encontraron turnos.'; msgEl.style.color = 'orange'; }
}

function applyEmpalme() {
    const choice = prompt("Seleccione el turno destino para el empalme:\n1. 7A7.3-14.3\n2. 7A7-14", "1");
    if (choice === null) return;
    let targetShiftName = "";
    if (choice === "1") targetShiftName = "7A7.3-14.3"; else if (choice === "2") targetShiftName = "7A7-14"; else { showToast("Opción no válida.", "error"); return; }
    if (!allShifts[targetShiftName]) { showToast("El turno destino no existe en la base.", "error"); return; }
    const { dataToRender, visibleDates } = applyAllFilters();
    let totalChanges = 0;
    visibleDates.forEach(dateStr => {
        const workerToChange = dataToRender.find(w => w.dailyData[dateStr]?.name === '7A6-13');
        if (workerToChange) {
            const globalWorker = appState.processedData.find(gw => gw.id === workerToChange.id);
            if (globalWorker) { 
                globalWorker.dailyData[dateStr] = { ...allShifts[targetShiftName], aisle: globalWorker.dailyData[dateStr].aisle }; 
                appState.weeksToHighlight.add(`${globalWorker.id}:${dateStr}`); 
                totalChanges++; 
            }
        }
    });
    if (totalChanges > 0) { renderAll(); saveAppState(); showToast(`Empalme ejecutado. Cambios: ${totalChanges}.`, "success"); closeMassChangeModal(); } else { showToast("No se encontraron trabajadores con 7A6-13.", "warning"); }
}

function closeMassChangeModal() { document.getElementById('massChangeModal').style.display = 'none'; }

function populateFilters() {
    const pasilloFilter = document.getElementById('pasilloFilter');
    const pasillos =[...new Set(appState.processedData.filter(d => !d.isPlaceholder).map(d => d.fixedData[1]))].sort();
    pasilloFilter.innerHTML = '<option value="">Todos</option>';
    pasillos.forEach(p => { if (p) { const opt = document.createElement('option'); opt.value = opt.textContent = p; pasilloFilter.appendChild(opt); } });
}

function renderMonthFilters() {
    const bar = document.getElementById('monthFilterBar');
    if (!bar || appState.dateHeaders.length === 0) { if(bar) bar.innerHTML = ''; return; }
    const months = [...new Set(appState.dateHeaders.map(d => d.substring(0, 7)))];
    const multiYear = new Set(months.map(m => m.substring(0, 4))).size > 1;
    let html = '<div class="month-filter-bar"><span class="month-filter-label">MESES RÁPIDOS:</span>';
    months.forEach(m => {
        const [year, month] = m.split('-');
        const label = (multiYear ? `${MONTH_NAMES_ES[+month - 1]} ${year}` : MONTH_NAMES_ES[+month - 1]).toUpperCase();
        const isActive = selectedMonthsFilter.has(m);
        html += `<button class="btn-month${isActive ? ' active' : ''}" data-month="${m}">${label}</button>`;
    });
    if (selectedMonthsFilter.size > 0) {
        html += `<button class="btn-month-clear">✕ Todos los meses</button>`;
        html += `<button class="btn-month-print" title="Imprimir programación del mes seleccionado en PDF">🖨️ Imprimir PDF</button>`;
    }
    html += '</div>';
    bar.innerHTML = html;
}

function applyAllFilters() {
    const pasilloValue = document.getElementById('pasilloFilter').value, restriccionValue = document.getElementById('restriccionFilter').value, nameValue = document.getElementById('nameSearch').value.toLowerCase(), dateFrom = document.getElementById('dateFromFilter').value, dateTo = document.getElementById('dateToFilter').value;
    let dataToRender = appState.processedData.filter(w => !w.isPlaceholder);
    if (pasilloValue) dataToRender = dataToRender.filter(d => d.fixedData[1] === pasilloValue);
    if (restriccionValue) dataToRender = dataToRender.filter(d => String(d.fixedData[2]).toUpperCase() === restriccionValue);
    if (currentRole === 'vermimalla') {
        const now = new Date();
        const y1 = now.getFullYear(), m1 = now.getMonth();
        const next = new Date(y1, m1 + 1, 1);
        const y2 = next.getFullYear(), m2 = next.getMonth();
        const pad = n => String(n).padStart(2, '0');
        const monthA = `${y1}-${pad(m1 + 1)}`;
        const monthB = `${y2}-${pad(m2 + 1)}`;
        dataToRender = appState.processedData.filter(w => !w.isPlaceholder);
        return { dataToRender, visibleDates: appState.dateHeaders.filter(d => d.substring(0, 7) === monthA || d.substring(0, 7) === monthB) };
    }
    if (nameValue) dataToRender = dataToRender.filter(d => d.fixedData[0].toLowerCase().includes(nameValue));
    let visibleDates = appState.dateHeaders;
    if (dateFrom) visibleDates = visibleDates.filter(d => d >= dateFrom);
    if (dateTo) visibleDates = visibleDates.filter(d => d <= dateTo);
    if (selectedMonthsFilter.size > 0) visibleDates = visibleDates.filter(d => selectedMonthsFilter.has(d.substring(0, 7)));

    if (specialShiftFilter) {
        dataToRender = dataToRender.filter(worker => {
            const shift = worker.dailyData[specialShiftFilter.dateStr];
            if (!shift) return false;
            const name = shift.name;
            const isNonWorking =['COMP', 'LBRE', 'VC', 'LIC', 'INC', 'DF', 'CAP'].includes(name);
            if (specialShiftFilter.metricKey === 'totalRealWorking') return !isNonWorking && (name.includes('A') || name.includes('C') || name.includes('i') || name.includes('N'));
            if (specialShiftFilter.metricKey === 'A') return !isNonWorking && name.includes('A');
            if (specialShiftFilter.metricKey === 'C') return !isNonWorking && name.includes('C');
            if (specialShiftFilter.metricKey === 'i') return !isNonWorking && name.includes('i');
            if (specialShiftFilter.metricKey === 'N') return !isNonWorking && name.includes('N');
            if (specialShiftFilter.metricKey === 'COMP') return name === 'COMP';
            if (specialShiftFilter.metricKey === 'LBRE') return name === 'LBRE';
            if (specialShiftFilter.metricKey === 'VC') return name === 'VC';
            if (specialShiftFilter.metricKey === 'OTROS') return isNonWorking && !['COMP', 'LBRE', 'VC'].includes(name);
            return true;
        });
    }
    return { dataToRender, visibleDates };
}

function renderAll() {
    renderMonthFilters();
    const { dataToRender, visibleDates } = applyAllFilters();
    const outputContainer = document.querySelector('.output-container');
    const scrollX = outputContainer ? outputContainer.scrollLeft : 0;
    const scrollY = outputContainer ? outputContainer.scrollTop : 0;

    const dailyDistribution = {};
    visibleDates.forEach(date => { dailyDistribution[date] = { A: 0, C: 0, i: 0, N: 0, COMP: 0, LBRE: 0, VC: 0, OTROS: 0 }; });
    dataToRender.forEach(worker => {
        visibleDates.forEach(dateStr => {
            const shift = worker.dailyData[dateStr]; if (!shift) return;
            const name = shift.name; const isNonWorking =['COMP', 'LBRE', 'VC', 'LIC', 'INC', 'DF', 'CAP'].includes(name);
            if (!isNonWorking) {
                if (name.includes('A')) dailyDistribution[dateStr].A++; else if (name.includes('C')) dailyDistribution[dateStr].C++; else if (name.includes('i')) dailyDistribution[dateStr].i++; else if (name.includes('N')) dailyDistribution[dateStr].N++;
            } else {
                if (name === 'COMP') dailyDistribution[dateStr].COMP++; else if (name === 'LBRE') dailyDistribution[dateStr].LBRE++; else if (name === 'VC') dailyDistribution[dateStr].VC++; else dailyDistribution[dateStr].OTROS++;
            }
        });
    });

    renderScheduleTable(dataToRender, visibleDates);
    renderDistributionAnalysis(dailyDistribution, visibleDates);

    const newOutputContainer = document.querySelector('.output-container');
    if (newOutputContainer) { newOutputContainer.scrollLeft = scrollX; newOutputContainer.scrollTop = scrollY; }
    const massChangeBtn = document.getElementById('massChangeBtn');
    if(massChangeBtn) massChangeBtn.style.display = (document.getElementById('dateFromFilter').value || document.getElementById('dateToFilter').value) ? 'block' : 'none';
}

function handleAisleScroll(containerArg) {
    if (!appState.processedData.length) return;
    const container = (containerArg && containerArg.querySelectorAll) ? containerArg : this;
    const scrollLeft = container.scrollLeft || 0;
    const allDateThs = container.querySelectorAll('th[data-date]');
    if (!allDateThs.length) return;
    const fixedColumnsWidth = allDateThs[0].offsetLeft;

    // Encontrar la primera fecha visible en el área scrolleada
    let visibleDate = allDateThs[0].dataset.date;
    allDateThs.forEach(th => {
        if ((th.offsetLeft - fixedColumnsWidth) <= scrollLeft) visibleDate = th.dataset.date;
    });

    container.querySelectorAll('.pasillo-cell[data-worker-id]').forEach(cell => {
        const workerId = parseInt(cell.dataset.workerId);
        const worker = appState.processedData.find(w => w.id === workerId);
        if (!worker) return;
        const aisle = worker.dailyData[visibleDate]?.aisle || worker.fixedData[1];
        const diff = appState.aisleDifficulties[aisle] || '';
        const newClass = 'equipo-badge' + (diff === 'Alto' ? ' equipo-badge-alto' : diff === 'Medio' ? ' equipo-badge-medio' : diff === 'Bajo' ? ' equipo-badge-bajo' : '');

        let badge = cell.querySelector('.equipo-badge');
        if (!badge) {
            cell.innerHTML = '<span class="equipo-badge"></span>';
            badge = cell.querySelector('.equipo-badge');
        }
        if (badge.textContent !== aisle) badge.textContent = aisle;
        if (badge.className !== newClass) badge.className = newClass;
    });
}

function renderScheduleTable(data, visibleDates) {
    const readOnly = currentRole === 'marcaciones' || currentRole === 'vermimalla';
    const visibleWeeks =[]; if (visibleDates.length > 0) { let currentWeek =[]; visibleDates.forEach(dateStr => { currentWeek.push(dateStr); if (new Date(dateStr + 'T00:00:00').getDay() === 0) { visibleWeeks.push(currentWeek); currentWeek =[]; } }); if (currentWeek.length > 0) visibleWeeks.push(currentWeek); }
    const tableTitle = readOnly ? '📅 Horario de Personal' : '📅 Horario de Personal (Editable)';
    let tableHTML = `<div class="table-toolbar"><h2 style="color: #1a237e; margin:0;">${tableTitle}</h2><button id="toggleCompactBtn" onclick="toggleCompactView()" class="btn-compact-toggle${compactShiftView ? ' active' : ''}">${compactShiftView ? '📋 Vista Completa' : '🔤 Solo Letras'}</button></div><table class="schedule-table${compactShiftView ? ' compact-view' : ''}"><thead><tr>`;
    appState.fixedHeaders.forEach(h => tableHTML += `<th>${h}</th>`);
    visibleWeeks.forEach((weekDates) => { weekDates.forEach(dateStr => { const isHoliday = appState.holidays.has(dateStr); const dow = new Date(dateStr + 'T00:00:00').getDay(); const thClass = isHoliday ? 'holiday-header' : (dow === 6 ? 'sat-header' : (dow === 0 ? 'sun-header' : '')); tableHTML += `<th class="${thClass}" data-date="${dateStr}">${dayAbbreviations[dow].toUpperCase()}<br>${dateStr.substring(5)}</th>`; }); tableHTML += `<th class="total-horas-header">Total Horas</th>`; });
    tableHTML += '</tr></thead><tbody>';
    // ── COMP-after-Sunday rule: build violation map ───────────────────────────
    // If a worker has a working shift (^\d+[ACIN]) on Sunday, the following
    // calendar week must contain at least one COMP. Mark violating week cells.
    const compViolationCells = new Map(); // workerId → Set<dateStr>
    data.forEach(rowData => {
        const violating = new Set();
        appState.dateHeaders.forEach(dateStr => {
            if (new Date(dateStr + 'T00:00:00').getDay() !== 0) return;
            const c = rowData.dailyData[dateStr];
            if (!c || !/^\d+[ACIN]/.test(c.name || '')) return;
            const idx = appState.dateHeaders.indexOf(dateStr);
            const nextWeek = appState.dateHeaders.slice(idx + 1, idx + 8);
            if (!nextWeek.length) return;
            const hasComp = nextWeek.some(d => (rowData.dailyData[d]?.name || '') === 'COMP');
            if (!hasComp) nextWeek.forEach(d => violating.add(d));
        });
        if (violating.size > 0) compViolationCells.set(rowData.id, violating);
    });

    const initialAisleDate = appState.dateHeaders[0] || null;
    data.forEach((rowData) => {
        const initialAisle = (initialAisleDate && rowData.dailyData[initialAisleDate]?.aisle) || rowData.fixedData[1];
        const initDiff = appState.aisleDifficulties[initialAisle] || '';
        const initBadgeClass = initDiff === 'Alto' ? ' equipo-badge-alto' : initDiff === 'Medio' ? ' equipo-badge-medio' : initDiff === 'Bajo' ? ' equipo-badge-bajo' : '';
        const nameCellAttr = readOnly ? '' : ` contenteditable="true" data-worker-id="${rowData.id}" title="Click para editar nombre"`;
        const nameCellClass = readOnly ? 'fixed-cell' : 'fixed-cell editable-name';
        tableHTML += `<tr data-worker-id="${rowData.id}"><td class="${nameCellClass}"${nameCellAttr}>${rowData.fixedData[0]}</td><td class="fixed-cell pasillo-cell" data-worker-id="${rowData.id}"><span class="equipo-badge${initBadgeClass}">${initialAisle}</span></td><td class="fixed-cell ${rowData.restrictionClass}">${rowData.fixedData[2]}</td>`;
        visibleWeeks.forEach((weekDates) => {
            let weeklyTotal = 0; weekDates.forEach((dateStr) => {
                const cell = rowData.dailyData[dateStr] || { name: 'N/A', hours: 0, className: '' }; weeklyTotal += Number(cell.hours || 0);
                const isHoliday = appState.holidays.has(dateStr);
                const cellDow = new Date(dateStr + 'T00:00:00').getDay();
                const weekendClass = cellDow === 6 ? 'sat-cell' : (cellDow === 0 ? 'sun-cell' : '');
                let fClass = cell.className + (appState.weeksToHighlight.has(`${rowData.id}:${dateStr}`) ? ' turno-CORRECCION' : '') + (appState.noveltyWeeks?.has(`${rowData.id}:${dateStr}`) ? ' turno-NOVEDAD' : '');
                if (isHoliday && cell.name === 'COMP') fClass = 'comp-on-holiday'; else if (isHoliday) fClass += ' holiday-cell';
                const allDatesIdx = appState.dateHeaders.indexOf(dateStr);
                const nextDateStr = allDatesIdx >= 0 && allDatesIdx < appState.dateHeaders.length - 1 ? appState.dateHeaders[allDatesIdx + 1] : null;
                const nextShift = nextDateStr ? rowData.dailyData[nextDateStr] : null;
                const nextIsValid = nextShift && (nextShift.name === 'COMP' || (nextShift.hours > 0 && nextShift.name.includes('N')));
                const showMoonWarning = cell.hours > 0 && cell.name.includes('N') && nextShift && !nextIsValid;
                const tdClass = (fClass.trim() + (showMoonWarning ? ' cell-with-moon' : '') + (weekendClass ? ' ' + weekendClass : '')).trim();
                const moonHTML = showMoonWarning ? '<span class="moon-warning" title="⚠️ Turno nocturno sin COMP u otro N al día siguiente">🌙</span>' : '';
                const excelId  = rowData.workerExcelId || String(rowData.id);
                const taskKey  = `${excelId}_${dateStr}`;
                const assignedTask = appState.dailyTasks[taskKey];
                const hasNote  = !!appState.taskNotes[taskKey];
                let shiftCellContent;
                if (readOnly) {
                    let taskBadgeHTML = '';
                    if (cell.hours > 0 && assignedTask) {
                        taskBadgeHTML = `<div class="task-badge-ro" data-excel-id="${excelId}" data-date-str="${dateStr}" title="${assignedTask.name}${hasNote ? ' — 📝 tiene observación' : ''}" style="${taskBadgeStyle(assignedTask)};display:flex;align-items:center;gap:3px;font-size:0.68em;font-weight:700;padding:2px 4px;margin-top:2px;border-radius:3px;cursor:pointer;">${assignedTask.icon} <span>${taskDisplayName(assignedTask, taskKey)}</span>${hasNote ? ' 📝' : ''}</div>`;
                    }
                    shiftCellContent = `<span class="shift-ro-text">${cell.name !== 'N/A' ? (compactShiftView ? getCompactShiftName(cell.name) : cell.name) : ''}</span>${taskBadgeHTML}`;
                } else {
                    let taskHTML = '';
                    if (cell.hours > 0) {
                        if (assignedTask) {
                            taskHTML = `<div class="task-badge-cell" data-excel-id="${excelId}" data-date-str="${dateStr}" style="${taskBadgeStyle(assignedTask)}">${assignedTask.icon} <span>${taskDisplayName(assignedTask, taskKey)}</span>${hasNote ? ' <span style="font-size:0.8em;opacity:0.7;" title="Tiene observación">📝</span>' : ''}</div>`;
                        } else {
                            taskHTML = `<div class="task-add-btn" data-excel-id="${excelId}" data-date-str="${dateStr}" title="Asignar tarea">+ tarea</div>`;
                        }
                    }
                    if (compactShiftView) {
                        const cName = getCompactShiftName(cell.name);
                        shiftCellContent = `<span class="shift-ro-text shift-compact-edit" onclick="var s=this.nextElementSibling;this.style.display='none';s.style.display='block';s.focus();" title="${cell.name !== 'N/A' ? cell.name : ''}">${cName}</span><select class="shift-select" style="display:none;" data-worker-id="${rowData.id}" data-date-str="${dateStr}">${shiftOptionsHTML.replace(`value="${cell.name}"`, `value="${cell.name}" selected`)}</select>${moonHTML}${taskHTML}`;
                    } else {
                        shiftCellContent = `<select class="shift-select" data-worker-id="${rowData.id}" data-date-str="${dateStr}">${shiftOptionsHTML.replace(`value="${cell.name}"`, `value="${cell.name}" selected`)}</select>${moonHTML}${taskHTML}`;
                    }
                }
                const compWarn = compViolationCells.get(rowData.id)?.has(dateStr);
                const taskBorderStyle = (cell.hours > 0 && assignedTask) ? `border:2px solid ${assignedTask.color};` : '';
                tableHTML += `<td class="shift-td ${tdClass}${compWarn ? ' comp-missing-cell' : ''}" style="${taskBorderStyle}" data-worker-id="${rowData.id}" data-excel-id="${excelId}" data-date-str="${dateStr}">${shiftCellContent}</td>`;
            });
            const validHours = [0, 7, 14, 21, 28, 35, 36, 42, 42.5, 48.5, 49]; const totalRounded = Math.round(weeklyTotal * 10) / 10; const isError = !validHours.includes(totalRounded);
            const weekHasCompWarn = compViolationCells.get(rowData.id) && weekDates.some(d => compViolationCells.get(rowData.id).has(d));
            tableHTML += `<td class="total-horas-cell ${isError ? 'hour-error-cell' : ''}"><span class="hrs-chip">${weeklyTotal}${isError ? ' ⚠️' : ''}${weekHasCompWarn ? ' <span class="comp-warn-icon" title="⚠️ Trabajó el domingo anterior y no tiene COMP en esta semana">🔔</span>' : ''}</span></td>`;
        });
        tableHTML += '</tr>';
    });
    tableHTML += '</tbody></table>';
    const out = document.getElementById('outputContainer');
    if (data.length > 0) {
        out.innerHTML = `<div class="output-container">${tableHTML}</div>`;
        const scrollEl = out.querySelector('.output-container');
        if (scrollEl) {
            scrollEl.addEventListener('scroll', handleAisleScroll);
            setTimeout(() => handleAisleScroll(scrollEl), 50);
        }
    } else {
        out.innerHTML = `<p style="text-align:center; color: #c62828;">No hay resultados.</p>`;
    }
}

function printSchedulePDF() {
    if (selectedMonthsFilter.size === 0) {
        showToast('Selecciona un mes en MESES RÁPIDOS antes de imprimir.', 'warning');
        return;
    }
    const { dataToRender, visibleDates } = applyAllFilters();
    if (visibleDates.length === 0 || dataToRender.length === 0) {
        showToast('No hay datos para imprimir.', 'warning');
        return;
    }

    const months = [...selectedMonthsFilter].sort();
    const monthLabels = months.map(m => {
        const [yr, mo] = m.split('-');
        return `${MONTH_NAMES_ES[parseInt(mo) - 1].toUpperCase()} ${yr}`;
    }).join(' / ');
    const storeLabel = selectedStore || '';
    const DOW_ABBR   = ['DOM','LUN','MAR','MIE','JUE','VIE','SAB'];
    const MESES_ABBR = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];
    const fmtDate = d => { const [,m,day] = d.split('-'); return `${parseInt(day)} ${MESES_ABBR[parseInt(m)-1]}`; };

    // Aisle difficulty colours (matches main app)
    const DIFF_BG    = { 'Alto':'#ef9a9a', 'Medio':'#FFFF00', 'Bajo':'#a5d6a7', '':'#dce0e4' };
    const DIFF_COLOR = { 'Alto':'#7f0000', 'Medio':'#333',    'Bajo':'#1b5e20', '':'#444'    };

    const numRows = dataToRender.length;

    // Cap row height at 6mm so cells never inflate when worker count is low.
    // Proportions: shift 73% / task 27% (same as before).
    const BASE_MM    = Math.min(6.0, 222 / numRows);
    const SHIFT_H_MM = (BASE_MM * (147 / 222)).toFixed(4);
    const TASK_H_MM  = (BASE_MM * (75  / 222)).toFixed(4);
    const ROW_MM     = BASE_MM.toFixed(4);

    // ── thead ────────────────────────────────────────────────────────
    let thead = '<tr><th class="th-fixed th-name">TRABAJADOR / EQUIPO</th>';
    visibleDates.forEach(dateStr => {
        const dow = new Date(dateStr + 'T00:00:00').getDay();
        const isHoliday = appState.holidays.has(dateStr);
        let cls = 'th-date';
        if (isHoliday) cls += ' hdr-holiday';
        else if (dow === 6) cls += ' hdr-sat';
        else if (dow === 0) cls += ' hdr-sun';
        thead += `<th class="${cls}">${DOW_ABBR[dow]}<br>${fmtDate(dateStr)}</th>`;
    });
    thead += '</tr>';

    // ── shift color helper (print only) — sin negrita, bordes suaves ─
    function getPrintShiftStyle(name, special) {
        if (!name) return { bg: 'background:#fff', fg: 'color:#ccc', bdr: 'border:0.2pt solid #eee' };
        if (name === 'COMP') return { bg: 'background:#f0f0f0', fg: 'color:#1a0067', bdr: 'border:0.2pt solid #c0c0c0' };
        if (name === 'LBRE') return { bg: 'background:#fff5f0', fg: 'color:#c62800', bdr: 'border:0.2pt solid #fd8060' };
        if (name === 'VC')   return { bg: 'background:#fce4ec', fg: 'color:#880e4f', bdr: 'border:0.2pt solid #f48fb1' };
        if (/^(INC|LIC|DF|CAP)/.test(name)) return { bg: 'background:#f9fbe7', fg: 'color:#33691e', bdr: 'border:0.2pt solid #aed581' };
        // Aperturas (A) — naranja
        if (/^\d+(?:\.\d+)?A/.test(name)) return special
            ? { bg: 'background:#ffcc80', fg: 'color:#4e1f00', bdr: 'border:0.2pt solid #fb8c00' }
            : { bg: 'background:#ffe0b2', fg: 'color:#5d2e00', bdr: 'border:0.2pt solid #ffb74d' };
        // Cierres (C) — verde
        if (/^\d+(?:\.\d+)?C/.test(name)) return special
            ? { bg: 'background:#a5d6a7', fg: 'color:#1b3a1c', bdr: 'border:0.2pt solid #66bb6a' }
            : { bg: 'background:#c8e6c9', fg: 'color:#1b5e20', bdr: 'border:0.2pt solid #81c784' };
        // Intermedios (i) — azul
        if (/^\d+(?:\.\d+)?[iI]/.test(name)) return special
            ? { bg: 'background:#90caf9', fg: 'color:#0a2744', bdr: 'border:0.2pt solid #42a5f5' }
            : { bg: 'background:#bbdefb', fg: 'color:#0d3666', bdr: 'border:0.2pt solid #64b5f6' };
        // Noches (N) — morado
        if (/^\d+(?:\.\d+)?N/.test(name)) return special
            ? { bg: 'background:#ce93d8', fg: 'color:#1a0033', bdr: 'border:0.2pt solid #ab47bc' }
            : { bg: 'background:#d1c4e9', fg: 'color:#311b92', bdr: 'border:0.2pt solid #b39ddb' };
        return { bg: 'background:#f5f5f5', fg: 'color:#555', bdr: 'border:0.2pt solid #ccc' };
    }

    // ── tbody ────────────────────────────────────────────────────────
    let tbody = '';
    dataToRender.forEach(rowData => {
        const initialAisleDate = appState.dateHeaders[0] || null;
        const aisle = (initialAisleDate && rowData.dailyData[initialAisleDate]?.aisle) || rowData.fixedData[1];
        const diff  = appState.aisleDifficulties[aisle] || '';
        const aBg   = DIFF_BG[diff]    || DIFF_BG[''];
        const aClr  = DIFF_COLOR[diff] || DIFF_COLOR[''];

        tbody += `<tr style="height:${ROW_MM}mm;">`;
        // Name cell: worker name + aisle badge stacked
        tbody += `<td class="td-fixed td-name"><div class="nw"><div class="wn">${rowData.fixedData[0]}</div><div class="ab" style="background:${aBg};color:${aClr};">${aisle}</div></div></td>`;

        visibleDates.forEach(dateStr => {
            const cell = rowData.dailyData[dateStr] || { name:'', hours:0, className:'' };
            const isHoliday = appState.holidays.has(dateStr);
            const dow = new Date(dateStr + 'T00:00:00').getDay();
            const shiftName = cell.name && cell.name !== 'N/A' ? cell.name : '';
            const isSpecialDay = isHoliday || dow === 6 || dow === 0;
            const excelId = rowData.workerExcelId || String(rowData.id);
            const assignedTask = appState.dailyTasks[`${excelId}_${dateStr}`];
            const shiftStyle = getPrintShiftStyle(shiftName, isSpecialDay);
            const taskFg = assignedTask?.fg || '#ffffff';
            const taskInner = (cell.hours > 0 && assignedTask)
                ? `<span style="background:${assignedTask.color};color:${taskFg};border-radius:3pt;padding:0.5pt 2.5pt;font-size:2.7pt;font-weight:500;display:inline-flex;align-items:center;gap:0.5pt;white-space:nowrap;overflow:hidden;max-width:98%;letter-spacing:0.1pt;">${assignedTask.icon} ${taskDisplayName(assignedTask, `${excelId}_${dateStr}`)}</span>`
                : '';
            tbody += `<td class="td-shift"><div class="ci"><div class="st"><span class="sc" style="${shiftStyle.bg};${shiftStyle.fg};${shiftStyle.bdr}">${shiftName}</span></div><div class="tk">${taskInner}</div></div></td>`;
        });
        tbody += '</tr>';
    });

    const dynamicShiftStyles = document.getElementById('dynamic-styles')?.textContent || '';
    const printedOn = new Date().toLocaleDateString('es-CO', { year:'numeric', month:'long', day:'numeric' });

    const html = `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<title>KRONOMERCADO — ${storeLabel} ${monthLabels}</title>
<style>
*{box-sizing:border-box;margin:0;padding:0;}
@page{size:landscape;margin:3mm;}
html,body{width:100%;background:#fff;color:#333;font-family:'Segoe UI',Arial,Helvetica,sans-serif;-webkit-print-color-adjust:exact;print-color-adjust:exact;font-weight:400;}
/* Page header */
.ph{display:flex;justify-content:space-between;align-items:flex-end;height:5mm;padding-bottom:0.5mm;margin-bottom:1.5mm;border-bottom:0.8pt solid #3949ab;}
.pt{font-size:8.5pt;font-weight:600;color:#1a237e;letter-spacing:.5px;line-height:1;}
.pm{font-size:6pt;color:#666;font-weight:400;}
.pd{font-size:4pt;color:#bbb;}
/* Table — bordes muy suaves */
table{width:100%;border-collapse:collapse;table-layout:fixed;}
thead tr{height:5mm;}
th,td{border:.15pt solid #ddd;padding:0;overflow:hidden;}
/* Columna de nombre */
.th-fixed,.td-fixed{background:#f8f9fc!important;font-weight:500;vertical-align:middle;}
.th-name{width:22mm;min-width:22mm;max-width:22mm;text-align:left;padding:1px 2px;font-size:4.5pt;vertical-align:middle;color:#444;}
.td-name{width:22mm;min-width:22mm;max-width:22mm;vertical-align:middle;padding:1px 2px;}
.nw{display:flex;flex-direction:column;align-items:flex-start;justify-content:center;gap:0.8px;width:100%;height:100%;}
.wn{font-size:3.8pt;font-weight:500;line-height:1.1;word-break:break-word;white-space:normal;width:100%;overflow:hidden;color:#222;}
.ab{font-size:3pt;font-weight:500;padding:0.5px 3px;border-radius:20pt;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:100%;display:inline-block;line-height:1.5;}
/* Encabezados de fecha — elegantes, sin negrita marcada */
.th-date{text-align:center;font-size:3.8pt;background:#3949ab!important;color:#e8eaf6!important;font-weight:500;line-height:1.3;padding:1px 0;vertical-align:middle;letter-spacing:0.2px;}
.hdr-sat{background:#4a148c!important;color:#ede7f6!important;}
.hdr-sun{background:#4a148c!important;color:#ede7f6!important;}
.hdr-holiday{background:#b71c1c!important;color:#ffcdd2!important;}
/* Celdas de turno */
.td-shift{padding:0;position:relative;vertical-align:top;text-align:center;background:#fff;}
.ci{position:absolute;top:0;left:0;right:0;bottom:0;display:flex;flex-direction:column;}
/* .st: wrapper — chip borde a borde con mínimo margen (1pt cada lado) */
.st{height:${SHIFT_H_MM}mm;flex:none;display:flex;align-items:center;justify-content:center;padding:0.5pt 1pt;}
/* .sc: chip/píldora igual que la web — sin negrita, bordes suaves */
.sc{display:inline-flex;align-items:center;justify-content:center;width:calc(100% - 0pt);border-radius:4pt;font-size:3.06pt;font-weight:400;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;padding:0.8pt 1pt;line-height:1.1;}
/* .tk: contenedor de badge de tarea */
.tk{height:${TASK_H_MM}mm;flex:none;display:flex;align-items:center;justify-content:center;padding:0 0.8pt;background:transparent;overflow:hidden;}
/* Dynamic shift colours */
${dynamicShiftStyles}
</style>
</head>
<body>
<div class="ph">
  <div><div class="pt">KRONOMERCADO &nbsp;·&nbsp; ${storeLabel}</div><div class="pm">Programación &nbsp;${monthLabels}</div></div>
  <div class="pd">Impreso: ${printedOn}</div>
</div>
<table><thead>${thead}</thead><tbody>${tbody}</tbody></table>
<script>
window.onload = function() {
    /* Safety zoom: guarantees fit on A3 landscape (410 × 287 mm printable at 96 dpi).
       When content already fits, scale stays ≥ 1 and zoom is not applied. */
    var PX_MM = 96 / 25.4;
    var body  = document.body;
    var scale = Math.min((414 * PX_MM) / body.scrollWidth, (291 * PX_MM) / body.scrollHeight);
    if (scale < 0.998) body.style.zoom = scale.toFixed(6);
    setTimeout(function(){ window.print(); }, 700);
};
<\/script>
</body></html>`;

    const printWin = window.open('', '_blank', 'width=1400,height=900');
    if (!printWin) { showToast('El navegador bloqueó la ventana emergente. Habilita ventanas emergentes para imprimir.', 'warning'); return; }
    printWin.document.write(html);
    printWin.document.close();
    printWin.focus();
}

function renderSummaryTable(data, visibleDates) {
    const container = document.getElementById('distributionAnalysisContainer');
    const dailyShiftCounts = {}; const allShiftNames = Object.keys(allShifts);
    visibleDates.forEach(date => { dailyShiftCounts[date] = {}; allShiftNames.forEach(shiftName => { dailyShiftCounts[date][shiftName] = 0; }); });
    data.forEach(rowData => { visibleDates.forEach(dateStr => { const shift = rowData.dailyData[dateStr]; if (shift && dailyShiftCounts[dateStr][shift.name] !== undefined) dailyShiftCounts[dateStr][shift.name]++; }); });
    const usedShiftNames = allShiftNames.filter(shiftName => visibleDates.some(date => dailyShiftCounts[date][shiftName] > 0));
    if (usedShiftNames.length === 0 || data.length === 0) { container.innerHTML = ''; container.style.display = 'none'; return; }
    let sHTML = '<h2 style="color: #1a237e;">🔢 Conteo de Personal por Turno</h2><div class="summary-container"><table class="summary-table"><thead><tr><th>Turno</th>';
    visibleDates.forEach(date => sHTML += `<th class="${appState.holidays.has(date) ? 'holiday-header' : ''}">${dayAbbreviations[new Date(date+'T00:00:00').getDay()].toUpperCase()}<br>${date.substring(5)}</th>`);
    sHTML += '</tr></thead><tbody>';
    usedShiftNames.sort().forEach(shiftName => {
        sHTML += `<tr><td>${shiftName}</td>`;
        visibleDates.forEach(date => { const count = dailyShiftCounts[date][shiftName]; sHTML += `<td class="${(allShifts[shiftName].isCoverageShift && count < appState.minStaff) ? 'count-warning' : ''}">${count}</td>`; });
        sHTML += '</tr>';
    });
    container.innerHTML = sHTML + '</tbody></table></div>';
    container.style.display = 'block';
    container.scrollIntoView({ behavior: 'smooth' });
}

function renderDistributionAnalysis(dailyDistribution, visibleDates) {
    const container = document.getElementById('summaryContainer');
    let tableHTML = `<h2 style="color: #1a237e;">📊 Distribución Diaria <small style="color: #555; font-size: 0.6em; font-weight: normal;">(Dale click a cualquier número para filtrar al personal)</small></h2><div class="distribution-analysis-container"><table class="summary-table distribution-table"><thead><tr><th>Métrica / Turno</th>`;
    visibleDates.forEach(date => { tableHTML += `<th>${dayAbbreviations[new Date(date+'T00:00:00').getDay()].toUpperCase()}<br>${date.substring(5)}</th>`; });
    tableHTML += '</tr></thead><tbody>';
    const operationalMetrics =[ { label: 'TOTAL TRABAJANDO (A+C+i+N)', key: 'totalRealWorking' }, { label: 'Apertura (A)', key: 'A' }, { label: 'Cierre (C)', key: 'C' }, { label: 'Intermedio (i)', key: 'i' }, { label: 'Noche (N)', key: 'N' } ];
    operationalMetrics.forEach(metric => {
        tableHTML += `<tr class="${metric.key === 'totalRealWorking' ? 'dist-total-row' : ''}"><td>${metric.label}</td>`;
        visibleDates.forEach(date => {
            const counts = dailyDistribution[date]; const totalACIN = counts.A + counts.C + counts.i + counts.N;
            const count = metric.key === 'totalRealWorking' ? totalACIN : counts[metric.key];
            const isActive = specialShiftFilter && specialShiftFilter.dateStr === date && specialShiftFilter.metricKey === metric.key;
            const cellClass = `clickable-cell ${isActive ? 'active-filter' : ''}`;
            if (metric.key === 'totalRealWorking') {
                tableHTML += `<td class="${cellClass}" data-date="${date}" data-metric="${metric.key}" title="Click para filtrar">${totalACIN}</td>`;
            } else { 
                const percentage = totalACIN > 0 ? ((count / totalACIN) * 100).toFixed(1) : '0.0'; 
                tableHTML += `<td class="${cellClass}" data-date="${date}" data-metric="${metric.key}" title="Click para filtrar">${count} <span class="dist-percent">(${percentage}%)</span></td>`; 
            }
        });
        tableHTML += '</tr>';
    });
    const nonWorkingMetrics =[ { label: 'Compensatorios (COMP)', key: 'COMP' }, { label: 'Días Libres (LBRE)', key: 'LBRE' }, { label: 'Vacaciones (VC)', key: 'VC' }, { label: 'Otros (INC/LIC/DF/CAP)', key: 'OTROS' } ];
    tableHTML += `<tr style="background:#eeeeee; height:10px;"><td colspan="${visibleDates.length + 1}"></td></tr>`;
    nonWorkingMetrics.forEach(metric => {
        tableHTML += `<tr class="non-working-row"><td>${metric.label}</td>`;
        visibleDates.forEach(date => { 
            const isActive = specialShiftFilter && specialShiftFilter.dateStr === date && specialShiftFilter.metricKey === metric.key;
            const cellClass = `clickable-cell ${isActive ? 'active-filter' : ''}`;
            tableHTML += `<td class="${cellClass}" data-date="${date}" data-metric="${metric.key}" title="Click para filtrar">${dailyDistribution[date][metric.key]}</td>`; 
        });
        tableHTML += '</tr>';
    });
    container.innerHTML = tableHTML + '</tbody></table></div>';
}

function pushUndo(workerId, dateStr, previousShift) {
    undoStack.push({ workerId, dateStr, previousShift: { ...previousShift } });
    if (undoStack.length > MAX_UNDO) undoStack.shift();
    const btn = document.getElementById('undoBtn');
    if (btn) btn.disabled = false;
}

function performUndo() {
    if (!undoStack.length) { showToast('No hay cambios para deshacer.', 'info'); return; }
    const { workerId, dateStr, previousShift } = undoStack.pop();
    const worker = appState.processedData.find(w => w.id == workerId);
    if (worker) {
        worker.dailyData[dateStr] = { ...previousShift };
        saveAppState();
        renderAll();
        showToast('↩ Cambio deshecho correctamente.', 'success');
    }
    const btn = document.getElementById('undoBtn');
    if (btn) btn.disabled = undoStack.length === 0;
}

function updateShift(selectElement) {
    const { workerId, dateStr } = selectElement.dataset;
    const workerGlobal = appState.processedData.find(w => w.id == workerId);
    if (workerGlobal) {
        pushUndo(workerId, dateStr, { ...workerGlobal.dailyData[dateStr] });
        const currentAisle = workerGlobal.dailyData[dateStr].aisle;
        workerGlobal.dailyData[dateStr] = { ...allShifts[selectElement.value], aisle: currentAisle };
        saveAppState();
    }
    renderAll();
}

function downloadExcel() {
    const { dataToRender, visibleDates } = applyAllFilters();
    const wb = XLSX.utils.book_new();
    const tienda = selectedStore || '';

    const scheduleExportData =[];
    const headers = ['UN', ...appState.fixedHeaders];
    const visibleWeeks =[];
    if (visibleDates.length > 0) { let currentWeek =[]; visibleDates.forEach(dateStr => { currentWeek.push(dateStr); if (new Date(dateStr+'T00:00:00').getDay() === 0) { visibleWeeks.push(currentWeek); currentWeek =[]; } }); if (currentWeek.length > 0) visibleWeeks.push(currentWeek); }
    visibleWeeks.forEach((weekDates) => { headers.push(...weekDates.map(dateStr => `${dayAbbreviations[new Date(dateStr + 'T00:00:00').getDay()].toUpperCase()} ${dateStr}`)); headers.push(`Total Horas`); });
    scheduleExportData.push(headers);
    dataToRender.forEach(rowData => { const row = [tienda, ...rowData.fixedData]; visibleWeeks.forEach(week => { let weeklyTotal = 0; week.forEach(dateStr => { const shift = rowData.dailyData[dateStr] || { name: '', hours: 0 }; row.push(shift.name); weeklyTotal += Number(shift.hours || 0); }); row.push(weeklyTotal); }); scheduleExportData.push(row); });
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(scheduleExportData), "Horario");

    const summaryData =[]; const daysOfWeekLong =['DOMINGO', 'LUNES', 'MARTES', 'MIÉRCOLES', 'JUEVES', 'VIERNES', 'SÁBADO'];
    const summaryHeaders =[ 'UN', 'TRABAJADOR', 'PASILLO', 'APERTURAS (A)', 'CIERRES (C)', 'INTERMEDIOS (i)', 'NOCTURNOS (N)', 'COMP', 'LBRE', 'VC', 'OTROS/INC', ...daysOfWeekLong.map(d => `DESCANSO ${d}`) ];
    summaryData.push(summaryHeaders);
    dataToRender.forEach(worker => {
        const counts = { A: 0, C: 0, i: 0, N: 0, COMP: 0, LBRE: 0, VC: 0, OTROS: 0 }; const restsByDay =[0, 0, 0, 0, 0, 0, 0];
        visibleDates.forEach(dateStr => {
            const shift = worker.dailyData[dateStr]; if (!shift) return;
            const name = shift.name; const isNonWorking =['COMP', 'LBRE', 'VC', 'LIC', 'INC', 'DF', 'CAP'].includes(name);
            if (name === 'COMP') { counts.COMP++; restsByDay[new Date(dateStr + 'T00:00:00').getDay()]++; } else if (name === 'LBRE') { counts.LBRE++; restsByDay[new Date(dateStr + 'T00:00:00').getDay()]++; } else if (name === 'VC') { counts.VC++; } else if (['LIC', 'INC', 'DF', 'CAP'].includes(name)) { counts.OTROS++; } else if (!isNonWorking) { if (name.includes('A')) counts.A++; else if (name.includes('C')) counts.C++; else if (name.includes('i')) counts.i++; else if (name.includes('N')) counts.N++; else if (name !== '0SP') counts.OTROS++; }
        });
        summaryData.push([ tienda, worker.fixedData[0], worker.fixedData[1], counts.A, counts.C, counts.i, counts.N, counts.COMP, counts.LBRE, counts.VC, counts.OTROS, ...restsByDay ]);
    });
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(summaryData), "Resumen Equidad");
    XLSX.writeFile(wb, 'Horario_KRONOMERCADO_Analisis.xlsx');
}

// == MOTOR DE POSICIONES Y SUGERENCIAS ==
function getDNADates(effectiveDateStr) {
    if (effectiveDateStr) {
        const before = appState.dateHeaders.filter(d => d < effectiveDateStr);
        return before.length >= 4 ? before.slice(-4) : before;
    }
    return appState.dateHeaders.slice(-4);
}

// ── ADN de turnos (continuidad de horarios) ─────────────────────────────────
// Clasifica el tipo de turno de una persona en la ventana ADN (4 días previos
// a la fecha efectiva): 'N' = noches, 'ACI' = apertura/cierre/intermedio,
// null = sin turnos de trabajo en la ventana (vacaciones, licencias, etc.)
function getShiftDNAType(worker, effectiveDateStr) {
    const dates = getDNADates(effectiveDateStr);
    let nCount = 0, aciCount = 0;
    dates.forEach(d => {
        const name = worker.dailyData[d]?.name || '';
        if (/^\d+(?:\.\d+)?[NI]/.test(name)) nCount++;
        else if (/^\d+(?:\.\d+)?(A|i|C)/.test(name)) aciCount++;
    });
    if (nCount === 0 && aciCount === 0) return null;
    return nCount >= aciCount ? 'N' : 'ACI';
}

// Regla DURA de ADN: los de turno N solo pueden rotar entre sí; los de turno
// A/C/i pueden rotar entre ellos. null (sin datos en la ventana) es comodín.
function dnaCompatible(wA, wB, effectiveDateStr) {
    const tA = getShiftDNAType(wA, effectiveDateStr);
    const tB = getShiftDNAType(wB, effectiveDateStr);
    if (tA === null || tB === null) return true;
    return tA === tB;
}

// PRIORIDAD Nº1 DEL ADN: ¿tiene turno LBRE el domingo anterior a la fecha
// efectiva (lunes)? Estas personas rotan de primero y se emparejan
// preferiblemente entre ellas — transición perfecta: libres el domingo y
// arrancan el horario nuevo el lunes. De esta regla se derivan las demás
// reglas del ADN (N solo con N; A/C/i entre ellos).
function hasSundayFree(worker, effectiveDateStr) {
    if (!effectiveDateStr) return false;
    const d = new Date(effectiveDateStr + 'T00:00:00');
    d.setDate(d.getDate() - 1);
    const pad = n => String(n).padStart(2, '0');
    const sunday = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    const shift = worker.dailyData[sunday];
    if (!shift) return false;
    return shift.name === 'LBRE';
}

function generateDNABlocksHTML(seat, effectiveDateStr) {
    if (appState.dateHeaders.length === 0) return '';
    const dates = getDNADates(effectiveDateStr);
    const label = effectiveDateStr ? `4 turnos previos al ${effectiveDateStr}` : 'Últimos 4 turnos (ADN)';
    let html = `<div class="dna-container" title="${label}">`;
    dates.forEach(d => {
        const shift = seat.dailyData[d];
        const shiftName = shift ? shift.name : '';
        html += `<span class="dna-block ${shift ? shift.className : ''}" title="${d}: ${shiftName}">${shiftName.substring(0,1)}</span>`;
    });
    html += '</div>';
    return html;
}

function getAisleDiffColor(aisle) {
    const diff = appState.aisleDifficulties[aisle] || '';
    if (diff === 'Alto') return '#c62828';
    if (diff === 'Medio')   return '#FFFF00';
    if (diff === 'Bajo')   return '#2e7d32';
    return '#546e7a';
}

function getAisleBadgeTextColor(aisle) {
    const diff = appState.aisleDifficulties[aisle] || '';
    return diff === 'Medio' ? '#333' : '#fff';
}

function getAisleDiffScore(aisle) {
    const diff = appState.aisleDifficulties[aisle] || '';
    if (diff === 'Alto') return 3;
    if (diff === 'Medio')   return 2;
    if (diff === 'Bajo')   return 1;
    return 0;
}

function getAisleTrackHTML(seat, pendingSwap) {
    const cycle = getWorkerAisleCycle(seat);
    const currentAisle = seat.fixedData[1] || '';
    const prevAisle = cycle.length >= 2 ? cycle[cycle.length - 2] : null;
    let nextAisle = null;
    if (pendingSwap) {
        nextAisle = pendingSwap.idA === seat.id ? pendingSwap.aisleB : pendingSwap.aisleA;
    }
    function sq(aisle, label) {
        const color = aisle ? getAisleDiffColor(aisle) : '#e0e0e0';
        const border = aisle ? 'rgba(0,0,0,0.25)' : '#ccc';
        const title = `${label}: ${aisle || '—'}`;
        return `<span style="width:16px;height:16px;border-radius:3px;background:${color};border:1px solid ${border};display:inline-block;flex-shrink:0;" title="${title}"></span>`;
    }
    return `<div style="display:inline-flex;gap:2px;align-items:center;" title="Antes → Ahora → Después del cambio">${sq(prevAisle,'Antes')}${sq(currentAisle,'Ahora')}${sq(nextAisle,'Después')}</div>`;
}

function getRotationSuggestion(seatId, effectiveDateStr) {
    if (appState.lockedPersons.has(parseInt(seatId))) return null;

    const currentSeat = appState.processedData.find(w => w.id === parseInt(seatId));
    if (!currentSeat) return null;

    const currentAisle = currentSeat.fixedData[1] || 'Sin Pasillo';
    if (appState.lockedAisles.has(currentAisle)) return null;

    const currentDiff = appState.aisleDifficulties[currentAisle] || 'Medio';

    // Historia de pasillos del trabajador (Ciclo Krebs)
    const cycle = getWorkerAisleCycle(currentSeat);

    // Últimos 3 pasillos físicos visitados (incl. actual) → no repetir hasta el 4º ciclo
    const recentAisleSet = new Set(cycle.slice(-3));

    // ── Niveles válidos según regla de sumas acumuladas ───────────────────────
    // Ventana [penúltimo, actual, PRÓXIMO]: suma total ∈ [4,7]
    // getValidDiffsForWorker calcula exactamente cuáles niveles son válidos para PRÓXIMO.
    const allDiffs = ['Alto', 'Medio', 'Bajo'];
    let targetPriority = getValidDiffsForWorker(currentSeat);

    // Ordenar: dentro de los niveles válidos, preferir el que sigue el ciclo D→M→S
    if (targetPriority.length >= 2) {
        const cycleOrder = { 'Alto': 0, 'Medio': 1, 'Bajo': 2 };
        const nextInCycle = allDiffs[((cycleOrder[currentDiff] ?? 1) + 1) % 3];
        if (targetPriority.includes(nextInCycle)) {
            targetPriority = [nextInCycle, ...targetPriority.filter(d => d !== nextInCycle)];
        }
    }

    const dnaDates = getDNADates(effectiveDateStr);
    const workerSubgroup = getAisleSubgroup(currentAisle);
    const subgroupAisles = workerSubgroup ? new Set(Object.values(workerSubgroup.aisles)) : null;

    // excludeRecent:    evita pasillos en últimos 3 ciclos
    // subgroupOnly:     restringe candidatos al mismo subgrupo
    // preferNoMyColor:  en cruce inter-subgrupo, prefiere SG que NO tenga el color del trabajador
    //                   (ej: un Difícil busca en SGs sin pasillo Difícil → "hueco disponible")
    function findBest(excludeRecent, subgroupOnly, preferNoMyColor = false) {
        for (const targetDiff of targetPriority) {
            let bestCandidate = null;
            let bestScore = -1;

            appState.processedData.forEach(candidate => {
                if (candidate.id === currentSeat.id) return;
                if (candidate.isPlaceholder) return;
                if (appState.lockedPersons.has(candidate.id)) return;
                const candidateAisle = candidate.fixedData[1] || 'Sin Pasillo';
                if (appState.lockedAisles.has(candidateAisle)) return;
                if (candidateAisle === currentAisle) return;
                if (appState.swappedSeats.has(candidate.id)) return;
                // ADN duro: N solo con N; A/C/i entre ellos (continuidad de horarios)
                if (!dnaCompatible(currentSeat, candidate, effectiveDateStr)) return;
                if ((appState.aisleDifficulties[candidateAisle] || 'Medio') !== targetDiff) return;
                // Bloqueo duro: Difícil → Difícil prohibido
                if (currentDiff === 'Alto' && (appState.aisleDifficulties[candidateAisle] || '') === 'Alto') return;
                // Bloqueo duro: historial últimos 3 ciclos (ambas direcciones)
                if (recentAisleSet.has(candidateAisle)) return;
                if (getPersonBlockedAisles(candidate).has(currentAisle)) return;
                if (subgroupOnly && subgroupAisles && !subgroupAisles.has(candidateAisle)) return;
                // Inter-subgrupo: omitir candidatos cuyo SG ya tiene el mismo color del trabajador
                if (preferNoMyColor && !subgroupOnly) {
                    const candidateSG = getAisleSubgroup(candidateAisle);
                    if (candidateSG && Object.keys(candidateSG.aisles).includes(currentDiff)) return;
                }

                // ADN: compatibilidad de turnos (desempate)
                let score = 0;
                // Prioridad Nº1: ambos con LBRE el domingo → emparejamiento ideal
                if (hasSundayFree(currentSeat, effectiveDateStr) && hasSundayFree(candidate, effectiveDateStr)) score += 100;
                dnaDates.forEach(date => {
                    if (candidate.dailyData[date]?.name === currentSeat.dailyData[date]?.name) score += 2;
                    else if (candidate.dailyData[date]?.isCoverageShift === currentSeat.dailyData[date]?.isCoverageShift) score += 1;
                });
                if (score > bestScore) { bestScore = score; bestCandidate = candidate; }
            });

            if (bestCandidate) return bestCandidate;
        }
        return null;
    }

    // Orden de preferencia (6 pasadas):
    // 1. Mismo SG + pasillo fresco
    // 2. Mismo SG + cualquier pasillo
    // 3. Otro SG sin mi color + pasillo fresco  (evita "robar" pareja de otro SG)
    // 4. Otro SG sin mi color + cualquier pasillo
    // 5. Cualquier SG + pasillo fresco           (último recurso — no hay SG sin mi color)
    // 6. Cualquier SG + cualquier pasillo
    return findBest(true, true)
        || findBest(false, true)
        || findBest(true, false, true)
        || findBest(false, false, true)
        || findBest(true, false)
        || findBest(false, false);
}

function executeSwap(seatIdA, seatIdB) {
    const seatA = appState.processedData.find(w => w.id === parseInt(seatIdA));
    const seatB = appState.processedData.find(w => w.id === parseInt(seatIdB));
    if (!seatA || !seatB) return;

    appState.pendingSwaps.push({
        idA: seatA.id, idB: seatB.id,
        nameA: seatA.fixedData[0], nameB: seatB.fixedData[0],
        aisleA: seatA.fixedData[1], aisleB: seatB.fixedData[1]
    });
    appState.swappedSeats.add(seatA.id);
    appState.swappedSeats.add(seatB.id);

    saveAppState();
    renderStaffDistribution();
    showToast(`🔄 Rotación agregada: ${seatA.fixedData[0]} ↔ ${seatB.fixedData[0]}. ${appState.pendingSwaps.length} pendiente(s).`, 'success');
}

function autoRotateAll() {
    const effDate = appState.rotationEffectiveDate;
    if (!effDate) { showToast('Defina primero la fecha de inicio del ciclo.', 'error'); return; }

    formSubgroups();

    function krebsScore(w) {
        return getWorkerAisleCycle(w).reduce((s, ai) => s + getAisleDiffScore(ai), 0);
    }
    function isAvailable(w) {
        return !appState.lockedPersons.has(w.id)
            && !appState.swappedSeats.has(w.id)
            && !appState.lockedAisles.has(w.fixedData[1] || '');
    }
    function queueSwap(wA, wB) {
        appState.pendingSwaps.push({
            idA: wA.id, idB: wB.id,
            nameA: wA.fixedData[0], nameB: wB.fixedData[0],
            aisleA: wA.fixedData[1], aisleB: wB.fixedData[1]
        });
        appState.swappedSeats.add(wA.id);
        appState.swappedSeats.add(wB.id);
    }

    // ADN: compatibilidad de turnos entre dos personas (mismo criterio que getRotationSuggestion)
    const dnaDates = getDNADates(effDate);
    function dnaScore(wA, wB) {
        let score = 0;
        // Prioridad Nº1: ambos con LBRE el domingo → emparejamiento ideal
        if (hasSundayFree(wA, effDate) && hasSundayFree(wB, effDate)) score += 100;
        dnaDates.forEach(date => {
            if (wA.dailyData[date]?.name === wB.dailyData[date]?.name) score += 2;
            else if (wA.dailyData[date]?.isCoverageShift === wB.dailyData[date]?.isCoverageShift) score += 1;
        });
        return score;
    }

    // Reglas DURAS para mover a `worker` hacia `targetAisle` (nunca se relajan):
    // Difícil→Difícil prohibido; no volver a los últimos `memoryN` pasillos del ciclo.
    function canMoveTo(worker, targetAisle, memoryN) {
        if (!targetAisle) return false;
        const curAisle = worker.fixedData[1] || '';
        if (targetAisle === curAisle) return false;
        if (appState.lockedAisles.has(targetAisle)) return false;
        const curDiff = appState.aisleDifficulties[curAisle] || '';
        const tgtDiff = appState.aisleDifficulties[targetAisle] || '';
        if (curDiff === 'Alto' && tgtDiff === 'Alto') return false;
        return !new Set(getWorkerAisleCycle(worker).slice(-memoryN)).has(targetAisle);
    }
    function hardOk(wA, wB, memoryN) {
        return canMoveTo(wA, wB.fixedData[1] || '', memoryN)
            && canMoveTo(wB, wA.fixedData[1] || '', memoryN);
    }
    // Regla de secuencia [4,7] verificada en AMBAS direcciones del intercambio
    function seqOk(wA, wB) {
        const diffA = appState.aisleDifficulties[wA.fixedData[1] || ''] || 'Medio';
        const diffB = appState.aisleDifficulties[wB.fixedData[1] || ''] || 'Medio';
        return getValidDiffsForWorker(wA).includes(diffB)
            && getValidDiffsForWorker(wB).includes(diffA);
    }

    let rotated = 0;
    let pendingManual = [];

    // Prioridad de procesamiento: PRIMERO quienes tienen el domingo libre antes
    // del ciclo (transición limpia al lunes efectivo); luego por carga acumulada.
    function rotOrder(a, b) {
        const sfA = hasSundayFree(a, effDate) ? 0 : 1;
        const sfB = hasSundayFree(b, effDate) ? 0 : 1;
        if (sfA !== sfB) return sfA - sfB;
        return krebsScore(b) - krebsScore(a);
    }

    // ── PASADA 1: emparejamiento balanceado dentro de cada subgrupo ───────────
    // Orden de proceso: D primero (alternando M/S destino), luego M↔S sobrantes.
    // Los niveles válidos se determinan por la regla de sumas acumuladas [4,7].
    appState.subgroups.forEach(sg => {
        function sgPool(diff) {
            const aisle = sg.aisles[diff];
            if (!aisle) return [];
            return appState.processedData
                .filter(w => w.fixedData[1] === aisle && isAvailable(w))
                .sort(rotOrder);
        }

        const dPool = sgPool('Alto');
        const mPool = sgPool('Medio');
        const sPool = sgPool('Bajo');

        // Paso A: D workers — alternando M y S para cubrir los 3 pares del SG.
        // Si el candidato preferido no pasa canSwap se prueba el siguiente del pool
        // (antes se descartaba el par completo y el trabajador quedaba sin rotar).
        let preferM = true;
        dPool.forEach(dWorker => {
            const validDiffs = getValidDiffsForWorker(dWorker);
            const canM = validDiffs.includes('Medio');
            const canS = validDiffs.includes('Bajo');
            let candidates = [];

            if (canM && canS) {
                candidates = preferM ? [...mPool, ...sPool] : [...sPool, ...mPool];
                preferM = !preferM;
            } else if (canM) {
                candidates = [...mPool];
            } else if (canS) {
                candidates = [...sPool];
            }

            const partner = candidates.find(c => isAvailable(c)
                && dnaCompatible(dWorker, c, effDate)
                && canSwap(dWorker, c));
            if (partner) {
                const pool = mPool.includes(partner) ? mPool : sPool;
                pool.splice(pool.indexOf(partner), 1);
                queueSwap(dWorker, partner); rotated++;
            }
        });

        // Paso B: M y S sobrantes — emparejar si al menos uno puede ir al nivel del otro.
        // Se prueban todas las combinaciones M×S (antes solo cabeza a cabeza: si un
        // par fallaba canSwap, ambos quedaban descartados sin reintento).
        mPool.forEach(mW => {
            if (!isAvailable(mW)) return;
            const mValid = getValidDiffsForWorker(mW);
            const sIdx = sPool.findIndex(sW => isAvailable(sW)
                && dnaCompatible(mW, sW, effDate)
                && (mValid.includes('Bajo') || getValidDiffsForWorker(sW).includes('Medio'))
                && canSwap(mW, sW));
            if (sIdx !== -1) {
                const sW = sPool.splice(sIdx, 1)[0];
                queueSwap(mW, sW); rotated++;
            }
        });
    });

    // ── PASADA 2: trabajadores sin par en su SG → cruce inter-subgrupo ────────
    // Preferencia: SG que no tenga el mismo color (ver getRotationSuggestion pasadas 3-4)
    const unmatched = appState.processedData.filter(w => !w.isPlaceholder && isAvailable(w))
        .sort(rotOrder);

    unmatched.forEach(worker => {
        if (!isAvailable(worker)) return;
        const suggestion = getRotationSuggestion(worker.id, effDate);
        if (!suggestion || !isAvailable(suggestion)) return; // las pasadas 3-4 lo resuelven
        queueSwap(worker, suggestion);
        rotated++;
    });

    // ── PASADA 3: GARANTÍA DE ROTACIÓN TOTAL — emparejar a todos los restantes ─
    // Niveles de relajación progresiva. Las reglas duras NUNCA se relajan:
    // Difícil→Difícil prohibido, no quedarse en el pasillo actual y ADN
    // (N solo con N; A/C/i entre ellos). El puntaje ADN desempata siempre.
    //   Nivel 1: secuencia [4,7] en ambas direcciones + memoria de 3 pasillos
    //   Nivel 2: sin regla de secuencia, memoria de 3 pasillos
    //   Nivel 3: sin secuencia, memoria de 1 (solo se prohíbe el pasillo actual)
    let relaxedSwaps = 0;
    const relaxLevels = [
        { seq: true,  memory: 3 },
        { seq: false, memory: 3 },
        { seq: false, memory: 1 }
    ];
    relaxLevels.forEach((lvl, li) => {
        let pool = appState.processedData.filter(w => !w.isPlaceholder && isAvailable(w))
            .sort(rotOrder);
        while (pool.length >= 2) {
            const worker = pool.shift();
            let best = null, bestDna = -1;
            pool.forEach(cand => {
                if (!dnaCompatible(worker, cand, effDate)) return; // ADN: nunca se relaja
                if (!hardOk(worker, cand, lvl.memory)) return;
                if (lvl.seq && !seqOk(worker, cand)) return;
                const s = dnaScore(worker, cand);
                if (s > bestDna) { bestDna = s; best = cand; }
            });
            if (best) {
                pool = pool.filter(w => w.id !== best.id);
                queueSwap(worker, best);
                rotated++;
                if (li > 0) relaxedSwaps++;
            }
        }
    });

    // ── PASADA 4: persona impar → rotación triangular A→B→C ──────────────────
    // Los intercambios son de a pares, así que con número impar siempre sobraría
    // alguien. Se le inserta en un swap ya encolado agregando un segundo swap:
    // applyPendingSwaps aplica en orden, y dos swaps encadenados (A↔B, luego B↔L)
    // producen la rotación triangular: A→pasillo B, B→pasillo L, L→pasillo A.
    const baseSwaps = appState.pendingSwaps.slice();
    const usedChains = new Set();
    appState.processedData.filter(w => !w.isPlaceholder && isAvailable(w)).forEach(loner => {
        const aisleL = loner.fixedData[1] || '';
        let bestInsert = null, bestDna = -1;
        [3, 1].forEach(memoryN => {
            if (bestInsert) return; // preferir la memoria estricta de 3 ciclos
            baseSwaps.forEach(swap => {
                if (usedChains.has(swap)) return;
                const wA = appState.processedData.find(w => w.id === swap.idA);
                const wB = appState.processedData.find(w => w.id === swap.idB);
                if (!wA || !wB) return;
                // ADN duro: en el triángulo los horarios rotan entre los TRES,
                // así que el impar debe ser compatible con ambos miembros.
                if (!dnaCompatible(loner, wA, effDate) || !dnaCompatible(loner, wB, effDate)) return;
                // Variante 1: encolar (B,L) → B va al pasillo de L, L al pasillo de A
                if (canMoveTo(wB, aisleL, memoryN) && canMoveTo(loner, swap.aisleA, memoryN)) {
                    const s = dnaScore(loner, wB);
                    if (s > bestDna) { bestDna = s; bestInsert = { anchor: wB, chain: swap }; }
                }
                // Variante 2: encolar (A,L) → A va al pasillo de L, L al pasillo de B
                if (canMoveTo(wA, aisleL, memoryN) && canMoveTo(loner, swap.aisleB, memoryN)) {
                    const s = dnaScore(loner, wA);
                    if (s > bestDna) { bestDna = s; bestInsert = { anchor: wA, chain: swap }; }
                }
            });
        });
        if (bestInsert) {
            usedChains.add(bestInsert.chain);
            queueSwap(bestInsert.anchor, loner);
            rotated++;
        } else {
            pendingManual.push(loner);
        }
    });

    saveAppState();
    renderStaffDistribution();

    const manualMsg = pendingManual.length > 0
        ? ` ${pendingManual.length} sin candidato → rotación manual recomendada.`
        : '';
    if (rotated > 0) {
        showToast(`✅ Auto-rotación: ${rotated} intercambio(s).${manualMsg}`, 'success');
    } else {
        showToast(`⚠️ Ningún intercambio posible automáticamente.${manualMsg}`, 'warning');
    }
    if (relaxedSwaps > 0) {
        setTimeout(() => showToast(`ℹ️ ${relaxedSwaps} intercambio(s) relajaron la regla de secuencia para garantizar rotación total (reglas duras intactas).`, 'info'), 400);
    }
    if (pendingManual.length > 0) {
        const names = pendingManual.map(w => w.fixedData[0]).join(', ');
        setTimeout(() => showToast(`🖐 Rotación manual requerida: ${names}`, 'warning'), 800);
    }
}

function reapplyWorkerVacation(worker) {
    const master = appState.workerMasterData.find(m => m.id === worker.id);
    const inicia = master?.inicia || '';
    const finaliza = master?.finaliza || '';
    appState.dateHeaders.forEach(dateStr => {
        const baseShiftName = worker.baseShifts?.[dateStr] || '';
        const baseShift = allShifts[baseShiftName] || { name: baseShiftName, hours: 0, className: 'turno-OTRO', isCoverageShift: false };
        const currentAisle = worker.dailyData[dateStr]?.aisle || worker.fixedData[1];
        const inVacation = inicia && finaliza && dateStr >= inicia && dateStr <= finaliza;
        worker.dailyData[dateStr] = inVacation
            ? { ...allShifts['VC'], aisle: currentAisle }
            : { ...baseShift, aisle: currentAisle };
    });
    applyLegalHours();
}

function applyPendingSwaps(effectiveDateStr) {
    if (appState.pendingSwaps.length === 0) { showToast('No hay rotaciones pendientes.', 'warning'); return; }
    const affectedWorkerIds = new Set();
    appState.pendingSwaps.forEach(swap => {
        const seatA = appState.processedData.find(w => w.id === swap.idA);
        const seatB = appState.processedData.find(w => w.id === swap.idB);
        if (!seatA || !seatB) return;
        appState.dateHeaders.forEach(date => {
            if (date >= effectiveDateStr) {
                // Solo intercambiar baseShifts (turnos base sin VC) — las VC se reaplican después
                if (seatA.baseShifts && seatB.baseShifts) {
                    const tempBase = seatA.baseShifts[date];
                    seatA.baseShifts[date] = seatB.baseShifts[date];
                    seatB.baseShifts[date] = tempBase;
                }
                // Intercambiar el aisle en dailyData (la persona "lleva" el pasillo del destino)
                const aisleA = seatA.dailyData[date]?.aisle || seatA.fixedData[1];
                const aisleB = seatB.dailyData[date]?.aisle || seatB.fixedData[1];
                if (seatA.dailyData[date]) seatA.dailyData[date] = { ...seatA.dailyData[date], aisle: aisleB };
                if (seatB.dailyData[date]) seatB.dailyData[date] = { ...seatB.dailyData[date], aisle: aisleA };
            }
        });
        const lastDate = appState.dateHeaders[appState.dateHeaders.length - 1];
        seatA.fixedData[1] = seatA.dailyData[lastDate]?.aisle || seatA.fixedData[1];
        seatB.fixedData[1] = seatB.dailyData[lastDate]?.aisle || seatB.fixedData[1];
        const masterA = appState.workerMasterData.find(m => m.id === seatA.id);
        const masterB = appState.workerMasterData.find(m => m.id === seatB.id);
        if (masterA) masterA.pasillo = seatA.fixedData[1];
        if (masterB) masterB.pasillo = seatB.fixedData[1];
        affectedWorkerIds.add(seatA.id);
        affectedWorkerIds.add(seatB.id);
    });
    // Re-aplicar los turnos reales y vacaciones propias de cada persona afectada
    affectedWorkerIds.forEach(id => {
        const worker = appState.processedData.find(w => w.id === id);
        if (worker) reapplyWorkerVacation(worker);
    });
    const count = appState.pendingSwaps.length;
    appState.pendingSwaps = [];
    appState.swappedSeats.clear();
    appState.rotationEffectiveDate = null;
    saveAppState();
    renderAll();
    renderStaffDistribution();
    showToast(`✅ ${count} rotación(es) aplicadas desde ${effectiveDateStr}. Define una nueva fecha para el siguiente ciclo.`, 'success');
    setTimeout(() => {
        const scrollEl = document.querySelector('.output-container');
        if (scrollEl) handleAisleScroll(scrollEl);
    }, 100);
}

function renderStaffDistribution() {
    const container = document.getElementById('staffDistributionContainer');
    if (!container) return;

    // Preservar scroll si el módulo ya está visible
    const wasVisible = container.style.display !== 'none';
    const mainContent = document.querySelector('.main-content');
    const savedScroll = mainContent ? mainContent.scrollTop : window.scrollY;

    // Recalcular subgrupos con el estado actual de pasillos/dificultades
    if (appState.processedData.length > 0) formSubgroups();

    const aislesMap = {};
    appState.processedData.filter(w => !w.isPlaceholder).forEach(w => {
        const aisle = w.fixedData[1] || 'Sin Pasillo';
        if (!aislesMap[aisle]) aislesMap[aisle] = [];
        aislesMap[aisle].push(w);
    });

    const diffOrder = { 'Alto': 0, 'Medio': 1, 'Bajo': 2 };

    // Agrupar pasillos por subgrupo para que queden juntos en la vista
    const aisleSgMap = {};
    appState.subgroups.forEach((sg, sgIdx) => {
        Object.values(sg.aisles).forEach(aisle => {
            if (!(aisle in aisleSgMap)) aisleSgMap[aisle] = sgIdx;
        });
    });
    const sortedAisles = Object.keys(aislesMap).sort((a, b) => {
        const sgA = aisleSgMap[a] ?? 999;
        const sgB = aisleSgMap[b] ?? 999;
        if (sgA !== sgB) return sgA - sgB;
        const da = diffOrder[appState.aisleDifficulties[a]] ?? 3;
        const db = diffOrder[appState.aisleDifficulties[b]] ?? 3;
        return da !== db ? da - db : a.localeCompare(b);
    });

    const minDate = appState.dateHeaders[0] || '';
    const maxDate = appState.dateHeaders[appState.dateHeaders.length - 1] || '';
    const pendingCount = appState.pendingSwaps.length;

    const effDate = appState.rotationEffectiveDate;

    // Panel 1: Fecha de ciclo (OBLIGATORIA, siempre visible primero)
    const datePanelHTML = effDate
        ? `<div style="background:#e8f5e9; border:2px solid #43a047; border-radius:6px; padding:12px 15px; margin-bottom:14px; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px;">
            <div>
                <b style="color:#1b5e20;">📅 Ciclo activo desde el lunes: <span style="font-size:1.1em;">${effDate}</span></b>
                <div style="font-size:0.85em; color:#388e3c; margin-top:3px;">El ADN y las sugerencias se calculan con los turnos previos a esta fecha.</div>
            </div>
            <button id="clearRotationDateBtn" class="btn-danger" style="padding:6px 14px; font-size:0.9em;">✕ Cambiar Fecha</button>
           </div>`
        : `<div style="background:#fff8e1; border:2px solid #f57c00; border-radius:6px; padding:12px 15px; margin-bottom:14px;">
            <h4 style="margin:0 0 10px 0; color:#e65100;">📅 Paso 1: Defina la fecha de inicio del ciclo de rotación</h4>
            <p style="margin:0 0 10px 0; font-size:0.9em; color:#555;">Debe ser un <b>lunes</b>. Sin esta fecha no se pueden agregar rotaciones.</p>
            <div style="display:flex; gap:10px; align-items:center; flex-wrap:wrap;">
                <input type="date" id="rotationEffectiveDateInput" style="padding:8px; border:1px solid #ccc; border-radius:4px; font-size:0.95em;" min="${minDate}" max="${maxDate}">
                <button id="setRotationDateBtn" class="btn-corporate" style="width:auto; padding:8px 16px; background:#f57c00;">Confirmar Lunes ✓</button>
            </div>
           </div>`;

    // Panel 2: Rotaciones pendientes (solo si hay fecha activa)
    let pendingPanelHTML = '';
    if (effDate) {
        if (pendingCount > 0) {
            const pendingList = appState.pendingSwaps.map(s => {
                const colorA = getAisleDiffColor(s.aisleA);
                const colorB = getAisleDiffColor(s.aisleB);
                const badgeA = `<span style="background:${colorA};color:${getAisleBadgeTextColor(s.aisleA)};padding:1px 7px;border-radius:3px;font-size:0.82em;font-weight:bold;">${s.aisleA}</span>`;
                const badgeB = `<span style="background:${colorB};color:${getAisleBadgeTextColor(s.aisleB)};padding:1px 7px;border-radius:3px;font-size:0.82em;font-weight:bold;">${s.aisleB}</span>`;
                return `<li style="padding:4px 0;">↔ <b>${s.nameA}</b> ${badgeA} &nbsp;↔&nbsp; <b>${s.nameB}</b> ${badgeB}</li>`;
            }).join('');
            const moreNote = '';
            pendingPanelHTML = `
            <div style="background:#fff3e0; border:2px solid #f57c00; border-radius:6px; padding:12px 15px; margin-bottom:14px;">
                <h4 style="margin:0 0 10px 0; color:#e65100;">⏳ Rotaciones Pendientes (${pendingCount}) — Efectivas desde ${effDate}</h4>
                <ul style="margin:0 0 12px 0; padding-left:20px; font-size:0.9em; color:#333;">${moreNote}${pendingList}</ul>
                <div style="display:flex; gap:10px; flex-wrap:wrap; border-top:1px dashed #ffcc80; padding-top:10px;">
                    <button id="autoRotateBtn" class="btn-corporate" style="width:auto; padding:8px 18px; background:#6a1b9a;">⚡ Auto-Rotar Restantes</button>
                    <button id="conformRotationBtn" class="btn-success" style="width:auto; padding:8px 18px;">✅ Confirmar y Aplicar desde ${effDate}</button>
                    <button id="cancelPendingBtn" class="btn-danger" style="padding:8px 12px;">✕ Cancelar Todo</button>
                </div>
            </div>`;
        } else {
            pendingPanelHTML = `
            <div style="background:#e8f5e9; border:1px solid #a5d6a7; border-radius:6px; padding:12px 15px; margin-bottom:14px; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px;">
                <span style="font-size:0.9em; color:#388e3c;">✅ Sin rotaciones pendientes. Haz los bloqueos y cambios manuales que necesites, luego presiona Auto-Rotar.</span>
                <button id="autoRotateBtn" class="btn-corporate" style="width:auto; padding:8px 18px; background:#6a1b9a; white-space:nowrap;">⚡ Auto-Rotar Restantes</button>
            </div>`;
        }
    }

    // ── Panel de Subgrupos ────────────────────────────────────────────────────
    function buildSubgroupPanelHTML() {
        if (appState.subgroups.length === 0) return '';
        const diffColor = { 'Alto': '#c62828', 'Medio': '#999900', 'Bajo': '#2e7d32' };
        const diffLabel = { 'Alto': '🔴', 'Medio': '🟡', 'Bajo': '🟢' };
        function aisleScore(aisle) {
            return appState.processedData
                .filter(w => (w.fixedData[1] || '') === aisle)
                .reduce((sum, w) => sum + getWorkerAisleCycle(w).reduce((s, a) => s + getAisleDiffScore(a), 0), 0);
        }
        let cards = appState.subgroups.map(sg => {
            const aisleEntries = Object.entries(sg.aisles)
                .sort((a, b) => diffOrder[a[0]] - diffOrder[b[0]]);
            const rows = aisleEntries.map(([diff, aisle]) => {
                const sc = aisleScore(aisle);
                return `<div style="display:flex;justify-content:space-between;align-items:center;padding:2px 0;">
                    <span style="color:${diffColor[diff]};font-weight:bold;font-size:0.82em;">${diffLabel[diff]} ${aisle}</span>
                    <span style="background:#e8eaf6;color:#1a237e;padding:0 6px;border-radius:8px;font-size:0.78em;font-weight:bold;">${sc}pt</span>
                </div>`;
            }).join('');
            const border = sg.isComplete ? '#43a047' : '#f57c00';
            const badge = sg.isComplete ? '<span style="color:#43a047;font-size:0.75em;font-weight:bold;">✅ COMPLETO</span>' : '<span style="color:#f57c00;font-size:0.75em;font-weight:bold;">⚠️ PARCIAL</span>';
            return `<div style="border:2px solid ${border};border-radius:6px;padding:8px 12px;min-width:170px;background:#fff;">
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;">
                    <span style="font-weight:bold;color:#1a237e;font-size:0.85em;">SG ${sg.id + 1}</span>${badge}
                </div>
                ${rows}
            </div>`;
        }).join('');
        const leftoversHTML = appState.leftoverAisles.length > 0
            ? `<div style="margin-top:8px;font-size:0.82em;color:#b71c1c;"><b>⛔ Sin subgrupo (prioridad próximo ciclo):</b> ${appState.leftoverAisles.join(', ')}</div>`
            : '';
        return `
        <details style="margin-bottom:14px;" open>
            <summary style="cursor:pointer;font-weight:bold;color:#1a237e;font-size:0.9em;padding:8px 12px;background:#e8eaf6;border-radius:6px;list-style:none;display:flex;justify-content:space-between;">
                <span>🔗 Subgrupos de Rotación (${appState.subgroups.length} subgrupos · ${appState.subgroups.filter(g=>g.isComplete).length} completos)</span>
                <span style="color:#666;font-weight:normal;font-size:0.9em;">▼ colapsar</span>
            </summary>
            <div style="padding:10px 0 0 0;">
                <div style="display:flex;flex-wrap:wrap;gap:10px;">${cards}</div>
                ${leftoversHTML}
            </div>
        </details>`;
    }

    let html = `<div style="padding: 10px; border-bottom: 2px dashed #b0bec5; margin-bottom: 15px; display: flex; justify-content: space-between; align-items: center; flex-wrap:wrap; gap:8px;">
        <h3 style="margin:0; color:#1a237e;">🧑‍🤝‍🧑 Distribución y Rotación de Posiciones</h3>
        <button onclick="document.getElementById('staffDistributionContainer').style.display='none'; document.getElementById('staffDistributionBtn')?.classList.remove('sidebar-btn--active');" class="btn-danger" style="padding:5px 15px; font-size:0.9em;">Cerrar Reporte</button>
    </div>
    ${datePanelHTML}
    ${pendingPanelHTML}
    ${buildSubgroupPanelHTML()}
    <div style="background:#e8eaf6; border:1px solid #c5cae9; border-radius:6px; padding:10px 15px; margin-bottom:18px; font-size:0.9em; color:#3949ab;">
        <b>ℹ️ Tip:</b> Desplázate horizontalmente por la programación para ver cómo cambia el <b>EQUIPO</b> de cada persona según el ciclo. El color refleja el nivel del pasillo.
    </div>
    <div style="display: flex; flex-wrap: wrap; gap: 15px;">`;

    // Calcular score máximo global para resaltar los más altos
    const allKrebsScores = appState.processedData
        .filter(w => !w.isPlaceholder)
        .map(w => getWorkerAisleCycle(w).reduce((s, a) => s + getAisleDiffScore(a), 0));
    const maxKrebsScore = allKrebsScores.length > 0 ? Math.max(...allKrebsScores) : 0;

    if(sortedAisles.length === 0) {
        html += `<p style="padding: 15px;">No hay personal cargado en el sistema aún.</p>`;
    } else {
        sortedAisles.forEach(aisle => {
            const diff = appState.aisleDifficulties[aisle] || '';
            const isAisleLocked = appState.lockedAisles.has(aisle);
            const workers = aislesMap[aisle].sort((a, b) => {
                const scoreA = getWorkerAisleCycle(a).reduce((s, ai) => s + getAisleDiffScore(ai), 0);
                const scoreB = getWorkerAisleCycle(b).reduce((s, ai) => s + getAisleDiffScore(ai), 0);
                return scoreB - scoreA || a.fixedData[0].localeCompare(b.fixedData[0]);
            });
            
            // Clase dinámica según dificultad
            let diffClass = '';
            if(diff === 'Alto') diffClass = 'card-aisle-alto';
            if(diff === 'Medio') diffClass = 'card-aisle-medio';
            if(diff === 'Bajo') diffClass = 'card-aisle-bajo';
            if(isAisleLocked) diffClass += ' card-aisle-locked';

            const sgIdx = aisleSgMap[aisle];
            const sgBadge = sgIdx !== undefined
                ? `<span style="background:#1a237e;color:#fff;padding:1px 6px;border-radius:8px;font-size:0.72em;font-weight:bold;margin-left:5px;" title="Subgrupo de rotación">SG${sgIdx+1}</span>`
                : '';

            html += `
            <div class="setup-card ${diffClass}" style="flex: 1; min-width: 300px; padding: 15px; margin-bottom: 0;">
                <h4 style="color: var(--corp-orange); margin-top: 0; border-bottom: 1px solid #eee; padding-bottom: 8px; display: flex; justify-content: space-between; align-items: center;">
                    <span>
                        <button class="btn-lock toggle-aisle-lock ${isAisleLocked ? 'locked' : ''}" data-aisle="${aisle}" title="Bloquear Pasillo">${isAisleLocked ? '🔒' : '🔓'}</button>
                        ${aisle}${sgBadge}
                    </span>
                    <select class="difficulty-select" data-aisle="${aisle}" style="width: auto; padding: 4px; font-size: 0.85em; margin-left:10px;" ${isAisleLocked ? 'disabled' : ''}>
                        <option value="" ${diff===''?'selected':''}>Nivel...</option>
                        <option value="Bajo"  ${diff==='Bajo' ?'selected':''}>🟢 Bajo</option>
                        <option value="Medio" ${diff==='Medio'?'selected':''}>🟡 Medio</option>
                        <option value="Alto"  ${diff==='Alto' ?'selected':''}>🔴 Alto</option>
                    </select>
                </h4>
                <ul style="list-style: none; padding: 0; margin: 0; max-height: 350px; overflow-y: auto;">
            `;
            
            workers.forEach(seat => {
                const isPersonLocked = appState.lockedPersons.has(seat.id);
                const pendingSwap = appState.pendingSwaps.find(s => s.idA === seat.id || s.idB === seat.id);
                const isPending = !!pendingSwap;
                const dnaHTML = generateDNABlocksHTML(seat, effDate);
                const suggestion = effDate ? getRotationSuggestion(seat.id, effDate) : null;
                const krebsScore = getWorkerAisleCycle(seat).reduce((s, a) => s + getAisleDiffScore(a), 0);
                const isTopScore = krebsScore > 0 && krebsScore === maxKrebsScore;
                const scoreBadge = krebsScore > 0
                    ? `<span style="background:${isTopScore ? '#c62828' : '#1a237e'};color:#fff;padding:0px 6px;border-radius:10px;font-size:0.75em;font-weight:bold;margin-left:4px;${isTopScore ? 'box-shadow:0 0 0 2px #ffcdd2;animation:pulse-red 1.4s ease-in-out infinite;' : ''}" title="${isTopScore ? '🔴 Prioridad de cambio — puntuación más alta' : 'Puntuación Krebs'}">${krebsScore}${isTopScore ? ' 🔴' : ''}</span>`
                    : '';

                let suggestionHtml = '';
                if (isAisleLocked || isPersonLocked) {
                    suggestionHtml = `<div style="margin-top:5px; background:#f5f5f5; padding:5px 8px; border-radius:4px; font-size:0.9em; color:#9e9e9e; text-align:center;">🔒 Bloqueado para cambios</div>`;
                } else if (!effDate) {
                    suggestionHtml = `<div style="margin-top:5px; background:#fff8e1; padding:5px 8px; border-radius:4px; font-size:0.9em; color:#e65100; text-align:center;">⚠️ Defina primero la fecha de inicio del ciclo (un lunes)</div>`;
                } else if (isPending) {
                    const partnerName = pendingSwap.idA === seat.id ? pendingSwap.nameB : pendingSwap.nameA;
                    const partnerAisle = pendingSwap.idA === seat.id ? pendingSwap.aisleB : pendingSwap.aisleA;
                    suggestionHtml = `<div style="margin-top:5px; background:#fff3e0; padding:5px 8px; border-radius:4px; font-size:0.9em; color:#e65100; font-weight:bold; display:flex; justify-content:space-between; align-items:center; gap:8px;">
                        <span>🔄 Pendiente: ↔ ${partnerName} <span style="font-weight:normal; color:#888;">(${partnerAisle})</span></span>
                        <button class="btn-danger btn-swap-undo" style="padding:3px 8px; font-size:0.82em; width:auto; white-space:nowrap;" data-seat="${seat.id}" title="Deshacer esta rotación individual">↩ Deshacer</button>
                    </div>`;
                } else {
                    suggestionHtml = `
                    <div style="margin-top:5px; background:#f0f4f8; padding:5px 8px; border-radius:4px; font-size:0.9em; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:4px;">
                        <span style="color:#1a237e;">${suggestion ? `💡 Sugerencia: <b>${suggestion.fixedData[1]}</b> (${suggestion.fixedData[0]})` : '⚠️ Sin candidatos idóneos'}</span>
                        <div style="display:flex;gap:4px;">
                            <button class="btn-corporate btn-swap-init" style="padding:4px 8px; font-size:0.9em; width:auto;" data-seat="${seat.id}" data-suggested="${suggestion ? suggestion.id : ''}" data-allow-any="false">Rotar 🔄</button>
                            ${!suggestion ? `<button class="btn-corporate btn-swap-init" style="padding:4px 8px; font-size:0.9em; width:auto; background:#f57c00;" data-seat="${seat.id}" data-suggested="" data-allow-any="true" title="Permite rotar con cualquier persona ignorando bloqueos">Libre 🔓</button>` : ''}
                            <button class="btn-corporate btn-manual-pick" style="padding:4px 8px; font-size:0.9em; width:auto; background:#37474f;" data-seat="${seat.id}" title="Elegir manualmente de la lista completa">Manual 🎯</button>
                        </div>
                    </div>`;
                }
                
                const trackHTML = getAisleTrackHTML(seat, pendingSwap || null);
                html += `
                <li style="font-size: 0.9em; padding: 10px 0; border-bottom: 1px dashed #eee;">
                    <div style="display:flex; justify-content:space-between; align-items:center;">
                        <span style="${isPersonLocked ? 'color:#999;' : ''}">
                            <button class="btn-lock toggle-person-lock ${isPersonLocked ? 'locked' : ''}" data-id="${seat.id}" title="Bloquear Persona">${isPersonLocked ? '🔒' : '🔓'}</button>
                            <b>[${seat.workerExcelId || 'Sin ID'}]</b> - ${seat.fixedData[0]}${scoreBadge}
                        </span>
                        <div style="display:inline-flex;flex-direction:column;align-items:flex-end;gap:3px;">
                            ${trackHTML}
                            ${dnaHTML}
                        </div>
                    </div>
                    ${suggestionHtml}
                </li>`;
            });
            html += `</ul></div>`;
        });
    }
    html += `</div>`;
    container.innerHTML = html;
    container.style.display = 'block';

    if (!wasVisible) {
        container.scrollIntoView({ behavior: 'smooth' });
    } else if (mainContent) {
        mainContent.scrollTop = savedScroll;
    } else {
        window.scrollTo(0, savedScroll);
    }
}

function updateWorkerVacation(workerId, newInicia, newFinaliza) {
    const worker = appState.processedData.find(w => w.id === workerId);
    if (!worker || !worker.baseShifts) return;
    appState.dateHeaders.forEach(dateStr => {
        const baseShiftName = worker.baseShifts[dateStr] || '';
        const baseShift = allShifts[baseShiftName] || { name: baseShiftName, hours: 0, className: 'turno-OTRO', isCoverageShift: false };
        const currentAisle = worker.dailyData[dateStr]?.aisle || worker.fixedData[1];
        const inVacation = newInicia && newFinaliza && dateStr >= newInicia && dateStr <= newFinaliza;
        worker.dailyData[dateStr] = inVacation ? { ...allShifts['VC'], aisle: currentAisle } : { ...baseShift, aisle: currentAisle };
    });
    applyLegalHours();
    const masterEntry = appState.workerMasterData.find(m => m.id === workerId);
    if (masterEntry) { masterEntry.inicia = newInicia; masterEntry.finaliza = newFinaliza; }
    renderAll();
    saveAppState();
    showToast('Vacaciones actualizadas en la programación.', 'success');
}

function applyWorkerNameChange(workerId, newName) {
    if (!newName) return;
    const newIsPlaceholder = isPlaceholderWorker(newName);
    const worker = appState.processedData.find(w => w.id === workerId);
    let statusChanged = false;
    if (worker) {
        worker.fixedData[0] = newName;
        if (worker.isPlaceholder !== newIsPlaceholder) { worker.isPlaceholder = newIsPlaceholder; statusChanged = true; }
    }
    const master = appState.workerMasterData.find(m => m.id === workerId);
    if (master) { master.nombre = newName; master.isPlaceholder = newIsPlaceholder; }
    // Actualizar nombres en rotaciones pendientes
    appState.pendingSwaps.forEach(swap => {
        if (swap.idA === workerId) swap.nameA = newName;
        if (swap.idB === workerId) swap.nameB = newName;
    });
    if (statusChanged) {
        populateFilters();
        renderAll();
        showToast(newIsPlaceholder
            ? `⚠️ "${newName}" es un puesto vacante — excluido de turnos y métricas.`
            : `✅ "${newName}" activado — ya forma parte de la programación.`,
            newIsPlaceholder ? 'warning' : 'success');
    }
}

function getWorkerAisleCycle(worker) {
    // Extrae los cambios de pasillo en orden cronológico desde dailyData
    const cycle = [];
    let lastAisle = null;
    appState.dateHeaders.forEach(date => {
        const aisle = worker.dailyData[date]?.aisle || worker.fixedData[1];
        if (aisle !== lastAisle) { cycle.push(aisle); lastAisle = aisle; }
    });
    return cycle;
}

function getWorkerAisleCycleWithDates(worker) {
    const cycle = [];
    let lastAisle = null;
    appState.dateHeaders.forEach(date => {
        const aisle = worker.dailyData[date]?.aisle || worker.fixedData[1];
        if (aisle !== lastAisle) { cycle.push({ aisle, date }); lastAisle = aisle; }
    });
    return cycle;
}

function formatDateShort(dateStr) {
    const meses = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];
    const [, m, d] = dateStr.split('-');
    return `${parseInt(d)} ${meses[parseInt(m) - 1]}`;
}

// Pasillos bloqueados para una persona: los últimos 3 pasillos de su ciclo (incluyendo el actual).
// Regla: (P1→P2→P1) bloquea P1 y P2 — no puede volver a ninguno hasta salir del ciclo de 3.
function getPersonBlockedAisles(worker) {
    const cycle = getWorkerAisleCycle(worker);
    return new Set(cycle.slice(-3));
}

// Verifica que el swap entre wA y wB sea válido en ambas direcciones.
// Reglas duras: (1) historial últimos 3 ciclos, (2) Difícil → Difícil prohibido.
function canSwap(wA, wB) {
    const aisleA = wA.fixedData[1] || '';
    const aisleB = wB.fixedData[1] || '';
    const diffA  = appState.aisleDifficulties[aisleA] || '';
    const diffB  = appState.aisleDifficulties[aisleB] || '';
    if (diffA === 'Alto' && diffB === 'Alto') return false;
    return !getPersonBlockedAisles(wA).has(aisleB) && !getPersonBlockedAisles(wB).has(aisleA);
}

function formSubgroups() {
    // Pasillos activos: excluir bloqueados y sin dificultad definida
    const activeAisles = [...new Set(appState.processedData.map(w => w.fixedData[1]).filter(Boolean))]
        .filter(aisle => !appState.lockedAisles.has(aisle));
    const byDiff = { 'Alto': [], 'Medio': [], 'Bajo': [] };
    activeAisles.forEach(aisle => {
        const diff = appState.aisleDifficulties[aisle] || '';
        if (byDiff[diff]) byDiff[diff].push(aisle);
    });

    // Puntaje total de cada pasillo (suma de Krebs de sus trabajadores actuales)
    function aisleScore(aisle) {
        return appState.processedData
            .filter(w => (w.fixedData[1] || '') === aisle)
            .reduce((sum, w) => sum + getWorkerAisleCycle(w).reduce((s, a) => s + getAisleDiffScore(a), 0), 0);
    }

    // Ordenar cada lista por score desc; pasillos sobrantes del ciclo anterior van primero
    const lastLeftovers = new Set(appState.leftoverAisles || []);
    ['Alto', 'Medio', 'Bajo'].forEach(diff => {
        byDiff[diff].sort((a, b) => {
            const aFirst = lastLeftovers.has(a) ? 0 : 1;
            const bFirst = lastLeftovers.has(b) ? 0 : 1;
            if (aFirst !== bFirst) return aFirst - bFirst;
            return aisleScore(b) - aisleScore(a);
        });
    });

    const subgroups = [];
    const usedAisles = new Set();

    // Paso 1: formar triplets completos D+M+S por rango de score
    const tripletCount = Math.min(byDiff['Alto'].length, byDiff['Medio'].length, byDiff['Bajo'].length);
    for (let i = 0; i < tripletCount; i++) {
        const sg = {
            id: subgroups.length,
            aisles: { 'Alto': byDiff['Alto'][i], 'Medio': byDiff['Medio'][i], 'Bajo': byDiff['Bajo'][i] },
            isComplete: true
        };
        subgroups.push(sg);
        Object.values(sg.aisles).forEach(a => usedAisles.add(a));
    }

    // Paso 2: intentar emparejar sobrantes en subgrupos incompletos (par de 2 diferentes)
    const remaining = activeAisles
        .filter(a => !usedAisles.has(a) && byDiff[appState.aisleDifficulties[a] || ''])
        .map(a => ({ aisle: a, diff: appState.aisleDifficulties[a] || '' }))
        .filter(x => x.diff !== '');

    const usedInIncomplete = new Set();
    let changed = true;
    while (changed) {
        changed = false;
        const avail = remaining.filter(x => !usedInIncomplete.has(x.aisle));
        for (let i = 0; i < avail.length && !changed; i++) {
            for (let j = i + 1; j < avail.length && !changed; j++) {
                if (avail[i].diff !== avail[j].diff) {
                    const sg = { id: subgroups.length, aisles: {}, isComplete: false };
                    sg.aisles[avail[i].diff] = avail[i].aisle;
                    sg.aisles[avail[j].diff] = avail[j].aisle;
                    subgroups.push(sg);
                    usedInIncomplete.add(avail[i].aisle);
                    usedInIncomplete.add(avail[j].aisle);
                    changed = true;
                }
            }
        }
    }

    // Paso 3: pasillos que no cupieron en ningún subgrupo → leftoverAisles para el próximo ciclo
    const newLeftovers = remaining.filter(x => !usedInIncomplete.has(x.aisle)).map(x => x.aisle);

    appState.subgroups = subgroups;
    appState.leftoverAisles = newLeftovers;
    return { subgroups, leftoverAisles: newLeftovers };
}

// Devuelve el subgrupo al que pertenece un pasillo, o null
function getAisleSubgroup(aisle) {
    return appState.subgroups.find(g => Object.values(g.aisles).includes(aisle)) || null;
}

// Calcula los niveles de dificultad válidos para la PRÓXIMA rotación de un trabajador
// basado en la regla de sumas acumuladas de las 3 últimas rotaciones:
//   Posición 1 (más antiguo del trío)  → suma ≤ 3  (siempre se cumple)
//   Posición 1+2                        → suma ∈ [3, 5]
//   Posición 1+2+3 (incluye el PRÓXIMO) → suma ∈ [4, 7]
//
// Dado A = score del penúltimo ciclo, B = score del último (actual),
// el próximo C debe estar en [max(1, 4−(A+B)), min(3, 7−(A+B))].
function getValidDiffsForWorker(worker) {
    const allDiffs = ['Alto', 'Medio', 'Bajo'];
    const scoreToLevel = { 1: 'Bajo', 2: 'Medio', 3: 'Alto' };
    const currentAisle = worker.fixedData[1] || '';
    const currentDiff  = appState.aisleDifficulties[currentAisle] || '';

    const cycle = getWorkerAisleCycle(worker);

    // Sin historial suficiente (< 2 entradas): solo evitar repetir nivel actual
    if (cycle.length < 2) {
        return allDiffs.filter(d => d !== currentDiff);
    }

    const aisleB = cycle[cycle.length - 1]; // ciclo actual
    const aisleA = cycle[cycle.length - 2]; // penúltimo
    const scoreB = getAisleDiffScore(aisleB);
    const scoreA = getAisleDiffScore(aisleA);

    // Si alguno no tiene dificultad asignada, volver a regla simple
    if (scoreA === 0 || scoreB === 0) {
        return allDiffs.filter(d => d !== currentDiff);
    }

    const sumAB = scoreA + scoreB;
    const minC  = Math.max(1, 4 - sumAB);
    const maxC  = Math.min(3, 7 - sumAB);

    if (minC > maxC) {
        // Historial fuera de rango (caso extremo): solo evitar nivel actual
        return allDiffs.filter(d => d !== currentDiff);
    }

    const valid = [];
    for (let c = minC; c <= maxC; c++) {
        if (scoreToLevel[c] && scoreToLevel[c] !== currentDiff) valid.push(scoreToLevel[c]);
    }
    return valid.length > 0 ? valid : allDiffs.filter(d => d !== currentDiff);
}

function renderPlantManager() {
    const container = document.getElementById('plantManagerContainer');
    if (!container) return;
    if (appState.workerMasterData.length === 0) {
        container.innerHTML = '<div style="padding:20px;"><p style="color:#c62828;">No hay datos de planta cargados. Cargue el archivo Excel primero.</p></div>';
        container.style.display = 'block';
        return;
    }
    const allAisles = [...new Set(appState.workerMasterData.map(m => m.pasillo).filter(Boolean))].sort();

    const todayPM = new Date(); todayPM.setHours(0, 0, 0, 0);
    const isOnVacation = m => {
        if (!m.inicia || !m.finaliza) return false;
        const s = new Date(m.inicia + 'T00:00:00'), e = new Date(m.finaliza + 'T00:00:00');
        return todayPM >= s && todayPM <= e;
    };

    const equipoStyleMap = {
        '':    { bg: '#e8f5e9', color: '#2e7d32', border: '#2e7d32', label: '🟢 LIBRE' },
        'R':   { bg: '#fff8e1', color: '#f57f17', border: '#f57f17', label: '🟡 R' },
        'RM':  { bg: '#fce4ec', color: '#c62828', border: '#c62828', label: '🔴 RM' },
        'SDF': { bg: '#e3f2fd', color: '#1565c0', border: '#1565c0', label: '🔵 SDF' },
    };
    const getEquipoStyle = eq => equipoStyleMap[String(eq || '').trim().toUpperCase()] || { bg: '#f5f5f5', color: '#546e7a', border: '#90a4ae', label: eq };

    const allActive   = appState.workerMasterData.filter(m => !m.isPlaceholder);
    const vacToday    = allActive.filter(m => isOnVacation(m));
    const countActive = allActive.length - vacToday.length;

    let html = `
    <div style="padding:10px; border-bottom:2px dashed #b0bec5; margin-bottom:15px; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px;">
        <div>
            <h3 style="margin:0; color:#1a237e;">🏭 Administrar mi Planta</h3>
            <p style="margin:4px 0 0; font-size:0.78em; color:#546e7a;">
                Total: <strong>${allActive.length}</strong> auxiliares
                &nbsp;·&nbsp; Activos hoy: <strong style="color:#2e7d32;">${countActive}</strong>
                ${vacToday.length > 0 ? `&nbsp;·&nbsp; <span style="color:#e65100; font-weight:600;">🏖️ ${vacToday.length} de vacaciones</span>` : ''}
            </p>
        </div>
        <button onclick="document.getElementById('plantManagerContainer').style.display='none'; document.getElementById('plantManagerBtn')?.classList.remove('sidebar-btn--active');" class="btn-danger" style="padding:5px 15px; font-size:0.9em;">Cerrar</button>
    </div>
    <div class="summary-container" style="margin-top:0;">
    <table class="summary-table plant-table" style="width:100%;">
        <thead><tr>
            <th>TRABAJADOR</th><th>NOMBRE</th><th>INICIA (Vac.)</th><th>FINALIZA (Vac.)</th><th>PASILLO</th>
            <th style="width:80px; text-align:center;" title="Estado de restricción nocturna (columna EQUIPO del Sheets)">EQUIPO</th>
            <th>COD NOMINA</th>
        </tr></thead><tbody>`;

    appState.workerMasterData.forEach(m => {
        const isSwapped  = appState.swappedSeats.has(m.id);
        const vacNow     = !m.isPlaceholder && isOnVacation(m);
        const eq         = String(m.equipo || '').trim().toUpperCase();
        const es         = getEquipoStyle(eq);

        const placeholderTag = m.isPlaceholder
            ? `<span title="Puesto vacante — excluido de turnos y métricas" style="display:inline-block;margin-left:6px;font-size:0.72em;font-weight:700;letter-spacing:1px;padding:1px 6px;border-radius:3px;background:#fff3e0;color:#e65100;border:1px solid #ffb74d;">VACANTE</span>`
            : '';
        const vacBadge = vacNow
            ? `<span title="De vacaciones hoy" style="display:inline-block;margin-left:5px;font-size:0.7em;font-weight:700;padding:1px 5px;border-radius:3px;background:#e3f2fd;color:#1565c0;border:1px solid #90caf9;">🏖️ VAC</span>`
            : '';

        const nombreUpper = m.nombre.toUpperCase();
        const needsPasilloDropdown = /\bTEMPORAL\b/.test(nombreUpper) || /\bSENA\b/.test(nombreUpper);
        const pasilloCell = needsPasilloDropdown
            ? `<select class="plant-input plant-pasillo-input" data-worker-id="${m.id}">${allAisles.map(a => `<option value="${a}"${a === m.pasillo ? ' selected' : ''}>${a}</option>`).join('')}</select>`
            : `<span id="plant-pasillo-${m.id}" style="${isSwapped ? 'color:var(--corp-orange); font-weight:bold;' : ''}">${m.pasillo}${isSwapped ? ' 🔄' : ''}</span>`;

        const equipoSelect = m.isPlaceholder ? '<span style="color:#bbb; font-size:0.8em;">—</span>' : `
            <select class="plant-equipo-select" data-worker-id="${m.id}"
                style="font-size:0.78em; padding:3px 4px; border-radius:5px; border:1.5px solid ${es.border}; background:${es.bg}; color:${es.color}; font-weight:700; cursor:pointer; width:72px; text-align:center;">
                <option value=""  ${eq===''   ?'selected':''}>🟢 LIBRE</option>
                <option value="R" ${eq==='R'  ?'selected':''}>🟡 R</option>
                <option value="RM"${eq==='RM' ?'selected':''}>🔴 RM</option>
                <option value="SDF"${eq==='SDF'?'selected':''}>🔵 SDF</option>
            </select>`;

        const rowStyle = m.isPlaceholder
            ? 'opacity:0.6;background:#fff8f1;'
            : vacNow ? 'background:#e3f2fd;' : '';

        html += `<tr style="${rowStyle}">
            <td style="font-weight:bold; color:#1a237e;">${m.workerExcelId}${placeholderTag}${vacBadge}</td>
            <td><input type="text" class="plant-input plant-name-input" data-worker-id="${m.id}" value="${m.nombre.replace(/"/g,'&quot;')}"></td>
            <td><input type="date" class="plant-input plant-inicia-input" data-worker-id="${m.id}" value="${m.inicia}"></td>
            <td><input type="date" class="plant-input plant-finaliza-input" data-worker-id="${m.id}" value="${m.finaliza}"></td>
            <td>${pasilloCell}</td>
            <td style="text-align:center;">${equipoSelect}</td>
            <td><input type="text" class="plant-input plant-restriccion-input" data-worker-id="${m.id}" value="${(m.restriccion || '').replace(/"/g,'&quot;')}" placeholder="Cód. Nómina"></td>
        </tr>`;
    });
    html += `</tbody></table></div>`;

    container.innerHTML = html;
    container.style.display = 'block';
    container.scrollIntoView({ behavior: 'smooth' });
}

function renderPlantHealthReport() {
    const container = document.getElementById('plantHealthContainer');
    if (!container) return;

    if (appState.workerMasterData.length === 0) {
        container.innerHTML = '<div style="padding:20px;"><p style="color:#c62828;">No hay datos de planta cargados. Cargue el archivo Excel primero.</p></div>';
        container.style.display = 'block';
        return;
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const allWorkers = appState.workerMasterData.filter(m => !m.isPlaceholder);

    const onVacation = allWorkers.filter(m => {
        if (!m.inicia || !m.finaliza) return false;
        const start = new Date(m.inicia + 'T00:00:00');
        const end   = new Date(m.finaliza + 'T00:00:00');
        return today >= start && today <= end;
    });
    const onVacationIds = new Set(onVacation.map(m => m.id));
    const activeWorkers = allWorkers.filter(m => !onVacationIds.has(m.id));

    const normalize = v => String(v || '').trim().toUpperCase();
    const categorize = w => {
        const eq = normalize(w.equipo);
        if (eq === 'R')   return 'R';
        if (eq === 'RM')  return 'RM';
        if (eq === 'SDF') return 'SDF';
        if (eq === '')    return 'LIBRE';
        return 'OTRO';
    };

    const allStats    = { LIBRE: 0, R: 0, RM: 0, SDF: 0, OTRO: 0 };
    const activeStats = { LIBRE: 0, R: 0, RM: 0, SDF: 0, OTRO: 0 };
    const vacStats    = { LIBRE: 0, R: 0, RM: 0, SDF: 0 };
    allWorkers.forEach(m => allStats[categorize(m)]++);
    activeWorkers.forEach(m => activeStats[categorize(m)]++);
    onVacation.forEach(m => { const c = categorize(m); if (vacStats[c] !== undefined) vacStats[c]++; });

    const totalActive   = activeWorkers.length;
    const canNight      = activeStats.LIBRE;
    const cannotNight   = totalActive - canNight;
    const nightPct      = totalActive > 0 ? Math.round((canNight / totalActive) * 100) : 0;
    const totalPlant    = allWorkers.length;
    const plantNightPct = totalPlant > 0 ? Math.round((allStats.LIBRE / totalPlant) * 100) : 0;

    let healthColor, healthLabel, healthEmoji, healthBg;
    if (nightPct >= 70)      { healthColor = '#2e7d32'; healthLabel = 'ÓPTIMO';    healthEmoji = '🟢'; healthBg = '#e8f5e9'; }
    else if (nightPct >= 50) { healthColor = '#f57f17'; healthLabel = 'MODERADO';  healthEmoji = '🟡'; healthBg = '#fff8e1'; }
    else                     { healthColor = '#c62828'; healthLabel = 'CRÍTICO';   healthEmoji = '🔴'; healthBg = '#fce4ec'; }

    const byPasillo = {};
    allWorkers.forEach(m => {
        const p = m.pasillo || 'SIN PASILLO';
        if (!byPasillo[p]) byPasillo[p] = { total: 0, vacation: 0, libre: 0, r: 0, rm: 0, sdf: 0, otro: 0 };
        byPasillo[p].total++;
        if (onVacationIds.has(m.id)) {
            byPasillo[p].vacation++;
        } else {
            const c = categorize(m);
            if (c === 'LIBRE')     byPasillo[p].libre++;
            else if (c === 'R')   byPasillo[p].r++;
            else if (c === 'RM')  byPasillo[p].rm++;
            else if (c === 'SDF') byPasillo[p].sdf++;
            else                  byPasillo[p].otro++;
        }
    });
    const pasilloEntries = Object.entries(byPasillo).sort((a, b) => b[1].total - a[1].total);

    const dateStr = today.toLocaleDateString('es-CO', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    const chartId = 'phDonut_' + Date.now();

    const CAT_META = {
        LIBRE: { label: 'Sin Restricción', emoji: '🟢', fg: '#2e7d32', bg: '#e8f5e9', border: '#2e7d32' },
        R:     { label: 'Restricción Rol',     emoji: '🟡', fg: '#f57f17', bg: '#fff8e1', border: '#f57f17' },
        RM:    { label: 'Restricción Médica',   emoji: '🔴', fg: '#c62828', bg: '#fce4ec', border: '#c62828' },
        SDF:   { label: 'SADOFES',              emoji: '🔵', fg: '#1565c0', bg: '#e3f2fd', border: '#1565c0' },
    };

    const alertBanner = nightPct < 50
        ? `<div style="background:#fce4ec; border:2px solid #c62828; border-radius:8px; padding:12px 16px; margin:0 12px 16px; display:flex; align-items:center; gap:10px;">
               <span style="font-size:1.5em;">⚠️</span>
               <div>
                   <strong style="color:#c62828;">ALERTA — Capacidad Nocturna Crítica</strong>
                   <p style="margin:4px 0 0; font-size:0.83em; color:#b71c1c;">
                       Solo el <strong>${nightPct}%</strong> de los auxiliares disponibles hoy pueden trasnochar.
                       Se recomienda revisar asignaciones de turnos nocturnos y evaluar cobertura.
                   </p>
               </div>
           </div>`
        : nightPct < 70
        ? `<div style="background:#fff8e1; border:2px solid #f57f17; border-radius:8px; padding:12px 16px; margin:0 12px 16px; display:flex; align-items:center; gap:10px;">
               <span style="font-size:1.5em;">⚠️</span>
               <div>
                   <strong style="color:#f57f17;">ATENCIÓN — Capacidad Nocturna Moderada</strong>
                   <p style="margin:4px 0 0; font-size:0.83em; color:#e65100;">
                       El <strong>${nightPct}%</strong> de los auxiliares disponibles hoy pueden trasnochar. Monitorear cobertura nocturna.
                   </p>
               </div>
           </div>`
        : '';

    const pasilloTableHTML = pasilloEntries.length > 0 ? `
    <div style="padding:0 12px 16px;">
        <h4 style="color:#37474f; margin:0 0 6px; font-size:0.88em; text-transform:uppercase; letter-spacing:1px; border-bottom:1px solid #e0e0e0; padding-bottom:6px;">
            🗂️ Desglose por Pasillo — Capacidad Operativa
        </h4>
        <p style="font-size:0.75em; color:#78909c; margin:0 0 10px;">
            Total incluye vacaciones · Capacidad = aptos para trasnochar / total del pasillo
        </p>
        <div style="overflow-x:auto;">
        <table class="summary-table" style="width:100%; font-size:0.84em;">
            <thead>
                <tr>
                    <th style="text-align:left;">Pasillo</th>
                    <th style="text-align:center;" title="Todos los auxiliares del pasillo">Total</th>
                    <th style="text-align:center; color:#1565c0;" title="Actualmente de vacaciones">🏖️ Vac</th>
                    <th style="text-align:center;">🟢 Libre</th>
                    <th style="text-align:center;">🟡 R</th>
                    <th style="text-align:center;">🔴 RM</th>
                    <th style="text-align:center;">🔵 SDF</th>
                    <th style="text-align:center;">🌙 Noche</th>
                    <th style="text-align:left; min-width:140px;" title="Aptos trasnochar / Total del pasillo">Cap. Operativa</th>
                </tr>
            </thead>
            <tbody>
                ${pasilloEntries.map(([pasillo, s]) => {
                    const apt = s.libre;
                    const pct = s.total > 0 ? Math.round((apt / s.total) * 100) : 0;
                    const activeInPasillo = s.total - s.vacation;
                    const bc  = pct >= 70 ? '#2e7d32' : pct >= 50 ? '#f57f17' : '#c62828';
                    const vacCell = s.vacation > 0
                        ? `<td style="text-align:center; color:#1565c0; font-weight:700;">${s.vacation}</td>`
                        : `<td style="text-align:center; color:#b0bec5;">—</td>`;
                    return `<tr>
                        <td style="font-weight:600;">${pasillo}</td>
                        <td style="text-align:center; font-weight:700;">${s.total}</td>
                        ${vacCell}
                        <td style="text-align:center; color:#2e7d32; font-weight:700;">${s.libre}</td>
                        <td style="text-align:center; color:#f57f17; font-weight:700;">${s.r || '—'}</td>
                        <td style="text-align:center; color:#c62828; font-weight:700;">${s.rm || '—'}</td>
                        <td style="text-align:center; color:#1565c0; font-weight:700;">${s.sdf || '—'}</td>
                        <td style="text-align:center; font-weight:700; color:${bc};">${apt}<span style="font-size:0.78em; font-weight:400; color:#78909c;"> /${s.total}</span></td>
                        <td>
                            <div style="background:#e0e0e0; border-radius:4px; height:18px; overflow:hidden; position:relative;">
                                <div style="background:${bc}; width:${pct}%; height:100%; border-radius:4px; transition:width 0.5s ease; min-width:${apt > 0 ? '4px' : '0'};"></div>
                                <span style="position:absolute; left:6px; top:0; line-height:18px; font-size:0.72em; font-weight:700; color:${pct > 20 ? '#fff' : bc};">${pct}%</span>
                            </div>
                            ${s.vacation > 0 ? `<div style="font-size:0.7em; color:#1565c0; margin-top:2px;">↳ ${activeInPasillo} activos hoy</div>` : ''}
                        </td>
                    </tr>`;
                }).join('')}
            </tbody>
        </table>
        </div>
    </div>` : '';

    const vacTableHTML = onVacation.length > 0 ? `
    <div style="padding:0 12px 16px;">
        <h4 style="color:#37474f; margin:0 0 12px; font-size:0.88em; text-transform:uppercase; letter-spacing:1px; border-bottom:1px solid #e0e0e0; padding-bottom:6px;">
            🏖️ Personal en Vacaciones Hoy — ${onVacation.length} ausente(s)
        </h4>
        <div style="display:flex; flex-wrap:wrap; gap:8px; margin-bottom:12px;">
            ${['LIBRE','R','RM','SDF'].filter(c => vacStats[c] > 0).map(c => {
                const m = CAT_META[c];
                return `<div style="background:${m.bg}; border:1.5px solid ${m.border}; border-radius:8px; padding:6px 14px; display:flex; align-items:center; gap:8px;">
                    <span style="font-size:0.82em; color:${m.fg}; font-weight:600;">${m.emoji} ${m.label}</span>
                    <span style="font-size:1.1em; font-weight:700; color:${m.fg};">${vacStats[c]}</span>
                </div>`;
            }).join('')}
        </div>
        <div style="overflow-x:auto;">
        <table class="summary-table" style="width:100%; font-size:0.82em;">
            <thead><tr>
                <th>Trabajador</th><th>Nombre</th><th>Pasillo</th><th>Restricción</th><th>Inicio Vac.</th><th>Fin Vac.</th>
            </tr></thead>
            <tbody>
                ${onVacation.map(m => {
                    const c  = categorize(m);
                    const cm = CAT_META[c] || { fg: '#546e7a', bg: '#eceff1', border: '#90a4ae', emoji: '⚪', label: c };
                    return `<tr>
                        <td style="font-weight:600; color:#1a237e;">${m.workerExcelId}</td>
                        <td>${m.nombre}</td>
                        <td>${m.pasillo || '-'}</td>
                        <td><span style="background:${cm.bg}; color:${cm.fg}; border:1px solid ${cm.border}; padding:2px 8px; border-radius:10px; font-size:0.8em; font-weight:700;">${cm.emoji} ${c}</span></td>
                        <td>${m.inicia || '-'}</td>
                        <td>${m.finaliza || '-'}</td>
                    </tr>`;
                }).join('')}
            </tbody>
        </table>
        </div>
    </div>` : '';

    const sortOrder = { LIBRE: 0, R: 1, SDF: 2, RM: 3, OTRO: 4 };
    const detailHTML = `
    <div style="padding:0 12px 16px;">
        <details>
            <summary style="cursor:pointer; color:#1a237e; font-size:0.88em; font-weight:600; padding:8px 0; text-transform:uppercase; letter-spacing:1px; user-select:none;">
                📋 Ver Detalle Completo por Trabajador (${allWorkers.length})
            </summary>
            <div style="overflow-x:auto; margin-top:10px;">
            <table class="summary-table" style="width:100%; font-size:0.82em;">
                <thead><tr>
                    <th>Trabajador</th><th>Nombre</th><th>Pasillo</th><th>Restricción EQUIPO</th><th style="text-align:center;">🌙 Trasnocha</th><th>Estado Hoy</th>
                </tr></thead>
                <tbody>
                    ${[...allWorkers].sort((a, b) => (sortOrder[categorize(a)] ?? 4) - (sortOrder[categorize(b)] ?? 4)).map(m => {
                        const c   = categorize(m);
                        const cm  = CAT_META[c] || { fg: '#546e7a', bg: '#eceff1', border: '#90a4ae', emoji: '⚪', label: c };
                        const isV = onVacationIds.has(m.id);
                        const cn  = c === 'LIBRE';
                        return `<tr style="${isV ? 'opacity:0.6; background:#fff3e0;' : ''}">
                            <td style="font-weight:600; color:#1a237e;">${m.workerExcelId}</td>
                            <td>${m.nombre}${isV ? ' <span style="font-size:0.72em;background:#fff3e0;color:#e65100;border:1px solid #ffb74d;padding:1px 5px;border-radius:3px;margin-left:4px;">VACACIONES</span>' : ''}</td>
                            <td>${m.pasillo || '-'}</td>
                            <td><span style="background:${cm.bg}; color:${cm.fg}; border:1px solid ${cm.border}; padding:2px 8px; border-radius:10px; font-size:0.8em; font-weight:700;">${cm.emoji} ${c === 'LIBRE' ? 'LIBRE' : c}</span></td>
                            <td style="text-align:center;">${cn ? '<span style="color:#2e7d32; font-weight:700; font-size:1em;">✅ SÍ</span>' : '<span style="color:#c62828; font-weight:700; font-size:1em;">🚫 NO</span>'}</td>
                            <td style="font-size:0.8em; color:${isV ? '#e65100' : '#2e7d32'}; font-weight:600;">${isV ? '🏖️ De Vacaciones' : '✅ Disponible'}</td>
                        </tr>`;
                    }).join('')}
                </tbody>
            </table>
            </div>
        </details>
    </div>`;

    let html = `
    <div style="padding:10px; border-bottom:2px dashed #b0bec5; margin-bottom:16px; display:flex; justify-content:space-between; align-items:center;">
        <div>
            <h3 style="margin:0; color:#1a237e;">🏥 Salud de Auxiliares &amp; Capacidad Nocturna</h3>
            <p style="margin:4px 0 0; font-size:0.78em; color:#78909c;">Generado el ${dateStr}</p>
        </div>
        <button onclick="document.getElementById('plantHealthContainer').style.display='none'; document.getElementById('plantHealthBtn')?.classList.remove('sidebar-btn--active');" class="btn-danger" style="padding:5px 15px; font-size:0.9em;">Cerrar</button>
    </div>

    ${alertBanner}

    <!-- KPI CARDS -->
    <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(155px, 1fr)); gap:12px; padding:0 12px 16px;">
        <div style="background:${healthBg}; border:2px solid ${healthColor}; border-radius:10px; padding:14px; text-align:center;">
            <div style="font-size:1.8em;">${healthEmoji}</div>
            <div style="font-size:1.7em; font-weight:700; color:${healthColor};">${nightPct}%</div>
            <div style="font-size:0.72em; font-weight:600; color:${healthColor}; text-transform:uppercase; letter-spacing:1px; margin-top:2px;">Capacidad Nocturna</div>
            <div style="font-size:0.7em; color:#546e7a; margin-top:4px;">Estado: <strong style="color:${healthColor};">${healthLabel}</strong></div>
        </div>
        <div style="background:#e3f2fd; border:2px solid #1565c0; border-radius:10px; padding:14px; text-align:center;">
            <div style="font-size:1.8em;">👥</div>
            <div style="font-size:1.7em; font-weight:700; color:#1565c0;">${totalPlant}</div>
            <div style="font-size:0.72em; font-weight:600; color:#1565c0; text-transform:uppercase; letter-spacing:1px; margin-top:2px;">Total Planta</div>
            <div style="font-size:0.7em; color:#546e7a; margin-top:4px;">${allStats.LIBRE} sin restricción (${plantNightPct}%)</div>
        </div>
        <div style="background:#e8f5e9; border:2px solid #2e7d32; border-radius:10px; padding:14px; text-align:center;">
            <div style="font-size:1.8em;">✅</div>
            <div style="font-size:1.7em; font-weight:700; color:#2e7d32;">${totalActive}</div>
            <div style="font-size:0.72em; font-weight:600; color:#2e7d32; text-transform:uppercase; letter-spacing:1px; margin-top:2px;">Disponibles Hoy</div>
            <div style="font-size:0.7em; color:#546e7a; margin-top:4px;">${onVacation.length} de vacaciones</div>
        </div>
        <div style="background:#f3e5f5; border:2px solid #6a1b9a; border-radius:10px; padding:14px; text-align:center;">
            <div style="font-size:1.8em;">🌙</div>
            <div style="font-size:1.7em; font-weight:700; color:#6a1b9a;">${canNight}</div>
            <div style="font-size:0.72em; font-weight:600; color:#6a1b9a; text-transform:uppercase; letter-spacing:1px; margin-top:2px;">Aptos Trasnochar</div>
            <div style="font-size:0.7em; color:#546e7a; margin-top:4px;">${cannotNight} con restricción</div>
        </div>
        <div style="background:#fce4ec; border:2px solid #c62828; border-radius:10px; padding:14px; text-align:center;">
            <div style="font-size:1.8em;">🚫</div>
            <div style="font-size:1.7em; font-weight:700; color:#c62828;">${cannotNight}</div>
            <div style="font-size:0.72em; font-weight:600; color:#c62828; text-transform:uppercase; letter-spacing:1px; margin-top:2px;">No Trasnochan</div>
            <div style="font-size:0.7em; color:#546e7a; margin-top:4px;">R: ${activeStats.R} · RM: ${activeStats.RM} · SDF: ${activeStats.SDF}</div>
        </div>
    </div>

    <!-- LEYENDA -->
    <div style="padding:0 12px 14px;">
        <div style="display:flex; flex-wrap:wrap; gap:7px;">
            ${Object.entries(CAT_META).map(([k, m]) =>
                `<span style="background:${m.bg}; color:${m.fg}; border:1.5px solid ${m.border}; padding:4px 12px; border-radius:20px; font-size:0.8em; font-weight:600;">${m.emoji} ${k === 'LIBRE' ? 'LIBRE' : k} — ${m.label}${k === 'LIBRE' ? ' · ✅ Puede trasnochar' : ' · 🚫 No trasnocha'}</span>`
            ).join('')}
        </div>
    </div>

    <div style="border-top:1px solid #e0e0e0; margin:0 12px 16px;"></div>

    <!-- GRÁFICAS: DONA + BARRAS -->
    <div style="display:grid; grid-template-columns:minmax(260px, 320px) 1fr; gap:20px; padding:0 12px 16px; align-items:start;">

        <!-- DONA (composición planta total) -->
        <div style="background:#fafafa; border:1px solid #e0e0e0; border-radius:10px; padding:16px; text-align:center;">
            <h4 style="color:#37474f; margin:0 0 12px; font-size:0.83em; text-transform:uppercase; letter-spacing:1px;">Composición Planta Total</h4>
            <div style="position:relative; max-width:220px; margin:0 auto;">
                <canvas id="${chartId}" width="220" height="220"></canvas>
            </div>
            <div style="margin-top:8px; font-size:0.75em; color:#78909c;">${totalPlant} auxiliares registrados · ${allStats.LIBRE} libres (${plantNightPct}%)</div>
        </div>

        <!-- BARRAS HORIZONTALES (activos hoy) -->
        <div style="background:#fafafa; border:1px solid #e0e0e0; border-radius:10px; padding:16px;">
            <h4 style="color:#37474f; margin:0 0 14px; font-size:0.83em; text-transform:uppercase; letter-spacing:1px;">Distribución Activos Hoy (${totalActive})</h4>
            ${Object.entries(CAT_META).map(([cat, m]) => {
                const count = activeStats[cat] || 0;
                const pct   = totalActive > 0 ? Math.round((count / totalActive) * 100) : 0;
                return `
                <div style="margin-bottom:13px;">
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:4px;">
                        <span style="font-size:0.82em; font-weight:600; color:${m.fg};">${m.emoji} ${cat === 'LIBRE' ? 'LIBRE' : cat} — ${m.label}</span>
                        <span style="font-size:0.82em; color:#546e7a;"><strong style="color:${m.fg};">${count}</strong> trabajador${count !== 1 ? 'es' : ''} · <strong>${pct}%</strong></span>
                    </div>
                    <div style="background:#e0e0e0; border-radius:4px; height:20px; overflow:hidden; position:relative;">
                        <div style="background:${m.fg}; width:${pct}%; height:100%; border-radius:4px; transition:width 0.6s ease; min-width:${count > 0 ? '4px' : '0'};"></div>
                        ${pct > 12 ? `<span style="position:absolute; left:8px; top:0; line-height:20px; font-size:0.72em; font-weight:700; color:white;">${pct}%</span>` : ''}
                    </div>
                </div>`;
            }).join('')}
            <div style="margin-top:14px; padding-top:10px; border-top:1px dashed #ccc; display:flex; justify-content:space-between; flex-wrap:wrap; gap:6px; font-size:0.82em; color:#37474f;">
                <span>🌙 Aptos noche: <strong style="color:#2e7d32;">${canNight} (${nightPct}%)</strong></span>
                <span>🚫 Con restricción: <strong style="color:#c62828;">${cannotNight} (${totalActive > 0 ? 100 - nightPct : 0}%)</strong></span>
            </div>
        </div>
    </div>

    <div style="border-top:1px solid #e0e0e0; margin:0 12px 16px;"></div>

    ${pasilloTableHTML}

    ${onVacation.length > 0 ? '<div style="border-top:1px solid #e0e0e0; margin:0 12px 16px;"></div>' : ''}
    ${vacTableHTML}

    ${detailHTML}
    `;

    container.innerHTML = html;
    container.style.display = 'block';
    container.scrollIntoView({ behavior: 'smooth' });

    if (typeof Chart !== 'undefined') {
        const ctx = document.getElementById(chartId);
        if (ctx) {
            new Chart(ctx, {
                type: 'doughnut',
                data: {
                    labels: Object.entries(CAT_META).map(([k, m]) => `${m.emoji} ${k === 'LIBRE' ? 'LIBRE' : k}`),
                    datasets: [{
                        data: ['LIBRE','R','RM','SDF'].map(c => allStats[c] || 0),
                        backgroundColor: ['#2e7d32','#f57f17','#c62828','#1565c0'],
                        borderColor: '#ffffff',
                        borderWidth: 3,
                        hoverOffset: 8
                    }]
                },
                options: {
                    responsive: false,
                    cutout: '62%',
                    plugins: {
                        legend: {
                            position: 'bottom',
                            labels: { font: { size: 10 }, padding: 8, boxWidth: 13 }
                        },
                        tooltip: {
                            callbacks: {
                                label: ctx => {
                                    const val = ctx.parsed;
                                    const pct = totalPlant > 0 ? Math.round((val / totalPlant) * 100) : 0;
                                    return ` ${val} trabajadores (${pct}%)`;
                                }
                            }
                        }
                    }
                }
            });
        }
    }
}

function toggleHorasDetalle(rowEl, workerNombre) {
    const NON_WORKING = new Set(['COMP','LBRE','VC','LIC','INC','DF','CAP','0SP']);
    const DAY_NAMES = ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb'];
    const container  = document.getElementById('horasPromedioContainer');
    const icon = rowEl.querySelector('.hp-toggle-icon');

    // Cerrar detalle existente
    const prev = container.querySelector('.hp-detail-row');
    const prevRow = container.querySelector('.hp-worker-row.hp-active');
    if (prevRow) {
        prevRow.classList.remove('hp-active');
        prevRow.style.background = '';
        const prevIcon = prevRow.querySelector('.hp-toggle-icon');
        if (prevIcon) prevIcon.textContent = '▶';
    }
    if (prev) {
        const isSame = prev.dataset.worker === workerNombre;
        prev.remove();
        if (isSame) return;  // toggle off
    }

    // Marcar fila activa
    rowEl.classList.add('hp-active');
    rowEl.style.background = '#e8eaf6';
    if (icon) icon.textContent = '▼';

    // Buscar trabajador
    const worker = appState.processedData.find(w => w.fixedData[0] === workerNombre);
    if (!worker) return;

    // Fechas filtradas según estado actual del contenedor
    const selectedMonth = container.dataset.selectedMonth ?? '';
    const filteredDates = selectedMonth
        ? appState.dateHeaders.filter(d => d.startsWith(selectedMonth))
        : appState.dateHeaders;
    if (!filteredDates.length) return;

    // Expandir rango a semanas completas (lunes→domingo)
    const toDate = s => new Date(s + 'T00:00:00');
    const toStr  = d => d.toISOString().substring(0, 10);
    const firstDt = toDate(filteredDates[0]);
    const lastDt  = toDate(filteredDates[filteredDates.length - 1]);
    const fdow = firstDt.getDay();
    const rangeStart = new Date(firstDt);
    rangeStart.setDate(firstDt.getDate() - (fdow === 0 ? 6 : fdow - 1));
    const ldow = lastDt.getDay();
    const rangeEnd = new Date(lastDt);
    rangeEnd.setDate(lastDt.getDate() + (ldow === 0 ? 0 : 7 - ldow));

    // Categoría y colores por turno
    function catInfo(name) {
        if (!name || name === 'N/A') return { label: '—',    bg: '#f5f5f5', color: '#999',    fw: '400' };
        if (name === 'COMP')         return { label: 'COMP', bg: '#f5f5f5', color: '#1a0067', fw: '700' };
        if (name === 'LBRE')         return { label: 'LBRE', bg: '#e3f2fd', color: '#c62828', fw: '700' };
        if (name === 'VC')           return { label: 'VC',   bg: '#fce4ec', color: '#d81b60', fw: '700' };
        if (/^(LIC|INC|DF|CAP)/.test(name)) return { label: name, bg: '#f0f4c3', color: '#33691e', fw: '700' };
        if (/^\d+(?:\.\d+)?A/.test(name))   return { label: 'APE', bg: '#ffe0b2', color: '#5d2e00', fw: '700' };
        if (/^\d+(?:\.\d+)?C/.test(name))   return { label: 'CIE', bg: '#c8e6c9', color: '#1b5e20', fw: '700' };
        if (/^\d+(?:\.\d+)?[iI]/.test(name))return { label: 'INT', bg: '#bbdefb', color: '#0d3666', fw: '700' };
        if (/^\d+(?:\.\d+)?N/.test(name))   return { label: 'NOC', bg: '#d1c4e9', color: '#311b92', fw: '700' };
        return { label: '?', bg: '#eeeeee', color: '#555', fw: '400' };
    }

    // Construir semanas
    let html = `<div style="padding:12px 16px;background:#f0f4ff;border-top:2px solid #3949ab;">
        <div style="font-weight:700;color:#1a237e;margin-bottom:10px;font-size:0.92em;">
            📅 Detalle día a día — <span style="color:#3949ab;">${workerNombre}</span>
            ${selectedMonth ? `<span style="color:#666;font-weight:400;margin-left:8px;">${(()=>{const[yr,mo]=selectedMonth.split('-');return MONTH_NAMES_ES[parseInt(mo)-1]+' '+yr;})()}</span>` : ''}
        </div>`;

    const cur = new Date(rangeStart);
    let grandTotal = 0, grandDays = 0, weekNum = 0;

    while (cur <= rangeEnd) {
        weekNum++;
        const weekLabel = `${toStr(cur)} → ${toStr(new Date(cur.getTime() + 6*86400000))}`;
        let weekTotal = 0, weekWorkedDays = 0;
        let daysHtml = '';

        for (let i = 0; i < 7; i++) {
            const day = new Date(cur); day.setDate(cur.getDate() + i);
            const ds  = toStr(day);
            const dow = day.getDay();
            const shift = worker.dailyData[ds];
            const name  = shift?.name || '—';
            const hrs   = (!shift || NON_WORKING.has(name) || name === 'N/A') ? 0 : Number(shift.hours || 0);
            const inFilter = filteredDates.includes(ds);
            const ci = catInfo(name);

            if (hrs > 0) { weekTotal += hrs; weekWorkedDays++; grandTotal += hrs; grandDays++; }

            const isWeekend = dow === 0 || dow === 6;
            const outsideFilter = !inFilter;
            const rowStyle = outsideFilter
                ? 'opacity:0.45;font-style:italic;'
                : (isWeekend ? 'background:#f3f4f6;' : '');

            daysHtml += `<tr style="${rowStyle}border-bottom:1px solid #e8eaf6;">
                <td style="padding:3px 8px;color:#555;font-size:0.82em;white-space:nowrap;">${DAY_NAMES[dow]}</td>
                <td style="padding:3px 8px;color:#333;font-size:0.82em;">${ds}${outsideFilter ? ' <span style="font-size:0.75em;color:#bbb;">(ext.)</span>' : ''}</td>
                <td style="padding:3px 8px;">
                    <span style="background:${ci.bg};color:${ci.color};font-weight:${ci.fw};padding:1px 6px;border-radius:4px;font-size:0.8em;">${name !== 'N/A' ? name : '—'}</span>
                </td>
                <td style="padding:3px 8px;text-align:center;">
                    <span style="background:${ci.bg};color:${ci.color};font-weight:${ci.fw};padding:1px 8px;border-radius:4px;font-size:0.82em;">${ci.label}</span>
                </td>
                <td style="padding:3px 8px;text-align:right;font-weight:700;color:${hrs>0?'#1565c0':'#bbb'};font-size:0.85em;">${hrs > 0 ? hrs + 'h' : '—'}</td>
            </tr>`;
        }

        html += `<div style="margin-bottom:10px;border:1px solid #c5cae9;border-radius:6px;overflow:hidden;">
            <div style="background:#3949ab;color:#fff;padding:5px 10px;font-size:0.78em;font-weight:700;display:flex;justify-content:space-between;align-items:center;">
                <span>Semana ${weekNum} &nbsp;·&nbsp; ${weekLabel}</span>
                <span style="background:rgba(255,255,255,0.18);border-radius:4px;padding:2px 8px;">
                    ${weekWorkedDays} días · <strong>${weekTotal.toFixed(1)}h</strong>
                    ${weekWorkedDays > 0 ? `<span style="opacity:0.8;font-weight:400;"> (prom ${(weekTotal/weekWorkedDays).toFixed(1)}h/día)</span>` : ''}
                </span>
            </div>
            <table style="width:100%;border-collapse:collapse;font-size:0.84em;background:#fff;">
                <thead><tr style="background:#e8eaf6;font-size:0.78em;color:#555;">
                    <th style="padding:3px 8px;text-align:left;font-weight:600;">Día</th>
                    <th style="padding:3px 8px;text-align:left;font-weight:600;">Fecha</th>
                    <th style="padding:3px 8px;text-align:left;font-weight:600;">Turno</th>
                    <th style="padding:3px 8px;text-align:left;font-weight:600;">Tipo</th>
                    <th style="padding:3px 8px;text-align:right;font-weight:600;">Horas</th>
                </tr></thead>
                <tbody>${daysHtml}</tbody>
            </table>
        </div>`;

        cur.setDate(cur.getDate() + 7);
    }

    // Totales finales
    html += `<div style="background:#1a237e;color:#fff;border-radius:6px;padding:8px 14px;display:flex;gap:24px;flex-wrap:wrap;font-size:0.85em;margin-top:4px;">
        <span>📊 <strong>${grandDays}</strong> días trabajados</span>
        <span>⏱️ <strong>${grandTotal.toFixed(1)}h</strong> totales</span>
        <span>📈 Prom/día: <strong>${grandDays>0?(grandTotal/grandDays).toFixed(1):0}h</strong></span>
        <span>📅 Prom/semana: <strong>${weekNum>0?(grandTotal/weekNum).toFixed(1):0}h</strong></span>
    </div></div>`;

    // Insertar fila de detalle después de la fila del trabajador
    const detailTr = document.createElement('tr');
    detailTr.className = 'hp-detail-row';
    detailTr.dataset.worker = workerNombre;
    detailTr.innerHTML = `<td colspan="15" style="padding:0;">${html}</td>`;
    rowEl.insertAdjacentElement('afterend', detailTr);
    detailTr.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function renderHorasPromedioReport() {
    const container = document.getElementById('horasPromedioContainer');
    if (!container) return;

    const NON_WORKING = new Set(['COMP','LBRE','VC','LIC','INC','DF','CAP','0SP']);
    const workers = appState.processedData.filter(w => !w.isPlaceholder);
    const closeBtnHtml = `<button onclick="document.getElementById('horasPromedioContainer').style.display='none';document.getElementById('horasPromedioBtn')?.classList.remove('sidebar-btn--active');" class="btn-danger" style="padding:5px 15px;font-size:0.9em;">Cerrar</button>`;

    if (!workers.length) {
        container.innerHTML = `<div style="padding:20px;"><div style="display:flex;justify-content:space-between;align-items:center;border-bottom:2px dashed #b0bec5;padding-bottom:12px;margin-bottom:15px;"><h3 style="margin:0;color:#1a237e;">⏱️ Promedio de Horas por Auxiliar</h3>${closeBtnHtml}</div><p style="color:#999;text-align:center;padding:30px;">No hay datos cargados.</p></div>`;
        container.style.display = 'block'; container.scrollIntoView({ behavior: 'smooth' }); return;
    }

    const monthsSet = new Set();
    appState.dateHeaders.forEach(d => monthsSet.add(d.substring(0, 7)));
    const months = ['', ...Array.from(monthsSet).sort()];

    const selectedMonth  = container.dataset.selectedMonth  ?? '';
    const selectedPasillo = container.dataset.selectedPasillo ?? '';
    const searchText     = container.dataset.searchText     ?? '';
    const sortCol        = container.dataset.sortCol        || 'totalHours';
    const sortDir        = container.dataset.sortDir        || 'desc';

    const filteredDates = selectedMonth
        ? appState.dateHeaders.filter(d => d.startsWith(selectedMonth))
        : appState.dateHeaders;

    const pasillos = ['', ...new Set(workers.map(w => w.fixedData[1]).filter(Boolean))].sort();

    // ── Por trabajador ──
    const workerStats = workers.map(w => {
        if (selectedPasillo && w.fixedData[1] !== selectedPasillo) return null;
        if (searchText && !w.fixedData[0]?.toLowerCase().includes(searchText.toLowerCase())) return null;

        let totalHours = 0, workedDays = 0;
        let compDays = 0, lbreDays = 0, vcDays = 0, licDays = 0, incDays = 0, otherDays = 0;
        let daysA = 0, daysC = 0, daysI = 0, daysN = 0;
        const monthMap = {};

        filteredDates.forEach(d => {
            const shift = w.dailyData[d]; if (!shift || shift.name === 'N/A') return;
            const name = shift.name; const hrs = Number(shift.hours || 0);

            if      (name === 'COMP') { compDays++; }
            else if (name === 'LBRE') { lbreDays++; }
            else if (name === 'VC')   { vcDays++; }
            else if (name === 'LIC')  { licDays++; }
            else if (name === 'INC')  { incDays++; }
            else if (['DF','CAP','0SP'].includes(name)) { otherDays++; }
            else if (hrs > 0) {
                totalHours += hrs; workedDays++;
                if      (/^\d+(?:\.\d+)?A/.test(name))    daysA++;
                else if (/^\d+(?:\.\d+)?C/.test(name))    daysC++;
                else if (/^\d+(?:\.\d+)?[iI]/.test(name)) daysI++;
                else if (/^\d+(?:\.\d+)?[NI]/.test(name)) daysN++;
                // Agrupar mes
                const mk = d.substring(0, 7);
                monthMap[mk] = (monthMap[mk] || 0) + hrs;
            }
        });

        // ── Promedio semanal: semanas completas lunes→domingo ──
        // Expandir el rango al lunes de la primera semana y al domingo de la última
        const weekVals = [];
        if (filteredDates.length > 0) {
            const toDate = s => new Date(s + 'T00:00:00');
            const toStr  = d => d.toISOString().substring(0, 10);
            const firstDt = toDate(filteredDates[0]);
            const lastDt  = toDate(filteredDates[filteredDates.length - 1]);
            // Lunes de la primera semana
            const fdow = firstDt.getDay();
            const rangeStart = new Date(firstDt);
            rangeStart.setDate(firstDt.getDate() - (fdow === 0 ? 6 : fdow - 1));
            // Domingo de la última semana
            const ldow = lastDt.getDay();
            const rangeEnd = new Date(lastDt);
            rangeEnd.setDate(lastDt.getDate() + (ldow === 0 ? 0 : 7 - ldow));
            // Recorrer semana a semana usando dailyData completo
            const cur = new Date(rangeStart);
            while (cur <= rangeEnd) {
                let wkHrs = 0;
                for (let i = 0; i < 7; i++) {
                    const day = new Date(cur); day.setDate(cur.getDate() + i);
                    const ds = toStr(day);
                    const s  = w.dailyData[ds];
                    if (s && !NON_WORKING.has(s.name) && Number(s.hours) > 0) wkHrs += Number(s.hours);
                }
                weekVals.push(wkHrs);
                cur.setDate(cur.getDate() + 7);
            }
        }

        const monthVals   = Object.values(monthMap);
        const avgPerDay   = workedDays > 0 ? totalHours / workedDays : 0;
        const avgPerWeek  = weekVals.length > 0 ? weekVals.reduce((a,b)=>a+b,0) / weekVals.length : 0;
        const avgPerMonth = monthVals.length > 0 ? monthVals.reduce((a,b)=>a+b,0) / monthVals.length : 0;
        const maxWeek     = weekVals.length > 0 ? Math.max(...weekVals) : 0;
        const minWeek     = weekVals.length > 0 ? Math.min(...weekVals) : 0;
        const weeksCount  = weekVals.length;

        return {
            nombre: w.fixedData[0] || '—', pasillo: w.fixedData[1] || '—',
            workedDays, totalHours, avgPerDay, avgPerWeek, avgPerMonth,
            maxWeek, minWeek, weeksCount,
            compDays, lbreDays, vcDays, licDays, incDays, otherDays,
            daysA, daysC, daysI, daysN,
        };
    }).filter(Boolean);

    // ── Ordenar ──
    workerStats.sort((a, b) => {
        const va = typeof a[sortCol] === 'string' ? a[sortCol].toLowerCase() : (a[sortCol] ?? 0);
        const vb = typeof b[sortCol] === 'string' ? b[sortCol].toLowerCase() : (b[sortCol] ?? 0);
        return sortDir === 'asc' ? (va < vb ? -1 : va > vb ? 1 : 0) : (va > vb ? -1 : va < vb ? 1 : 0);
    });

    // ── Totales globales ──
    const n = workerStats.length || 1;
    const totalHrsAll  = workerStats.reduce((s,w) => s + w.totalHours, 0);
    const avgDayAll    = workerStats.reduce((s,w) => s + w.avgPerDay, 0)   / n;
    const avgWeekAll   = workerStats.reduce((s,w) => s + w.avgPerWeek, 0)  / n;
    const avgMonthAll  = workerStats.reduce((s,w) => s + w.avgPerMonth, 0) / n;
    const totalWorkers = workerStats.length;

    function fmt(v) { return isFinite(v) ? v.toFixed(1) : '0.0'; }
    function bar(pct, color) {
        const w = Math.min(100, Math.round(pct));
        return `<div style="background:#e0e0e0;border-radius:3px;height:6px;width:56px;display:inline-block;vertical-align:middle;margin-right:2px;"><div style="background:${color};height:6px;border-radius:3px;width:${w}%;"></div></div>`;
    }

    function sortTh(col, label, title = '') {
        const active = sortCol === col;
        const arrow  = active ? (sortDir === 'asc' ? '▲' : '▼') : '⇅';
        const bg     = active ? 'background:rgba(255,255,255,0.18);' : '';
        return `<th title="${title||label}" style="padding:7px 6px;white-space:nowrap;cursor:pointer;user-select:none;${bg}font-size:0.82em;"
            onclick="const c=document.getElementById('horasPromedioContainer');const p=c.dataset.sortCol;c.dataset.sortDir=(p==='${col}'&&c.dataset.sortDir==='asc')?'desc':'asc';c.dataset.sortCol='${col}';renderHorasPromedioReport();">
            ${label}&nbsp;<span style="font-size:0.75em;opacity:0.75;">${arrow}</span></th>`;
    }

    // ── Filas de tabla ──
    const tableRows = workerStats.map((w, idx) => {
        const totalCat = w.daysA + w.daysC + w.daysI + w.daysN || 1;
        const pA = w.daysA / totalCat * 100, pC = w.daysC / totalCat * 100;
        const pI = w.daysI / totalCat * 100, pN = w.daysN / totalCat * 100;
        const dayColor = w.avgPerDay >= 7.5 ? '#c62828' : w.avgPerDay >= 6.5 ? '#2e7d32' : w.avgPerDay > 0 ? '#f57c00' : '#aaa';
        const rowBg = idx % 2 === 0 ? '#ffffff' : '#f9f9fc';
        const uid = `hp-detail-${idx}`;
        return `<tr class="hp-worker-row" data-hp-idx="${idx}" style="background:${rowBg};border-bottom:1px solid #eee;cursor:pointer;" onclick="toggleHorasDetalle(this,'${w.nombre.replace(/'/g,"\\'")}')">
            <td style="padding:5px 8px;font-weight:600;color:#1a237e;white-space:nowrap;">
                <span style="display:inline-flex;align-items:center;gap:5px;">
                    <span class="hp-toggle-icon" style="font-size:0.75em;color:#90a4ae;">▶</span>
                    ${w.nombre}
                </span>
            </td>
            <td style="padding:5px 6px;font-size:0.82em;color:#555;">${w.pasillo}</td>
            <td style="text-align:center;padding:5px 4px;font-weight:700;color:#1565c0;">${w.workedDays}</td>
            <td style="text-align:center;padding:5px 4px;font-weight:700;color:#0d47a1;">${fmt(w.totalHours)}</td>
            <td style="text-align:center;padding:5px 4px;font-weight:800;color:${dayColor};">${fmt(w.avgPerDay)}</td>
            <td style="text-align:center;padding:5px 4px;font-weight:700;color:#4527a0;">${fmt(w.avgPerWeek)}</td>
            <td style="text-align:center;padding:5px 4px;font-weight:700;color:#00838f;">${fmt(w.avgPerMonth)}</td>
            <td style="text-align:center;padding:5px 4px;font-size:0.85em;color:#388e3c;">${fmt(w.maxWeek)}</td>
            <td style="text-align:center;padding:5px 4px;font-size:0.85em;color:#c62828;">${fmt(w.minWeek)}</td>
            <td style="text-align:center;padding:5px 4px;color:#4caf50;font-weight:600;">${w.compDays}</td>
            <td style="text-align:center;padding:5px 4px;color:#1976d2;font-weight:600;">${w.lbreDays}</td>
            <td style="text-align:center;padding:5px 4px;color:#d81b60;font-weight:600;">${w.vcDays}</td>
            <td style="text-align:center;padding:5px 4px;color:#b71c1c;font-weight:600;">${w.licDays + w.incDays}</td>
            <td style="padding:5px 4px;white-space:nowrap;font-size:0.8em;">
                <span style="color:#f57c00;font-weight:700;">A:${w.daysA}</span>
                <span style="color:#1565c0;margin-left:5px;font-weight:700;">C:${w.daysC}</span>
                <span style="color:#00838f;margin-left:5px;font-weight:700;">I:${w.daysI}</span>
                <span style="color:#311b92;margin-left:5px;font-weight:700;">N:${w.daysN}</span>
            </td>
            <td style="padding:5px 6px;min-width:90px;">
                <div title="Aperturas ${Math.round(pA)}%">${bar(pA,'#f57c00')}<span style="font-size:0.68em;color:#777;">${Math.round(pA)}%</span></div>
                <div title="Cierres ${Math.round(pC)}%">${bar(pC,'#1565c0')}<span style="font-size:0.68em;color:#777;">${Math.round(pC)}%</span></div>
                <div title="Intermedios ${Math.round(pI)}%">${bar(pI,'#00838f')}<span style="font-size:0.68em;color:#777;">${Math.round(pI)}%</span></div>
                <div title="Noches ${Math.round(pN)}%">${bar(pN,'#311b92')}<span style="font-size:0.68em;color:#777;">${Math.round(pN)}%</span></div>
            </td>
        </tr>`;
    }).join('');

    const monthOptions = months.map(m => {
        if (!m) return `<option value="" ${!selectedMonth?'selected':''}>Todos los meses</option>`;
        const [yr, mo] = m.split('-');
        return `<option value="${m}" ${m===selectedMonth?'selected':''}>${MONTH_NAMES_ES[parseInt(mo)-1]} ${yr}</option>`;
    }).join('');
    const pasilloOptions = pasillos.map(p =>
        `<option value="${p}" ${p===selectedPasillo?'selected':''}>${p||'Todos los equipos'}</option>`
    ).join('');

    const sumWD  = workerStats.reduce((s,w)=>s+w.workedDays,0);
    const sumCO  = workerStats.reduce((s,w)=>s+w.compDays,0);
    const sumLB  = workerStats.reduce((s,w)=>s+w.lbreDays,0);
    const sumVC  = workerStats.reduce((s,w)=>s+w.vcDays,0);
    const sumLI  = workerStats.reduce((s,w)=>s+w.licDays+w.incDays,0);

    container.innerHTML = `
    <div style="padding:16px 20px;">
      <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;padding-bottom:14px;border-bottom:2px solid #e3f2fd;margin-bottom:16px;">
        <h3 style="margin:0;color:#1a237e;font-size:1.12em;">⏱️ Promedio de Horas Trabajadas por Auxiliar</h3>
        ${closeBtnHtml}
      </div>

      <!-- Filtros -->
      <div style="display:flex;gap:12px;flex-wrap:wrap;margin-bottom:16px;align-items:flex-end;background:#f5f7fa;border-radius:8px;padding:10px 14px;border:1px solid #e0e0e0;">
        <div style="display:flex;flex-direction:column;gap:3px;">
          <label style="font-size:0.72em;font-weight:800;color:#555;letter-spacing:0.5px;">MES</label>
          <select style="padding:6px 10px;border:1px solid #ccc;border-radius:6px;font-size:0.87em;min-width:135px;"
            onchange="document.getElementById('horasPromedioContainer').dataset.selectedMonth=this.value;renderHorasPromedioReport();">${monthOptions}</select>
        </div>
        <div style="display:flex;flex-direction:column;gap:3px;">
          <label style="font-size:0.72em;font-weight:800;color:#555;letter-spacing:0.5px;">EQUIPO / PASILLO</label>
          <select style="padding:6px 10px;border:1px solid #ccc;border-radius:6px;font-size:0.87em;min-width:145px;"
            onchange="document.getElementById('horasPromedioContainer').dataset.selectedPasillo=this.value;renderHorasPromedioReport();">${pasilloOptions}</select>
        </div>
        <div style="display:flex;flex-direction:column;gap:3px;">
          <label style="font-size:0.72em;font-weight:800;color:#555;letter-spacing:0.5px;">BUSCAR TRABAJADOR</label>
          <input type="text" placeholder="Nombre..." value="${searchText}" style="padding:6px 10px;border:1px solid #ccc;border-radius:6px;font-size:0.87em;min-width:160px;"
            oninput="document.getElementById('horasPromedioContainer').dataset.searchText=this.value;renderHorasPromedioReport();">
        </div>
        <div style="margin-left:auto;font-size:0.8em;color:#777;padding-bottom:2px;">
          <strong style="color:#1a237e;">${totalWorkers}</strong> auxiliar${totalWorkers!==1?'es':''}
          ${selectedMonth ? ' · <strong>' + (()=>{const[yr,mo]=selectedMonth.split('-');return MONTH_NAMES_ES[parseInt(mo)-1]+' '+yr;})() + '</strong>' : ''}
        </div>
      </div>

      <!-- Tarjetas resumen -->
      <div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:18px;">
        <div style="flex:1;min-width:110px;background:linear-gradient(135deg,#e3f2fd,#bbdefb);border-radius:10px;padding:11px 14px;text-align:center;border:1px solid #90caf9;">
          <div style="font-size:0.68em;color:#1565c0;font-weight:800;letter-spacing:0.5px;text-transform:uppercase;">Total Horas</div>
          <div style="font-size:1.8em;font-weight:900;color:#0d47a1;line-height:1.2;">${fmt(totalHrsAll)}</div>
          <div style="font-size:0.7em;color:#1976d2;">${sumWD} días trabajados</div>
        </div>
        <div style="flex:1;min-width:110px;background:linear-gradient(135deg,#e8f5e9,#c8e6c9);border-radius:10px;padding:11px 14px;text-align:center;border:1px solid #a5d6a7;">
          <div style="font-size:0.68em;color:#2e7d32;font-weight:800;letter-spacing:0.5px;text-transform:uppercase;">Prom. Hrs/Día</div>
          <div style="font-size:1.8em;font-weight:900;color:#1b5e20;line-height:1.2;">${fmt(avgDayAll)}</div>
          <div style="font-size:0.7em;color:#388e3c;">por día efectivo</div>
        </div>
        <div style="flex:1;min-width:110px;background:linear-gradient(135deg,#f3e5f5,#e1bee7);border-radius:10px;padding:11px 14px;text-align:center;border:1px solid #ce93d8;">
          <div style="font-size:0.68em;color:#6a1b9a;font-weight:800;letter-spacing:0.5px;text-transform:uppercase;">Prom. Hrs/Semana</div>
          <div style="font-size:1.8em;font-weight:900;color:#4a148c;line-height:1.2;">${fmt(avgWeekAll)}</div>
          <div style="font-size:0.7em;color:#7b1fa2;">promedio equipo</div>
        </div>
        <div style="flex:1;min-width:110px;background:linear-gradient(135deg,#fff8e1,#ffecb3);border-radius:10px;padding:11px 14px;text-align:center;border:1px solid #ffe082;">
          <div style="font-size:0.68em;color:#e65100;font-weight:800;letter-spacing:0.5px;text-transform:uppercase;">Prom. Hrs/Mes</div>
          <div style="font-size:1.8em;font-weight:900;color:#bf360c;line-height:1.2;">${fmt(avgMonthAll)}</div>
          <div style="font-size:0.7em;color:#f57c00;">promedio equipo</div>
        </div>
        <div style="flex:1;min-width:110px;background:linear-gradient(135deg,#fce4ec,#f8bbd0);border-radius:10px;padding:11px 14px;text-align:center;border:1px solid #f48fb1;">
          <div style="font-size:0.68em;color:#880e4f;font-weight:800;letter-spacing:0.5px;text-transform:uppercase;">COMP + LBRE</div>
          <div style="font-size:1.8em;font-weight:900;color:#ad1457;line-height:1.2;">${sumCO+sumLB}</div>
          <div style="font-size:0.7em;color:#c2185b;">${sumVC} VC · ${sumLI} LIC/INC</div>
        </div>
      </div>

      <!-- Tabla -->
      <div style="overflow-x:auto;border-radius:8px;border:1px solid #ddd;box-shadow:0 2px 8px rgba(0,0,0,0.06);">
        <table style="width:100%;border-collapse:collapse;font-size:0.83em;">
          <thead>
            <tr style="background:#1a237e;color:#fff;">
              ${sortTh('nombre','Trabajador')}
              ${sortTh('pasillo','Equipo')}
              ${sortTh('workedDays','Días Trab.','Días con turno laboral (sin COMP/LBRE/VC/LIC/INC)')}
              ${sortTh('totalHours','Total Hrs')}
              ${sortTh('avgPerDay','Prom/Día','Promedio horas por día trabajado')}
              ${sortTh('avgPerWeek','Prom/Sem','Promedio horas por semana')}
              ${sortTh('avgPerMonth','Prom/Mes','Promedio horas por mes')}
              ${sortTh('maxWeek','Max Sem.','Semana con más horas')}
              ${sortTh('minWeek','Min Sem.','Semana con menos horas')}
              ${sortTh('compDays','COMP')}
              ${sortTh('lbreDays','LBRE')}
              ${sortTh('vcDays','VC')}
              ${sortTh('licDays','LIC/INC')}
              <th style="padding:7px 6px;font-size:0.82em;">Turnos A/C/I/N</th>
              <th style="padding:7px 6px;font-size:0.82em;min-width:100px;">Distribución</th>
            </tr>
          </thead>
          <tbody>
            ${tableRows || '<tr><td colspan="15" style="text-align:center;padding:24px;color:#999;">Sin resultados para los filtros seleccionados.</td></tr>'}
          </tbody>
          <tfoot>
            <tr style="background:#e8eaf6;font-weight:700;border-top:2px solid #3949ab;font-size:0.88em;">
              <td colspan="2" style="padding:6px 8px;color:#1a237e;">TOTAL / PROMEDIO EQUIPO</td>
              <td style="text-align:center;padding:6px 4px;color:#1565c0;">${sumWD}</td>
              <td style="text-align:center;padding:6px 4px;color:#0d47a1;">${fmt(totalHrsAll)}</td>
              <td style="text-align:center;padding:6px 4px;color:#2e7d32;">${fmt(avgDayAll)}</td>
              <td style="text-align:center;padding:6px 4px;color:#4527a0;">${fmt(avgWeekAll)}</td>
              <td style="text-align:center;padding:6px 4px;color:#00838f;">${fmt(avgMonthAll)}</td>
              <td colspan="2" style="padding:6px 4px;"></td>
              <td style="text-align:center;padding:6px 4px;color:#4caf50;">${sumCO}</td>
              <td style="text-align:center;padding:6px 4px;color:#1976d2;">${sumLB}</td>
              <td style="text-align:center;padding:6px 4px;color:#d81b60;">${sumVC}</td>
              <td style="text-align:center;padding:6px 4px;color:#b71c1c;">${sumLI}</td>
              <td colspan="2" style="padding:6px 4px;"></td>
            </tr>
          </tfoot>
        </table>
      </div>
      <p style="font-size:0.72em;color:#aaa;margin-top:8px;">
        * Prom/Día excluye COMP, LBRE, VC, LIC, INC, DF, CAP, 0SP. Semana inicia el lunes. Clic en encabezado para ordenar. Color Prom/Día: 🟢 ≥6.5h · 🟠 &lt;6.5h · 🔴 ≥7.5h.
      </p>
    </div>`;

    container.style.display = 'block';
    container.scrollIntoView({ behavior: 'smooth' });
}

function renderKrebsReport() {
    const container = document.getElementById('krebsReportContainer');
    if (!container) return;

    if (appState.processedData.length === 0 || appState.dateHeaders.length === 0) {
        container.innerHTML = '<div style="padding:20px;"><p style="color:#c62828;">No hay datos cargados. Cargue el archivo Excel primero.</p></div>';
        container.style.display = 'block';
        container.scrollIntoView({ behavior: 'smooth' });
        return;
    }

    if (appState.processedData.length > 0) formSubgroups();

    const workersKrebs = appState.processedData.filter(w => !w.isPlaceholder).map(worker => {
        const cycleWD = getWorkerAisleCycleWithDates(worker);
        const score   = cycleWD.reduce((s, { aisle }) => s + getAisleDiffScore(aisle), 0);
        return { worker, cycleWD, score };
    }).sort((a, b) => b.score - a.score || a.worker.fixedData[0].localeCompare(b.worker.fixedData[0]));

    const maxScore = workersKrebs.length > 0 ? workersKrebs[0].score : 0;

    let html = `
    <div style="padding:10px; border-bottom:2px dashed #b0bec5; margin-bottom:15px; display:flex; justify-content:space-between; align-items:center;">
        <h3 style="margin:0; color:#1a237e;">🔄 Análisis Ciclos de Esfuerzo por Auxiliar</h3>
        <button onclick="document.getElementById('krebsReportContainer').style.display='none'; document.getElementById('krebsReportBtn')?.classList.remove('sidebar-btn--active');" class="btn-danger" style="padding:5px 15px; font-size:0.9em;">Cerrar</button>
    </div>
    <div style="padding:0 10px 10px;">
        <p style="font-size:0.85em; color:#666; margin:0 0 14px 0;">
            Ordenado por puntuación acumulada &nbsp;·&nbsp;
            🔴 Alto = 3 pts &nbsp; 🟡 Medio = 2 pts &nbsp; 🟢 Bajo = 1 pt &nbsp;·&nbsp;
            Últimos 6 cambios · fecha = inicio del pasillo.
        </p>
        <div class="summary-container" style="margin-top:0;">
        <table class="summary-table" style="width:100%;">
            <thead><tr>
                <th style="width:220px; text-align:left;">NOMBRE</th>
                <th style="text-align:right;">CICLO DE ROTACIONES</th>
                <th style="width:80px; text-align:center;">PUNTOS</th>
            </tr></thead>
            <tbody>`;

    workersKrebs.forEach(({ worker, cycleWD, score }) => {
        const displayCycle = cycleWD.slice(-6);
        const olderCount   = cycleWD.length - displayCycle.length;
        const olderBadge   = olderCount > 0
            ? `<span style="color:#90a4ae;font-size:0.75em;font-style:italic;margin-right:6px;vertical-align:middle;" title="${olderCount} cambio(s) anteriores no mostrados">+${olderCount} ant.</span>`
            : '';
        const cycleHTML = olderBadge + displayCycle.map(({ aisle, date }) => {
            const color = getAisleDiffColor(aisle);
            const pts   = getAisleDiffScore(aisle);
            const tc    = getAisleBadgeTextColor(aisle);
            const diff  = appState.aisleDifficulties[aisle] || 'Sin nivel';
            const fecha = formatDateShort(date);
            return `<span style="display:inline-flex;flex-direction:column;align-items:center;gap:2px;vertical-align:middle;">
                <span style="font-size:0.68em;color:#78909c;font-weight:normal;white-space:nowrap;">${fecha}</span>
                <span style="background:${color};color:${tc};padding:2px 9px;border-radius:4px;font-size:0.82em;font-weight:bold;white-space:nowrap;" title="${aisle} · ${diff} · ${pts} pts">${aisle}</span>
            </span>`;
        }).join(`<span style="color:#90a4ae;font-weight:bold;margin:0 2px;vertical-align:middle;">→</span>`);

        const isTopScore = score > 0 && score === maxScore;
        const scoreBadge = `<span style="background:${isTopScore ? '#c62828' : '#1a237e'};color:#fff;padding:2px 10px;border-radius:12px;font-weight:bold;font-size:0.9em;${isTopScore ? 'box-shadow:0 0 0 3px #ffcdd2;' : ''}" title="${isTopScore ? '🔴 Prioridad de cambio — puntuación más alta' : 'Puntuación Krebs'}">${score}${isTopScore ? ' 🔴' : ''}</span>`;
        const sg = getAisleSubgroup(worker.fixedData[1] || '');
        const sgBadge = sg
            ? `<span style="background:${sg.isComplete?'#1b5e20':'#e65100'};color:#fff;padding:0 6px;border-radius:8px;font-size:0.72em;font-weight:bold;margin-left:4px;" title="${sg.isComplete?'Subgrupo completo (A+M+B)':'Subgrupo parcial'}">SG${sg.id+1}</span>`
            : `<span style="background:#b71c1c;color:#fff;padding:0 6px;border-radius:8px;font-size:0.72em;font-weight:bold;margin-left:4px;" title="Sin subgrupo asignado">—</span>`;

        html += `<tr style="${isTopScore ? 'background:#fff5f5;' : ''}">
            <td style="font-weight:600; color:${isTopScore ? '#c62828' : '#1a237e'}; white-space:nowrap; vertical-align:middle;">${worker.fixedData[0]}${sgBadge}</td>
            <td style="text-align:right; padding:8px 6px; vertical-align:middle;">${cycleHTML}</td>
            <td style="text-align:center; vertical-align:middle;">${scoreBadge}</td>
        </tr>`;
    });

    html += `</tbody></table></div></div>`;
    container.innerHTML = html;
    container.style.display = 'block';
    container.scrollIntoView({ behavior: 'smooth' });
}

function toggleTaskReportFilter(taskId) {
    _tasksReportTaskFilter = _tasksReportTaskFilter === taskId ? null : taskId;
    renderTasksReport();
}
function toggleTaskReportMonth(month) {
    _tasksReportMonthFilter = _tasksReportMonthFilter === month ? null : month;
    renderTasksReport();
}
function clearTaskReportFilters() {
    _tasksReportTaskFilter  = null;
    _tasksReportMonthFilter = null;
    renderTasksReport();
}
function clearTaskReportMonthFilter() {
    _tasksReportMonthFilter = null;
    renderTasksReport();
}

function renderTasksReport() {
    const container = document.getElementById('tasksReportContainer');
    if (!container) return;

    const meses     = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];
    const monthFull = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
    const fmtDate   = d => { const [,m,day] = d.split('-'); return `${parseInt(day)} ${meses[parseInt(m)-1]}`; };

    // Recopilar todas las filas: slot 1 (principal) y slot 2 (segunda tarea)
    const allRows = [];
    Object.entries(appState.dailyTasks).forEach(([key, task]) => {
        const sepIdx = key.indexOf('_');
        const excelId = key.substring(0, sepIdx);
        const date    = key.substring(sepIdx + 1);
        const worker  = appState.processedData.find(w => String(w.workerExcelId) === String(excelId));
        const obs     = appState.taskNotes[key] || '';
        allRows.push({ nombre: worker ? worker.fixedData[0] : excelId, pasillo: worker ? (worker.fixedData[1] || '—') : '—', date, task, obs, slot: 1 });
    });
    Object.entries(appState.dailyTasks2 || {}).forEach(([key, task]) => {
        const sepIdx = key.indexOf('_');
        const excelId = key.substring(0, sepIdx);
        const date    = key.substring(sepIdx + 1);
        const worker  = appState.processedData.find(w => String(w.workerExcelId) === String(excelId));
        allRows.push({ nombre: worker ? worker.fixedData[0] : excelId, pasillo: worker ? (worker.fixedData[1] || '—') : '—', date, task, obs: '', slot: 2 });
    });
    allRows.sort((a, b) => a.date.localeCompare(b.date) || a.nombre.localeCompare(b.nombre) || a.slot - b.slot);

    const closeBtnHtml = `<button onclick="document.getElementById('tasksReportContainer').style.display='none';document.getElementById('tasksReportBtn')?.classList.remove('sidebar-btn--active');" class="btn-danger" style="padding:5px 15px;font-size:0.9em;">Cerrar</button>`;

    if (!allRows.length) {
        container.innerHTML = `<div style="padding:20px;">
            <div style="padding:10px;border-bottom:2px dashed #b0bec5;margin-bottom:15px;display:flex;justify-content:space-between;align-items:center;">
                <h3 style="margin:0;color:#1a237e;">📌 Informe de Ejecución de Tareas</h3>
                ${closeBtnHtml}
            </div>
            <p style="color:#999;text-align:center;padding:30px;">No hay tareas asignadas aún.</p></div>`;
        container.style.display = 'block';
        container.scrollIntoView({ behavior: 'smooth' });
        return;
    }

    // Conteo por tarea (todos los slots)
    const countByTask = {};
    PREDEFINED_TASKS.forEach(t => { countByTask[t.id] = 0; });
    allRows.forEach(r => { if (countByTask[r.task.id] !== undefined) countByTask[r.task.id]++; });

    // Tarjetas resumen — clicables para filtrar
    const summaryCards = PREDEFINED_TASKS.filter(t => countByTask[t.id] > 0).map(t => {
        const isActive = _tasksReportTaskFilter === t.id;
        const dimmed   = _tasksReportTaskFilter !== null && !isActive;
        return `
        <div onclick="toggleTaskReportFilter(${t.id})" style="
            background:${t.color}14;border:2px solid ${isActive ? t.color : t.color + '44'};
            border-radius:10px;padding:12px 18px;text-align:center;min-width:110px;flex:1;
            cursor:pointer;transition:all 0.15s;opacity:${dimmed ? '0.35' : '1'};
            ${isActive ? 'box-shadow:0 0 0 3px ' + t.color + '55;transform:scale(1.05);' : ''}
            user-select:none;" title="Clic para filtrar por ${t.name}">
            <div style="font-size:1.7em;">${t.icon}</div>
            <div style="font-size:1.5em;font-weight:900;color:${t.color};">${countByTask[t.id]}</div>
            <div style="font-size:0.75em;color:#555;font-weight:600;line-height:1.3;">${t.shortName}</div>
            ${isActive ? `<div style="font-size:0.62em;color:${t.color};margin-top:2px;font-weight:800;letter-spacing:0.5px;">▼ FILTRADO</div>` : ''}
        </div>`;
    }).join('');

    const totalCard = `
        <div onclick="clearTaskReportFilters()" style="
            background:#1a237e14;border:2px solid ${_tasksReportTaskFilter !== null ? '#1a237e' : '#1a237e44'};
            border-radius:10px;padding:12px 18px;text-align:center;min-width:110px;flex:1;
            cursor:pointer;transition:all 0.15s;user-select:none;" title="Ver todas las tareas">
            <div style="font-size:1.7em;">📊</div>
            <div style="font-size:1.5em;font-weight:900;color:#1a237e;">${allRows.length}</div>
            <div style="font-size:0.75em;color:#555;font-weight:600;">Total tareas</div>
        </div>`;

    // Filtro por mes
    const availableMonths = [...new Set(allRows.map(r => r.date.substring(0, 7)))].sort();
    const monthFilterBar = availableMonths.length > 1 ? `
        <div style="display:flex;gap:6px;flex-wrap:wrap;align-items:center;padding:8px 4px 12px;border-bottom:1px dashed #e0e0e0;margin-bottom:12px;">
            <span style="font-size:0.78em;color:#888;font-weight:700;margin-right:4px;">📅 Filtrar por mes:</span>
            ${availableMonths.map(m => {
                const [yr, mn] = m.split('-');
                const isActiveM = _tasksReportMonthFilter === m;
                return `<button onclick="toggleTaskReportMonth('${m}')" style="
                    padding:4px 13px;border-radius:20px;
                    border:1px solid ${isActiveM ? '#1565c0' : '#ddd'};
                    background:${isActiveM ? '#1565c0' : '#f5f5f5'};
                    color:${isActiveM ? '#fff' : '#555'};
                    font-size:0.82em;font-weight:${isActiveM ? '700' : '500'};
                    cursor:pointer;transition:all 0.15s;
                ">${monthFull[parseInt(mn)-1].substring(0,3)} ${yr}</button>`;
            }).join('')}
            ${_tasksReportMonthFilter ? `<button onclick="clearTaskReportMonthFilter()" style="padding:4px 10px;border-radius:20px;border:1px solid #e53935;background:#fff;color:#e53935;font-size:0.78em;cursor:pointer;font-weight:600;">✕ Ver todos</button>` : ''}
        </div>` : '';

    // Aplicar filtros
    let filteredRows = allRows;
    if (_tasksReportTaskFilter !== null) filteredRows = filteredRows.filter(r => r.task.id === _tasksReportTaskFilter);
    if (_tasksReportMonthFilter)         filteredRows = filteredRows.filter(r => r.date.startsWith(_tasksReportMonthFilter));

    const filterInfo = (_tasksReportTaskFilter !== null || _tasksReportMonthFilter) ? `
        <div style="background:#e3f2fd;border:1px solid #90caf9;border-radius:8px;padding:8px 12px;margin-bottom:10px;display:flex;justify-content:space-between;align-items:center;font-size:0.88em;flex-wrap:wrap;gap:6px;">
            <span>🔍 Mostrando <strong>${filteredRows.length}</strong> de <strong>${allRows.length}</strong> registros</span>
            <button onclick="clearTaskReportFilters()" style="background:#1565c0;color:#fff;border:none;border-radius:5px;padding:3px 10px;cursor:pointer;font-size:0.88em;font-weight:600;">✕ Limpiar filtros</button>
        </div>` : '';

    const tableRows = filteredRows.map(r => `
        <tr${r.slot === 2 ? ' style="background:#fafafa;"' : ''}>
            <td style="font-weight:600;color:#1a237e;white-space:nowrap;">${r.nombre}</td>
            <td><span style="background:#e8eaf6;color:#3949ab;padding:2px 8px;border-radius:5px;font-size:0.82em;font-weight:700;">${r.pasillo}</span></td>
            <td style="color:#555;white-space:nowrap;">${fmtDate(r.date)}</td>
            <td>${r.slot === 2
                ? `<span style="background:#f5f5f5;color:#555;border:1px dashed #bbb;padding:3px 8px;border-radius:6px;font-size:0.82em;font-weight:600;white-space:nowrap;">${r.task.icon} ${r.task.name} <span style="font-size:0.78em;color:#aaa;">(2ª tarea)</span></span>`
                : `<span style="${taskBadgeStyle(r.task)};padding:3px 10px;border-radius:6px;font-size:0.82em;font-weight:700;white-space:nowrap;">${r.task.icon} ${r.task.name}</span>`
            }</td>
            <td style="color:#555;font-size:0.85em;max-width:200px;white-space:pre-wrap;line-height:1.4;">${r.obs ? `<span title="${r.obs.replace(/"/g,'&quot;')}">📝 ${r.obs}</span>` : '<span style="color:#bbb;">—</span>'}</td>
        </tr>`).join('');

    container.innerHTML = `
        <div style="padding:10px;border-bottom:2px dashed #b0bec5;margin-bottom:15px;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;">
            <h3 style="margin:0;color:#1a237e;">📌 Informe de Ejecución de Tareas</h3>
            ${closeBtnHtml}
        </div>
        <div style="display:flex;gap:12px;flex-wrap:wrap;margin-bottom:16px;padding:0 4px;">
            ${summaryCards}
            ${totalCard}
        </div>
        ${monthFilterBar}
        ${filterInfo}
        <div class="summary-container" style="margin-top:0;">
            <table class="summary-table" style="width:100%;">
                <thead><tr>
                    <th>Trabajador</th><th>Pasillo</th><th>Fecha</th><th>Tarea</th><th>Observación</th>
                </tr></thead>
                <tbody>${tableRows.length ? tableRows : '<tr><td colspan="5" style="text-align:center;color:#bbb;padding:20px;">Sin resultados para el filtro seleccionado</td></tr>'}</tbody>
            </table>
        </div>`;
    container.style.display = 'block';
    container.scrollIntoView({ behavior: 'smooth' });
}

function renderEquidadReport() {
    const container = document.getElementById('equidadReportContainer');
    if (!container) return;

    const workers = appState.processedData;
    const closeBtnHtml = `<button onclick="document.getElementById('equidadReportContainer').style.display='none';document.getElementById('equidadBtn')?.classList.remove('sidebar-btn--active');" class="btn-danger" style="padding:5px 15px;font-size:0.9em;">Cerrar</button>`;

    if (!workers || workers.length === 0) {
        container.innerHTML = `<div style="padding:20px;"><div style="padding:10px;border-bottom:2px dashed #b0bec5;margin-bottom:15px;display:flex;justify-content:space-between;align-items:center;"><h3 style="margin:0;color:#1a237e;">⚖️ Análisis de Equidad</h3>${closeBtnHtml}</div><p style="color:#999;text-align:center;padding:30px;">No hay datos cargados.</p></div>`;
        container.style.display = 'block';
        container.scrollIntoView({ behavior: 'smooth' });
        return;
    }

    // Meses disponibles
    const monthsSet = new Set();
    appState.dateHeaders.forEach(d => monthsSet.add(d.substring(0, 7)));
    const months = Array.from(monthsSet).sort();

    const currentMonth = container.dataset.selectedMonth !== undefined ? container.dataset.selectedMonth : (months[0] || '');
    const filteredDates = currentMonth ? appState.dateHeaders.filter(d => d.startsWith(currentMonth)) : appState.dateHeaders;

    const sortCol = container.dataset.sortCol || 'nombre';
    const sortDir = container.dataset.sortDir || 'asc';

    function getShiftCategory(name) {
        if (!name) return null;
        if (/^\d+(?:\.\d+)?A/.test(name))       return 'A';
        if (/^\d+(?:\.\d+)?C/.test(name))       return 'C';
        if (/^\d+(?:\.\d+)?N/.test(name))       return 'N';
        if (/^\d+(?:\.\d+)?[iI]/.test(name))   return 'I';
        if (name === 'VC')   return 'VC';
        if (name === 'LIC')  return 'LIC';
        if (name === 'INC')  return 'INC';
        if (name === 'COMP') return 'COM';
        if (name === 'LBRE') return 'LBRE';
        return null;
    }

    const categories = ['A', 'C', 'N', 'I', 'VC', 'LIC', 'INC', 'COM', 'LBRE'];

    const workerStats = workers
        .filter(w => !w.isPlaceholder)
        .map(w => {
            const counts = { A: 0, C: 0, N: 0, I: 0, VC: 0, LIC: 0, INC: 0, COM: 0, LBRE: 0 };
            filteredDates.forEach(d => {
                const shift = w.dailyData[d];
                if (!shift) return;
                const cat = getShiftCategory(shift.name);
                if (cat) counts[cat]++;
            });
            const total = categories.reduce((s, c) => s + counts[c], 0);
            return { nombre: w.fixedData[0] || '—', ...counts, total };
        })
        .sort((a, b) => {
            let va, vb;
            if (sortCol === 'nombre') { va = a.nombre; vb = b.nombre; }
            else if (sortCol === 'pctA') { va = a.total > 0 ? a.A / a.total : 0; vb = b.total > 0 ? b.A / b.total : 0; }
            else if (sortCol === 'pctC') { va = a.total > 0 ? a.C / a.total : 0; vb = b.total > 0 ? b.C / b.total : 0; }
            else if (sortCol === 'pctN') { va = a.total > 0 ? a.N / a.total : 0; vb = b.total > 0 ? b.N / b.total : 0; }
            else { va = a[sortCol] ?? 0; vb = b[sortCol] ?? 0; }
            if (va < vb) return sortDir === 'asc' ? -1 : 1;
            if (va > vb) return sortDir === 'asc' ? 1 : -1;
            return 0;
        });

    const totals = { A: 0, C: 0, N: 0, I: 0, VC: 0, LIC: 0, INC: 0, COM: 0, LBRE: 0, total: 0 };
    workerStats.forEach(w => { categories.forEach(c => { totals[c] += w[c]; }); totals.total += w.total; });

    const catConfig = [
        { key: 'A',    label: 'Apertura',      color: '#f57c00' },
        { key: 'C',    label: 'Cierre',         color: '#1565c0' },
        { key: 'N',    label: 'Noche',          color: '#1a237e' },
        { key: 'I',    label: 'Intermedio',     color: '#00838f' },
        { key: 'VC',   label: 'Vacaciones',     color: '#d81b60' },
        { key: 'LIC',  label: 'Licencia',       color: '#558b2f' },
        { key: 'INC',  label: 'Incapacidad',    color: '#c62828' },
        { key: 'COM',  label: 'Compensatorio',  color: '#4527a0' },
        { key: 'LBRE', label: 'Libre',          color: '#0277bd' },
    ];

    const n = workerStats.length;
    const gt = totals.total || 1; // grand total, evita división por cero

    const summaryCards = catConfig.map(c => {
        const pct = totals.total > 0 ? Math.round(totals[c.key] / totals.total * 100) : 0;
        return `<div style="background:${c.color}14;border:2px solid ${c.color}44;border-radius:10px;padding:10px 14px;text-align:center;min-width:80px;flex:1;">
            <div style="font-size:0.68em;color:#555;font-weight:700;letter-spacing:0.5px;text-transform:uppercase;margin-bottom:2px;">${c.label}</div>
            <div style="font-size:1.7em;font-weight:900;color:${c.color};line-height:1.1;">${totals[c.key]}</div>
            <div style="font-size:0.75em;color:${c.color};font-weight:700;margin-top:2px;">${pct}% del total</div>
        </div>`;
    }).join('');

    const monthOptionsHtml = months.map(m => {
        const [yr, mo] = m.split('-');
        return `<option value="${m}" ${m === currentMonth ? 'selected' : ''}>${MONTH_NAMES_ES[parseInt(mo)-1]} ${yr}</option>`;
    }).join('');

    const selLabel = currentMonth ? (() => { const [yr, mo] = currentMonth.split('-'); return `${MONTH_NAMES_ES[parseInt(mo)-1]} ${yr}`; })() : 'Todos los meses';

    const colColors = { A: '#f57c00', C: '#1565c0', N: '#1a237e', I: '#00838f', VC: '#d81b60', LIC: '#558b2f', INC: '#c62828', COM: '#4527a0', LBRE: '#0277bd' };

    function pct(val, tot) { return tot > 0 ? Math.round(val / tot * 100) + '%' : '0%'; }

    function sortTh(col, label, color, extraStyle = '') {
        const active = sortCol === col;
        const arrow  = active ? (sortDir === 'asc' ? ' ▲' : ' ▼') : ' ⇅';
        const arrowStyle = active ? `color:${color};` : 'color:#bbb;font-size:0.75em;';
        return `<th style="text-align:center;cursor:pointer;user-select:none;white-space:nowrap;${extraStyle}${color ? `color:${color};` : ''}${active ? `background:${color}18;` : ''}"
            onclick="const c=document.getElementById('equidadReportContainer');const prev=c.dataset.sortCol;c.dataset.sortDir=(prev==='${col}'&&c.dataset.sortDir==='desc')?'asc':'desc';c.dataset.sortCol='${col}';renderEquidadReport();"
            title="Ordenar por ${label}">${label}<span style="${arrowStyle}">${arrow}</span></th>`;
    }

    const tableRows = workerStats.map(w => {
        const cells = categories.map(c => `<td style="text-align:center;color:${colColors[c]};font-weight:600;">${w[c]}</td>`).join('');
        const pctA = pct(w.A, w.total);
        const pctC = pct(w.C, w.total);
        const pctN = pct(w.N, w.total);
        return `<tr>
            <td style="font-weight:600;color:#1a237e;white-space:nowrap;">${w.nombre}</td>
            ${cells}
            <td style="text-align:center;font-size:0.82em;color:#f57c00;font-weight:700;">${pctA}</td>
            <td style="text-align:center;font-size:0.82em;color:#1565c0;font-weight:700;">${pctC}</td>
            <td style="text-align:center;font-size:0.82em;color:#1a237e;font-weight:700;">${pctN}</td>
            <td style="text-align:center;font-weight:700;color:#333;">${w.total}</td>
        </tr>`;
    }).join('');

    const totalCells = categories.map(c => `<td style="text-align:center;font-weight:900;color:${colColors[c]};">${totals[c]}</td>`).join('');
    const totalPctA = pct(totals.A, totals.total);
    const totalPctC = pct(totals.C, totals.total);
    const totalPctN = pct(totals.N, totals.total);

    container.innerHTML = `
    <div style="padding:10px 14px;border-bottom:2px dashed #b0bec5;margin-bottom:14px;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;">
        <h3 style="margin:0;color:#1a237e;">⚖️ Análisis de Equidad — ${selLabel}</h3>
        ${closeBtnHtml}
    </div>
    <div style="display:flex;align-items:center;gap:10px;margin-bottom:16px;padding:0 6px;flex-wrap:wrap;">
        <label style="font-weight:700;color:#333;font-size:0.88em;">📅 Filtrar por mes:</label>
        <select id="equidadMonthSelect" style="padding:6px 12px;border:2px solid #1a237e;border-radius:6px;font-size:0.88em;color:#1a237e;font-weight:600;cursor:pointer;background:#fff;">
            <option value="" ${currentMonth === '' ? 'selected' : ''}>Todos los meses</option>
            ${monthOptionsHtml}
        </select>
        <span style="font-size:0.8em;color:#888;">${n} trabajadores · ${filteredDates.length} días</span>
    </div>
    <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:20px;padding:0 4px;">
        ${summaryCards}
    </div>
    <div class="summary-container" style="margin-top:0;overflow-x:auto;">
        <table class="summary-table" style="width:100%;min-width:600px;">
            <thead>
                <tr>
                    <th style="text-align:left;min-width:150px;cursor:pointer;user-select:none;${sortCol==='nombre'?'background:#e8eaf6;':''}"
                        onclick="const c=document.getElementById('equidadReportContainer');const prev=c.dataset.sortCol;c.dataset.sortDir=(prev==='nombre'&&c.dataset.sortDir==='desc')?'asc':'desc';c.dataset.sortCol='nombre';renderEquidadReport();"
                        title="Ordenar por Nombre" rowspan="2">
                        Trabajador<span style="${sortCol==='nombre'?'color:#1a237e;':'color:#bbb;font-size:0.75em;'}">${sortCol==='nombre'?(sortDir==='asc'?' ▲':' ▼'):' ⇅'}</span>
                    </th>
                    ${sortTh('A',    'A',    '#f57c00')}
                    ${sortTh('C',    'C',    '#1565c0')}
                    ${sortTh('N',    'N',    '#1a237e')}
                    ${sortTh('I',    'I',    '#00838f')}
                    ${sortTh('VC',   'VC',   '#d81b60')}
                    ${sortTh('LIC',  'LIC',  '#558b2f')}
                    ${sortTh('INC',  'INC',  '#c62828')}
                    ${sortTh('COM',  'COM',  '#4527a0')}
                    ${sortTh('LBRE', 'LBRE', '#0277bd')}
                    ${sortTh('pctA', '%A',   '#f57c00', 'background:#fff3e0;')}
                    ${sortTh('pctC', '%C',   '#1565c0', 'background:#e3f2fd;')}
                    ${sortTh('pctN', '%N',   '#1a237e', 'background:#e8eaf6;')}
                    ${sortTh('total','Total','#333')}
                </tr>
                <tr>
                    <th colspan="9" style="text-align:center;font-size:0.72em;color:#888;font-weight:500;padding:2px 0;letter-spacing:0.3px;">Turnos trabajados</th>
                    <th colspan="3" style="text-align:center;font-size:0.72em;color:#888;font-weight:500;padding:2px 0;letter-spacing:0.3px;">% sobre total propio</th>
                    <th></th>
                </tr>
            </thead>
            <tbody>
                ${tableRows}
                <tr style="border-top:3px solid #1a237e;font-weight:900;background:#e8eaf6;">
                    <td style="color:#1a237e;font-weight:900;">TOTAL</td>
                    ${totalCells}
                    <td style="text-align:center;font-size:0.82em;color:#f57c00;font-weight:900;">${totalPctA}</td>
                    <td style="text-align:center;font-size:0.82em;color:#1565c0;font-weight:900;">${totalPctC}</td>
                    <td style="text-align:center;font-size:0.82em;color:#1a237e;font-weight:900;">${totalPctN}</td>
                    <td style="text-align:center;font-weight:900;color:#1a237e;">${totals.total}</td>
                </tr>
            </tbody>
        </table>
    </div>`;

    const monthSelect = document.getElementById('equidadMonthSelect');
    if (monthSelect) {
        monthSelect.addEventListener('change', () => {
            container.dataset.selectedMonth = monthSelect.value;
            renderEquidadReport();
        });
    }

    container.style.display = 'block';
    container.scrollIntoView({ behavior: 'smooth' });
}

function openSwapModal(seatId, suggestedTargetId, allowAny = false) {
    const seatA = appState.processedData.find(w => w.id == seatId);
    document.getElementById('swapNameA').textContent = seatA.fixedData[0] + (allowAny ? ' (Cambio Libre)' : '');
    document.getElementById('swapAisleA').textContent = seatA.fixedData[1];
    document.getElementById('swapHiddenSeatA').value = seatA.id;

    const select = document.getElementById('swapTargetSelect');
    select.innerHTML = '<option value="">-- Seleccione Posición de Destino --</option>';

    const blockedForA = getPersonBlockedAisles(seatA);
    const aisleA = seatA.fixedData[1] || '';

    const aislesMap = {};
    appState.processedData.forEach(w => {
        if(w.id == seatId) return;
        if(w.isPlaceholder) return;
        if(!allowAny && appState.swappedSeats.has(w.id)) return;
        if(!allowAny && appState.lockedPersons.has(w.id)) return;
        const aisle = w.fixedData[1] || 'Sin Pasillo';
        if(!allowAny && appState.lockedAisles.has(aisle)) return;
        // Bloqueo duro: Difícil → Difícil prohibido
        const diffA2 = appState.aisleDifficulties[aisleA] || '';
        if(diffA2 === 'Alto' && (appState.aisleDifficulties[aisle] || '') === 'Alto') return;
        // Bloqueo duro: historial últimos 3 ciclos (ambas direcciones)
        if(blockedForA.has(aisle)) return;
        if(getPersonBlockedAisles(w).has(aisleA)) return;
        if (!aislesMap[aisle]) aislesMap[aisle] = [];
        aislesMap[aisle].push(w);
    });

    Object.keys(aislesMap).sort().forEach(aisle => {
        const group = document.createElement('optgroup');
        group.label = `Pasillo: ${aisle} (${appState.aisleDifficulties[aisle] || 'Sin Nivel'})`;
        aislesMap[aisle].forEach(w => {
            const opt = document.createElement('option');
            opt.value = w.id;
            opt.textContent = `${w.fixedData[0]} (ID: ${w.workerExcelId})`;
            if(w.id == suggestedTargetId) opt.selected = true;
            group.appendChild(opt);
        });
        select.appendChild(group);
    });

    document.getElementById('swapModal').style.display = 'flex';
}

function renderManualPickerList() {
    const list = document.getElementById('mpWorkerList');
    if (!list || _mpSeatIdA === null) return;

    const seatA   = appState.processedData.find(w => w.id === _mpSeatIdA);
    const aisleA  = seatA ? (seatA.fixedData[1] || '') : '';
    const diffA   = appState.aisleDifficulties[aisleA] || '';
    const scoreA  = getAisleDiffScore(aisleA);
    const blockedForA = seatA ? getPersonBlockedAisles(seatA) : new Set();

    const effDate   = appState.rotationEffectiveDate;
    const dnaDates  = getDNADates(effDate || null);

    const aisleSgMap = {};
    appState.subgroups.forEach((sg, sgIdx) => {
        Object.values(sg.aisles).forEach(a => { if (!(a in aisleSgMap)) aisleSgMap[a] = sgIdx; });
    });

    // Calcula compatibilidad ADN: 4 cuadros, uno por fecha ADN
    // verde = turno idéntico, amarillo = mismo tipo (cobertura/fijo), gris = sin coincidencia
    function adnDots(w) {
        return dnaDates.map(date => {
            const sa = seatA?.dailyData[date];
            const sb = w.dailyData[date];
            let color = '#e0e0e0';
            if (sa && sb) {
                if (sa.name === sb.name) color = '#43a047';
                else if (sa.isCoverageShift === sb.isCoverageShift) color = '#FFFF00';
            }
            return `<span style="width:9px;height:9px;border-radius:2px;background:${color};display:inline-block;" title="${date}"></span>`;
        }).join('');
    }
    function adnScore(w) {
        let s = 0;
        dnaDates.forEach(date => {
            const sa = seatA?.dailyData[date], sb = w.dailyData[date];
            if (sa && sb) { if (sa.name === sb.name) s += 2; else if (sa.isCoverageShift === sb.isCoverageShift) s += 1; }
        });
        return s;
    }

    // Grupo de prioridad para cada candidato:
    // 0 = nivel inferior a A  → prioridad alta  (ideal)
    // 1 = nivel superior a A  → segunda opción
    // 2 = mismo nivel         → menor prioridad
    // 3 = bloqueado (historial o D→D)
    function priorityGroup(w) {
        const wAisle = w.fixedData[1] || '';
        const wDiff  = appState.aisleDifficulties[wAisle] || '';
        const wScore = getAisleDiffScore(wAisle);
        if (diffA === 'Alto' && wDiff === 'Alto') return 3;
        if (blockedForA.has(wAisle) || getPersonBlockedAisles(w).has(aisleA)) return 3;
        if (wScore < scoreA)  return 0;
        if (wScore > scoreA)  return 1;
        return 2;
    }

    // Construir lista plana ordenada
    const candidates = appState.processedData
        .filter(w => w.id !== _mpSeatIdA && !w.isPlaceholder)
        .map(w => {
            const pg           = priorityGroup(w);
            const hasPending   = appState.swappedSeats.has(w.id);
            const isTempUnlock = _mpTempUnlocked.has(w.id);
            const isOccupied   = hasPending && !isTempUnlock;
            const isLocked     = appState.lockedPersons.has(w.id);
            return { w, pg, adn: adnScore(w), hasPending, isTempUnlock, isOccupied, isLocked };
        })
        .sort((a, b) => {
            if (a.pg !== b.pg) return a.pg - b.pg;
            // dentro del mismo grupo: libres antes que ocupados
            const aFree = !a.isOccupied && !a.isLocked;
            const bFree = !b.isOccupied && !b.isLocked;
            if (aFree !== bFree) return aFree ? -1 : 1;
            // mayor compatibilidad ADN primero
            if (a.adn !== b.adn) return b.adn - a.adn;
            return a.w.fixedData[0].localeCompare(b.w.fixedData[0]);
        });

    const pgMeta = {
        0: { label: '⬇️ Nivel inferior — Prioridad alta',  bg: '#e8f5e9', color: '#1b5e20' },
        1: { label: '⬆️ Nivel superior',                   bg: '#e3f2fd', color: '#0d47a1' },
        2: { label: '↔️ Mismo nivel — Menor prioridad',    bg: '#fff8e1', color: '#6d4c00' },
        3: { label: '🚫 Bloqueados (historial / D→D)',      bg: '#ffebee', color: '#b71c1c' },
    };

    let html = '';
    let currentPg = -1;

    candidates.forEach(({ w, pg, adn, hasPending, isTempUnlock, isOccupied, isLocked }) => {
        if (pg !== currentPg) {
            currentPg = pg;
            const m = pgMeta[pg];
            html += `<div style="background:${m.bg};padding:5px 12px;font-size:0.77em;font-weight:bold;color:${m.color};border-bottom:1px solid rgba(0,0,0,0.08);position:sticky;top:0;z-index:2;">${m.label}</div>`;
        }

        const wAisle     = w.fixedData[1] || 'Sin Pasillo';
        const aisleColor = getAisleDiffColor(wAisle);
        const sgIdx      = aisleSgMap[wAisle];
        const sgTag      = sgIdx !== undefined
            ? `<span style="background:#1a237e;color:#fff;padding:0 4px;border-radius:4px;font-size:0.72em;margin-left:3px;">SG${sgIdx+1}</span>`
            : '';
        const aislePill  = `<span style="background:${aisleColor};color:${getAisleBadgeTextColor(wAisle)};padding:0 5px;border-radius:3px;font-size:0.73em;font-weight:bold;margin-left:4px;">${wAisle}${sgTag}</span>`;

        const isBlocked  = pg === 3;
        const isSelected = _mpSelectedB === w.id;
        const canSelect  = !isBlocked && !isOccupied && !isLocked;

        const rowBg      = isSelected ? '#c8e6ff' : isBlocked ? '#fff5f5' : isOccupied ? '#fafafa' : '#fff';
        const bdrLeft    = isSelected ? '#1976d2' : isBlocked ? '#ef9a9a' : 'transparent';
        const opacity    = isBlocked || isLocked ? 'opacity:0.42;' : isOccupied ? 'opacity:0.65;' : '';
        const cursor     = canSelect ? 'pointer' : 'default';

        let lockIcon = '';
        if (isBlocked) {
            const isDDBlock = diffA === 'Alto' && (appState.aisleDifficulties[wAisle] || '') === 'Alto';
            lockIcon = `<span title="${isDDBlock ? 'Difícil → Difícil no permitido en un ciclo' : 'Bloqueado por historial (últimos 3 ciclos)'}">🚫</span>`;
        } else if (isLocked) {
            lockIcon = `<span style="color:#bbb;" title="Persona bloqueada del sistema">🔒</span>`;
        } else if (isOccupied) {
            lockIcon = `<button class="mp-lock-btn" data-wid="${w.id}" style="background:none;border:none;cursor:pointer;font-size:1em;padding:0 2px;" title="Ya tiene cambio asignado · Clic para habilitar">🔓</button>`;
        } else if (isTempUnlock) {
            lockIcon = `<button class="mp-lock-btn" data-wid="${w.id}" style="background:none;border:none;cursor:pointer;font-size:1em;padding:0 2px;" title="Habilitado temporalmente · Clic para bloquear">🔒</button>`;
        }

        html += `<div class="mp-row${isOccupied ? ' mp-occupied' : ''}${isBlocked ? ' mp-history-blocked' : ''}" data-wid="${w.id}"
            style="display:flex;align-items:center;gap:7px;padding:7px 12px;border-bottom:1px solid #eee;cursor:${cursor};background:${rowBg};border-left:3px solid ${bdrLeft};box-sizing:border-box;${opacity}${isSelected ? 'font-weight:bold;' : ''}">
            <span style="width:12px;height:12px;border-radius:3px;background:${aisleColor};flex-shrink:0;border:1px solid rgba(0,0,0,0.2);"></span>
            <span style="flex:1;font-size:0.88em;">${w.fixedData[0]}${aislePill}</span>
            <span style="display:inline-flex;gap:2px;align-items:center;" title="Compatibilidad ADN">${adnDots(w)}</span>
            ${lockIcon}
        </div>`;
    });

    list.innerHTML = html || '<p style="padding:12px;color:#888;text-align:center;">No hay otros trabajadores.</p>';
    const btn = document.getElementById('executeMpSwapBtn');
    if (btn) { btn.disabled = !_mpSelectedB; btn.style.opacity = _mpSelectedB ? '1' : '0.5'; }
}

function openManualPickerModal(seatId) {
    _mpSeatIdA = parseInt(seatId);
    _mpTempUnlocked = new Set();
    _mpSelectedB = null;

    const seatA = appState.processedData.find(w => w.id === _mpSeatIdA);
    if (!seatA) return;

    document.getElementById('mpNameA').textContent = seatA.fixedData[0];
    const color = getAisleDiffColor(seatA.fixedData[1] || '');
    document.getElementById('mpAisleBadgeA').innerHTML =
        `<span style="background:${color};color:#fff;padding:1px 8px;border-radius:3px;font-size:0.9em;font-weight:bold;">${seatA.fixedData[1] || 'Sin Pasillo'}</span>`;
    document.getElementById('mpHiddenSeatA').value = _mpSeatIdA;

    renderManualPickerList();
    document.getElementById('manualPickerModal').style.display = 'flex';
}

// == MATRIX LOADING ANIMATION ==
let _matrixAnimFrame = null;
let _matrixCtx = null;
let _matrixDrops = [];

function startMatrixAnimation() {
    const canvas = document.getElementById('matrixCanvas');
    if (!canvas) return;
    canvas.width  = window.innerWidth;
    canvas.height = window.innerHeight;
    _matrixCtx = canvas.getContext('2d');

    const fs   = 15;
    const cols = Math.floor(canvas.width / fs);
    // Stagger start positions so columns don't all begin at top
    _matrixDrops = Array.from({length: cols}, () => Math.floor(Math.random() * -80));

    const baseChars  = 'アイウエオカキクケコサシスセソタチツテトナニヌネノ0123456789ABCDEF#%@$*+-';
    const brandWords = ['ALKOSTO', 'MERCADO', 'KRONOMERCADO'];
    // Each column gets a fixed corporate color: ~55% orange, ~45% blue
    const colIsOrange = Array.from({length: cols}, () => Math.random() > 0.45);
    // Word drops: col -> { word, startRow }
    const wordDrops = new Map();

    // Seed one of each brand word spread evenly across the screen at start
    brandWords.forEach((word, wi) => {
        const col = Math.floor((wi + 1) * cols / (brandWords.length + 1));
        wordDrops.set(col, { word, startRow: 8 + wi * 15 });
    });

    function draw() {
        _matrixCtx.fillStyle = 'rgba(0,0,0,0.05)';
        _matrixCtx.fillRect(0, 0, canvas.width, canvas.height);
        _matrixCtx.font = `bold ${fs}px "Courier New", monospace`;

        for (let i = 0; i < cols; i++) {
            if (_matrixDrops[i] < 0) { _matrixDrops[i]++; continue; }

            const drop = _matrixDrops[i];
            const x = i * fs;
            const y = drop * fs;

            // Determine character — brand word takes priority
            let ch = baseChars[Math.floor(Math.random() * baseChars.length)];
            let isWord = false;
            const wd = wordDrops.get(i);
            if (wd) {
                const pos = drop - wd.startRow;
                if (pos >= 0 && pos < wd.word.length) {
                    ch = wd.word[pos];
                    isWord = true;
                } else if (pos > wd.word.length + 5) {
                    wordDrops.delete(i);
                }
            }

            // Corporate colors: brand words bright orange, columns alternate orange/blue
            if (isWord) {
                _matrixCtx.fillStyle = '#ff9800';
            } else if (colIsOrange[i]) {
                _matrixCtx.fillStyle = '#f57c00';
            } else {
                _matrixCtx.fillStyle = '#42a5f5';
            }

            _matrixCtx.fillText(ch, x, y);

            // Reset column when it passes the bottom
            if (y > canvas.height && Math.random() > 0.975) {
                _matrixDrops[i] = 0;
                // ~35% chance this reset spawns a brand word
                if (!wordDrops.has(i) && Math.random() > 0.65) {
                    const word = brandWords[Math.floor(Math.random() * brandWords.length)];
                    wordDrops.set(i, { word, startRow: 0 });
                }
            }
            _matrixDrops[i]++;
        }
        _matrixAnimFrame = requestAnimationFrame(draw);
    }
    draw();
}

function stopMatrixAnimation() {
    if (_matrixAnimFrame) { cancelAnimationFrame(_matrixAnimFrame); _matrixAnimFrame = null; }
    const canvas = document.getElementById('matrixCanvas');
    if (canvas && _matrixCtx) _matrixCtx.clearRect(0, 0, canvas.width, canvas.height);
}

function updateMatrixStatus(text) {
    const el = document.getElementById('matrixStatus');
    if (!el) return;
    el.style.opacity = '0';
    setTimeout(() => { el.textContent = text; el.style.opacity = '1'; }, 200);
}

function showMatrixLoader(storeName) {
    const overlay = document.getElementById('matrixLoadingOverlay');
    if (!overlay) return;
    const nameEl = document.getElementById('matrixStoreName');
    if (nameEl) nameEl.textContent = String(storeName || '').toUpperCase();
    updateMatrixStatus('INICIANDO CONEXIÓN...');
    overlay.style.display = 'flex';
    overlay.style.opacity = '1';
    startMatrixAnimation();
}

function hideMatrixLoader() {
    const overlay = document.getElementById('matrixLoadingOverlay');
    if (!overlay) return;
    overlay.style.animation = 'matrixFadeOut 0.6s ease forwards';
    setTimeout(() => {
        overlay.style.display = 'none';
        overlay.style.animation = '';
        stopMatrixAnimation();
    }, 650);
}

// == CARGA DE DATOS DESDE GOOGLE SHEETS ==
async function loadFromGoogleSheets() {
    const url = getSheetsUrl();
    if (!url) { showToast('⚠️ Configura primero la URL de Google Sheets (Exportar → ⚙️).', 'warning'); return; }

    const dateInput   = document.getElementById('startDate');
    const numDaysInput = document.getElementById('numDays');
    const messageEl   = document.getElementById('message');

    if (!dateInput.value || !numDaysInput.value) {
        showToast('⚠️ Define primero la Fecha de Inicio y los Días a cargar.', 'warning'); return;
    }
    const startD = new Date(dateInput.value + 'T00:00:00');
    if (startD.getDay() !== 0) { showToast('❌ La Fecha de inicio debe ser Domingo.', 'error'); return; }
    const daysVal = parseInt(numDaysInput.value, 10);
    if (daysVal % 14 !== 0) { showToast('❌ Los días a cargar deben ser múltiplo de 14.', 'error'); return; }

    showMatrixLoader(selectedStore);
    messageEl.textContent = '⏳ Cargando datos desde Google Sheets...';
    messageEl.className = ''; messageEl.style.display = 'block';

    const schedName  = 'SCHED_' + (selectedStore || '');
    const plantaName = 'PLANTA_' + (selectedStore || '');

    try {
        updateMatrixStatus('CONECTANDO A GOOGLE SHEETS...');
        const [schedResp, plantaResp] = await Promise.all([
            fetch(`${url}?action=getData&sheet=${encodeURIComponent(schedName)}`).then(r => r.json()),
            fetch(`${url}?action=getData&sheet=${encodeURIComponent(plantaName)}`).then(r => r.json())
        ]);

        if (!schedResp.success)  throw new Error(`SCHED: ${schedResp.error}`);
        if (!plantaResp.success) throw new Error(`PLANTA: ${plantaResp.error}`);

        // --- Parsear PLANTA (equivalente Excel) ---
        updateMatrixStatus('DESCARGANDO DATOS DE PLANTA...');
        const plantaRows = plantaResp.data;
        if (plantaRows.length < 2) throw new Error('La hoja PLANTA está vacía.');
        const plantaHeaders = plantaRows[0].map(h => String(h).trim());
        const workerDataRaw = plantaRows.slice(1)
            .filter(row => row.some(c => c !== ''))
            .map(row => {
                const obj = {};
                plantaHeaders.forEach((h, i) => { obj[h] = (row[i] !== undefined && row[i] !== null) ? row[i] : ''; });
                return obj;
            });
        const workerDataMap = new Map(workerDataRaw.map(w => [String(w.TRABAJADOR || '').trim(), w]));

        appState.aisleDifficulties = {};
        workerDataRaw.forEach(w => {
            const pasillo = String(w.pasillo || w.PASILLO || '').trim();
            const nivel   = String(w['NIVEL DE PASILLO'] || '').trim();
            if (pasillo && nivel && !appState.aisleDifficulties[pasillo]) appState.aisleDifficulties[pasillo] = nivel;
        });

        // --- Parsear SCHED (equivalente CSV) ---
        updateMatrixStatus('DESCARGANDO HORARIOS...');
        const schedRows = schedResp.data;
        if (schedRows.length < 2) throw new Error('La hoja SCHED está vacía.');
        const schedHeaders = schedRows[0].map(h => String(h).trim());
        const schedData    = schedRows.slice(1).filter(row => row.some(c => c !== ''));

        appState.fixedHeaders = schedHeaders.slice(0, NUM_FIXED_COLUMNS);

        // Limpiar estado previo
        appState.swappedSeats.clear(); appState.lockedAisles.clear();
        appState.lockedPersons.clear(); appState.pendingSwaps = [];
        appState.rotationEffectiveDate = null; appState.weeksToHighlight.clear(); appState.noveltyWeeks.clear();
        appState.dailyTasks = {};
        appState.minStaff = parseInt(document.getElementById('minStaff').value, 10) || 0;

        // Construir dateHeaders, weeks, holidays
        appState.dateHeaders = Array.from({ length: daysVal }, (_, i) => {
            const d = new Date(startD); d.setDate(d.getDate() + i); return d.toISOString().split('T')[0];
        });
        const years = [...new Set(appState.dateHeaders.map(d => d.substring(0, 4)))];
        appState.holidays = new Set();
        years.forEach(yr => getColombianHolidays(parseInt(yr)).forEach(h => appState.holidays.add(h)));
        appState.weeks = []; let currentWeek = [];
        appState.dateHeaders.forEach(dateStr => {
            currentWeek.push(dateStr);
            if (new Date(dateStr + 'T00:00:00').getDay() === 0) { appState.weeks.push(currentWeek); currentWeek = []; }
        });
        if (currentWeek.length > 0) appState.weeks.push(currentWeek);

        // Construir processedData (mismo algoritmo que el botón "Generar y Aplicar")
        updateMatrixStatus('PROCESANDO DATOS...');
        const processedData = [];
        appState.workerMasterData = [];
        for (const [idx, scheduleRow] of schedData.entries()) {
            if (scheduleRow.length < NUM_FIXED_COLUMNS) continue;
            const workerId   = String(scheduleRow[0]).trim();
            const workerInfo = workerDataMap.get(workerId);
            if (!workerInfo || !workerInfo.NOMBRE) continue;

            const fixedData = scheduleRow.slice(0, NUM_FIXED_COLUMNS).map(v => String(v).trim());
            fixedData[0] = String(workerInfo.NOMBRE).trim();
            fixedData[1] = String(workerInfo.pasillo || workerInfo.PASILLO || fixedData[1]).trim();
            fixedData[2] = String(workerInfo.RESTRICCION || fixedData[2]).trim();
            const restrictionClass = fixedData[2].toUpperCase() === 'SI' ? 'restriccion-si' : 'restriccion-no';

            const baseShifts = {};
            appState.dateHeaders.forEach((dateStr, di) => {
                const code = String(scheduleRow[NUM_FIXED_COLUMNS + di] || '').trim();
                baseShifts[dateStr] = csvInputMap[code] || code;
            });

            const iniciaStr   = formatExcelDate(workerInfo.INICIA);
            const finalizaStr = formatExcelDate(workerInfo.FINALIZA);
            const dailyData   = {};
            appState.dateHeaders.forEach(dateStr => {
                const baseShiftName = baseShifts[dateStr];
                const inVacation = iniciaStr && finalizaStr && dateStr >= iniciaStr && dateStr <= finalizaStr;
                const shift = inVacation ? allShifts['VC'] : (allShifts[baseShiftName] || { name: baseShiftName, hours: 0, className: 'turno-OTRO', isCoverageShift: false });
                dailyData[dateStr] = { ...shift, aisle: fixedData[1] };
            });

            const placeholder = isPlaceholderWorker(fixedData[0]);
            processedData.push({ id: idx, workerExcelId: workerId, fixedData, dailyData, restrictionClass, baseShifts, isPlaceholder: placeholder });
            appState.workerMasterData.push({
                id: idx, workerExcelId: workerId,
                nombre: fixedData[0], inicia: iniciaStr, finaliza: finalizaStr,
                equipo: String(workerInfo.EQUIPO || '').trim(),
                pasillo: fixedData[1], restriccion: fixedData[2],
                isPlaceholder: placeholder
            });
        }

        if (!processedData.length) throw new Error('No se encontraron trabajadores coincidentes entre SCHED y PLANTA. Verifica que el código TRABAJADOR sea idéntico en ambas hojas.');

        appState.processedData = processedData;
        undoStack = []; const _ubu1 = document.getElementById('undoBtn'); if (_ubu1) _ubu1.disabled = true;
        updateMatrixStatus('CONSTRUYENDO PROGRAMACIÓN...');
        await new Promise(r => setTimeout(r, 400));
        applyLegalHours(); populateFilters(); renderAll(); computeAndShowMetrics(); saveAppState();

        document.getElementById('sidebar-tools').style.display = 'block';
        document.getElementById('filterControls').style.display = 'flex';
        messageEl.textContent = `✅ ${processedData.length} trabajadores cargados desde Google Sheets (${selectedStore}).`;
        messageEl.className = 'success';
        hideMatrixLoader();
        showToast(`✅ ${processedData.length} trabajadores cargados desde Sheets`, 'success');
        updateProgInfoBar();
        clearTimeout(sheetsSyncTimer); syncScheduleToSheets(false);
        loadTasksFromSheets();

    } catch (err) {
        hideMatrixLoader();
        messageEl.textContent = `🔥 Error: ${err.message}`;
        messageEl.className = 'error';
        showToast(`Error al cargar desde Sheets: ${err.message}`, 'error');
    }
}

// == BARRA DE INFO DE ÚLTIMA FECHA CARGADA ==
function updateProgInfoBar() {
    const bar    = document.getElementById('progInfoBar');
    const span   = document.getElementById('lastProgDate');
    if (!bar || !span) return;
    if (!appState.dateHeaders.length) { bar.style.display = 'none'; return; }

    const lastDate    = appState.dateHeaders[appState.dateHeaders.length - 1];
    const lastDateObj = new Date(lastDate + 'T00:00:00');
    const dayName     = lastDateObj.toLocaleDateString('es-CO', { weekday: 'long' });
    const formatted   = lastDateObj.toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: 'numeric' });
    span.textContent  = `${dayName} ${formatted}`;
    bar.style.display = 'flex';
}

// == EXTENSIÓN DE PROGRAMACIÓN SIN BORRAR DÍAS EXISTENTES ==
async function extendScheduleFromSheets() {
    const url         = getSheetsUrl();
    const lastDate    = appState.dateHeaders[appState.dateHeaders.length - 1];
    const lastDateObj = new Date(lastDate + 'T00:00:00');

    const daysVal = parseInt(document.getElementById('numDays').value, 10);
    if (!daysVal || daysVal % 14 !== 0) {
        showToast('❌ Los días a cargar deben ser múltiplo de 14.', 'error'); return;
    }

    // Siguiente domingo después del último sábado
    const nextSunday    = new Date(lastDateObj);
    nextSunday.setDate(nextSunday.getDate() + 1);
    const nextSundayStr = nextSunday.toISOString().split('T')[0];

    const messageEl = document.getElementById('message');
    messageEl.textContent = '⏳ Extendiendo programación desde Google Sheets...';
    messageEl.className = ''; messageEl.style.display = 'block';

    const existingDays = appState.dateHeaders.length;
    const schedName    = 'SCHED_' + (selectedStore || '');
    const plantaName   = 'PLANTA_' + (selectedStore || '');

    try {
        const [schedResp, plantaResp] = await Promise.all([
            fetch(`${url}?action=getData&sheet=${encodeURIComponent(schedName)}`).then(r => r.json()),
            fetch(`${url}?action=getData&sheet=${encodeURIComponent(plantaName)}`).then(r => r.json())
        ]);

        if (!schedResp.success) throw new Error(`SCHED: ${schedResp.error}`);

        const schedRows    = schedResp.data;
        if (schedRows.length < 2) throw new Error('La hoja SCHED está vacía.');
        const schedHeaders = schedRows[0].map(h => String(h).trim());
        const schedData    = schedRows.slice(1).filter(row => row.some(c => c !== ''));
        const cycleLen     = schedHeaders.length - NUM_FIXED_COLUMNS; // longitud del ciclo SCHED

        // Construir las nuevas fechas
        const newDateHeaders = Array.from({ length: daysVal }, (_, i) => {
            const d = new Date(nextSunday);
            d.setDate(d.getDate() + i);
            return d.toISOString().split('T')[0];
        });

        // Mapa de trabajador → fila SCHED
        const schedByWorker = new Map();
        for (const row of schedData) schedByWorker.set(String(row[0]).trim(), row);

        // Mapa de trabajador → datos PLANTA (vacaciones)
        let workerDataMap = new Map();
        if (plantaResp.success && plantaResp.data && plantaResp.data.length >= 2) {
            const ph = plantaResp.data[0].map(h => String(h).trim());
            const raw = plantaResp.data.slice(1)
                .filter(row => row.some(c => c !== ''))
                .map(row => { const obj = {}; ph.forEach((h, i) => { obj[h] = row[i] !== undefined ? row[i] : ''; }); return obj; });
            workerDataMap = new Map(raw.map(w => [String(w.TRABAJADOR || '').trim(), w]));
        }

        // Extender cada trabajador con las nuevas fechas
        for (const worker of appState.processedData) {
            const schedRow   = schedByWorker.get(worker.workerExcelId);
            const workerInfo = workerDataMap.get(worker.workerExcelId);
            const iniciaStr  = workerInfo ? formatExcelDate(workerInfo.INICIA)   : '';
            const finalizaStr = workerInfo ? formatExcelDate(workerInfo.FINALIZA) : '';

            newDateHeaders.forEach((dateStr, di) => {
                // Calcular posición en el ciclo SCHED considerando los días ya cargados
                const schedColIdx  = cycleLen > 0 ? (existingDays + di) % cycleLen : di;
                const code         = schedRow ? String(schedRow[NUM_FIXED_COLUMNS + schedColIdx] || '').trim() : '';
                const baseShiftName = csvInputMap[code] || code || '0SP';

                const inVacation = iniciaStr && finalizaStr && dateStr >= iniciaStr && dateStr <= finalizaStr;
                const shift = inVacation
                    ? allShifts['VC']
                    : (allShifts[baseShiftName] || { name: baseShiftName, hours: 0, className: 'turno-OTRO', isCoverageShift: false });

                worker.baseShifts[dateStr] = baseShiftName;
                worker.dailyData[dateStr]  = { ...shift, aisle: worker.fixedData[1] };
            });
        }

        // Unir los dateHeaders y reconstruir semanas + festivos
        appState.dateHeaders = [...appState.dateHeaders, ...newDateHeaders];

        const years = [...new Set(appState.dateHeaders.map(d => d.substring(0, 4)))];
        years.forEach(yr => getColombianHolidays(parseInt(yr)).forEach(h => appState.holidays.add(h)));

        appState.weeks = []; let cw = [];
        appState.dateHeaders.forEach(ds => {
            cw.push(ds);
            if (new Date(ds + 'T00:00:00').getDay() === 0) { appState.weeks.push(cw); cw = []; }
        });
        if (cw.length > 0) appState.weeks.push(cw);

        applyLegalHours(); populateFilters(); renderAll(); computeAndShowMetrics(); saveAppState();
        updateProgInfoBar();

        const lastNew = newDateHeaders[newDateHeaders.length - 1];
        messageEl.textContent = `✅ Programación extendida: ${daysVal} días adicionales (total ${appState.dateHeaders.length} días, hasta ${lastNew}).`;
        messageEl.className = 'success';
        showToast(`✅ Extendido hasta ${lastNew} — ${appState.dateHeaders.length} días en total`, 'success');
        clearTimeout(sheetsSyncTimer); syncScheduleToSheets(false);

    } catch (err) {
        messageEl.textContent = `🔥 Error al extender: ${err.message}`;
        messageEl.className = 'error';
        showToast(`Error al extender programación: ${err.message}`, 'error');
    }
}

// == CARGA AUTOMÁTICA DESDE PROG AL INICIAR SESIÓN ==
async function autoLoadFromProgSheet() {
    const url = getSheetsUrl();
    if (!url) {
        hideSplash();
        if (currentRole === 'admin' && localStorage.getItem(getStateKey())) document.getElementById('restoreSessionBtn').style.display = 'block';
        return;
    }

    const _splashSt = document.getElementById('splashStatus');
    if (_splashSt) _splashSt.textContent = 'Sincronizando programación...';
    updateSheetsSyncStatus('⏳ Buscando programación en Base de Datos...', '#1565c0');

    const progName   = 'PROG_' + (selectedStore || '');
    const plantaName = 'PLANTA_' + (selectedStore || '');
    const PROG_FIXED = 4; // TRABAJADOR (código), NOMBRE, EQUIPO, RESTRICCION

    try {
        const [progResp, plantaResp] = await Promise.all([
            fetch(`${url}?action=getData&sheet=${encodeURIComponent(progName)}`).then(r => r.json()),
            fetch(`${url}?action=getData&sheet=${encodeURIComponent(plantaName)}`).then(r => r.json())
        ]);

        // Sin datos en PROG → usar localStorage como fallback
        if (!progResp.success || !progResp.data || progResp.data.length < 3) {
            hideSplash();
            updateSheetsSyncStatus(progResp.success ? '' : '⚠️ Sin datos en Base de Datos', '#e65100');
            if (currentRole === 'admin' && localStorage.getItem(getStateKey())) document.getElementById('restoreSessionBtn').style.display = 'block';
            return;
        }

        const progData  = progResp.data;
        // fila 0 = meta, fila 1 = encabezados, fila 2+ = datos
        const headerRow = progData[1].map(h => String(h).trim());
        const dateHeaders = headerRow.slice(PROG_FIXED).filter(h => /^\d{4}-\d{2}-\d{2}$/.test(h));

        if (!dateHeaders.length) {
            hideSplash();
            updateSheetsSyncStatus('', '');
            if (currentRole === 'admin' && localStorage.getItem(getStateKey())) document.getElementById('restoreSessionBtn').style.display = 'block';
            return;
        }

        // Parsear PLANTA para metadatos (nombre, vacaciones, dificultad)
        let workerDataMap = new Map();
        appState.aisleDifficulties = {};
        if (plantaResp.success && plantaResp.data && plantaResp.data.length >= 2) {
            const ph = plantaResp.data[0].map(h => String(h).trim());
            const workerDataRaw = plantaResp.data.slice(1)
                .filter(row => row.some(c => c !== ''))
                .map(row => { const obj = {}; ph.forEach((h, i) => { obj[h] = row[i] !== undefined ? row[i] : ''; }); return obj; });
            workerDataMap = new Map(workerDataRaw.map(w => [String(w.TRABAJADOR || '').trim(), w]));
            workerDataRaw.forEach(w => {
                const pasillo = String(w.pasillo || w.PASILLO || '').trim();
                const nivel   = String(w['NIVEL DE PASILLO'] || '').trim();
                if (pasillo && nivel && !appState.aisleDifficulties[pasillo]) appState.aisleDifficulties[pasillo] = nivel;
            });
        }

        // Establecer inputs de fecha
        document.getElementById('startDate').value = dateHeaders[0];
        document.getElementById('numDays').value   = String(dateHeaders.length);

        // Construir appState base
        appState.dateHeaders = dateHeaders;
        appState.fixedHeaders = ['TRABAJADOR', 'EQUIPO', 'COD NOMI'];
        appState.swappedSeats.clear(); appState.lockedAisles.clear();
        appState.lockedPersons.clear(); appState.pendingSwaps = [];
        appState.rotationEffectiveDate = null; appState.weeksToHighlight.clear(); appState.noveltyWeeks.clear(); appState.minStaff = 0;

        // Semanas y festivos
        const years = [...new Set(dateHeaders.map(d => d.substring(0, 4)))];
        appState.holidays = new Set();
        years.forEach(yr => getColombianHolidays(parseInt(yr)).forEach(h => appState.holidays.add(h)));
        appState.weeks = []; let cw = [];
        dateHeaders.forEach(ds => { cw.push(ds); if (new Date(ds + 'T00:00:00').getDay() === 0) { appState.weeks.push(cw); cw = []; } });
        if (cw.length > 0) appState.weeks.push(cw);

        // Construir processedData desde las filas del PROG
        const dataRows = progData.slice(2).filter(row => row.some(c => c !== ''));
        const processedData = [];
        appState.workerMasterData = [];

        for (const [idx, row] of dataRows.entries()) {
            if (row.length < PROG_FIXED) continue;
            const workerExcelId = String(row[0]).trim();
            const nombre        = String(row[1]).trim();
            const equipo        = String(row[2]).trim();
            const restriccion   = String(row[3]).trim();
            if (!nombre && !workerExcelId) continue;

            const fixedData = [nombre || workerExcelId, equipo, restriccion];
            const restrictionClass = restriccion.toUpperCase() === 'SI' ? 'restriccion-si' : 'restriccion-no';

            const workerInfo  = workerDataMap.get(workerExcelId);
            const iniciaStr   = workerInfo ? formatExcelDate(workerInfo.INICIA)   : '';
            const finalizaStr = workerInfo ? formatExcelDate(workerInfo.FINALIZA) : '';

            const dailyData  = {};
            const baseShifts = {};
            dateHeaders.forEach((ds, di) => {
                const shiftName = String(row[PROG_FIXED + di] || '').trim();
                const shift = allShifts[shiftName] || { name: shiftName || '0SP', hours: 0, className: 'turno-OTRO', isCoverageShift: false };
                dailyData[ds]  = { ...shift, aisle: equipo };
                baseShifts[ds] = shiftName === 'VC' ? '0SP' : (shiftName || '0SP');
            });

            const placeholder3 = isPlaceholderWorker(fixedData[0]);
            processedData.push({ id: idx, workerExcelId, fixedData, dailyData, restrictionClass, baseShifts, isPlaceholder: placeholder3 });
            appState.workerMasterData.push({
                id: idx, workerExcelId,
                nombre: fixedData[0], inicia: iniciaStr, finaliza: finalizaStr,
                equipo: workerInfo ? String(workerInfo.EQUIPO || '').trim() : '',
                pasillo: equipo, restriccion, isPlaceholder: placeholder3
            });
        }

        if (!processedData.length) {
            hideSplash();
            updateSheetsSyncStatus('⚠️ PROG sin trabajadores válidos', '#e65100');
            if (currentRole === 'admin' && localStorage.getItem(getStateKey())) document.getElementById('restoreSessionBtn').style.display = 'block';
            return;
        }

        appState.processedData = processedData;
        undoStack = []; const _ubu2 = document.getElementById('undoBtn'); if (_ubu2) _ubu2.disabled = true;
        applyLegalHours();
        const _splashSt2 = document.getElementById('splashStatus');
        if (_splashSt2) _splashSt2.textContent = 'Construyendo programación...';
        await loadDistributionFromSheets(); // restaurar aisles por día y estado de rotación
        await loadTasksFromSheets();        // restaurar tareas e historial de observaciones
        populateFilters(); renderAll(); computeAndShowMetrics();
        if (currentRole === 'admin') saveAppState();

        document.getElementById('sidebar-tools').style.display = 'block';
        document.getElementById('filterControls').style.display = 'flex';
        if (currentRole === 'marcaciones') applyMarcacionesMode();
        else if (currentRole === 'vermimalla') applyVerMiMallaMode();

        const messageEl = document.getElementById('message');
        messageEl.textContent = `✅ Programación restaurada desde Google Sheets: ${processedData.length} trabajadores.`;
        messageEl.className = 'success'; messageEl.style.display = 'block';

        showToast(`✅ ${processedData.length} trabajadores cargados desde Sheets`, 'success');
        updateProgInfoBar();
        updateSheetsSyncStatus(`🗄️ Base de Datos: restaurado ${new Date().toLocaleTimeString('es-CO')}`, '#2e7d32');
        hideSplash();

    } catch (err) {
        hideSplash();
        updateSheetsSyncStatus('⚠️ Error al conectar con Base de Datos', '#e65100');
        if (currentRole === 'admin' && localStorage.getItem(getStateKey())) document.getElementById('restoreSessionBtn').style.display = 'block';
    }
}

// == GOOGLE SHEETS SYNC ==
let sheetsSyncTimer = null;

const DEFAULT_SHEETS_URL = 'https://script.google.com/macros/s/AKfycbxXE_z14kyu-RxREklKXmp7QSXnjEzsUApyY7S3fwhPeida7jvSg39wlxyr5FrqoAN_/exec';

function getSheetsUrl() {
    return localStorage.getItem('kronoSheetsUrl_' + selectedStore) || DEFAULT_SHEETS_URL;
}

function updateSheetsSyncStatus(text, color) {
    const el = document.getElementById('sheetsSyncStatus');
    if (!el) return;
    el.style.color = text ? (color || '#555') : '#8fa0b5';
    el.textContent = text || '';
}

function syncScheduleToSheets(silent = false) {
    const url = getSheetsUrl();
    if (!url) {
        if (!silent) showToast('⚠️ Configura la URL de Google Sheets primero (Exportar → ⚙️ Configurar).', 'warning');
        return;
    }
    if (!appState.processedData.length) {
        if (!silent) showToast('⚠️ No hay datos de programación para sincronizar.', 'warning');
        return;
    }

    const syncBtn = document.getElementById('sheetsSyncBtn');
    if (syncBtn) { syncBtn.disabled = true; syncBtn.textContent = '⏳ Guardando...'; }
    updateSheetsSyncStatus('⏳ Sincronizando con Google Sheets...', '#1565c0');

    // Build headers: TRABAJADOR (código), NOMBRE, EQUIPO, RESTRICCION, luego fechas
    const headers = ['TRABAJADOR', 'NOMBRE', 'EQUIPO', 'RESTRICCION', ...appState.dateHeaders];

    // Build data rows (one per worker)
    const rows = appState.processedData.map(worker => {
        const shifts = appState.dateHeaders.map(d => worker.dailyData[d]?.name || '');
        return [worker.workerExcelId || '', worker.fixedData[0], worker.fixedData[1], worker.fixedData[2] || '', ...shifts];
    });

    const payload = {
        sheetName: 'PROG_' + (selectedStore || 'SIN_TIENDA'),
        store: selectedStore || '',
        timestamp: new Date().toLocaleString('es-CO', { timeZone: 'America/Bogota' }),
        headers,
        rows
    };

    fetch(url, {
        method: 'POST',
        body: JSON.stringify(payload),
        headers: { 'Content-Type': 'text/plain' }
    })
    .then(r => r.json())
    .then(result => {
        if (result.success) {
            if (!silent) showToast(`✅ Programación guardada en Google Sheets (${result.rows} trabajadores).`, 'success');
            updateSheetsSyncStatus(`🗄️ Base de Datos: guardado ${new Date().toLocaleTimeString('es-CO')}`, '#2e7d32');
        } else {
            showToast(`❌ Error al guardar en Sheets: ${result.error}`, 'error');
            updateSheetsSyncStatus('❌ Error al sincronizar', '#c62828');
        }
    })
    .catch(err => {
        showToast(`❌ Error de conexión con Sheets: ${err.message}`, 'error');
        updateSheetsSyncStatus('❌ Sin conexión a Sheets', '#c62828');
    })
    .finally(() => {
        if (syncBtn) { syncBtn.disabled = false; syncBtn.textContent = '☁️ Guardar en Google Sheets'; }
    });
}

function scheduleSheetsSync() {
    if (!getSheetsUrl() || !appState.processedData.length) return;
    clearTimeout(sheetsSyncTimer);
    sheetsSyncTimer = setTimeout(() => syncScheduleToSheets(true), 4000);
}

// == DISTRIBUCIÓN Y ROTACIÓN — PERSISTENCIA EN SHEETS ==
let distSyncTimer = null;

function scheduleDistSync() {
    if (!getSheetsUrl() || !appState.processedData.length) return;
    clearTimeout(distSyncTimer);
    distSyncTimer = setTimeout(() => syncDistributionToSheets(true), 4000);
}

function syncDistributionToSheets(silent = false) {
    const url = getSheetsUrl();
    if (!url || !appState.processedData.length || !appState.dateHeaders.length) return;

    // Estado de rotación como JSON en metadatos (fila 1, col 3)
    const rotationState = JSON.stringify({
        swappedSeats: Array.from(appState.swappedSeats),
        lockedAisles: Array.from(appState.lockedAisles),
        lockedPersons: Array.from(appState.lockedPersons),
        pendingSwaps: appState.pendingSwaps,
        rotationEffectiveDate: appState.rotationEffectiveDate
    });

    const headers = ['NOMBRE', ...appState.dateHeaders];
    const rows = appState.processedData.map(worker => {
        const aisles = appState.dateHeaders.map(d => worker.dailyData[d]?.aisle || worker.fixedData[1]);
        return [worker.fixedData[0] || '', ...aisles];
    });

    const payload = {
        sheetName: 'DIST_' + (selectedStore || 'SIN_TIENDA'),
        store: selectedStore || '',
        timestamp: new Date().toLocaleString('es-CO', { timeZone: 'America/Bogota' }),
        metaTitle: 'Distribución',
        metaExtra: rotationState,
        frozenCols: 1,
        headers,
        rows
    };

    fetch(url, {
        method: 'POST',
        body: JSON.stringify(payload),
        headers: { 'Content-Type': 'text/plain' }
    })
    .then(r => r.json())
    .then(result => {
        if (!result.success && !silent) showToast(`❌ Error al guardar distribución: ${result.error}`, 'error');
    })
    .catch(() => {});
}

async function loadDistributionFromSheets() {
    const url = getSheetsUrl();
    if (!url || !appState.processedData.length || !appState.dateHeaders.length) return;

    const distName = 'DIST_' + (selectedStore || '');
    try {
        const resp = await fetch(`${url}?action=getData&sheet=${encodeURIComponent(distName)}`).then(r => r.json());
        if (!resp.success || !resp.data || resp.data.length < 3) return;

        const distData = resp.data;

        // Fila 0 col 2 = JSON de estado de rotación
        try {
            const rotState = JSON.parse(String(distData[0][2] || ''));
            if (rotState && typeof rotState === 'object') {
                appState.swappedSeats       = new Set(rotState.swappedSeats || []);
                appState.lockedAisles       = new Set(rotState.lockedAisles || []);
                appState.lockedPersons      = new Set(rotState.lockedPersons || []);
                appState.pendingSwaps       = rotState.pendingSwaps || [];
                appState.rotationEffectiveDate = rotState.rotationEffectiveDate || null;
            }
        } catch(e) { /* sin estado de rotación guardado, se ignora */ }

        // Fila 1 = headers: NOMBRE, fecha1, fecha2...
        const headerRow      = distData[1].map(h => String(h).trim());
        const distDateHeaders = headerRow.slice(1);

        // Fila 2+ = un trabajador por fila con su pasillo por día
        for (const row of distData.slice(2)) {
            const workerName = String(row[0]).trim();
            if (!workerName) continue;
            const worker = appState.processedData.find(w => w.fixedData[0] === workerName);
            if (!worker) continue;
            distDateHeaders.forEach((dateStr, di) => {
                const aisle = String(row[1 + di] || '').trim();
                if (aisle && worker.dailyData[dateStr]) {
                    worker.dailyData[dateStr] = { ...worker.dailyData[dateStr], aisle };
                }
            });
        }
    } catch(e) { /* DIST aún no existe, se ignora */ }
}

window.addEventListener('beforeunload', () => { if(appState.processedData.length > 0) saveAppState(); });

// == INICIALIZACIÓN ==
// ── Splash screen helpers ──────────────────────────────────
function showSplash(msg) {
    const el = document.getElementById('splashScreen');
    if (!el) return;
    el.classList.remove('splash-out');
    el.style.display = 'flex';
    if (msg) { const st = document.getElementById('splashStatus'); if (st) st.textContent = msg; }
}
function hideSplash() {
    const el = document.getElementById('splashScreen');
    if (!el || el.style.display === 'none') return;
    el.classList.add('splash-out');
    setTimeout(() => { el.style.display = 'none'; el.classList.remove('splash-out'); }, 680);
}

document.addEventListener('DOMContentLoaded', () => {
    // Ocultar splash intro después de 3 s
    setTimeout(hideSplash, 3000);

    // Accordion del sidebar
    document.querySelectorAll('.sidebar-group-header').forEach(header => {
        header.addEventListener('click', () => {
            header.closest('.sidebar-group').classList.toggle('open');
        });
    });

    initShifts();

    const attachEvt = (id, event, handler) => { const el = document.getElementById(id); if (el) el.addEventListener(event, handler); };

    attachEvt('toggleFullscreenBtn', 'click', () => {
        isFullscreen = !isFullscreen;
        const sidebar = document.getElementById('sidebarMenu'); const initPanel = document.getElementById('initialConfigPanel');
        if (isFullscreen) { if(sidebar) sidebar.classList.add('fullscreen-hidden'); if(initPanel) initPanel.classList.add('fullscreen-hidden'); }
        else { if(sidebar) sidebar.classList.remove('fullscreen-hidden'); if(initPanel) initPanel.classList.remove('fullscreen-hidden'); }
    });

    // Toggle sidebar en móvil
    function openMobileSidebar() {
        const sb = document.getElementById('sidebarMenu');
        const ov = document.getElementById('sidebarOverlay');
        if (sb) sb.classList.add('sidebar-open');
        if (ov) ov.classList.add('active');
    }
    function closeMobileSidebar() {
        const sb = document.getElementById('sidebarMenu');
        const ov = document.getElementById('sidebarOverlay');
        if (sb) sb.classList.remove('sidebar-open');
        if (ov) ov.classList.remove('active');
    }
    attachEvt('sidebarToggleBtn', 'click', openMobileSidebar);
    attachEvt('sidebarOverlay',   'click', closeMobileSidebar);
    // Cerrar sidebar al pulsar cualquier botón del sidebar en móvil
    const sidebarMenu = document.getElementById('sidebarMenu');
    if (sidebarMenu) {
        sidebarMenu.addEventListener('click', (e) => {
            if (e.target.classList.contains('sidebar-btn') && window.innerWidth <= 768) {
                closeMobileSidebar();
            }
        });
    }

    // Manejo de selección de rol
    document.querySelectorAll('.btn-role').forEach(btn => {
        btn.addEventListener('click', () => {
            currentRole = btn.dataset.role;
            const roleLabel = currentRole === 'admin' ? '🔧 Administrador' : currentRole === 'marcaciones' ? '📋 Marcaciones' : '📅 Ver Mi Malla';
            document.getElementById('role-selected-label').textContent = roleLabel;
            document.getElementById('step-role').style.display = 'none';
            document.getElementById('step-store').style.display = 'block';
        });
    });

    attachEvt('backToRoleBtn', 'click', () => {
        currentRole = null;
        document.getElementById('step-store').style.display = 'none';
        document.getElementById('step-role').style.display = 'block';
    });

    // Manejo de selección de tienda
    document.querySelectorAll('.btn-store').forEach(btn => {
        btn.addEventListener('click', () => {
            selectedStore = btn.dataset.store;
            document.getElementById('store-selected-label').textContent = selectedStore;
            document.getElementById('step-store').style.display = 'none';
            document.getElementById('step-password').style.display = 'block';
            document.getElementById('passwordInput').value = '';
            document.getElementById('passwordInput').focus();
        });
    });

    attachEvt('backToStoreBtn', 'click', () => {
        selectedStore = null;
        document.getElementById('step-password').style.display = 'none';
        document.getElementById('step-store').style.display = 'block';
    });

    const performLogin = () => {
        const pwd = document.getElementById('passwordInput').value;
        const isAdmin = currentRole === 'admin' && pwd.toUpperCase() === getAdminKey();
        const isMarcaciones = pwd === 'MARCA1' && currentRole === 'marcaciones';
        const isVerMiMalla = currentRole === 'vermimalla' && pwd.toUpperCase() === (selectedStore || '');
        if (!isAdmin && !isMarcaciones && !isVerMiMalla) { showToast('Contraseña incorrecta.', 'error'); return; }

        document.getElementById('store-label').textContent = selectedStore || '';
        document.getElementById('view-login').style.display = 'none';
        document.getElementById('view-login').classList.remove('active-view');
        document.getElementById('view-app').style.display = 'flex';

        // Actualizar label del botón de sincronización
        const progBtn = document.getElementById('loadFromProgBtn');
        if (progBtn) progBtn.textContent = `🔄 Sincronizar con PROG_${selectedStore || ''}`;

        // Limpiar estado de la sesión anterior antes de cargar la nueva tienda
        appState.processedData = []; appState.dateHeaders = []; appState.weeks = [];
        appState.workerMasterData = []; appState.pendingSwaps = [];
        appState.swappedSeats.clear(); appState.lockedAisles.clear();
        appState.lockedPersons.clear(); appState.rotationEffectiveDate = null;
        document.getElementById('outputContainer').innerHTML = '';
        document.getElementById('summaryContainer').innerHTML = '';
        document.getElementById('sidebar-tools').style.display = 'none';
        document.getElementById('filterControls').style.display = 'none';
        document.getElementById('restoreSessionBtn').style.display = 'none';
        updateSheetsSyncStatus('', '');

        if (isMarcaciones) {
            applyMarcacionesMode();
        } else if (isVerMiMalla) {
            applyVerMiMallaMode();
        }

        // Mostrar splash de carga y sincronizar con Base de Datos
        showSplash('Conectando con Base de Datos...');
        autoLoadFromProgSheet();
    };

    attachEvt('loginBtn', 'click', performLogin);
    attachEvt('passwordInput', 'keypress', (e) => { if(e.key === 'Enter') performLogin(); });

    attachEvt('logoutBtn', 'click', () => {
        if (currentRole === 'admin' && appState.processedData.length > 0) {
            saveAppState();
            clearTimeout(sheetsSyncTimer);
            syncScheduleToSheets(false);
            showToast('💾 Guardando respaldo en Google Sheets...', 'success');
        }
        currentRole = null;
        document.getElementById('view-app').style.display = 'none';
        document.getElementById('view-logout').style.display = 'flex';
        document.getElementById('view-logout').classList.add('active-view');
    });
    attachEvt('reloginBtn', 'click', () => {
        selectedStore = null;
        currentRole = null;
        document.getElementById('view-logout').style.display = 'none';
        document.getElementById('view-logout').classList.remove('active-view');
        document.getElementById('passwordInput').value = '';
        document.getElementById('step-password').style.display = 'none';
        document.getElementById('step-store').style.display = 'none';
        document.getElementById('step-role').style.display = 'block';
        document.getElementById('view-login').style.display = 'flex';
        document.getElementById('view-login').classList.add('active-view');
    });

    attachEvt('restoreSessionBtn', 'click', loadAppState);

    attachEvt('closeMetricsBtn', 'click', () => { document.getElementById('metricsModal').style.display = 'none'; });

    attachEvt('seasonBtn', 'click', () => {
        const seasonMonths =[3, 7, 11]; const compDaysOfWeek =[1, 2, 3, 4, 5];
        appState.weeksToHighlight.clear(); appState.noveltyWeeks.clear();
        const weeksToApplyIndices = new Set();
        appState.weeks.forEach((weekDates, index) => { if (seasonMonths.includes(new Date(weekDates[0] + 'T00:00:00').getMonth())) weeksToApplyIndices.add(index); });
        appState.weeks.forEach((_, index) => { if (weeksToApplyIndices.has(index + 1)) weeksToApplyIndices.add(index); });

        // REGLA DE TEMPORADA: el domingo con LBRE se trabaja (hereda el último turno
        // laborado de esa semana) y genera un COMP la semana INMEDIATAMENTE siguiente.
        let sundaysWorked = 0;
        appState.weeks.forEach((weekDates, index) => {
            if (!weeksToApplyIndices.has(index) || weekDates.length !== 7) return;
            const firstDateObj = new Date(weekDates[0] + 'T00:00:00'); const firstMonth = firstDateObj.getMonth(); const nextMonth = (firstMonth + 1) % 12;
            const associatedSeasonMonthIndex = seasonMonths.includes(firstMonth) ? firstMonth : (seasonMonths.includes(nextMonth) ? nextMonth : -1);
            if (associatedSeasonMonthIndex === -1) return;
            const yearOfBoundary = (associatedSeasonMonthIndex < firstMonth) ? firstDateObj.getFullYear() + 1 : firstDateObj.getFullYear();
            const lastDayStr = new Date(yearOfBoundary, associatedSeasonMonthIndex + 1, 0).toISOString().split('T')[0];
            const sundayStr = weekDates.find(d => new Date(d + 'T00:00:00').getDay() === 0);
            if (!sundayStr || sundayStr > lastDayStr) return;
            const nextWeek = appState.weeks[index + 1];

            let compDayIndex = 0;
            appState.processedData.forEach(worker => {
                if (worker.dailyData[sundayStr]?.name !== 'LBRE') return;
                // El domingo se trabaja con el último turno laborado de esa semana.
                // El cambio se escribe en baseShifts (turno BASE, no el equivalente ya
                // subido a 7h/8h) para que applyLegalHours recalcule la semana completa:
                // al dejar de ser "domingo LBRE", la semana pasa de equivalentes 7h a la
                // regla normal (sáb/dom en 8h, resto en 6.5h según corresponda).
                const sourceDate = weekDates.slice(0, 6).reverse().find(d => (worker.dailyData[d]?.hours || 0) > 0);
                if (!sourceDate) return;
                const sourceBaseName = worker.baseShifts?.[sourceDate];
                if (worker.baseShifts && sourceBaseName && allShifts[sourceBaseName]) {
                    worker.baseShifts[sundayStr] = sourceBaseName;
                    worker.dailyData[sundayStr] = { ...allShifts[sourceBaseName], aisle: worker.dailyData[sundayStr].aisle };
                } else {
                    worker.dailyData[sundayStr] = { ...worker.dailyData[sourceDate], aisle: worker.dailyData[sundayStr].aisle };
                }
                appState.weeksToHighlight.add(`${worker.id}:${sundayStr}`);
                sundaysWorked++;
                // Domingo trabajado → COMP la semana siguiente (L-V, rotando el día,
                // sobre un día que tenga turno laborado). También en baseShifts para
                // que applyLegalHours no lo revierta al turno base.
                if (!nextWeek) return;
                for (let k = 0; k < compDaysOfWeek.length; k++) {
                    const dayToComp = compDaysOfWeek[(compDayIndex + k) % compDaysOfWeek.length];
                    const compDateStr = nextWeek.find(d => new Date(d + 'T00:00:00').getDay() === dayToComp);
                    if (compDateStr && (worker.dailyData[compDateStr]?.hours || 0) > 0) {
                        worker.dailyData[compDateStr] = { ...allShifts['COMP'], aisle: worker.dailyData[compDateStr].aisle };
                        if (worker.baseShifts) worker.baseShifts[compDateStr] = 'COMP';
                        appState.weeksToHighlight.add(`${worker.id}:${compDateStr}`);
                        break;
                    }
                }
                compDayIndex++;
            });
        });

        // RE-CÁLCULO DE HORAS: con los domingos ya trabajados en baseShifts, la lógica
        // semanal reajusta los equivalentes 6.5h/7h/8h de cada semana según corresponda.
        applyLegalHours();

        // AUDITORÍA DE NOVEDADES: COMP que no aplica →
        //   (a) dos o más COMP en la misma semana, o
        //   (b) COMP en una semana cuyo domingo anterior fue LBRE (no se trabajó).
        // La semana completa se marca en rojo (clase turno-NOVEDAD).
        let noveltyCount = 0;
        appState.processedData.forEach(worker => {
            appState.weeks.forEach((weekDates, index) => {
                const comps = weekDates.filter(d => worker.dailyData[d]?.name === 'COMP');
                if (comps.length === 0) return;
                const prevWeek = appState.weeks[index - 1];
                const prevSunday = prevWeek ? prevWeek.find(d => new Date(d + 'T00:00:00').getDay() === 0) : null;
                const sundayWasFree = prevSunday ? worker.dailyData[prevSunday]?.name === 'LBRE' : false;
                if (comps.length >= 2 || sundayWasFree) {
                    weekDates.forEach(d => appState.noveltyWeeks.add(`${worker.id}:${d}`));
                    noveltyCount++;
                }
            });
        });

        renderAll(); saveAppState();
        const noveltyMsg = noveltyCount > 0 ? ` ⚠️ ${noveltyCount} semana(s) con NOVEDAD (COMP que no aplica) marcadas en rojo.` : '';
        showToast(`Temporadas aplicadas: ${sundaysWorked} domingo(s) LBRE ahora trabajados con COMP la semana siguiente.${noveltyMsg}`, noveltyCount > 0 ? 'warning' : 'success');
    });

    attachEvt('correctionBtn', 'click', () => {
        let correctionsMade = 0; const fixSadofe = confirm("¿Desea corregir los turnos del equipo SADOFE?\n(Sábados y Festivos se igualarán al Domingo)");
        appState.processedData.forEach(worker => {
            if (fixSadofe && worker.fixedData[1] && worker.fixedData[1].toUpperCase().includes('SADOFE')) {
                appState.weeks.forEach(weekDates => {
                    const sunDate = weekDates.find(d => new Date(d + 'T00:00:00').getDay() === 0);
                    const satDate = weekDates.find(d => new Date(d + 'T00:00:00').getDay() === 6);
                    if (sunDate && worker.dailyData[sunDate]) {
                        const sunShift = { ...worker.dailyData[sunDate] };
                        if (satDate && worker.dailyData[satDate]) { worker.dailyData[satDate] = { ...sunShift, aisle: worker.dailyData[satDate].aisle }; appState.weeksToHighlight.add(`${worker.id}:${satDate}`); correctionsMade++; }
                        weekDates.forEach(dateStr => { if (appState.holidays.has(dateStr) && dateStr !== sunDate) { worker.dailyData[dateStr] = { ...sunShift, aisle: worker.dailyData[dateStr].aisle }; appState.weeksToHighlight.add(`${worker.id}:${dateStr}`); correctionsMade++; } });
                    }
                });
            }
            appState.weeks.forEach(weekDates => {
                let weeklyTotalHours = weekDates.reduce((sum, d) => sum + (worker.dailyData[d]?.hours || 0), 0);
                let targetHours = Math.abs(weeklyTotalHours - 44) < Math.abs(weeklyTotalHours - 52) ? 44 : 52;
                const diff = targetHours - weeklyTotalHours;
                if (Math.abs(diff) === 1) {
                    for (const dayOfWeek of[3, 4]) {
                        const dateStr = weekDates.find(d => new Date(d + 'T00:00:00').getDay() === dayOfWeek);
                        if (!dateStr) continue;
                        const currentShift = worker.dailyData[dateStr];
                        if (!currentShift || currentShift.hours === 0 ||['COMP','LBRE','0SP','VC','LIC','INC','DF'].includes(currentShift.name)) continue;
                        let newShiftName = diff > 0 ? shift7hTo8hMap[currentShift.name] : shift8hTo7hMap[currentShift.name];
                        if (newShiftName) { worker.dailyData[dateStr] = { ...allShifts[newShiftName], aisle: worker.dailyData[dateStr].aisle }; appState.weeksToHighlight.add(`${worker.id}:${dateStr}`); correctionsMade++; break; }
                    }
                }
            });
        });
        renderAll(); saveAppState();
        const validHours =[0, 7, 14, 21, 28, 35, 42, 49]; let goodWeeks = 0; let badWeeks = 0;
        appState.processedData.forEach(worker => { appState.weeks.forEach(weekDates => { let total = weekDates.reduce((sum, d) => sum + (worker.dailyData[d]?.hours || 0), 0); if (validHours.includes(Math.round(total))) goodWeeks++; else badWeeks++; }); });
        document.getElementById('countWeeksGood').textContent = goodWeeks; document.getElementById('countWeeksBad').textContent = badWeeks;
        document.getElementById('correctionSummaryModal').style.display = 'flex';
    });

    attachEvt('massChangeBtn', 'click', openMassChangeModal);
    attachEvt('closeMassChangeModalBtn', 'click', closeMassChangeModal);
    attachEvt('applyMassChangeBtn', 'click', applyMassChange);
    attachEvt('empalmeBtn', 'click', applyEmpalme);

    // NUEVO: Cobertura reescrita usando DailyAisle
    function renderCoverageAnalysis() {
        const { dataToRender, visibleDates } = applyAllFilters(); 
        const dayStats = {}; 
        visibleDates.forEach(dateStr => { 
            dayStats[dateStr] = { A: 0, C: 0, i: 0, N: 0, absents:[] }; 
            dataToRender.forEach(w => { 
                const shift = w.dailyData[dateStr]; if (!shift) return; 
                if (shift.hours > 0) { 
                    if (shift.name.includes('A')) dayStats[dateStr].A++; else if (shift.name.includes('C')) dayStats[dateStr].C++; else if (shift.name.includes('i')) dayStats[dateStr].i++; else if (shift.name.includes('N')) dayStats[dateStr].N++; 
                } 
            }); 
        });
        const absenteesStats = { VC: new Set(), SPECIAL: new Set() };
        dataToRender.forEach(w => { visibleDates.forEach(date => { const shiftName = w.dailyData[date]?.name; if (!shiftName) return; if (shiftName === 'VC') absenteesStats.VC.add(w.fixedData[0]); else if (['LIC', 'DF', 'CAP', 'INC'].includes(shiftName)) absenteesStats.SPECIAL.add(w.fixedData[0]); }); });
        
        // REFACTOR: Agrupación diaria por pasillo
        const allAisles = new Set();
        dataToRender.forEach(w => visibleDates.forEach(d => { if(w.dailyData[d]?.aisle) allAisles.add(w.dailyData[d].aisle); }));
        
        const detailedGaps =[]; const aisleGapCounts = {}; 
        allAisles.forEach(aisleName => {
            aisleGapCounts[aisleName] = 0; 
            visibleDates.forEach(dateStr => { 
                const workersInAisle = dataToRender.filter(w => w.dailyData[dateStr]?.aisle === aisleName);
                const hasCoverage = workersInAisle.some(w => w.dailyData[dateStr]?.isCoverageShift); 
                if (!hasCoverage && workersInAisle.length > 0) { 
                    aisleGapCounts[aisleName]++; 
                    const dateObj = new Date(dateStr + 'T00:00:00'); const dayName = dayAbbreviations[dateObj.getDay()].toUpperCase(); 
                    const specificAbsents = workersInAisle.filter(w => { const sName = w.dailyData[dateStr]?.name; return['LIC', 'INC', 'DF', 'CAP', 'COMP', 'VC'].includes(sName); }).map(w => { return { name: w.fixedData[0], shift: w.dailyData[dateStr]?.name, aisle: aisleName }; }); 
                    detailedGaps.push({ aisle: aisleName, date: dateStr, dayName: dayName, stats: dayStats[dateStr], specificAbsents: specificAbsents }); 
                } 
            }); 
        });
        
        const rankingArray = Object.entries(aisleGapCounts).map(([key, val]) => ({ aisle: key, count: val })).filter(item => item.count > 0).sort((a, b) => b.count - a.count);
        let htmlContent = `<div style="padding: 10px; border-bottom: 2px dashed #b0bec5; margin-bottom: 20px; display: flex; justify-content: space-between; align-items: center;"><h3 style="margin:0; color:#1a237e;">📉 Resumen de Cobertura y Ausencias</h3><button onclick="document.getElementById('coverageAnalysisContainer').style.display='none'; document.getElementById('coverageAnalysisContainer').innerHTML=''; document.getElementById('coverageBtn')?.classList.remove('sidebar-btn--active');" class="btn-danger" style="padding:5px 15px; font-size:0.9em;">Cerrar Reporte</button></div><div style="display:flex; gap:20px; margin-bottom:25px; justify-content:center; flex-wrap:wrap;"><div class="card-stat" style="background-color: #e3f2fd; border: 1px solid #bbdefb;"><div style="font-size:2em;">🏖️</div><strong style="color:#1565c0; display:block; margin:5px 0;">Vacaciones (VC)</strong><span style="font-size:1.8em; font-weight:bold; color:#0d47a1;">${absenteesStats.VC.size}</span><div style="font-size:0.8em; color:#555;">Personas</div></div><div class="card-stat" style="background-color: #ffebee; border: 1px solid #ffcdd2;"><div style="font-size:2em;">🚨</div><strong style="color:#c62828; display:block; margin:5px 0;">Novedades (LIC/DF/CAP)</strong><span style="font-size:1.8em; font-weight:bold; color:#b71c1c;">${absenteesStats.SPECIAL.size}</span><div style="font-size:0.8em; color:#555;">Personas</div></div></div><div style="display: flex; flex-wrap: wrap; gap: 20px;"><div style="flex: 1; min-width: 300px;"><h4 style="color:#d32f2f; margin-bottom: 10px;">🏆 Ranking Pasillos con más huecos</h4><div class="summary-container" style="margin-top:0; max-height:400px; overflow-y:auto;"><table class="summary-table" style="width:100%;"><thead><tr style="background-color: #d32f2f; color: white;"><th>Pasillo</th><th>Días Sin Cobertura</th></tr></thead><tbody>`;
        if (rankingArray.length === 0) { htmlContent += `<tr><td colspan="2" style="color:green; font-weight:bold;">¡Felicidades! No hay huecos.</td></tr>`; } else { rankingArray.forEach(r => { htmlContent += `<tr><td style="text-align:left; font-weight:bold;">${r.aisle}</td><td style="font-weight:bold; color:#c62828; font-size:1.1em;">${r.count}</td></tr>`; }); }
        htmlContent += `</tbody></table></div></div><div style="flex: 2; min-width: 400px;"><h4 style="color:#1a237e; margin-bottom: 10px;">⚠️ Detalle de Días Sin Cobertura por Pasillo</h4><div class="summary-container" style="margin-top:0; max-height:400px; overflow-y:auto;"><table class="summary-table coverage-detail-table" style="width:100%;"><thead><tr><th style="position:sticky; top:0; z-index:10;">Pasillo</th><th style="position:sticky; top:0; z-index:10;">Fecha</th><th style="position:sticky; top:0; z-index:10;">Malla Global</th><th style="position:sticky; top:0; z-index:10;">PERSONAS AUSENTES (Pasillo)</th></tr></thead><tbody>`;
        if (detailedGaps.length === 0) { htmlContent += `<tr><td colspan="4" style="padding:15px; color:green; font-weight:bold; font-size:1.1em; text-align:center;">✅ ¡Excelente! No hay huecos de cobertura en los pasillos filtrados.</td></tr>`; } else { detailedGaps.sort((a,b) => a.date.localeCompare(b.date) || a.aisle.localeCompare(b.aisle)); const badgeColors = { 'COMP': '#d4edda', 'VC': '#d1c4e9', 'LIC': '#f8bbd0', 'INC': '#fff9c4', 'DF': '#b2dfdb', 'CAP': '#ffe0b2', 'DEFAULT': '#f5f5f5' }; detailedGaps.forEach(gap => { const s = gap.stats; let countsHtml = ''; if(s.A > 0) countsHtml += `<span class="tag-count count-a">A:${s.A}</span>`; if(s.C > 0) countsHtml += `<span class="tag-count count-c">C:${s.C}</span>`; if(s.i > 0) countsHtml += `<span class="tag-count count-i">i:${s.i}</span>`; if(s.N > 0) countsHtml += `<span class="tag-count count-n">N:${s.N}</span>`; if(countsHtml === '') countsHtml = '<span style="color:red;">0 (Sin personal global)</span>'; let absentHtml = ''; if (gap.specificAbsents.length > 0) { absentHtml = gap.specificAbsents.map(p => { const bgColor = badgeColors[p.shift] || badgeColors['DEFAULT']; return `<div style="display:inline-block; margin-right:5px; margin-bottom:4px;"><span class="tag-absent" style="background-color:${bgColor}; border:1px solid #ccc; color:#333 !important; padding:3px 6px; border-radius:4px;">${p.name} <b>(${p.shift})</b></span><br><small style="color:#666; font-size:0.75em; display:block; text-align:center;">${p.aisle}</small></div>`; }).join(''); } else { absentHtml = '<span style="color:#999; font-style:italic;">Nadie en novedad/comp</span>'; } htmlContent += `<tr><td style="font-weight:bold; color:#333;">${gap.aisle}</td><td style="color:#c62828;">${gap.dayName} ${gap.date.substring(5)}</td><td>${countsHtml}</td><td>${absentHtml}</td></tr>`; }); }
        htmlContent += `</tbody></table></div></div></div>`;
        const container = document.getElementById('coverageAnalysisContainer'); container.innerHTML = htmlContent; container.style.display = 'block'; container.scrollIntoView({ behavior: 'smooth' });
    }
    attachEvt('coverageBtn', 'click', () => toggleSidebarPanel('coverageBtn', 'coverageAnalysisContainer', renderCoverageAnalysis));

    // Delegador de Eventos para el Módulo de Distribución
    const staffDistContainer = document.getElementById('staffDistributionContainer');
    if (staffDistContainer) {
        // Al cambiar dificultad
        staffDistContainer.addEventListener('change', (e) => {
            if (e.target.classList.contains('difficulty-select')) {
                const aisle = e.target.dataset.aisle;
                appState.aisleDifficulties[aisle] = e.target.value;
                saveAppState();
                renderStaffDistribution(); 
                showToast("Dificultad guardada. Sugerencias actualizadas.", "success");
            }
        });
        
        staffDistContainer.addEventListener('click', (e) => {
            // Confirmar fecha de inicio del ciclo (debe ser lunes)
            if (e.target.id === 'setRotationDateBtn') {
                const dateVal = document.getElementById('rotationEffectiveDateInput')?.value;
                if (!dateVal) { showToast('Seleccione una fecha.', 'error'); return; }
                const dow = new Date(dateVal + 'T00:00:00').getDay();
                if (dow !== 1) { showToast('La fecha debe ser un LUNES. Seleccione el lunes de la semana en que inicia el ciclo.', 'error'); return; }
                if (appState.pendingSwaps.length > 0) {
                    if (!confirm('Cambiar la fecha de ciclo cancelará las rotaciones pendientes. ¿Continuar?')) return;
                    appState.pendingSwaps = [];
                    appState.swappedSeats.clear();
                }
                appState.rotationEffectiveDate = dateVal;
                saveAppState();
                renderStaffDistribution();
                showToast(`Ciclo establecido desde el lunes ${dateVal}. Ya puedes agregar rotaciones.`, 'success');
                return;
            }
            // Cambiar/limpiar la fecha de ciclo
            if (e.target.id === 'clearRotationDateBtn') {
                if (appState.pendingSwaps.length > 0) {
                    if (!confirm('Cambiar la fecha cancelará las rotaciones pendientes. ¿Continuar?')) return;
                    appState.pendingSwaps = [];
                    appState.swappedSeats.clear();
                }
                appState.rotationEffectiveDate = null;
                saveAppState();
                renderStaffDistribution();
                return;
            }
            // Auto-rotar todos los trabajadores restantes
            if (e.target.id === 'autoRotateBtn') {
                const total = appState.processedData.filter(w =>
                    !appState.lockedPersons.has(w.id) && !appState.swappedSeats.has(w.id)
                ).length;
                if (total === 0) { showToast('No hay trabajadores disponibles para auto-rotar.', 'warning'); return; }
                if (!confirm(`¿Auto-rotar ${total} trabajador(es) sin bloqueo ni rotación manual asignada?\n\nSe agregarán los intercambios recomendados al listado de pendientes.`)) return;
                autoRotateAll();
                return;
            }
            // Confirmar y aplicar rotaciones pendientes
            if (e.target.id === 'conformRotationBtn') {
                const dateVal = appState.rotationEffectiveDate;
                if (!dateVal) { showToast('No hay fecha de ciclo activa.', 'error'); return; }
                if (!confirm(`¿Confirmar ${appState.pendingSwaps.length} rotación(es) efectivas desde el lunes ${dateVal}?\n\nLos turnos desde esa fecha serán intercambiados entre las personas. Esta acción no se puede deshacer.`)) return;
                applyPendingSwaps(dateVal);
                return;
            }
            // Cancelar todas las rotaciones pendientes
            if (e.target.id === 'cancelPendingBtn') {
                if (!confirm('¿Cancelar todas las rotaciones pendientes?\n\nNingún cambio se aplicará a la programación.')) return;
                appState.pendingSwaps = [];
                appState.swappedSeats.clear();
                saveAppState();
                renderStaffDistribution();
                showToast('Rotaciones pendientes canceladas.', 'info');
                return;
            }
            // Deshacer rotación individual de una persona
            if (e.target.classList.contains('btn-swap-undo')) {
                const seatId = parseInt(e.target.dataset.seat);
                const swapIdx = appState.pendingSwaps.findIndex(s => s.idA === seatId || s.idB === seatId);
                if (swapIdx >= 0) {
                    const swap = appState.pendingSwaps[swapIdx];
                    appState.swappedSeats.delete(swap.idA);
                    appState.swappedSeats.delete(swap.idB);
                    appState.pendingSwaps.splice(swapIdx, 1);
                    saveAppState();
                    renderStaffDistribution();
                    showToast(`↩ Rotación deshecha: ${swap.nameA} ↔ ${swap.nameB}`, 'info');
                }
                return;
            }
            // Rotar (sugerencia automática o libre)
            if (e.target.classList.contains('btn-swap-init')) {
                const seatId = e.target.dataset.seat;
                const suggestedId = e.target.dataset.suggested;
                const allowAny = e.target.dataset.allowAny === 'true';
                openSwapModal(seatId, suggestedId, allowAny);
            }
            // Rotar con selección manual completa
            if (e.target.classList.contains('btn-manual-pick')) {
                openManualPickerModal(e.target.dataset.seat);
            }
            // Toggle Lock Persona
            if (e.target.classList.contains('toggle-person-lock')) {
                const seatId = parseInt(e.target.dataset.id);
                if (appState.lockedPersons.has(seatId)) appState.lockedPersons.delete(seatId);
                else appState.lockedPersons.add(seatId);
                saveAppState();
                renderStaffDistribution();
            }
            // Toggle Lock Pasillo
            if (e.target.classList.contains('toggle-aisle-lock')) {
                const aisle = e.target.dataset.aisle;
                if (appState.lockedAisles.has(aisle)) appState.lockedAisles.delete(aisle);
                else appState.lockedAisles.add(aisle);
                saveAppState();
                renderStaffDistribution();
            }
        });
    }

    // Toggle panels: primer clic abre, segundo clic cierra
    function toggleSidebarPanel(btnId, containerId, renderFn) {
        const btn = document.getElementById(btnId);
        const container = document.getElementById(containerId);
        if (!btn || !container) return;
        const isOpen = container.style.display !== 'none' && container.innerHTML.trim() !== '';
        if (isOpen) {
            container.style.display = 'none';
            btn.classList.remove('sidebar-btn--active');
        } else {
            // Llamar al render (que internamente hace display:block y scrollIntoView)
            renderFn();
            btn.classList.add('sidebar-btn--active');
        }
    }

    attachEvt('staffDistributionBtn', 'click', () => toggleSidebarPanel('staffDistributionBtn', 'staffDistributionContainer', renderStaffDistribution));
    attachEvt('krebsReportBtn',       'click', () => toggleSidebarPanel('krebsReportBtn',       'krebsReportContainer',       renderKrebsReport));
    attachEvt('plantManagerBtn',      'click', () => toggleSidebarPanel('plantManagerBtn',       'plantManagerContainer',       renderPlantManager));
    attachEvt('plantHealthBtn',       'click', () => toggleSidebarPanel('plantHealthBtn',        'plantHealthContainer',        renderPlantHealthReport));
    attachEvt('tasksReportBtn',       'click', () => toggleSidebarPanel('tasksReportBtn',        'tasksReportContainer',        renderTasksReport));
    attachEvt('equidadBtn',           'click', () => toggleSidebarPanel('equidadBtn',            'equidadReportContainer',      renderEquidadReport));
    attachEvt('horasPromedioBtn',     'click', () => toggleSidebarPanel('horasPromedioBtn',       'horasPromedioContainer',      renderHorasPromedioReport));

    // Eventos del módulo Administrar mi Planta
    const plantContainer = document.getElementById('plantManagerContainer');
    if (plantContainer) {
        plantContainer.addEventListener('change', (e) => {
            const workerId = parseInt(e.target.dataset.workerId);
            if (isNaN(workerId)) return;
            if (e.target.classList.contains('plant-name-input')) {
                const newName = e.target.value.trim();
                if (!newName) return;
                applyWorkerNameChange(workerId, newName);
                renderAll();
                saveAppState();
                showToast('Nombre actualizado en toda la programación.', 'success');
            }
            if (e.target.classList.contains('plant-inicia-input') || e.target.classList.contains('plant-finaliza-input')) {
                const masterEntry = appState.workerMasterData.find(m => m.id === workerId);
                if (!masterEntry) return;
                const iniEl = plantContainer.querySelector(`.plant-inicia-input[data-worker-id="${workerId}"]`);
                const finEl = plantContainer.querySelector(`.plant-finaliza-input[data-worker-id="${workerId}"]`);
                const newInicia = iniEl ? iniEl.value : masterEntry.inicia;
                const newFinaliza = finEl ? finEl.value : masterEntry.finaliza;
                updateWorkerVacation(workerId, newInicia, newFinaliza);
            }
            if (e.target.classList.contains('plant-pasillo-input')) {
                const newAisle = e.target.value;
                const worker = appState.processedData.find(w => w.id === workerId);
                if (worker) {
                    worker.fixedData[1] = newAisle;
                    if (worker.dailyData) worker.dailyData.forEach(d => { if (d) d.aisle = newAisle; });
                }
                const master = appState.workerMasterData.find(m => m.id === workerId);
                if (master) master.pasillo = newAisle;
                populateFilters();
                renderAll();
                saveAppState();
                showToast(`Pasillo de ${worker?.fixedData[0] || ''} actualizado a ${newAisle}.`, 'success');
            }
            if (e.target.classList.contains('plant-restriccion-input')) {
                const newVal = e.target.value.trim();
                const worker = appState.processedData.find(w => w.id === workerId);
                if (worker) worker.fixedData[2] = newVal;
                const master = appState.workerMasterData.find(m => m.id === workerId);
                if (master) master.restriccion = newVal;
                renderAll();
                saveAppState();
                showToast(`Cód. Nómina de ${worker?.fixedData[0] || master?.nombre || ''} actualizado.`, 'success');
            }
            if (e.target.classList.contains('plant-equipo-select')) {
                const newVal = e.target.value.trim().toUpperCase();
                const master = appState.workerMasterData.find(m => m.id === workerId);
                if (!master) return;
                master.equipo = newVal;
                saveAppState();
                // Actualizar color del select inmediatamente sin re-renderizar la tabla
                const equipoColors = {
                    '':    { bg:'#e8f5e9', color:'#2e7d32', border:'#2e7d32' },
                    'R':   { bg:'#fff8e1', color:'#f57f17', border:'#f57f17' },
                    'RM':  { bg:'#fce4ec', color:'#c62828', border:'#c62828' },
                    'SDF': { bg:'#e3f2fd', color:'#1565c0', border:'#1565c0' },
                };
                const ec = equipoColors[newVal] || { bg:'#f5f5f5', color:'#546e7a', border:'#90a4ae' };
                e.target.style.background    = ec.bg;
                e.target.style.color         = ec.color;
                e.target.style.borderColor   = ec.border;
                // Refrescar informe de salud si está abierto
                const hc = document.getElementById('plantHealthContainer');
                if (hc && hc.style.display !== 'none') renderPlantHealthReport();
                const label = newVal === '' ? 'LIBRE' : newVal;
                showToast(`Restricción de ${master.nombre} actualizada a ${label}.`, 'success');
            }
        });
    }

    // Eventos del Modal Swap (sugerencia automática)
    attachEvt('closeSwapModalBtn', 'click', () => { document.getElementById('swapModal').style.display = 'none'; });
    attachEvt('executeSwapBtn', 'click', () => {
        const seatA = document.getElementById('swapHiddenSeatA').value;
        const seatB = document.getElementById('swapTargetSelect').value;

        if(!seatB) { showToast('Seleccione un destino válido', 'error'); return; }

        executeSwap(seatA, seatB);
        document.getElementById('swapModal').style.display = 'none';
    });

    // Eventos del Modal Manual Picker
    attachEvt('closeMpModalBtn', 'click', () => {
        document.getElementById('manualPickerModal').style.display = 'none';
        _mpSeatIdA = null; _mpTempUnlocked = new Set(); _mpSelectedB = null;
    });
    attachEvt('executeMpSwapBtn', 'click', () => {
        if (!_mpSelectedB || !_mpSeatIdA) { showToast('Selecciona una persona primero', 'error'); return; }
        executeSwap(_mpSeatIdA, _mpSelectedB);
        document.getElementById('manualPickerModal').style.display = 'none';
        _mpSeatIdA = null; _mpTempUnlocked = new Set(); _mpSelectedB = null;
    });
    const mpList = document.getElementById('mpWorkerList');
    if (mpList) {
        mpList.addEventListener('click', (e) => {
            // Toggle del candado 🔓 / 🔒
            if (e.target.classList.contains('mp-lock-btn')) {
                const wid = parseInt(e.target.dataset.wid);
                if (_mpTempUnlocked.has(wid)) {
                    _mpTempUnlocked.delete(wid);
                    if (_mpSelectedB === wid) _mpSelectedB = null;
                } else {
                    _mpTempUnlocked.add(wid);
                }
                renderManualPickerList();
                return;
            }
            // Seleccionar fila de trabajador
            const row = e.target.closest('.mp-row');
            if (row && !row.classList.contains('mp-occupied') && !row.classList.contains('mp-history-blocked')) {
                const wid = parseInt(row.dataset.wid);
                const w = appState.processedData.find(x => x.id === wid);
                if (w && !appState.lockedPersons.has(wid)) {
                    _mpSelectedB = (_mpSelectedB === wid) ? null : wid;
                    renderManualPickerList();
                }
            }
        });
    }

    const monthFilterBar = document.getElementById('monthFilterBar');
    if (monthFilterBar) {
        monthFilterBar.addEventListener('click', (e) => {
            if (e.target.classList.contains('btn-month-clear')) {
                selectedMonthsFilter.clear();
                renderAll();
                return;
            }
            if (e.target.classList.contains('btn-month-print')) {
                printSchedulePDF();
                return;
            }
            const btn = e.target.closest('.btn-month');
            if (btn && btn.dataset.month) {
                const m = btn.dataset.month;
                if (selectedMonthsFilter.has(m)) selectedMonthsFilter.delete(m);
                else selectedMonthsFilter.add(m);
                renderAll();
            }
        });
    }

    attachEvt('distributionBtn', 'click', () => toggleSidebarPanel('distributionBtn', 'distributionAnalysisContainer', () => { const { dataToRender, visibleDates } = applyAllFilters(); renderSummaryTable(dataToRender, visibleDates); }));
    attachEvt('downloadBtn', 'click', () => { downloadExcel(); showToast("Excel generado correctamente.", "success"); });
    
    attachEvt('outputContainer', 'change', (e) => { if (e.target.classList.contains('shift-select')) updateShift(e.target); });

    // == TAREAS DIARIAS — event handlers ==
    // Abrir picker al hacer clic en el badge o en el botón "+ tarea"
    document.getElementById('outputContainer').addEventListener('click', e => {
        const roBtn = e.target.closest('.task-badge-ro');
        if (roBtn) { e.stopPropagation(); openTaskViewerRO(roBtn.dataset.excelId, roBtn.dataset.dateStr, roBtn); return; }
        const btn = e.target.closest('.task-badge-cell, .task-add-btn');
        if (!btn) return;
        e.stopPropagation();
        openTaskPicker(btn.dataset.excelId, btn.dataset.dateStr, btn);
    });

    // Seleccionar tarea desde el picker
    document.getElementById('taskPickerPopup').addEventListener('click', e => {
        const item = e.target.closest('[data-task-id]');
        if (!item) return;
        const popup = document.getElementById('taskPickerPopup');
        const exId  = popup.dataset.excelId;
        const dStr  = popup.dataset.dateStr;
        const tId   = item.dataset.taskId === 'null' ? null : parseInt(item.dataset.taskId);
        const slot  = item.dataset.slot === '2' ? 2 : 1;
        if (slot === 2) {
            assignTask2(exId, dStr, tId);
            closeTaskPicker();
            return;
        }
        assignTask(exId, dStr, tId);
        // Show custom name field if personalizada selected; keep picker open for name input
        const wrap = document.getElementById('taskCustomNameWrap');
        const task = PREDEFINED_TASKS.find(t => t.id === tId);
        if (wrap) wrap.style.display = (task && task.isEditable) ? 'block' : 'none';
        if (task && task.isEditable) { const cn = document.getElementById('taskCustomNameInput'); if (cn) { cn.focus(); return; } }
        closeTaskPicker();
    });

    // Cerrar picker al hacer clic fuera
    document.addEventListener('click', e => {
        if (!e.target.closest('#taskPickerPopup') && !e.target.closest('.task-badge-cell') && !e.target.closest('.task-add-btn') && !e.target.closest('.task-badge-ro')) {
            closeTaskPicker();
        }
    });
    document.addEventListener('keydown', e => { if (e.key === 'Escape') closeTaskPicker(); });
    document.addEventListener('keydown', e => {
        if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
            if (e.target.classList.contains('editable-name') || e.target.classList.contains('shift-select')) return;
            e.preventDefault();
            performUndo();
        }
    });
    attachEvt('undoBtn', 'click', performUndo);
    attachEvt('pasilloFilter', 'change', renderAll);
    attachEvt('restriccionFilter', 'change', renderAll);
    attachEvt('nameSearch', 'input', renderAll);
    attachEvt('dateFromFilter', 'change', renderAll);
    attachEvt('dateToFilter', 'change', renderAll);

    attachEvt('outputContainer', 'focusout', (e) => {
        if (e.target.classList.contains('editable-name')) {
            const workerId = parseInt(e.target.dataset.workerId);
            const workerGlobal = appState.processedData.find(w => w.id === workerId);
            const newName = e.target.textContent.trim();
            if (workerGlobal && newName && workerGlobal.fixedData[0] !== newName) {
                applyWorkerNameChange(workerId, newName);
                saveAppState();
                showToast("Nombre modificado y guardado", "success");
                renderStaffDistribution();
            }
        }
    });

    attachEvt('outputContainer', 'keydown', (e) => {
        if (e.target.classList.contains('editable-name') && e.key === 'Enter') {
            e.preventDefault();
            e.target.blur();
        }
    });

    attachEvt('clearFiltersBtn', 'click', () => {['pasilloFilter', 'restriccionFilter', 'nameSearch', 'dateFromFilter', 'dateToFilter'].forEach(id => { const el = document.getElementById(id); if(el) el.value = ""; }); specialShiftFilter = null; selectedMonthsFilter.clear(); renderAll(); });

    // Cargar datos desde Google Sheets — flujo de confirmación 2 pasos
    const _scOverlay  = document.getElementById('sheetsConfirmOverlay');
    const _scStep1    = document.getElementById('sheetsConfirmStep1');
    const _scStep2    = document.getElementById('sheetsConfirmStep2');
    const _scPwdInput = document.getElementById('sheetsConfirmPwd');
    const _scPwdError = document.getElementById('sheetsConfirmPwdError');

    function openSheetsConfirm() {
        _scStep1.style.display = 'block';
        _scStep2.style.display = 'none';
        _scPwdInput.value = '';
        _scPwdError.textContent = '';
        _scOverlay.style.display = 'flex';
    }
    function closeSheetsConfirm() {
        _scOverlay.style.display = 'none';
        _scPwdInput.value = '';
        _scPwdError.textContent = '';
    }

    attachEvt('loadFromSheetsBtn', 'click', openSheetsConfirm);

    attachEvt('sheetsConfirmNo', 'click', closeSheetsConfirm);

    attachEvt('sheetsConfirmYes', 'click', () => {
        _scStep1.style.display = 'none';
        _scStep2.style.display = 'block';
        _scPwdInput.focus();
    });

    attachEvt('sheetsConfirmBack', 'click', () => {
        _scStep2.style.display = 'none';
        _scStep1.style.display = 'block';
        _scPwdError.textContent = '';
    });

    const _doSheetsLoad = () => {
        if (_scPwdInput.value.toUpperCase() === getAdminKey()) {
            closeSheetsConfirm();
            loadFromGoogleSheets();
        } else {
            _scPwdError.textContent = '❌ Contraseña incorrecta. Intente de nuevo.';
            _scPwdInput.value = '';
            _scPwdInput.focus();
            _scPwdInput.style.borderColor = '#c62828';
            setTimeout(() => { _scPwdInput.style.borderColor = '#ddd'; }, 1200);
        }
    };
    attachEvt('sheetsConfirmPwdOk', 'click', _doSheetsLoad);
    document.getElementById('sheetsConfirmPwd').addEventListener('keypress', e => { if (e.key === 'Enter') _doSheetsLoad(); });

    // === MODAL EXTENDER PROGRAMACIÓN ===
    const _extOverlay  = document.getElementById('extendConfirmOverlay');
    const _extStep1    = document.getElementById('extendConfirmStep1');
    const _extStep2    = document.getElementById('extendConfirmStep2');
    const _extLoading  = document.getElementById('extendLoadingStep');
    const _extPwdInput = document.getElementById('extendConfirmPwd');
    const _extPwdError = document.getElementById('extendConfirmPwdError');

    function openExtendConfirm() {
        if (!appState.processedData.length) {
            showToast('⚠️ Carga primero una programación antes de extender.', 'warning'); return;
        }
        if (!getSheetsUrl()) {
            showToast('⚠️ Configura primero la URL de Google Sheets.', 'warning'); return;
        }
        const lastDate    = appState.dateHeaders[appState.dateHeaders.length - 1];
        const lastDateObj = new Date(lastDate + 'T00:00:00');
        if (lastDateObj.getDay() !== 6) {
            showToast('⚠️ El último día de la programación actual no es Sábado. Verifica la programación cargada.', 'warning'); return;
        }
        const fmtOpts = { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' };
        document.getElementById('extendLastDay').textContent = lastDateObj.toLocaleDateString('es-CO', fmtOpts);

        const nextDay = new Date(lastDateObj);
        nextDay.setDate(nextDay.getDate() + 1);
        document.getElementById('extendRecommendDate').textContent = nextDay.toLocaleDateString('es-CO', fmtOpts);

        const startVal = document.getElementById('startDate').value;
        if (startVal) {
            const sdObj = new Date(startVal + 'T00:00:00');
            document.getElementById('extendFromDate').textContent = sdObj.toLocaleDateString('es-CO', fmtOpts);
        } else {
            document.getElementById('extendFromDate').textContent = '(No seleccionada — por favor elige una fecha)';
        }

        _extStep1.style.display = 'block';
        _extStep2.style.display = 'none';
        _extLoading.style.display = 'none';
        _extPwdInput.value = '';
        _extPwdError.textContent = '';
        _extOverlay.style.display = 'flex';
    }

    function closeExtendConfirm() {
        _extOverlay.style.display = 'none';
        _extPwdInput.value = '';
        _extPwdError.textContent = '';
    }

    const _doExtend = async () => {
        if (_extPwdInput.value.toUpperCase() === getAdminKey()) {
            _extStep2.style.display = 'none';
            _extLoading.style.display = 'block';
            await extendScheduleFromSheets();
            closeExtendConfirm();
        } else {
            _extPwdError.textContent = '❌ Contraseña incorrecta. Intente de nuevo.';
            _extPwdInput.value = '';
            _extPwdInput.focus();
            _extPwdInput.style.borderColor = '#c62828';
            setTimeout(() => { _extPwdInput.style.borderColor = '#ddd'; }, 1200);
        }
    };

    attachEvt('extendFromSheetsBtn', 'click', openExtendConfirm);
    attachEvt('extendConfirmNo',     'click', closeExtendConfirm);
    attachEvt('extendConfirmYes',    'click', () => { _extStep1.style.display = 'none'; _extStep2.style.display = 'block'; _extPwdInput.focus(); });
    attachEvt('extendConfirmBack',   'click', () => { _extStep2.style.display = 'none'; _extStep1.style.display = 'block'; _extPwdError.textContent = ''; });
    attachEvt('extendConfirmPwdOk',  'click', _doExtend);
    document.getElementById('extendConfirmPwd').addEventListener('keypress', e => { if (e.key === 'Enter') _doExtend(); });

    // Google Sheets Sync buttons
    attachEvt('sheetsSyncBtn', 'click', () => syncScheduleToSheets(false));

    attachEvt('loadFromProgBtn', 'click', () => {
        const btn = document.getElementById('loadFromProgBtn');
        if (btn) btn.textContent = '⏳ Cargando...';
        autoLoadFromProgSheet().finally(() => {
            if (btn) btn.textContent = `🔄 Sincronizar con PROG_${selectedStore || ''}`;
        });
    });

    attachEvt('sheetsConfigBtn', 'click', () => {
        const existing = getSheetsUrl();
        const input = document.getElementById('sheetsUrlInput');
        if (input && existing) input.value = existing;
        const msgEl = document.getElementById('sheetsConfigMessage');
        if (msgEl) msgEl.textContent = '';
        document.getElementById('sheetsConfigModal').style.display = 'flex';
    });

    attachEvt('closeSheetsConfigBtn', 'click', () => {
        document.getElementById('sheetsConfigModal').style.display = 'none';
    });

    attachEvt('clearSheetsUrlBtn', 'click', () => {
        localStorage.removeItem('kronoSheetsUrl_' + selectedStore);
        const input = document.getElementById('sheetsUrlInput');
        if (input) input.value = '';
        updateSheetsSyncStatus('', '');
        const msgEl = document.getElementById('sheetsConfigMessage');
        if (msgEl) { msgEl.textContent = '✅ URL eliminada.'; msgEl.style.color = '#2e7d32'; }
    });

    attachEvt('saveSheetsUrlBtn', 'click', () => {
        const input = document.getElementById('sheetsUrlInput');
        const msgEl = document.getElementById('sheetsConfigMessage');
        const url = input ? input.value.trim() : '';
        if (!url || !url.startsWith('https://script.google.com/')) {
            if (msgEl) { msgEl.textContent = '❌ URL inválida. Debe comenzar con https://script.google.com/'; msgEl.style.color = '#c62828'; }
            return;
        }
        localStorage.setItem('kronoSheetsUrl_' + selectedStore, url);
        if (msgEl) { msgEl.textContent = '⏳ URL guardada. Probando conexión...'; msgEl.style.color = '#1565c0'; }
        // Test connection with a GET
        fetch(url)
            .then(r => r.text())
            .then(text => {
                if (msgEl) { msgEl.textContent = '✅ Conexión exitosa. Ya puedes sincronizar la programación.'; msgEl.style.color = '#2e7d32'; }
                updateSheetsSyncStatus('☁️ Sheets: conectado', '#2e7d32');
            })
            .catch(() => {
                if (msgEl) { msgEl.textContent = '⚠️ URL guardada, pero no se pudo verificar la conexión. Revisa que el script esté publicado correctamente.'; msgEl.style.color = '#e65100'; }
            });
    });

    attachEvt('summaryContainer', 'click', (e) => {
        const cell = e.target.closest('.clickable-cell'); if (!cell) return;
        const dateStr = cell.getAttribute('data-date'); const metricKey = cell.getAttribute('data-metric');
        if (specialShiftFilter && specialShiftFilter.dateStr === dateStr && specialShiftFilter.metricKey === metricKey) specialShiftFilter = null;
        else specialShiftFilter = { dateStr, metricKey };
        renderAll();
    });
});
