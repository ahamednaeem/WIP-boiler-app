/**
 * Western India Plywoods - Boiler Fuel Management
 * Main Application Controller
 */

// Current shift state in memory
let currentShift = {
  date: '',
  shift: 'Shift 1',
  operatorName: 'Operator 1',
  thermax: {
    openingDepthCm: null,
    openingVolumeM3: 0,
    openingStockKg: 0,
    lorries: [],
    totalIncomingChipsKg: 0,
    closingDepthCm: null,
    closingVolumeM3: 0,
    closingStockKg: 0,
    consumptionKg: 0,
    consumptionTonnes: 0
  },
  maxTherm: {
    lorries: [],
    woodLogsKg: 0,
    dustSacksCount: 0,
    dustWeightPerSackKg: 8,
    dustKg: 0,
    totalConsumptionKg: 0,
    totalConsumptionTonnes: 0
  },
  complock: {
    lorries: [],
    woodLogsKg: 0,
    totalConsumptionKg: 0,
    totalConsumptionTonnes: 0
  },
  notes: ''
};

// Target boiler when opening Lorry Modal: 'thermax' | 'maxTherm' | 'complock'
let currentModalBoiler = 'thermax';

document.addEventListener('DOMContentLoaded', () => {
  initDateTimeAndShift();
  initTabs();
  initEventListeners();
  initReferenceTable();
  loadCurrentShiftData();
  updateLiveClock();
  setInterval(updateLiveClock, 1000);
});

/**
 * Determine default date and shift based on current time
 */
function initDateTimeAndShift() {
  const now = new Date();
  const dateInput = document.getElementById('shiftDate');
  const shiftSelect = document.getElementById('shiftSelect');

  // Format YYYY-MM-DD
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const todayStr = `${year}-${month}-${day}`;
  dateInput.value = todayStr;
  currentShift.date = todayStr;

  // Auto detect shift:
  // Shift 1: 06:30 to 14:30
  // Shift 2: 14:30 to 22:30
  // Shift 3: 22:30 to 06:30
  const hours = now.getHours();
  const minutes = now.getMinutes();
  const totalMinutes = hours * 60 + minutes;

  const s1Start = 6 * 60 + 30;  // 06:30
  const s2Start = 14 * 60 + 30; // 14:30
  const s3Start = 22 * 60 + 30; // 22:30

  let detectedShift = 'Shift 1';
  if (totalMinutes >= s1Start && totalMinutes < s2Start) {
    detectedShift = 'Shift 1';
  } else if (totalMinutes >= s2Start && totalMinutes < s3Start) {
    detectedShift = 'Shift 2';
  } else {
    detectedShift = 'Shift 3';
    // If between midnight and 06:30, it belongs to the shift day of yesterday
    if (totalMinutes < s1Start) {
      const yesterday = new Date(now);
      yesterday.setDate(yesterday.getDate() - 1);
      const yYear = yesterday.getFullYear();
      const yMonth = String(yesterday.getMonth() + 1).padStart(2, '0');
      const yDay = String(yesterday.getDate()).padStart(2, '0');
      dateInput.value = `${yYear}-${yMonth}-${yDay}`;
      currentShift.date = dateInput.value;
    }
  }

  shiftSelect.value = detectedShift;
  currentShift.shift = detectedShift;
}

/**
 * Live Clock in header
 */
function updateLiveClock() {
  const now = new Date();
  const timeStr = now.toLocaleTimeString('en-IN', { hour12: true });
  const clockEl = document.getElementById('currentClock');
  if (clockEl) {
    clockEl.textContent = timeStr;
  }
}

/**
 * Tab Navigation Setup
 */
function initTabs() {
  const tabBtns = document.querySelectorAll('.tab-btn');
  tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      tabBtns.forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));

      btn.classList.add('active');
      const targetPane = document.getElementById(btn.dataset.tab);
      if (targetPane) {
        targetPane.classList.add('active');
      }

      if (btn.dataset.tab === 'tabReports') {
        renderReportsTab();
      }
    });
  });
}

/**
 * Event Listeners for User Inputs
 */
