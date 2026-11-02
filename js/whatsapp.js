/**
 * Western India Plywoods - Boiler Fuel Management
 * WhatsApp Message Generator & Sharing
 */

function formatNumber(num, decimals = 2) {
  if (num === null || num === undefined || isNaN(num)) return '0.00';
  return Number(num).toLocaleString('en-IN', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  });
}

/**
 * Format a single shift report for WhatsApp
 */
function generateShiftWhatsAppText(shiftData) {
  if (!shiftData) return '';

  const date = shiftData.date || 'N/A';
  const shift = shiftData.shift || 'Shift 1';
  const operator = shiftData.operatorName || 'Shift In-Charge';
  const unit = shiftData.unit || 'T';

  // Thermax
  const th = shiftData.thermax || {};
  const thOpenDepth = th.openingDepthCm ?? '-';
  const thOpenStockT = (th.openingStockKg || 0) / 1000;
  const thCloseDepth = th.closingDepthCm ?? '-';
  const thCloseStockT = (th.closingStockKg || 0) / 1000;
  const thLorriesCount = th.lorries?.length || 0;
  const thInChipsT = (th.totalIncomingChipsKg || 0) / 1000;
  const thConsT = (th.consumptionKg || 0) / 1000;

  // Max Therm
  const mt = shiftData.maxTherm || {};
  const mtLorriesCount = mt.lorries?.length || 0;
  const mtWoodT = (mt.woodLogsKg || 0) / 1000;
  const mtSacks = mt.dustSacksCount || 0;
  const mtSackWt = mt.dustWeightPerSackKg || 8;
  const mtDustT = (mt.dustKg || 0) / 1000;
  const mtConsT = (mt.totalConsumptionKg || 0) / 1000;

  // Complock
  const cp = shiftData.complock || {};
  const cpLorriesCount = cp.lorries?.length || 0;
  const cpWoodT = (cp.woodLogsKg || 0) / 1000;
  const cpConsT = (cp.totalConsumptionKg || 0) / 1000;

  // Grand Total
  const grandTotalT = thConsT + mtConsT + cpConsT;

  return `🏭 *WESTERN INDIA PLYWOODS (WIP)*
🔥 *ബോയിലർ കൺസംഷൻ റിപ്പോർട്ട് (Boiler Shift Log)*
━━━━━━━━━━━━━━━━━━━━
📅 *തീയതി (Date):* ${date}
⏰ *ഷിഫ്റ്റ് (Shift):* ${shift}
👷 *ഓപ്പറേറ്റർ:* ${operator}
━━━━━━━━━━━━━━━━━━━━

1️⃣ *THERMAX BOILER (വുഡ് ചിപ്സ്)*
• Bunker Opening Depth: ${thOpenDepth} cm (${formatNumber(thOpenStockT, 2)} Tonnes)
• Incoming Lorries (${thLorriesCount}): ${formatNumber(thInChipsT, 2)} Tonnes
• Bunker Closing Depth: ${thCloseDepth} cm (${formatNumber(thCloseStockT, 2)} Tonnes)
👉 *Thermax Consumption: ${formatNumber(thConsT, 2)} Tonnes*

2️⃣ *MAX THERM BOILER (വുഡ് ലോഗ്സ് + ഡസ്റ്റ്)*
• Wood Logs Lorries (${mtLorriesCount}): ${formatNumber(mtWoodT, 2)} Tonnes
• Plywood Dust (${mtSacks} sacks × ${mtSackWt} kg): ${formatNumber(mtDustT, 2)} Tonnes
👉 *Max Therm Consumption: ${formatNumber(mtConsT, 2)} Tonnes*

3️⃣ *COMPLOCK BOILER (വുഡ് ലോഗ്സ്)*
• Wood Logs Lorries (${cpLorriesCount}): ${formatNumber(cpWoodT, 2)} Tonnes
👉 *Complock Consumption: ${formatNumber(cpConsT, 2)} Tonnes*

━━━━━━━━━━━━━━━━━━━━
📊 *ആകെ ഷിഫ്റ്റ് കൺസംഷൻ (Total Fuel):*
👉 *${formatNumber(grandTotalT, 2)} TONNES*
${shiftData.notes ? `\n📝 *Notes:* ${shiftData.notes}` : ''}
━━━━━━━━━━━━━━━━━━━━
_Generated via WIP Boiler Fuel App_`;
}

/**
 * Format a daily 24-hr consolidated report for WhatsApp
 */
function generateDailyWhatsAppText(dailySummary) {
  if (!dailySummary) return '';

  const date = dailySummary.date;
  const thT = dailySummary.thermaxTotalTonnes || 0;
  const mtT = dailySummary.maxThermTotalTonnes || 0;
  const cpT = dailySummary.complockTotalTonnes || 0;
  const grandT = dailySummary.grandTotalTonnes || 0;
  const shiftCount = dailySummary.shiftsLogged || 0;

  let shiftsText = '';
  if (dailySummary.shifts && dailySummary.shifts.length > 0) {
    shiftsText = dailySummary.shifts.map(s => {
      const sTotalT = ((s.thermax?.consumptionKg || 0) + (s.maxTherm?.totalConsumptionKg || 0) + (s.complock?.totalConsumptionKg || 0)) / 1000;
      return `  • *${s.shift}* (${s.operatorName || 'Op'}): ${formatNumber(sTotalT, 2)} Tonnes`;
    }).join('\n');
  }

  return `🏭 *WESTERN INDIA PLYWOODS (WIP)*
📊 *24-HOUR DAILY BOILER CONSUMPTION SUMMARY*
━━━━━━━━━━━━━━━━━━━━
📅 *തീയതി (Date):* ${date}
🕒 *ഷിഫ്റ്റുകൾ:* ${shiftCount} / 3 ഷിഫ്റ്റുകൾ രേഖപ്പെടുത്തി
━━━━━━━━━━━━━━━━━━━━

🔥 *ബോയിലർ തിരിച്ചുള്ള ആകെ കണക്ക് (Boiler-wise Totals):*
1️⃣ *Thermax (Wood Chips):* ${formatNumber(thT, 2)} Tonnes
2️⃣ *Max Therm (Logs + Dust):* ${formatNumber(mtT, 2)} Tonnes
3️⃣ *Complock (Wood Logs):* ${formatNumber(cpT, 2)} Tonnes

━━━━━━━━━━━━━━━━━━━━
📌 *ഷിഫ്റ്റ് തിരിച്ചുള്ള കണക്ക് (Shift Breakdown):*
${shiftsText || '  (ഡാറ്റ ലഭ്യമല്ല)'}

━━━━━━━━━━━━━━━━━━━━
🏆 *24-HOUR GRAND TOTAL FUEL CONSUMPTION:*
👉 *${formatNumber(grandT, 2)} TONNES*
━━━━━━━━━━━━━━━━━━━━
_Western India Plywoods - Boiler Management System_`;
}

/**
 * Open WhatsApp with prefilled message
 */
function shareToWhatsApp(text) {
  const url = `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`;
  window.open(url, '_blank');
}
