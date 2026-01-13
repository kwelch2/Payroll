import { Employee, LeaveTransaction, LeavePolicyConfig, DEFAULT_POLICY } from '../types';

type NormalizedShiftSchedule = '10' | '12';

export function normalizeShiftSchedule(raw?: string): NormalizedShiftSchedule {
  const value = (raw || '').toString();
  if (value.includes('10')) return '10';
  if (value.includes('12') || value.includes('48')) return '12';
  return '12'; 
}

export function formatShiftLabel(raw?: string): string {
  const normalized = normalizeShiftSchedule(raw);
  return normalized === '12' ? '12-Hour Shift' : '10-Hour Shift';
}

function getShiftScheduleValue(employee: Employee): string | undefined {
  const classifications: any = employee.classifications;
  return classifications.shift_schedule ?? classifications.shift_Schedule;
}

export function getShiftHours(employee: Employee): 10 | 12 {
  const shift = normalizeShiftSchedule(getShiftScheduleValue(employee));
  return shift === '10' ? 10 : 12;
}

/**
 * Calculates monthly accrual. 
 * Updated to accept 'referenceDate' for projecting future/past rates.
 */
export function calculateMonthlyAccrual(
  employee: Employee, 
  policy: LeavePolicyConfig = DEFAULT_POLICY,
  referenceDate?: Date // <--- ADDED THIS PARAMETER
) {
  const startDate = employee.classifications.ft_start_date;
  
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

  // 1. Calculate Years of Service based on referenceDate (or now)
  const start = new Date(startDate);
  if (isNaN(start.getTime())) {
     return { vacation: 0, personal: 0, totalMonthly: 0, tier: 'Invalid Date', yearsOfService: 0, yearlyAllowance: 0 };
  }

  const now = referenceDate || new Date(); // Use provided date or today
  let years = now.getFullYear() - start.getFullYear();
  const m = now.getMonth() - start.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < start.getDate())) {
    years--;
  }
  years = Math.max(0, years);

  // 2. Determine Day Value (Hours)
  const hoursPerDay = getShiftHours(employee);

  // 3. Find Correct Policy Tier
  const activeTier = [...policy.tiers].sort((a, b) => b.years - a.years).find(t => years >= t.years);

  if (!activeTier) {
      return { vacation: 0, personal: 0, totalMonthly: 0, tier: 'Unknown Tier', yearsOfService: years, yearlyAllowance: 0 };
  }

  const vacationDays = activeTier.vacation_days;
  const personalDays = activeTier.personal_days;
  const tierName = `${activeTier.years}+ Years`;

  // 4. Calculate Monthly Hours
  const vacationHours = (vacationDays * hoursPerDay) / 12;
  const personalHours = (personalDays * hoursPerDay) / 12;

  return {
    vacation: parseFloat(vacationHours.toFixed(4)),
    personal: parseFloat(personalHours.toFixed(4)),
    totalMonthly: parseFloat((vacationHours + personalHours).toFixed(4)),
    tier: tierName,
    yearsOfService: years,
    yearlyAllowance: (vacationDays + personalDays) * hoursPerDay
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

export function checkAnniversaryCap(employee: Employee, policy: LeavePolicyConfig = DEFAULT_POLICY): Employee {
  const bank = employee.leave_bank;
  const shiftType = normalizeShiftSchedule(getShiftScheduleValue(employee));
  
  if (!bank) return employee;

  bank.personal_balance = bank.personal_balance || 0;
  bank.vacation_balance = bank.vacation_balance || 0;

  const cap = shiftType === '12' ? policy.caps.shift_12 : policy.caps.shift_10;
  const currentTotal = bank.vacation_balance + bank.personal_balance;

  if (currentTotal > cap) {
    const forfeitAmount = currentTotal - cap;
    
    let remainingForfeit = forfeitAmount;
    let forfeitPersonal = 0;
    let forfeitVacation = 0;

    if (bank.personal_balance >= remainingForfeit) {
        forfeitPersonal = remainingForfeit;
        bank.personal_balance -= remainingForfeit;
    } else {
        forfeitPersonal = bank.personal_balance;
        remainingForfeit -= bank.personal_balance;
        bank.personal_balance = 0;

        forfeitVacation = remainingForfeit;
        bank.vacation_balance -= remainingForfeit;
    }

    const transaction: LeaveTransaction = {
      id: `TX-CAP-${Date.now()}`,
      date: new Date().toISOString().split('T')[0],
      type: 'adjustment',
      amount_vacation: -forfeitVacation,
      amount_personal: -forfeitPersonal,
      description: `Annual Cap Adjustment (Max ${cap} hrs)`,
      balance_after: bank.vacation_balance + bank.personal_balance
    };

    bank.history = [transaction, ...bank.history];
  }

  return { ...employee, leave_bank: bank };
}