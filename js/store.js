/**
 * Western India Plywoods - Boiler Fuel Management
 * Store & Data Persistence Layer (Offline-First + Firebase Cloud Sync)
 */

const STORAGE_KEY = 'wip_boiler_shifts_v1';
const OPERATOR_KEY = 'wip_boiler_operators_v1';
const SETTINGS_KEY = 'wip_boiler_settings_v1';

const DEFAULT_SETTINGS = {
  dustSackWeightKg: 8.0,
  woodChipsBulkDensity: 370.0,
  weightUnit: 'tonnes'
};

const DEFAULT_OPERATORS = [
  'Naeem',
  'Operator 2',
  'Operator 3'
];

class BoilerStore {
  constructor() {
    this.shifts = this.loadShifts();
    this.settings = this.loadSettings();
    this.operators = this.loadOperators();
    this.changeListeners = [];

    // Setup Firebase cloud sync listener hook
    if (typeof window !== 'undefined') {
      window.addEventListener('DOMContentLoaded', () => {
        if (window.firebaseSync) {
          window.firebaseSync.onDataUpdate((remoteShifts) => {
            this.mergeRemoteShifts(remoteShifts);
          });
        }
      });
    }
  }

  addChangeListener(cb) {
    this.changeListeners.push(cb);
  }

  notifyChange() {
    this.changeListeners.forEach(cb => {
      try { cb(); } catch (e) { console.error(e); }
    });
  }

  loadShifts() {
    try {
      const data = localStorage.getItem(STORAGE_KEY);
      return data ? JSON.parse(data) : [];
    } catch (e) {
      console.error('Failed to load shifts from localStorage', e);
      return [];
    }
  }

