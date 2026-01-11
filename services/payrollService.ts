import { PayrollRow, Employee, MasterRates } from '../types';

export function calculatePayRow(
  empName: string, 
  rawCode: string, 
  hoursOrQty: number, 
  employees: Employee[], 
  rates: MasterRates
): PayrollRow {
  
  // 1. Find the Employee
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

  // 2. Resolve Pay Code
  const def = rates.pay_codes.definitions.find(
    d => d.label.toLowerCase() === rawCode.toLowerCase() || 
         d.code.toLowerCase() === rawCode.toLowerCase()
  );

  if (!def) {
    return createEmptyRow(empName, rawCode, hoursOrQty, "Unknown Pay Code", 'error');
  }

  const systemCode = def.code; 

  // 3. Determine Rate Strategy
  let rate = 0;
  let usedCustomRate = false;

  if (employee.payroll_config?.use_user_pay_scale) {
    const customRate = employee.payroll_config.custom_rates?.[systemCode];
    if (customRate !== undefined && customRate !== null) {
      rate = customRate;
      usedCustomRate = true;
    } else {
      rate = 0;
      usedCustomRate = true; 
    }
  } 
  
  if (!usedCustomRate) {
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

  // CHANGED: Only flag zero rate if NOT Full Time
  const isFullTime = employee.classifications.employment_type === 'Full Time';
  
  if (rate === 0 && total === 0 && !isFullTime) {
    alert = "Zero Rate";
    alertLevel = 'warning';
  }

  return {
    id: `row-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    name: employee.personal.full_name,
    payLevel: employee.classifications.pay_level,
    employmentType: employee.classifications.employment_type || 'PRN', // Default to PRN if missing
    code: def.label, 
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
    employmentType: 'Unknown',
    code,
    hours,
    rate: 0,
    total: 0,
    alert: error,
    alertLevel: level
  };
}