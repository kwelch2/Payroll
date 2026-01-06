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
  };
  status: string;
}

export interface PayCodeDefinition {
  code: string;
  label: string;
  type: 'hourly' | 'flat';
  description?: string;
  color?: string;
}

export interface MasterRates {
  meta: {
    version: string;
    effective_date: string;
  };
  pay_codes: {
    definitions: PayCodeDefinition[];
  };
  pay_scale: Record<string, {
    rank: number;
    rates: Record<string, number>;
  }>;
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
  alertLevel?: 'warning' | 'error';
  
  // NEW FIELDS FOR DATES
  startDate?: string;
  startTime?: string;
  endDate?: string;
  endTime?: string;
}