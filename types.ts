// types.ts

export interface PayCodeDefinition {
  code: string;
  label: string;
  type: 'hourly' | 'flat' | 'bank_draw';
  description?: string;
  color?: string;
}

export interface PTORule {
  carryover_cap: number;
  yearly_allowance: number;
  accrual_type: 'monthly' | 'yearly';
}

export interface MasterRates {
  meta: {
    version: string;
    effective_date?: string;
    last_updated?: string;
  };
  pay_codes: {
    definitions: PayCodeDefinition[];
  };
  pay_levels: Record<string, {
    rank: number;
    rates: Record<string, number>;
    pto_group?: string; 
  }>;
  pto_rules?: Record<string, PTORule>;
}

export interface LeaveTransaction {
  id: string;
  date: string;
  type: 'accrual' | 'usage' | 'adjustment' | 'reset';
  amount_vacation: number;
  amount_personal: number;
  description: string;
  balance_after: number;
}

export interface Employee {
  id: string;
  employee_id?: string;
  personal: {
    full_name: string;
    first_name: string;
    last_name: string;
  };
  address?: {
    line1: string;
    line2: string;
    city: string;
    state: string;
    zip: string;
  };
  classifications: {
    pay_level: string;
    rank: string;
    employment_type?: 'Full Time' | 'PRN';
    officer_rank?: string;
    fire_status?: string;
    ems_cert?: string;
    start_date_ems?: string;
    start_date_fire?: string;
    
    // --- UPDATED: Now expects simple '10' or '12' ---
    ft_start_date?: string;
    shift_schedule?: '10' | '12' | string; // 'string' allows legacy values temporarily
    pto_status?: 'Active' | 'Frozen';
  };
  contact?: {
    phone: string;
    email: string;
    carrier: string;
  };
  payroll_config: {
    use_user_pay_scale: boolean;
    custom_rates: Record<string, number>;
  };
  status: string;
  
  leave_bank?: {
    vacation_balance: number;
    personal_balance: number;
    last_accrual_date?: string;
    history: LeaveTransaction[];
  };
}

export interface AppConfig {
  ranks: string[];
  ems_cert_levels: string[];
  fire_statuses: string[];
  carriers: string[];
}

export interface PayrollRow {
  id: string;
  name: string;
  payLevel: string;
  employmentType?: string;
  code: string;
  hours: number;
  rate: number | null;
  total: number | null;
  manual_rate_override?: number | null;
  manual_note?: string;
  alert?: string;
  alertLevel?: 'info' | 'warning' | 'error';
  startDate?: string;
  startTime?: string;
  endDate?: string;
  endTime?: string;
}