  saveShifts() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.shifts));
    } catch (e) {
      console.error('Failed to save shifts', e);
    }
  }

  loadSettings() {
    try {
      const data = localStorage.getItem(SETTINGS_KEY);
      return data ? { ...DEFAULT_SETTINGS, ...JSON.parse(data) } : { ...DEFAULT_SETTINGS };
    } catch (e) {
      return { ...DEFAULT_SETTINGS };
    }
  }

  saveSettings(settings) {
    this.settings = { ...this.settings, ...settings };
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(this.settings));
    } catch (e) {
      console.error('Failed to save settings', e);
    }
  }

  loadOperators() {
    try {
      const data = localStorage.getItem(OPERATOR_KEY);
      return data ? JSON.parse(data) : [...DEFAULT_OPERATORS];
    } catch (e) {
      return [...DEFAULT_OPERATORS];
    }
  }

  saveOperators(operators) {
    this.operators = operators;
    try {
      localStorage.setItem(OPERATOR_KEY, JSON.stringify(this.operators));
    } catch (e) {
      console.error('Failed to save operators', e);
    }
  }

  getShiftId(dateStr, shiftName) {
    const shiftSlug = shiftName.toLowerCase().replace(/[^a-z0-9]/g, '-');
    return `${dateStr}-${shiftSlug}`;
  }

  getShift(dateStr, shiftName) {
    const id = this.getShiftId(dateStr, shiftName);
    return this.shifts.find(s => s.id === id) || null;
  }

  saveShift(shiftData) {
    const id = this.getShiftId(shiftData.date, shiftData.shift);
    const existingIndex = this.shifts.findIndex(s => s.id === id);

    const record = {
      ...shiftData,
      id,
      updatedAt: new Date().toISOString()
    };

    if (existingIndex >= 0) {
      this.shifts[existingIndex] = record;
    } else {
      this.shifts.push(record);
    }

    this.shifts.sort((a, b) => new Date(b.date + ' ' + (b.shiftStartTime || '00:00')) - new Date(a.date + ' ' + (a.shiftStartTime || '00:00')));
    this.saveShifts();

    // Auto sync to Firebase Cloud if connected
    if (window.firebaseSync && window.firebaseSync.isInitialized) {
      window.firebaseSync.saveShift(record);
    }

    this.notifyChange();
    return record;
  }

  deleteShift(id) {
    this.shifts = this.shifts.filter(s => s.id !== id);
    this.saveShifts();

    if (window.firebaseSync && window.firebaseSync.isInitialized) {
      window.firebaseSync.deleteShift(id);
    }

    this.notifyChange();
  }

  mergeRemoteShifts(remoteShifts) {
    if (!Array.isArray(remoteShifts)) return;

    let hasChanges = false;
    remoteShifts.forEach(rs => {
      if (!rs.id) return;
      const localIdx = this.shifts.findIndex(s => s.id === rs.id);
      if (localIdx >= 0) {
        const localTime = new Date(this.shifts[localIdx].updatedAt || 0).getTime();
        const remoteTime = new Date(rs.updatedAt || 0).getTime();
        if (remoteTime > localTime) {
          this.shifts[localIdx] = rs;
          hasChanges = true;
        }
      } else {
        this.shifts.push(rs);
        hasChanges = true;
      }
    });

    if (hasChanges) {
      this.shifts.sort((a, b) => new Date(b.date + ' ' + (b.shiftStartTime || '00:00')) - new Date(a.date + ' ' + (a.shiftStartTime || '00:00')));
      this.saveShifts();
      this.notifyChange();
    }
  }

  getPreviousShiftClosingDepth(currentDate, currentShift) {
    const shiftsOrder = ['Shift 1', 'Shift 2', 'Shift 3'];
    const currentIndex = shiftsOrder.indexOf(currentShift);

    let targetDate = currentDate;
    let targetShift = null;

    if (currentIndex > 0) {
      targetShift = shiftsOrder[currentIndex - 1];
    } else {
      const d = new Date(currentDate);
      d.setDate(d.getDate() - 1);
      targetDate = d.toISOString().split('T')[0];
      targetShift = 'Shift 3';
    }

    const directPrev = this.getShift(targetDate, targetShift);
    if (directPrev && directPrev.thermax && typeof directPrev.thermax.closingDepthCm === 'number' && directPrev.thermax.closingDepthCm > 0) {
      return directPrev.thermax.closingDepthCm;
    }

    const sorted = [...this.shifts]
      .filter(s => s.thermax && typeof s.thermax.closingDepthCm === 'number' && s.thermax.closingDepthCm > 0)
      .sort((a, b) => new Date(b.updatedAt || b.date) - new Date(a.updatedAt || a.date));

    if (sorted.length > 0) {
      return sorted[0].thermax.closingDepthCm;
    }

    return null;
  }

  getDailySummary(dateStr) {
    const dayShifts = this.shifts.filter(s => s.date === dateStr);
    
    let thermaxTotalKg = 0;
    let maxThermTotalKg = 0;
    let complockTotalKg = 0;
    let totalLorriesCount = 0;
    let totalDustSacks = 0;

    dayShifts.forEach(s => {
      thermaxTotalKg += (s.thermax?.consumptionKg || 0);
      maxThermTotalKg += (s.maxTherm?.totalConsumptionKg || 0);
      complockTotalKg += (s.complock?.totalConsumptionKg || 0);
      
      const thermaxLorries = s.thermax?.lorries?.length || 0;
      const maxThermLorries = s.maxTherm?.lorries?.length || 0;
      const complockLorries = s.complock?.lorries?.length || 0;
      totalLorriesCount += (thermaxLorries + maxThermLorries + complockLorries);

      totalDustSacks += (s.maxTherm?.dustSacksCount || 0);
    });

    const grandTotalKg = thermaxTotalKg + maxThermTotalKg + complockTotalKg;

    return {
      date: dateStr,
      shiftsLogged: dayShifts.length,
      shifts: dayShifts,
      thermaxTotalKg,
      thermaxTotalTonnes: Number((thermaxTotalKg / 1000).toFixed(3)),
      maxThermTotalKg,
      maxThermTotalTonnes: Number((maxThermTotalKg / 1000).toFixed(3)),
      complockTotalKg,
      complockTotalTonnes: Number((complockTotalKg / 1000).toFixed(3)),
      grandTotalKg,
      grandTotalTonnes: Number((grandTotalKg / 1000).toFixed(3)),
      totalLorriesCount,
      totalDustSacks
    };
  }

  exportAllDataJson() {
    return JSON.stringify({
      version: '1.0',
      exportedAt: new Date().toISOString(),
      plant: 'Western India Plywoods',
      shifts: this.shifts,
      settings: this.settings,
      operators: this.operators
    }, null, 2);
  }

  importDataJson(jsonString) {
    try {
      const data = JSON.parse(jsonString);
      if (Array.isArray(data.shifts)) {
        this.shifts = data.shifts;
        this.saveShifts();
      }
      if (data.settings) {
        this.saveSettings(data.settings);
      }
      if (Array.isArray(data.operators)) {
        this.saveOperators(data.operators);
      }
      this.notifyChange();
      return true;
    } catch (e) {
      console.error('Import failed', e);
      return false;
    }
  }
}

window.boilerStore = new BoilerStore();
