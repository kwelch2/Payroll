import { Employee, MasterRates, PayrollRow } from '../types';

export function calculatePayRow(
  rawName: string,
  codeLabel: string,
  hours: number,
  employees: Employee[],
  rates: MasterRates
): PayrollRow {
  const employee = employees.find(e => e.personal.full_name === rawName);
  const rowId = Math.random().toString(36).substr(2, 9);
  
  // Basic row structure
  let row: PayrollRow = {
    id: rowId,
    name: rawName,
    code: codeLabel,
    hours: hours,
    rate: 0,
    total: 0,
    payLevel: 'Unknown',
    alert: '',
    alertLevel: 'info' // Default
  };

  if (!employee) {
    row.alert = "Employee Not Found";
    row.alertLevel = "error";
    return row;
  }

  row.payLevel = employee.classifications.pay_level || 'Unknown';
  
  const isHourlyOnly = row.payLevel.toLowerCase() === 'hourly only';
  const useUserScale = employee.payroll_config.use_user_pay_scale || row.payLevel.toLowerCase() === 'user-pay-level';

  // Find Pay Code definition
  const defs = rates.pay_codes.definitions;
  const payCodeDef = defs.find(d => d.label.trim().toLowerCase() === codeLabel.trim().toLowerCase());

  if (!payCodeDef) {
    if (isHourlyOnly) {
      row.alert = "Hourly Only (Unmapped Code)";
    } else {
      row.alert = `Unknown Code: ${codeLabel}`;
      row.alertLevel = "error";
    }
    return row;
  }

  // Determine Rate
  let finalRate: number | null = null;

  if (useUserScale) {
    // Check custom rates
    const custom = employee.payroll_config.custom_rates[payCodeDef.code];
    if (custom !== undefined) {
      finalRate = custom;
    } else {
      row.alert = "Missing Custom Rate";
      row.alertLevel = "warn";
    }
  } else if (!isHourlyOnly) {
    // Check Master Matrix
    const levelRates = rates.pay_levels[row.payLevel]?.rates;
    if (levelRates && levelRates[payCodeDef.code] !== undefined) {
      finalRate = levelRates[payCodeDef.code];
    } else {
      row.alert = `Rate not set for ${row.payLevel}`;
      row.alertLevel = "warn";
    }
  }

  // Hourly Only logic: Hours track, but Total is 0 unless manually overridden later
  if (isHourlyOnly) {
    row.rate = 0;
    row.total = 0;
    row.alert = ""; // Clear warnings for hourly only
    return row;
  }

  row.rate = finalRate;

  // Calculate Total
  if (finalRate !== null) {
    if (payCodeDef.type === 'flat') {
      row.total = finalRate; // Flat rate is per occurrence, assume CSV line is 1 occurrence usually, or if hours column used as qty
    } else {
      row.total = finalRate * hours;
    }
  }

  return row;
}

export function getRowColor(codeLabel: string, rates: MasterRates): string {
  const def = rates.pay_codes.definitions.find(d => d.label === codeLabel);
  return def ? def.color : '#e2e8f0'; // Default slate-200
}