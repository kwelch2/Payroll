import { Employee, LeaveTransaction } from '../types';

/**
 * Calculates the monthly accrual amounts based on Years of Service and Shift Type.
 */
export function calculateMonthlyAccrual(employee: Employee): { vacation: number, personal: number, totalMonthly: number, tier: string, yearsOfService: number, yearlyAllowance: number } {
  const startDate = employee.classifications.ft_start_date;
  const shiftType = employee.classifications.shift_schedule || "";

  // Safety Checks
  if (!startDate || employee.classifications.employment_type !== 'Full Time') {
    return { vacation: 0, personal: 0, totalMonthly: 0, tier: 'N/A', yearsOfService: 0, yearlyAllowance: 0 };
  }

  // 1. Calculate Years of Service
  const start = new Date(startDate);
  if (isNaN(start.getTime())) {
     return { vacation: 0, personal: 0, totalMonthly: 0, tier: 'Invalid Date', yearsOfService: 0, yearlyAllowance: 0 };
  }

  const now = new Date();
  let years = now.getFullYear() - start.getFullYear();
  const m = now.getMonth() - start.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < start.getDate())) {
    years--;
  }
  years = Math.max(0, years);

  // 2. Determine Day Value (Hours)
  // FIX: Loose check for "12" or "48" covers "12-Hour", "12-Hour Shift", "48/96"
  const is12Hour = shiftType.includes('12') || shiftType.includes('48');
  const hoursPerDay = is12Hour ? 12 : 10;

  // 3. Determine Vacation Days Per Year (The Policy)
  let vacationDays = 0;
  let tierName = "";

  if (years < 1) { vacationDays = 10; tierName = "Year 0-1 (10 Days)"; }
  else if (years < 5) { vacationDays = 10; tierName = "Year 1-5 (10 Days)"; }
  else if (years < 10) { vacationDays = 15; tierName = "Year 5-10 (15 Days)"; }
  else if (years < 15) { vacationDays = 20; tierName = "Year 10-15 (20 Days)"; }
  else if (years < 20) { vacationDays = 25; tierName = "Year 15-20 (25 Days)"; }
  else { vacationDays = 30; tierName = "Year 20+ (30 Days)"; }

  // 4. Calculate Monthly Hours
  const vacationHours = (vacationDays * hoursPerDay) / 12;
  const personalHours = (5 * hoursPerDay) / 12;

  return {
    vacation: parseFloat(vacationHours.toFixed(4)),
    personal: parseFloat(personalHours.toFixed(4)),
    totalMonthly: parseFloat((vacationHours + personalHours).toFixed(4)),
    tier: tierName,
    yearsOfService: years,
    yearlyAllowance: (vacationDays + 5) * hoursPerDay
  };
}

/**
 * Processes a "Paid Time Off" usage entry.
 */
export function processLeaveUsage(employee: Employee, hoursUsed: number, date: string, note: string): Employee {
  const bank = employee.leave_bank || { vacation_balance: 0, personal_balance: 0, history: [] };
  
  let remaining = hoursUsed;
  let usedPersonal = 0;
  let usedVacation = 0;

  if (bank.personal_balance > 0) {
    if (bank.personal_balance >= remaining) {
      usedPersonal = remaining;
      bank.personal_balance -= remaining;
      remaining = 0;
    } else {
      usedPersonal = bank.personal_balance;
      remaining -= bank.personal_balance;
      bank.personal_balance = 0;
    }
  }

  if (remaining > 0) {
    usedVacation = remaining;
    bank.vacation_balance -= remaining; 
  }

  const transaction: LeaveTransaction = {
    id: `TX-${Date.now()}`,
    date,
    type: 'usage',
    amount_vacation: -usedVacation,
    amount_personal: -usedPersonal,
    description: `Payroll Usage: ${note}`,
    balance_after: bank.vacation_balance + bank.personal_balance
  };

  return {
    ...employee,
    leave_bank: {
      ...bank,
      history: [transaction, ...bank.history]
    }
  };
}

export function checkAnniversaryCap(employee: Employee): Employee {
  const bank = employee.leave_bank;
  const shiftType = employee.classifications.shift_schedule || "";
  
  if (!bank) return employee;

  // Ensure banks are initialized
  bank.personal_balance = bank.personal_balance || 0;
  bank.vacation_balance = bank.vacation_balance || 0;

  // Use the same robust check for Cap
  const cap = (shiftType.includes('12') || shiftType.includes('48')) ? 60 : 50;
  
  if (bank.personal_balance > cap) {
    const forfeitAmount = bank.personal_balance - cap;
    bank.personal_balance = cap;

    const transaction: LeaveTransaction = {
      id: `TX-CAP-${Date.now()}`,
      date: new Date().toISOString().split('T')[0],
      type: 'adjustment',
      amount_vacation: 0,
      amount_personal: -forfeitAmount,
      description: `Annual Cap Adjustment (Max ${cap} hrs)`,
      balance_after: bank.vacation_balance + bank.personal_balance
    };

    bank.history = [transaction, ...bank.history];
  }

  return { ...employee, leave_bank: bank };
}