function initEventListeners() {
  // Date & Shift change
  document.getElementById('shiftDate').addEventListener('change', (e) => {
    currentShift.date = e.target.value;
    loadCurrentShiftData();
  });

  document.getElementById('shiftSelect').addEventListener('change', (e) => {
    currentShift.shift = e.target.value;
    loadCurrentShiftData();
  });

  document.getElementById('operatorSelect').addEventListener('change', (e) => {
    currentShift.operatorName = e.target.value;
  });

  document.getElementById('shiftNotes').addEventListener('input', (e) => {
    currentShift.notes = e.target.value;
  });

  // Thermax Depths
  const thOpenInput = document.getElementById('thOpenDepth');
  thOpenInput.addEventListener('input', () => {
    const val = thOpenInput.value === '' ? null : Number(thOpenInput.value);
    currentShift.thermax.openingDepthCm = val;
    updateThermaxCalculations();
    updateVisualBunker(val !== null ? val : 0);
  });

  const thCloseInput = document.getElementById('thCloseDepth');
  thCloseInput.addEventListener('input', () => {
    const val = thCloseInput.value === '' ? null : Number(thCloseInput.value);
    currentShift.thermax.closingDepthCm = val;
    updateThermaxCalculations();
  });

  // Fetch previous shift closing depth
  document.getElementById('btnRefreshPrevDepth').addEventListener('click', () => {
    applyAutoHandover(true);
  });

  // Max Therm Dust Inputs
  document.getElementById('mtDustSacks').addEventListener('input', (e) => {
    currentShift.maxTherm.dustSacksCount = parseInt(e.target.value, 10) || 0;
    updateMaxThermCalculations();
  });

  document.getElementById('mtSackWeight').addEventListener('input', (e) => {
    currentShift.maxTherm.dustWeightPerSackKg = parseFloat(e.target.value) || 8;
    updateMaxThermCalculations();
  });

  // Add Lorry Buttons
  document.getElementById('btnAddThermaxLorry').addEventListener('click', () => openLorryModal('thermax'));
  document.getElementById('btnAddMaxThermLorry').addEventListener('click', () => openLorryModal('maxTherm'));
  document.getElementById('btnAddComplockLorry').addEventListener('click', () => openLorryModal('complock'));

  // Lorry Modal Actions
  document.getElementById('modalClose').addEventListener('click', closeLorryModal);
  document.getElementById('modalCancel').addEventListener('click', closeLorryModal);
  document.getElementById('lorryForm').addEventListener('submit', handleLorryFormSubmit);

  // Modal Weight Mode Toggle
  document.querySelectorAll('input[name="modalWeightMode"]').forEach(radio => {
    radio.addEventListener('change', (e) => {
      const mode = e.target.value;
      document.getElementById('modeDirectNet').style.display = mode === 'net' ? 'block' : 'none';
      document.getElementById('modeGrossTare').style.display = mode === 'gross_tare' ? 'block' : 'none';
    });
  });

  // Modal Gross/Tare live calc
  const grossIn = document.getElementById('modalGrossWeight');
  const tareIn = document.getElementById('modalTareWeight');
  const calcGrossTare = () => {
    const g = parseFloat(grossIn.value) || 0;
    const t = parseFloat(tareIn.value) || 0;
    const net = Math.max(0, g - t);
    document.getElementById('modalCalcNet').textContent = `${net.toLocaleString()} kg (${(net / 1000).toFixed(3)} Tonnes)`;
  };
  grossIn.addEventListener('input', calcGrossTare);
  tareIn.addEventListener('input', calcGrossTare);

  // Save Shift Button
  document.getElementById('btnSaveShift').addEventListener('click', saveCurrentShift);

  // WhatsApp Buttons
  document.getElementById('btnShareWhatsApp').addEventListener('click', () => {
    const text = generateShiftWhatsAppText(currentShift);
    shareToWhatsApp(text);
  });

  document.getElementById('btnShareDailyWhatsApp').addEventListener('click', () => {
    const daily = boilerStore.getDailySummary(currentShift.date);
    const text = generateDailyWhatsAppText(daily);
    shareToWhatsApp(text);
  });

  // Export CSV
  document.getElementById('btnExportCSV').addEventListener('click', () => {
    exportShiftsToCSV(boilerStore.shifts);
  });

  document.getElementById('btnRefreshHistory').addEventListener('click', renderAllShiftsTable);

  // Settings Actions
  document.getElementById('btnSaveSettings').addEventListener('click', () => {
    const bulkDensity = parseFloat(document.getElementById('settingBulkDensity').value) || 370;
    const sackWt = parseFloat(document.getElementById('settingDustSackWeight').value) || 8;
    BUNKER_CONFIG.bulkDensityKgM3 = bulkDensity;
    boilerStore.saveSettings({ woodChipsBulkDensity: bulkDensity, dustSackWeightKg: sackWt });
    alert('സെറ്റിങ്സ് വിജയകരമായി സേവ് ചെയ്തു (Settings saved successfully).');
    updateAllCalculations();
  });

  // Quick lookup
  document.getElementById('quickLookupDepth').addEventListener('input', (e) => {
    const d = parseFloat(e.target.value);
    if (!isNaN(d)) {
      const res = getThermaxBunkerDetails(d);
      document.getElementById('quickLookupResult').textContent = 
        `Volume: ${res.volumeM3.toFixed(3)} m³ | Stock: ${res.stockTonnes.toFixed(2)} Tonnes (${res.stockKg.toLocaleString()} kg)`;
    } else {
      document.getElementById('quickLookupResult').textContent = 'Volume: -- m³ | Stock: -- Tonnes (-- kg)';
    }
  });

  // Backup & Restore
  document.getElementById('btnBackupData').addEventListener('click', () => {
    const jsonStr = boilerStore.exportAllDataJson();
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `WIP_Boiler_Backup_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  });

  document.getElementById('fileRestoreInput').addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const success = boilerStore.importDataJson(event.target.result);
      if (success) {
        alert('ഡാറ്റ വിജയകരമായി റീസ്റ്റോർ ചെയ്തു (Backup restored successfully).');
        loadCurrentShiftData();
      } else {
        alert('ബാക്കപ്പ് ഫയൽ വായിക്കാൻ കഴിഞ്ഞില്ല (Failed to parse backup JSON).');
      }
    };
    reader.readAsText(file);
  });
}

/**
 * Load Shift Data (or initialize new shift)
 */
function loadCurrentShiftData() {
  const existing = boilerStore.getShift(currentShift.date, currentShift.shift);

  if (existing) {
    currentShift = JSON.parse(JSON.stringify(existing));
    document.getElementById('autoHandoverBadge').style.display = 'none';
  } else {
    // New Shift
    currentShift = {
      date: document.getElementById('shiftDate').value,
      shift: document.getElementById('shiftSelect').value,
      operatorName: document.getElementById('operatorSelect').value,
      thermax: {
        openingDepthCm: null,
        openingVolumeM3: 0,
        openingStockKg: 0,
        lorries: [],
        totalIncomingChipsKg: 0,
        closingDepthCm: null,
        closingVolumeM3: 0,
        closingStockKg: 0,
        consumptionKg: 0,
        consumptionTonnes: 0
      },
      maxTherm: {
        lorries: [],
        woodLogsKg: 0,
        dustSacksCount: 0,
        dustWeightPerSackKg: boilerStore.settings.dustSackWeightKg || 8,
        dustKg: 0,
        totalConsumptionKg: 0,
        totalConsumptionTonnes: 0
      },
      complock: {
        lorries: [],
        woodLogsKg: 0,
        totalConsumptionKg: 0,
        totalConsumptionTonnes: 0
      },
      notes: ''
    };

    // Apply auto-handover from previous shift!
    applyAutoHandover(false);
  }

  // Populate UI inputs
  document.getElementById('operatorSelect').value = currentShift.operatorName || 'Operator 1';
  document.getElementById('shiftNotes').value = currentShift.notes || '';

  // Thermax UI
  document.getElementById('thOpenDepth').value = currentShift.thermax.openingDepthCm ?? '';
  document.getElementById('thCloseDepth').value = currentShift.thermax.closingDepthCm ?? '';

  // Max Therm UI
  document.getElementById('mtDustSacks').value = currentShift.maxTherm.dustSacksCount || '';
  document.getElementById('mtSackWeight').value = currentShift.maxTherm.dustWeightPerSackKg || 8;

  // Render Lorry tables
  renderLorryTable('thermax');
  renderLorryTable('maxTherm');
  renderLorryTable('complock');

  // Trigger calculations
  updateAllCalculations();

  // Visual bunker update
  updateVisualBunker(currentShift.thermax.openingDepthCm ?? 0);
}

/**
 * Auto handover of Thermax bunker opening depth
 */
function applyAutoHandover(showNotification = false) {
  const prevClosing = boilerStore.getPreviousShiftClosingDepth(currentShift.date, currentShift.shift);
  const badge = document.getElementById('autoHandoverBadge');

  if (prevClosing !== null && prevClosing !== undefined) {
    currentShift.thermax.openingDepthCm = prevClosing;
    document.getElementById('thOpenDepth').value = prevClosing;
    badge.style.display = 'inline-flex';
    badge.textContent = `✓ Auto-filled: ${prevClosing} cm`;
    if (showNotification) {
      alert(`മുൻപത്തെ ഷിഫ്റ്റിലെ closing depth (${prevClosing} cm) ഓപ്പണിങ് ആയി നൽകി.`);
    }
  } else {
    badge.style.display = 'none';
    if (showNotification) {
      alert('മുൻപത്തെ ഷിഫ്റ്റിലെ റെക്കോർഡ് കണ്ടെത്താനായില്ല (No previous shift found).');
    }
  }
  updateThermaxCalculations();
}

/**
 * Recalculate Thermax Section
 */
function updateThermaxCalculations() {
  const th = currentShift.thermax;

  // Opening
  if (th.openingDepthCm !== null && th.openingDepthCm !== undefined && th.openingDepthCm !== '') {
    const openRes = getThermaxBunkerDetails(th.openingDepthCm);
    th.openingVolumeM3 = openRes.volumeM3;
    th.openingStockKg = openRes.stockKg;
    document.getElementById('thOpenVol').textContent = `${openRes.volumeM3.toFixed(3)} m³`;
    document.getElementById('thOpenStock').textContent = `${openRes.stockTonnes.toFixed(2)} Tonnes (${openRes.stockKg.toLocaleString()} kg)`;
  } else {
    th.openingVolumeM3 = 0;
    th.openingStockKg = 0;
    document.getElementById('thOpenVol').textContent = '0.000 m³';
    document.getElementById('thOpenStock').textContent = '0.00 Tonnes';
  }

  // Incoming lorries sum
  let incomingChipsKg = 0;
  th.lorries.forEach(l => {
    incomingChipsKg += (l.netKg || 0);
  });
  th.totalIncomingChipsKg = incomingChipsKg;
  document.getElementById('thTotalIncomingT').textContent = 
    `${(incomingChipsKg / 1000).toFixed(2)} Tonnes (${incomingChipsKg.toLocaleString()} kg)`;

  // Closing
  if (th.closingDepthCm !== null && th.closingDepthCm !== undefined && th.closingDepthCm !== '') {
    const closeRes = getThermaxBunkerDetails(th.closingDepthCm);
    th.closingVolumeM3 = closeRes.volumeM3;
    th.closingStockKg = closeRes.stockKg;
    document.getElementById('thCloseVol').textContent = `${closeRes.volumeM3.toFixed(3)} m³`;
    document.getElementById('thCloseStock').textContent = `${closeRes.stockTonnes.toFixed(2)} Tonnes (${closeRes.stockKg.toLocaleString()} kg)`;
  } else {
    th.closingVolumeM3 = 0;
    th.closingStockKg = 0;
    document.getElementById('thCloseVol').textContent = '0.000 m³';
    document.getElementById('thCloseStock').textContent = '0.00 Tonnes';
  }

  // Net Consumption = Opening Stock + Incoming Lorries - Closing Stock
  const cons = calculateThermaxConsumption(th.openingStockKg, th.totalIncomingChipsKg, th.closingStockKg);
  th.consumptionKg = cons.consumptionKg;
  th.consumptionTonnes = cons.consumptionTonnes;

  document.getElementById('thFinalConsumption').textContent = `${cons.consumptionTonnes.toFixed(2)} Tonnes`;
  document.getElementById('thFinalConsumptionKg').textContent = `${cons.consumptionKg.toLocaleString()} kg`;

  // Top KPI update
  document.getElementById('kpiThermax').textContent = cons.consumptionTonnes.toFixed(2);
  document.getElementById('kpiThermaxSub').textContent = 
    `Open: ${th.openingDepthCm ?? '-'} cm | Close: ${th.closingDepthCm ?? '-'} cm`;

  updateGrandTotal();
}

/**
 * Recalculate Max Therm Section
 */
function updateMaxThermCalculations() {
  const mt = currentShift.maxTherm;

  // Wood logs lorries sum
  let logsKg = 0;
  mt.lorries.forEach(l => {
    logsKg += (l.netKg || 0);
  });
  mt.woodLogsKg = logsKg;
  document.getElementById('mtWoodLogsTotal').textContent = 
    `${(logsKg / 1000).toFixed(2)} Tonnes (${logsKg.toLocaleString()} kg)`;

  // Dust calculations
  const dustResult = calculateMaxThermConsumption(logsKg, mt.dustSacksCount, mt.dustWeightPerSackKg);
  mt.dustKg = dustResult.dustKg;
  mt.totalConsumptionKg = dustResult.totalKg;
  mt.totalConsumptionTonnes = dustResult.totalTonnes;

  document.getElementById('mtDustKg').textContent = `${dustResult.dustKg.toLocaleString()} kg`;
  document.getElementById('mtDustTonnes').textContent = `${dustResult.dustTonnes.toFixed(2)} Tonnes`;

  document.getElementById('mtFinalConsumption').textContent = `${dustResult.totalTonnes.toFixed(2)} Tonnes`;
  document.getElementById('mtFinalConsumptionKg').textContent = `${dustResult.totalKg.toLocaleString()} kg`;

  // Top KPI update
  document.getElementById('kpiMaxTherm').textContent = dustResult.totalTonnes.toFixed(2);
  document.getElementById('kpiMaxThermSub').textContent = 
    `Logs: ${(logsKg / 1000).toFixed(1)} T | Dust: ${dustResult.dustTonnes.toFixed(1)} T (${mt.dustSacksCount} sacks)`;

  updateGrandTotal();
}

/**
 * Recalculate Complock Section
 */
function updateComplockCalculations() {
  const cp = currentShift.complock;

  let logsKg = 0;
  cp.lorries.forEach(l => {
    logsKg += (l.netKg || 0);
  });
  cp.woodLogsKg = logsKg;
  const compResult = calculateComplockConsumption(logsKg);
  cp.totalConsumptionKg = compResult.totalKg;
  cp.totalConsumptionTonnes = compResult.totalTonnes;

  document.getElementById('cpWoodLogsTotal').textContent = 
    `${(logsKg / 1000).toFixed(2)} Tonnes (${logsKg.toLocaleString()} kg)`;
  document.getElementById('cpFinalConsumption').textContent = `${compResult.totalTonnes.toFixed(2)} Tonnes`;
  document.getElementById('cpFinalConsumptionKg').textContent = `${compResult.totalKg.toLocaleString()} kg`;

  // Top KPI update
  document.getElementById('kpiComplock').textContent = compResult.totalTonnes.toFixed(2);
  document.getElementById('kpiComplockSub').textContent = `Lorries: ${cp.lorries.length}`;

  updateGrandTotal();
}

/**
 * Update Shift Grand Total
 */
function updateGrandTotal() {
  const thT = currentShift.thermax.consumptionTonnes || 0;
  const mtT = currentShift.maxTherm.totalConsumptionTonnes || 0;
  const cpT = currentShift.complock.totalConsumptionTonnes || 0;

  const totalT = thT + mtT + cpT;
  document.getElementById('kpiGrandTotal').textContent = totalT.toFixed(2);
  document.getElementById('barTotalTonnes').textContent = `${totalT.toFixed(2)} T`;
}

function updateAllCalculations() {
  updateThermaxCalculations();
  updateMaxThermCalculations();
  updateComplockCalculations();
}

/**
 * Update Interactive Visual Bunker SVG Display
 */
function updateVisualBunker(depthCm) {
  const d = Math.max(0, Math.min(BUNKER_CONFIG.totalDepthCm, Number(depthCm) || 0));
  const res = getThermaxBunkerDetails(d);

  // Bunker SVG coordinate mapping:
  // Top: y = 20 (0 cm)
  // Transition (Rectangular bottom): y = 120 (247 cm)
  // Bottom (Hopper discharge): y = 300 (753 cm)
  let yMarker = 20;
  if (d <= BUNKER_CONFIG.upperHeightCm) {
    // 0 to 247 cm maps to 20 to 120 px
    yMarker = 20 + (d / BUNKER_CONFIG.upperHeightCm) * 100;
  } else {
    // 247 to 753 cm maps to 120 to 300 px
    const hopperFraction = (d - BUNKER_CONFIG.upperHeightCm) / BUNKER_CONFIG.hopperHeightCm;
    yMarker = 120 + hopperFraction * 180;
  }

  // Set line position
  const lineEl = document.getElementById('svgLevelLine');
  if (lineEl) {
    lineEl.setAttribute('y1', yMarker);
    lineEl.setAttribute('y2', yMarker);
  }

  // Set fuel fill rect: start from yMarker to 300
  const fillEl = document.getElementById('svgFuelFill');
  if (fillEl) {
    fillEl.setAttribute('y', yMarker);
    fillEl.setAttribute('height', Math.max(0, 304 - yMarker));
  }

  // Pill status
  const pill = document.getElementById('bunkerVisualStatus');
  if (pill) {
    pill.textContent = `Level: ${d} cm | ${res.volumeM3.toFixed(2)} m³ | ${res.stockTonnes.toFixed(2)} T`;
  }
}

/**
 * Lorry Weighment Modal Logic
 */
function openLorryModal(boiler) {
  currentModalBoiler = boiler;
  const titles = {
    thermax: '🚛 Add Wood Chips Lorry (Thermax)',
    maxTherm: '🚛 Add Wood Logs Lorry (Max Therm)',
    complock: '🚛 Add Wood Logs Lorry (Complock)'
  };
  document.getElementById('modalTitle').textContent = titles[boiler] || '🚛 Add Lorry Weighment';
  document.getElementById('modalTargetBoiler').value = boiler;

  // Reset form fields
  document.getElementById('modalVehicleNo').value = '';
  document.getElementById('modalNetWeight').value = '';
  document.getElementById('modalGrossWeight').value = '';
  document.getElementById('modalTareWeight').value = '';
  document.getElementById('modalCalcNet').textContent = '0 kg (0.00 Tonnes)';

  // Default to net weight mode
  document.querySelector('input[name="modalWeightMode"][value="net"]').checked = true;
  document.getElementById('modeDirectNet').style.display = 'block';
  document.getElementById('modeGrossTare').style.display = 'none';

  document.getElementById('lorryModal').classList.add('active');
}

function closeLorryModal() {
  document.getElementById('lorryModal').classList.remove('active');
}

function handleLorryFormSubmit(e) {
  e.preventDefault();

  const boiler = document.getElementById('modalTargetBoiler').value;
  const vehicleNo = document.getElementById('modalVehicleNo').value.trim() || 'Lorry';
  const mode = document.querySelector('input[name="modalWeightMode"]:checked').value;

  let netKg = 0;
  let grossKg = null;
  let tareKg = null;

  if (mode === 'net') {
    const rawVal = parseFloat(document.getElementById('modalNetWeight').value);
    if (isNaN(rawVal) || rawVal <= 0) {
      alert('ദയവായി സാധുവായ നെറ്റ് വെയ്റ്റ് നൽകുക (Please enter a valid net weight).');
      return;
    }
    const unit = document.getElementById('modalNetUnit').value;
    netKg = unit === 'tonnes' ? rawVal * 1000 : rawVal;
  } else {
    grossKg = parseFloat(document.getElementById('modalGrossWeight').value) || 0;
    tareKg = parseFloat(document.getElementById('modalTareWeight').value) || 0;
    netKg = grossKg - tareKg;
    if (netKg <= 0) {
      alert('ഗ്രോസ് വെയ്റ്റ് ടേർ വെയ്റ്റിനേക്കാൾ കൂടുതലായിരിക്കണം (Gross weight must exceed tare weight).');
      return;
    }
  }

  const lorryItem = {
    id: Date.now().toString(),
    vehicleNo,
    netKg: Math.round(netKg),
    netTonnes: Number((netKg / 1000).toFixed(3)),
    grossKg,
    tareKg
  };

  if (boiler === 'thermax') {
    currentShift.thermax.lorries.push(lorryItem);
    renderLorryTable('thermax');
    updateThermaxCalculations();
  } else if (boiler === 'maxTherm') {
    currentShift.maxTherm.lorries.push(lorryItem);
    renderLorryTable('maxTherm');
    updateMaxThermCalculations();
  } else if (boiler === 'complock') {
    currentShift.complock.lorries.push(lorryItem);
    renderLorryTable('complock');
    updateComplockCalculations();
  }

  closeLorryModal();
}

/**
 * Render Lorry Tables
 */
function renderLorryTable(boiler) {
  let tableBodyId = '';
  let lorries = [];

  if (boiler === 'thermax') {
    tableBodyId = 'thLorryTableBody';
    lorries = currentShift.thermax.lorries;
  } else if (boiler === 'maxTherm') {
    tableBodyId = 'mtLorryTableBody';
    lorries = currentShift.maxTherm.lorries;
  } else if (boiler === 'complock') {
    tableBodyId = 'cpLorryTableBody';
    lorries = currentShift.complock.lorries;
  }

  const tbody = document.getElementById(tableBodyId);
  if (!tbody) return;

  if (lorries.length === 0) {
    tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; color:#64748b;">ഈ ഷിഫ്റ്റിൽ ലോറികൾ ചേർത്തിട്ടില്ല (No lorries added yet)</td></tr>';
    return;
  }

  tbody.innerHTML = lorries.map((l, index) => `
    <tr>
      <td>${index + 1}</td>
      <td><strong>${l.vehicleNo}</strong></td>
      <td style="color:#38bdf8; font-weight:700;">${l.netTonnes.toFixed(2)} T</td>
      <td>${l.netKg.toLocaleString()} kg</td>
      <td>
        <button class="btn-delete" onclick="deleteLorry('${boiler}', '${l.id}')">Delete</button>
      </td>
    </tr>
  `).join('');
}

window.deleteLorry = function(boiler, id) {
  if (!confirm('ഈ ലോറി എൻട്രി നീക്കം ചെയ്യണമെന്നുറപ്പാണോ? (Delete this lorry entry?)')) return;

  if (boiler === 'thermax') {
    currentShift.thermax.lorries = currentShift.thermax.lorries.filter(l => l.id !== id);
    renderLorryTable('thermax');
    updateThermaxCalculations();
  } else if (boiler === 'maxTherm') {
    currentShift.maxTherm.lorries = currentShift.maxTherm.lorries.filter(l => l.id !== id);
    renderLorryTable('maxTherm');
    updateMaxThermCalculations();
  } else if (boiler === 'complock') {
    currentShift.complock.lorries = currentShift.complock.lorries.filter(l => l.id !== id);
    renderLorryTable('complock');
    updateComplockCalculations();
  }
};

/**
 * Save Current Shift
 */
function saveCurrentShift() {
  currentShift.date = document.getElementById('shiftDate').value;
  currentShift.shift = document.getElementById('shiftSelect').value;
  currentShift.operatorName = document.getElementById('operatorSelect').value;
  currentShift.notes = document.getElementById('shiftNotes').value;

  const saved = boilerStore.saveShift(currentShift);
  alert(`✓ ${currentShift.shift} (${currentShift.date}) ഡാറ്റ വിജയകരമായി സേവ് ചെയ്തു!`);

  // Refresh reports view
  renderReportsTab();
}

/**
 * Reports Tab Rendering
 */
function renderReportsTab() {
  const daily = boilerStore.getDailySummary(currentShift.date);

  document.getElementById('dailyThermaxT').textContent = daily.thermaxTotalTonnes.toFixed(2);
  document.getElementById('dailyMaxThermT').textContent = daily.maxThermTotalTonnes.toFixed(2);
  document.getElementById('dailyComplockT').textContent = daily.complockTotalTonnes.toFixed(2);
  document.getElementById('dailyGrandTotalT').textContent = daily.grandTotalTonnes.toFixed(2);

  // Day shifts cards
  const container = document.getElementById('dayShiftsContainer');
  if (daily.shifts.length === 0) {
    container.innerHTML = '<div style="color:#64748b; font-size:0.85rem;">ഈ തീയതിയിൽ ഷിഫ്റ്റുകൾ ഒന്നും രേഖപ്പെടുത്തിയിട്ടില്ല.</div>';
  } else {
    container.innerHTML = daily.shifts.map(s => {
      const sTotalT = ((s.thermax?.consumptionKg || 0) + (s.maxTherm?.totalConsumptionKg || 0) + (s.complock?.totalConsumptionKg || 0)) / 1000;
      return `
        <div style="background:#1e293b; border:1px solid #334155; border-radius:8px; padding:12px; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px;">
          <div>
            <span style="font-weight:700; color:#fff;">${s.shift}</span>
            <span style="font-size:0.8rem; color:#94a3b8; margin-left:8px;">(Operator: ${s.operatorName})</span>
            <div style="font-size:0.75rem; color:#64748b; margin-top:2px;">
              Thermax: ${((s.thermax?.consumptionKg || 0) / 1000).toFixed(2)} T | 
              Max Therm: ${((s.maxTherm?.totalConsumptionKg || 0) / 1000).toFixed(2)} T | 
              Complock: ${((s.complock?.totalConsumptionKg || 0) / 1000).toFixed(2)} T
            </div>
          </div>
          <div style="display:flex; align-items:center; gap:10px;">
            <strong style="color:#34d399; font-size:1.1rem;">${sTotalT.toFixed(2)} T</strong>
            <button class="btn btn-secondary btn-sm" onclick="loadShiftForEditing('${s.date}', '${s.shift}')">Edit</button>
          </div>
        </div>
      `;
    }).join('');
  }

  renderAllShiftsTable();
}

/**
 * All Recorded Shifts Table
 */
function renderAllShiftsTable() {
  const tbody = document.getElementById('allShiftsTableBody');
  if (!tbody) return;

  if (boilerStore.shifts.length === 0) {
    tbody.innerHTML = '<tr><td colspan="8" style="text-align:center; color:#64748b;">No shift records stored yet.</td></tr>';
    return;
  }

  tbody.innerHTML = boilerStore.shifts.map(s => {
    const thT = ((s.thermax?.consumptionKg || 0) / 1000).toFixed(2);
    const mtT = ((s.maxTherm?.totalConsumptionKg || 0) / 1000).toFixed(2);
    const cpT = ((s.complock?.totalConsumptionKg || 0) / 1000).toFixed(2);
    const totalT = (parseFloat(thT) + parseFloat(mtT) + parseFloat(cpT)).toFixed(2);

    return `
      <tr>
        <td>${s.date}</td>
        <td><strong>${s.shift}</strong></td>
        <td>${s.operatorName || '-'}</td>
        <td style="color:#f59e0b;">${thT}</td>
        <td style="color:#ef4444;">${mtT}</td>
        <td style="color:#3b82f6;">${cpT}</td>
        <td style="color:#34d399; font-weight:700;">${totalT}</td>
        <td style="white-space:nowrap;">
          <button class="btn btn-secondary btn-sm" onclick="loadShiftForEditing('${s.date}', '${s.shift}')">Open</button>
          <button class="btn-delete" style="margin-left:4px;" onclick="deleteShiftRecord('${s.id}')">Del</button>
        </td>
      </tr>
    `;
  }).join('');
}

window.loadShiftForEditing = function(dateStr, shiftName) {
  document.getElementById('shiftDate').value = dateStr;
  document.getElementById('shiftSelect').value = shiftName;
  currentShift.date = dateStr;
  currentShift.shift = shiftName;
  loadCurrentShiftData();

  // Switch to Tab 1
  document.querySelector('.tab-btn.thermax').click();
};

window.deleteShiftRecord = function(id) {
  if (confirm('ഈ ഷിഫ്റ്റ് ലോഗ് പൂർണ്ണമായി നീക്കം ചെയ്യണമെന്നുറപ്പാണോ?')) {
    boilerStore.deleteShift(id);
    renderReportsTab();
  }
};

/**
 * Populate Bunker Calibration Reference Table in Settings tab
 */
function initReferenceTable() {
  const tbody = document.getElementById('bunkerRefTableBody');
  if (!tbody) return;

  const rows = [];
  // Sample every 10cm from 0 to 750, plus 247 and 753
  const depths = [];
  for (let d = 0; d <= 750; d += 10) {
    if (d > 240 && !depths.includes(247) && d <= 250) {
      depths.push(247);
    }
    depths.push(d);
  }
  if (!depths.includes(753)) depths.push(753);
  depths.sort((a, b) => a - b);

  depths.forEach(d => {
    const res = getThermaxBunkerDetails(d);
    rows.push(`
      <tr>
        <td><strong>${d} cm</strong></td>
        <td>${res.volumeM3.toFixed(4)} m³</td>
        <td>${res.stockKg.toLocaleString()} kg</td>
        <td style="color:#38bdf8; font-weight:600;">${res.stockTonnes.toFixed(3)} T</td>
      </tr>
    `);
  });

  tbody.innerHTML = rows.join('');
}
