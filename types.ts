// types.ts

export interface Employee {
  id: string;
  personal: {
    full_name: string;
    first_name: string;
    last_name: string;
  };
  classifications: {
    pay_level: string;
    rank: string;
    // Add these if missing based on your data
    ems_cert?: string;
    fire_status?: string;
    start_date_ems?: string;
    start_date_fire?: string;
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
    group: string;
    current_balance: number;
  };
  // Allow for loose typing if data structure varies
  address?: any; 
}

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
  }>;
  pto_rules?: Record<string, PTORule>;
}

export interface PayrollRow {
  id: string;
  name: string;
  payLevel: string;
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

// --- THIS WAS MISSING ---
export interface AppConfig {
  ranks: string[];
  ems_cert_levels: string[];
  fire_statuses: string[];
  carriers: string[];
}