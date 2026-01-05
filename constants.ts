import { MasterRates, AppConfig, Employee } from './types';

// Client IDs are public in the Implicit Grant flow.
export const GOOGLE_CLIENT_ID = '573380746156-eqd4q2ke91cqd2u1kbmbe3b17sb405n9.apps.googleusercontent.com';

// API Key for Google Drive Discovery (Restricted to origin)
export const GOOGLE_API_KEY = 'AIzaSyBD12ailGSsPVnYm1ppmfKB52CeqJiTKhw';

export const INITIAL_CONFIG: AppConfig = {
  ranks: ['Probationary', 'Firefighter', 'Engineer', 'Lieutenant', 'Captain', 'Battalion Chief', 'Chief'],
  ems_cert_levels: ['Driver', 'EMR', 'EMT', 'EMT (OM)', 'AEMT', 'Paramedic'],
  fire_statuses: ['Recruit', 'FTO', 'Active/Employee', 'Reserve'],
  carriers: ['Verizon', 'AT&T', 'T-Mobile', 'Other']
};

export const INITIAL_RATES: MasterRates = {
  meta: { version: "2026.2", last_updated: new Date().toISOString() },
  pay_codes: {
    definitions: [
      { code: "shift_pay", label: "Shift Pay", type: "hourly", description: "Standard Duty Crew", color: "#86efac" }, // Green-300
      { code: "on_call", label: "On Call", type: "hourly", description: "On Call Rate", color: "#f0abfc" }, // Fuchsia-300
      { code: "local_tx", label: "Local TX", type: "flat", description: "Flat transport", color: "#4ade80" }, 
      { code: "out_of_county_tx", label: "Out of County TX", type: "flat", description: "Flat transport (Out)", color: "#60a5fa" },
      { code: "ems_overtime", label: "EMS Overtime", type: "hourly", description: "OT Rate", color: "#93c5fd" }, // Blue-300
      { code: "fire_overtime", label: "Fire Overtime", type: "hourly", description: "Fire OT", color: "#fca5a5" }, // Red-300
      { code: "training", label: "Training", type: "hourly", description: "Training", color: "#fde047" }, // Yellow-300
      { code: "paid_time_off", label: "Paid Time Off", type: "bank_draw", description: "PTO", color: "#cbd5e1" } // Slate-300
    ]
  },
  pay_levels: {
    "Paramedic": { rank: 2, rates: { shift_pay: 25, on_call: 3, local_tx: 35 } },
    "EMT": { rank: 4, rates: { shift_pay: 12, on_call: 3, local_tx: 25 } },
    "Hourly Only": { rank: 0, rates: {} }
  },
  pto_rules: {
    "Fire": { carryover_cap: 50, yearly_allowance: 144, accrual_type: "monthly" },
    "EMS": { carryover_cap: 60, yearly_allowance: 120, accrual_type: "monthly" }
  }
};

// Simplified seed data from user input
export const INITIAL_EMPLOYEES: Employee[] = [
  {
    id: "201",
    employee_id: "201",
    personal: { full_name: "Beck, Joe", first_name: "Joe", last_name: "Beck" },
    address: { line1: "", line2: "", city: "", state: "", zip: "" },
    classifications: { pay_level: "Paramedic", officer_rank: "", ems_cert: "Paramedic", fire_status: "", start_date_ems: "", start_date_fire: "" },
    contact: { phone: "", email: "", carrier: "" },
    payroll_config: { use_user_pay_scale: false, custom_rates: {} },
    status: "Active",
    leave_bank: { group: "EMS", current_balance: 12 }
  },
  {
    id: "101",
    employee_id: "101",
    personal: { full_name: "Bertacco, Ryan", first_name: "Ryan", last_name: "Bertacco" },
    address: { line1: "", line2: "", city: "", state: "", zip: "" },
    classifications: { pay_level: "Hourly Only", officer_rank: "Firefighter", ems_cert: "", fire_status: "Firefighter", start_date_ems: "", start_date_fire: "" },
    contact: { phone: "", email: "", carrier: "" },
    payroll_config: { use_user_pay_scale: false, custom_rates: {} },
    status: "Active",
    leave_bank: { group: "Fire", current_balance: 48 }
  }
];