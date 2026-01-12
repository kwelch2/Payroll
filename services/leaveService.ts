// services/leaveService.ts
import { Employee, LeaveTransaction } from '../types';

/**
 * Calculates the monthly accrual amounts based on Years of Service and Shift Type.
 */
export function calculateMonthlyAccrual(employee: Employee): { vacation: number, personal: number, tier: string } {
  const startDate = employee.classifications.ft_start_date;
  const shiftType = employee.classifications.shift_schedule;

  // Safety Checks
  if (!startDate || !shiftType || employee.classifications.employment_type !== 'Full Time') {
    return { vacation: 0, personal: 0, tier: 'N/A' };
  }

  // 1. Calculate Years of Service
  const start = new Date(startDate);
  const now = new Date();
  let years = now.getFullYear() - start.getFullYear();
  const m = now.getMonth() - start.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < start.getDate())) {
    years--;
  }

  // 2. Determine Day Value (Hours)
  const hoursPerDay = shiftType === '12-Hour' ? 12 : 10;

  // 3. Determine Vacation Days Per Year (The Policy)
  let vacationDays = 0;
  let tierName = "";

  if (years < 1) { vacationDays = 10; tierName = "Year 0-1 (10 Days)"; }
  else if (years < 5) { vacationDays = 10; tierName = "Year 1-5 (10 Days)"; } // Assumed gap fill
  else if (years < 10) { vacationDays = 15; tierName = "Year 5-10 (15 Days)"; }
  else if (years < 15) { vacationDays = 20; tierName = "Year 10-15 (20 Days)"; }
  else if (years < 20) { vacationDays = 25; tierName = "Year 15-20 (25 Days)"; }
  else { vacationDays = 30; tierName = "Year 20+ (30 Days)"; }

  // 4. Calculate Monthly Hours
  // Formula: (Days * HoursPerDay) / 12 Months
  const vacationHours = (vacationDays * hoursPerDay) / 12;
  
  // Personal Leave is fixed at 5 Days/Year
  const personalHours = (5 * hoursPerDay) / 12;

  return {
    vacation: parseFloat(vacationHours.toFixed(4)),
    personal: parseFloat(personalHours.toFixed(4)),
    tier: tierName
  };
}

/**
 * Processes a "Paid Time Off" usage entry.
 * Automatically deducts from Personal Leave first, then Vacation.
 */
export function processLeaveUsage(employee: Employee, hoursUsed: number, date: string, note: string): Employee {
  // Initialize bank if missing
  const bank = employee.leave_bank || { vacation_balance: 0, personal_balance: 0, history: [] };
  
  let remaining = hoursUsed;
  let usedPersonal = 0;
  let usedVacation = 0;

  // 1. Burn Personal Leave First
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

  // 2. Burn Vacation Leave Second
  if (remaining > 0) {
    usedVacation = remaining;
    bank.vacation_balance -= remaining; // Allow to go negative if that's policy, or add check here
  }

  // 3. Log Transaction
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

/**
 * Checks for Anniversary Cap on Personal Leave.
 * Should be run once a year on the anniversary month.
 */
export function checkAnniversaryCap(employee: Employee): Employee {
  const bank = employee.leave_bank;
  const shiftType = employee.classifications.shift_schedule;
  
  if (!bank || !shiftType) return employee;

  const cap = shiftType === '12-Hour' ? 60 : 50;
  
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