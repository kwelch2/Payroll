import { Employee, LeaveTransaction } from '../types';

type NormalizedShiftSchedule = '10' | '12';

export function normalizeShiftSchedule(raw?: string): NormalizedShiftSchedule {
  const value = (raw || '').toString();
  if (value.includes('10')) return '10';
  if (value.includes('12') || value.includes('48')) return '12';
  return '12';
}

export function formatShiftLabel(raw?: string): string {
  return normalizeShiftSchedule(raw) === '12' ? '12-Hour Shift' : '10-Hour Shift';
}

function getShiftScheduleValue(employee: Employee): string | undefined {
  const classifications: any = employee.classifications;
  return classifications.shift_schedule ?? classifications.shift_Schedule;
}

/**
 * Calculates the monthly accrual amounts based on Years of Service and Shift Type.
 */
export function calculateMonthlyAccrual(employee: Employee) {
  const startDate = employee.classifications.ft_start_date;
  const shiftType = normalizeShiftSchedule(getShiftScheduleValue(employee));

  // Defaults for missing data
  if (!startDate || employee.classifications.employment_type !== 'Full Time') {
    return { 
      vacation: 0, 
      personal: 0, 
      totalMonthly: 0,
      tier: 'N/A', 
      yearsOfService: 0,
      yearlyAllowance: 0
    };
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
  const hoursPerDay = shiftType === '12' ? 12 : 10;

  // 3. Determine Vacation Days Per Year
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

export function processLeaveUsage(employee: Employee, hoursUsed: number, date: string, note: string): Employee {
  const bank = {
    vacation_balance: employee.leave_bank?.vacation_balance || 0,
    personal_balance: employee.leave_bank?.personal_balance || 0,
    history: employee.leave_bank?.history || []
  };
  
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
  const shiftType = normalizeShiftSchedule(getShiftScheduleValue(employee));
  
  if (!bank) return employee;

  bank.personal_balance = bank.personal_balance || 0;
  bank.vacation_balance = bank.vacation_balance || 0;

  const cap = shiftType === '12' ? 60 : 50;

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