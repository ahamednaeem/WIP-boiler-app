/**
 * Western India Plywoods - Boiler Fuel Management
 * Store & Data Persistence Layer (Offline-First + Auto-LAN Sync)
 */

const STORAGE_KEY = 'wip_boiler_shifts_v1';
const OPERATOR_KEY = 'wip_boiler_operators_v1';
const SETTINGS_KEY = 'wip_boiler_settings_v1';

const DEFAULT_SETTINGS = {
  dustSackWeightKg: 8.0,
  woodChipsBulkDensity: 370.0,
  weightUnit: 'tonnes',
  cloudSyncUrl: '/api/shifts' // Defaults to local LAN sync endpoint
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
    this.fetchRemoteShifts();
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

    // Auto sync to server if available
    this.syncToCloud(record);

    return record;
  }

  deleteShift(id) {
    this.shifts = this.shifts.filter(s => s.id !== id);
    this.saveShifts();
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
      return true;
    } catch (e) {
      console.error('Import failed', e);
      return false;
    }
  }

  async syncToCloud(record) {
    const url = this.settings.cloudSyncUrl || '/api/shifts';
    try {
      await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(record)
      });
    } catch (e) {
      // Offline or standalone file mode - local storage already holds it safely
    }
  }

  async fetchRemoteShifts() {
    const url = this.settings.cloudSyncUrl || '/api/shifts';
    try {
      const res = await fetch(url);
      if (res.ok) {
        const remoteShifts = await res.json();
        if (Array.isArray(remoteShifts) && remoteShifts.length > 0) {
          // Merge remote shifts into local storage
          remoteShifts.forEach(rs => {
            const idx = this.shifts.findIndex(s => s.id === rs.id);
            if (idx >= 0) {
              if (new Date(rs.updatedAt || 0) > new Date(this.shifts[idx].updatedAt || 0)) {
                this.shifts[idx] = rs;
              }
            } else {
              this.shifts.push(rs);
            }
          });
          this.saveShifts();
        }
      }
    } catch (e) {
      // Server not running, silently using local storage
    }
  }
}

window.boilerStore = new BoilerStore();
