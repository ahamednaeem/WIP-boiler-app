/**
 * Western India Plywoods - Boiler Fuel Management
 * Thermax Bunker Geometry & Calculations
 * 
 * Geometry parameters (from engineering specs):
 * - Upper Rectangular section: L = 508.0 cm, W = 194.0 cm, H = 247.0 cm
 *   Upper volume = 5.08 * 1.94 * 2.47 = 24.342344 m³
 * - Lower 2-Hopper section: H = 506.0 cm, Bottom W = 46.0 cm, Top W = 194.0 cm, Total L = 508.0 cm (2 * 254 cm)
 *   Hopper volume = 5.08 * ((0.46 + 1.94) / 2) * 5.06 = 30.84576 m³
 * - Total Bunker Depth: 753.0 cm (7.53 m)
 * - Total Bunker Volume: 55.188104 m³
 * - Bulk Density: 370 kg/m³
 * - Max Stock at D = 0 cm: 20419.59848 kg (~20.42 Tonnes)
 */

const BUNKER_CONFIG = {
  upperLengthCm: 508.0,
  upperWidthCm: 194.0,
  upperHeightCm: 247.0,
  hopperHeightCm: 506.0,
  hopperBottomWidthCm: 46.0,
  hopperTopWidthCm: 194.0,
  totalDepthCm: 753.0,
  upperVolumeM3: 24.342344,
  hopperVolumeM3: 30.84576,
  totalCapacityM3: 55.188104,
  bulkDensityKgM3: 370.0,
  maxStockKg: 20419.59848
};

/**
 * Calculate remaining volume (m³) given distance from top D in cm.
 * @param {number} depthCm - Distance from top in cm (0 to 753)
 * @returns {number} Remaining volume in m³
 */
function calculateThermaxVolume(depthCm) {
  if (depthCm === null || depthCm === undefined || isNaN(depthCm)) return 0;
  const d = Math.max(0, Math.min(BUNKER_CONFIG.totalDepthCm, Number(depthCm)));

  if (d >= BUNKER_CONFIG.totalDepthCm) {
    return 0;
  }

  // Case 1: In the upper rectangular section (0 to 247 cm)
  if (d <= BUNKER_CONFIG.upperHeightCm) {
    const emptyDepthM = d / 100.0;
    const emptyVolumeM3 = (BUNKER_CONFIG.upperLengthCm / 100.0) * (BUNKER_CONFIG.upperWidthCm / 100.0) * emptyDepthM;
    return BUNKER_CONFIG.totalCapacityM3 - emptyVolumeM3;
  }

  // Case 2: In the lower hopper section (247 cm to 753 cm)
  // Height of wood remaining from the very bottom of the hopper
  const hRemainingM = (BUNKER_CONFIG.totalDepthCm - d) / 100.0; // from 0 to 5.06 m
  const hopperHeightM = BUNKER_CONFIG.hopperHeightCm / 100.0; // 5.06 m
  const w0 = BUNKER_CONFIG.hopperBottomWidthCm / 100.0; // 0.46 m
  const w1 = BUNKER_CONFIG.hopperTopWidthCm / 100.0; // 1.94 m
  const L = BUNKER_CONFIG.upperLengthCm / 100.0; // 5.08 m

  // Cross section trapezoid area from y=0 to y=hRemainingM:
  // w(y) = w0 + ((w1 - w0) / H) * y
  // Area(h) = w0 * h + 0.5 * ((w1 - w0) / H) * h²
  const slope = (w1 - w0) / hopperHeightM;
  const areaM2 = (w0 * hRemainingM) + (0.5 * slope * hRemainingM * hRemainingM);
  const remainingVolumeM3 = L * areaM2;

  return Math.max(0, remainingVolumeM3);
}

/**
 * Calculate estimated wood chips stock in kg from remaining volume.
 * @param {number} volumeM3 
 * @returns {number} Stock in kg
 */
function calculateThermaxStockKg(volumeM3) {
  return volumeM3 * BUNKER_CONFIG.bulkDensityKgM3;
}

/**
 * Complete Thermax Level lookup given depth D in cm.
 * @param {number} depthCm 
 * @returns {{depthCm: number, volumeM3: number, stockKg: number, stockTonnes: number}}
 */
function getThermaxBunkerDetails(depthCm) {
  const d = Math.max(0, Math.min(BUNKER_CONFIG.totalDepthCm, Number(depthCm) || 0));
  const volumeM3 = calculateThermaxVolume(d);
  const stockKg = calculateThermaxStockKg(volumeM3);
  return {
    depthCm: d,
    volumeM3: Number(volumeM3.toFixed(4)),
    stockKg: Number(stockKg.toFixed(2)),
    stockTonnes: Number((stockKg / 1000).toFixed(3))
  };
}

/**
 * Calculate Thermax shift fuel consumption
 * Formula: Opening Stock + Total Incoming Wood Chips - Closing Stock
 * @param {number} openingStockKg 
 * @param {number} incomingChipsKg 
 * @param {number} closingStockKg 
 * @returns {{consumptionKg: number, consumptionTonnes: number}}
 */
function calculateThermaxConsumption(openingStockKg, incomingChipsKg, closingStockKg) {
  const openKg = Number(openingStockKg) || 0;
  const inKg = Number(incomingChipsKg) || 0;
  const closeKg = Number(closingStockKg) || 0;

  const consumptionKg = (openKg + inKg) - closeKg;
  return {
    consumptionKg: Number(consumptionKg.toFixed(2)),
    consumptionTonnes: Number((consumptionKg / 1000).toFixed(3))
  };
}

/**
 * Calculate Max Therm shift fuel consumption
 * Formula: Wood Logs (from lorries) + Dust Bags (count * sackWeightKg, default 8kg)
 * @param {number} woodLogsKg 
 * @param {number} dustSacksCount 
 * @param {number} sackWeightKg (default 8)
 * @returns {{woodLogsKg: number, dustKg: number, totalKg: number, totalTonnes: number}}
 */
function calculateMaxThermConsumption(woodLogsKg, dustSacksCount, sackWeightKg = 8) {
  const logsKg = Number(woodLogsKg) || 0;
  const sacks = Math.max(0, parseInt(dustSacksCount, 10) || 0);
  const weightPerSack = Number(sackWeightKg) > 0 ? Number(sackWeightKg) : 8;
  const dustKg = sacks * weightPerSack;
  const totalKg = logsKg + dustKg;

  return {
    woodLogsKg: logsKg,
    woodLogsTonnes: Number((logsKg / 1000).toFixed(3)),
    dustSacks: sacks,
    dustKg: dustKg,
    dustTonnes: Number((dustKg / 1000).toFixed(3)),
    totalKg: Number(totalKg.toFixed(2)),
    totalTonnes: Number((totalKg / 1000).toFixed(3))
  };
}

/**
 * Calculate Complock shift fuel consumption
 * Formula: Wood Logs (from lorries)
 * @param {number} woodLogsKg 
 * @returns {{woodLogsKg: number, totalTonnes: number}}
 */
function calculateComplockConsumption(woodLogsKg) {
  const logsKg = Number(woodLogsKg) || 0;
  return {
    woodLogsKg: logsKg,
    totalKg: logsKg,
    totalTonnes: Number((logsKg / 1000).toFixed(3))
  };
}

// Export for Node and Browser
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    BUNKER_CONFIG,
    calculateThermaxVolume,
    calculateThermaxStockKg,
    getThermaxBunkerDetails,
    calculateThermaxConsumption,
    calculateMaxThermConsumption,
    calculateComplockConsumption
  };
}
