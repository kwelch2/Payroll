export interface PayCode {
  code: string;
  label: string;
  type: 'hourly' | 'flat' | 'bank_draw' | 'other';
  color: string;
  description?: string;
}

export interface PayLevelRates {
  [code: string]: number | null;
}

export interface PayLevel {
  rank: number;
  pto_group?: string;
  rates: PayLevelRates;
}

export interface PTORule {
  carryover_cap: number;
  yearly_allowance: number;
  accrual_type: 'monthly' | 'yearly';
}

export interface MasterRates {
  meta: { version: string; last_updated: string };
  pay_codes: { definitions: PayCode[] };
  pay_levels: { [levelName: string]: PayLevel };
  pto_rules?: { [groupName: string]: PTORule };
}

export interface Employee {
  id: string;
  employee_id: string;
  personal: { first_name: string; last_name: string; full_name: string };
  address: { line1: string; line2: string; city: string; state: string; zip: string };
  classifications: {
    pay_level: string;
    officer_rank: string;
    ems_cert: string;
    fire_status: string;
    start_date_ems: string;
    start_date_fire: string;
  };
  contact: { phone: string; email: string; carrier: string };
  payroll_config: { use_user_pay_scale: boolean; custom_rates: { [code: string]: number } };
  status: string;
  leave_bank?: {
    group: string;
    current_balance: number;
  };
}

export interface PayrollRow {
  id: string; // Internal unique ID for React keys
  name: string;
  code: string; // The Label, effectively
  hours: number;
  rate: number | null;
  total: number | null;
  payLevel: string;
  startDate?: string;
  startTime?: string;
  endDate?: string;
  endTime?: string;
  manual_rate_override?: number | null;
  manual_note?: string | null;
  alert?: string;
  alertLevel?: 'warn' | 'error' | 'info';
  csvName?: string;
}

export interface AppConfig {
  ranks: string[];
  ems_cert_levels: string[];
  fire_statuses: string[];
  carriers: string[];
}