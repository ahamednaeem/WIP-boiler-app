/**
 * Western India Plywoods - Boiler Fuel Management
 * Excel & CSV Exporter
 */

function downloadCSV(csvContent, fileName) {
  // Add UTF-8 BOM for Microsoft Excel compatibility
  const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  link.setAttribute('href', url);
  link.setAttribute('download', fileName);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Export all recorded shifts to CSV
 */
function exportShiftsToCSV(shifts) {
  if (!shifts || shifts.length === 0) {
    alert('ഡൗൺലോഡ് ചെയ്യാൻ ഡാറ്റ ലഭ്യമല്ല (No shifts data available to export).');
    return;
  }

  const headers = [
    'Date',
    'Shift',
    'Operator',
    'Thermax_Open_Depth_cm',
    'Thermax_Open_Stock_T',
    'Thermax_Lorries_Count',
    'Thermax_Incoming_Chips_T',
    'Thermax_Close_Depth_cm',
    'Thermax_Close_Stock_T',
    'Thermax_Consumption_T',
    'MaxTherm_Lorries_Count',
    'MaxTherm_Wood_Logs_T',
    'MaxTherm_Dust_Sacks',
    'MaxTherm_Dust_T',
    'MaxTherm_Consumption_T',
    'Complock_Lorries_Count',
    'Complock_Wood_Logs_T',
    'Complock_Consumption_T',
    'Grand_Total_Consumption_T',
    'Notes'
  ];

  const rows = shifts.map(s => {
    const th = s.thermax || {};
    const mt = s.maxTherm || {};
    const cp = s.complock || {};

    const row = [
      s.date,
      s.shift,
      `"${(s.operatorName || '').replace(/"/g, '""')}"`,
      th.openingDepthCm ?? '',
      ((th.openingStockKg || 0) / 1000).toFixed(3),
      th.lorries?.length || 0,
      ((th.totalIncomingChipsKg || 0) / 1000).toFixed(3),
      th.closingDepthCm ?? '',
      ((th.closingStockKg || 0) / 1000).toFixed(3),
      ((th.consumptionKg || 0) / 1000).toFixed(3),
      mt.lorries?.length || 0,
      ((mt.woodLogsKg || 0) / 1000).toFixed(3),
      mt.dustSacksCount || 0,
      ((mt.dustKg || 0) / 1000).toFixed(3),
      ((mt.totalConsumptionKg || 0) / 1000).toFixed(3),
      cp.lorries?.length || 0,
      ((cp.woodLogsKg || 0) / 1000).toFixed(3),
      ((cp.totalConsumptionKg || 0) / 1000).toFixed(3),
      (((th.consumptionKg || 0) + (mt.totalConsumptionKg || 0) + (cp.totalConsumptionKg || 0)) / 1000).toFixed(3),
      `"${(s.notes || '').replace(/"/g, '""')}"`
    ];
    return row.join(',');
  });

  const csv = [headers.join(','), ...rows].join('\r\n');
  const fileName = `WIP_Boiler_Consumption_Report_${new Date().toISOString().slice(0, 10)}.csv`;
  downloadCSV(csv, fileName);
}
