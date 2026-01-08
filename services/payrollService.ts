import { PayrollRow, Employee, MasterRates } from '../types';

export function calculatePayRow(
  empName: string, 
  code: string, 
  hoursOrQty: number, 
  employees: Employee[], 
  rates: MasterRates
): PayrollRow {
  
  // 1. Find the Employee
  // We match by "Last, First" or "First Last" to be safe, or ID if possible
  const employee = employees.find(e => {
    const nameMatches = e.personal.full_name === empName || 
                        `${e.personal.last_name}, ${e.personal.first_name}` === empName ||
                        `${e.personal.first_name} ${e.personal.last_name}` === empName;
    return nameMatches;
  });

  // Default Object if employee not found
  if (!employee) {
    return createEmptyRow(empName, code, hoursOrQty, "Employee not found");
  }

  // 2. Determine Rate Strategy
  let rate = 0;
  let usedCustomRate = false;

  // STRATEGY A: User Profile Pay Scale (Override)
  if (employee.payroll_config?.use_user_pay_scale) {
    const customRate = employee.payroll_config.custom_rates?.[code];
    
    // If a custom rate exists (even if 0), use it. 
    // If it's undefined, it means it wasn't set in their profile.
    if (customRate !== undefined && customRate !== null) {
      rate = customRate;
      usedCustomRate = true;
    } else {
      // Fallback: If they are on "User-Pay-Level" but haven't defined a rate for this code,
      // we default to 0 to prevent accidental matrix inheritance.
      rate = 0;
    }
  } 
  
  // STRATEGY B: Master Matrix Lookup
  // Only run if we didn't use a custom rate
  if (!usedCustomRate) {
    const level = employee.classifications.pay_level || 'Hourly Only';
    const levelRates = rates.pay_levels[level]?.rates;
    
    if (levelRates && levelRates[code] !== undefined) {
      rate = levelRates[code];
    }
  }

  // 3. Calculate Total
  // Note: For 'Flat' items, hoursOrQty acts as the Quantity.
  // For 'Hourly' items, it acts as Hours.
  // The math is the same: Rate * Qty.
  const total = rate * hoursOrQty;

  // 4. Generate Alert Flags
  let alert = "";
  let alertLevel: 'info' | 'warning' | 'error' | undefined = undefined;

  // Check 1: Missing Rate
  if (rate === 0 && total === 0) {
    // It's okay for unpaid codes, but flag it just in case
    alert = "Zero Rate";
    alertLevel = 'warning';
  }

  // Check 2: Pay Code Existence
  const def = rates.pay_codes.definitions.find(d => d.label === code || d.code === code);
  if (!def) {
    alert = "Unknown Pay Code";
    alertLevel = 'error';
  }

  return {
    id: `row-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    name: employee.personal.full_name, // Standardize name
    payLevel: employee.classifications.pay_level,
    code: code,
    hours: hoursOrQty,
    rate: rate,
    total: total,
    alert: alert,
    alertLevel: alertLevel
  };
}

export function getRowColor(code: string, rates: MasterRates): string {
  const def = rates.pay_codes.definitions.find(d => d.label === code || d.code === code);
  return def?.color || '#e2e8f0'; // Default gray if not found
}

function createEmptyRow(name: string, code: string, hours: number, error: string): PayrollRow {
  return {
    id: `row-${Date.now()}`,
    name,
    payLevel: 'Unknown',
    code,
    hours,
    rate: 0,
    total: 0,
    alert: error,
    alertLevel: 'error'
  };
}