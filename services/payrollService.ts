import { PayrollRow, Employee, MasterRates } from '../types';

export function calculatePayRow(
  empName: string, 
  rawCode: string, // This might be "Shift Pay" (Label) or "shift_pay" (Code)
  hoursOrQty: number, 
  employees: Employee[], 
  rates: MasterRates
): PayrollRow {
  
  // 1. Find the Employee
  // Robust matching for "Last, First", "First Last", or exact matches
  const employee = employees.find(e => {
    if (!e.personal) return false;
    const full = e.personal.full_name?.toLowerCase() || "";
    const firstLast = `${e.personal.first_name} ${e.personal.last_name}`.toLowerCase();
    const lastFirst = `${e.personal.last_name}, ${e.personal.first_name}`.toLowerCase();
    const search = empName.toLowerCase().trim();
    
    return full === search || firstLast === search || lastFirst === search;
  });

  if (!employee) {
    return createEmptyRow(empName, rawCode, hoursOrQty, "Employee not found");
  }

  // 2. Resolve Pay Code (The Fix)
  // We must convert the CSV label (e.g. "Shift Pay") to the System ID (e.g. "shift_pay")
  // to look up rates correctly in the database.
  const def = rates.pay_codes.definitions.find(
    d => d.label.toLowerCase() === rawCode.toLowerCase() || 
         d.code.toLowerCase() === rawCode.toLowerCase()
  );

  if (!def) {
    return createEmptyRow(empName, rawCode, hoursOrQty, "Unknown Pay Code", 'error');
  }

  const systemCode = def.code; // Use this for lookups (e.g. "shift_pay")

  // 3. Determine Rate Strategy
  let rate = 0;
  let usedCustomRate = false;

  // STRATEGY A: User Profile Pay Scale (Override)
  if (employee.payroll_config?.use_user_pay_scale) {
    const customRate = employee.payroll_config.custom_rates?.[systemCode];
    
    // If a custom rate is explicitly defined (even 0), use it.
    if (customRate !== undefined && customRate !== null) {
      rate = customRate;
      usedCustomRate = true;
    } else {
      // If the User Profile is active but has NO rate for this code, 
      // we default to 0 to prevent accidentally inheriting a rate from the standard matrix.
      rate = 0;
      usedCustomRate = true; 
    }
  } 
  
  // STRATEGY B: Master Matrix Lookup
  // Only run if we didn't use a custom rate
  if (!usedCustomRate) {
    // If pay_level is missing, default to 'Hourly Only' to avoid crashing
    const level = employee.classifications.pay_level || 'Hourly Only';
    const levelData = rates.pay_levels[level];
    
    if (levelData && levelData.rates && levelData.rates[systemCode] !== undefined) {
      rate = levelData.rates[systemCode];
    }
  }

  // 4. Calculate Total
  const total = rate * hoursOrQty;

  // 5. Generate Alert Flags
  let alert = "";
  let alertLevel: 'info' | 'warning' | 'error' | undefined = undefined;

  // Warn if rate is 0 (unless it's a known unpaid code if you have those)
  if (rate === 0 && total === 0) {
    alert = "Zero Rate";
    alertLevel = 'warning';
  }

  return {
    id: `row-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    name: employee.personal.full_name,
    payLevel: employee.classifications.pay_level,
    code: def.label, // Show the readable Label (e.g. "Shift Pay") in the table
    hours: hoursOrQty,
    rate: rate,
    total: total,
    alert: alert,
    alertLevel: alertLevel
  };
}

export function getRowColor(rawCode: string, rates: MasterRates): string {
  const def = rates.pay_codes.definitions.find(
    d => d.label.toLowerCase() === rawCode.toLowerCase() || 
         d.code.toLowerCase() === rawCode.toLowerCase()
  );
  return def?.color || '#e2e8f0';
}

function createEmptyRow(name: string, code: string, hours: number, error: string, level: 'info' | 'warning' | 'error' = 'warning'): PayrollRow {
  return {
    id: `row-${Date.now()}-${Math.random()}`,
    name,
    payLevel: 'Unknown',
    code,
    hours,
    rate: 0,
    total: 0,
    alert: error,
    alertLevel: level
  };
}