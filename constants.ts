import { MasterRates, Employee, AppConfig } from './types';

export const INITIAL_RATES: MasterRates = {
  meta: { version: "2025.1" },
  pay_codes: {
    definitions: [
      { code: "reg", label: "Shift Pay", type: "flat", color: "#3b82f6" },
      { code: "ot", label: "Overtime", type: "hourly", color: "#ef4444" },
      { code: "vac", label: "Vacation", type: "hourly", color: "#10b981" },
      { code: "sick", label: "Sick Leave", type: "hourly", color: "#f59e0b" },
      { code: "hol", label: "Holiday", type: "hourly", color: "#8b5cf6" },
      { code: "train", label: "Training", type: "hourly", color: "#6366f1" },
      { code: "event", label: "Special Event", type: "hourly", color: "#ec4899" }
    ]
  },
  pay_levels: {
    "FF-1": { rank: 1, rates: { "reg": 200, "ot": 25, "vac": 20 } },
    "FF-2": { rank: 2, rates: { "reg": 220, "ot": 28, "vac": 22 } },
    "LT": { rank: 3, rates: { "reg": 250, "ot": 35, "vac": 28 } },
    "CPT": { rank: 4, rates: { "reg": 300, "ot": 40, "vac": 32 } }
  }
};

export const INITIAL_EMPLOYEES: Employee[] = [
  {
    id: "EMP-001",
    personal: { first_name: "John", last_name: "Doe", full_name: "John Doe" },
    classifications: { pay_level: "FF-1", rank: "Firefighter" }, // Fixed property name
    status: "active",
    payroll_config: { use_user_pay_scale: false, custom_rates: {} }
  },
  {
    id: "EMP-002",
    personal: { first_name: "Jane", last_name: "Smith", full_name: "Jane Smith" },
    classifications: { pay_level: "LT", rank: "Lieutenant" }, // Fixed property name
    status: "active",
    payroll_config: { use_user_pay_scale: false, custom_rates: {} }
  }
];

export const INITIAL_CONFIG: AppConfig = {
  ranks: ["Firefighter", "Lieutenant", "Captain", "Chief"],
  ems_cert_levels: ["EMR", "EMT", "AEMT", "Paramedic"],
  fire_statuses: ["Probationary", "Active", "Reserve"],
  carriers: ["Verizon", "AT&T", "T-Mobile"]
};