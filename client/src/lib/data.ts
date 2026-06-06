// Mock Data and Type Definitions

export type Role = 'Admin' | 'Employee' | 'HR';
export type LeaveType = 'Casual' | 'Sick' | 'LWP' | 'Earned' | 'OD' | 'Comp Off';

export interface User {
  id: string;
  code: string;
  name: string;
  role: Role;
  designation: string;
  email?: string;
  reportingManager?: string;
  hrName?: string;
}

export interface LeaveRequest {
  id: string;
  employeeId: string;
  employeeName: string;
  employeeCode: string;
  type: LeaveType;
  startDate: string;
  endDate: string;
  duration: string; // "Full Day" | "Half Day" | "Hourly"
  description: string;
  status: 'Pending' | 'Approved' | 'Rejected' | 'Cancelled';
  attachment?: string;
  reasonForAction?: string;
  actionBy?: string; // Admin Name/Code
  actionDate?: string;
  appliedDate: string;
  odFromTime?: string; // For Hourly OD - format HH:mm
  odToTime?: string;   // For Hourly OD - format HH:mm
}

// Initial Users from the prompt
export const INITIAL_USERS: User[] = [
  // Admins
  { id: '1', code: 'A0001', name: 'SAM PARKESH', role: 'Admin', designation: 'Director' },
  { id: '2', code: 'A0002', name: 'LEO CLESTINE', role: 'Admin', designation: 'Manager' },
  { id: '3', code: 'A0003', name: 'SUJI', role: 'Admin', designation: 'Manager' },
  // Employees
  { id: '4', code: 'E0041', name: 'MOHAN RAJ C', role: 'Employee', designation: 'Finance Executive' },
  { id: '5', code: 'E0042', name: 'YUVARAJ S', role: 'Employee', designation: 'Purchase Executive' },
  { id: '6', code: 'E0043', name: 'ATMAKUR RAJESH', role: 'Employee', designation: 'HR & Admin' },
  { id: '7', code: 'E0032', name: 'SIVARAM C', role: 'Employee', designation: 'Multi Technician' },
  { id: '8', code: 'E0040', name: 'UMAR FAROOQUE', role: 'Employee', designation: 'Site Engineer' },
  { id: '9', code: 'E0028', name: 'KAALIPUSHPA R', role: 'Employee', designation: 'Quantity Analyst' },
  { id: '10', code: 'E0035', name: 'DENNIS RAJU', role: 'Employee', designation: 'Finance Analyst' },
  { id: '11', code: 'E0009', name: 'RANJITH', role: 'Employee', designation: 'Director/Ops Manager' },
  { id: '12', code: 'E0044', name: 'PRIYA P', role: 'Employee', designation: 'Finance Assistant' },
  { id: '13', code: 'E0045', name: 'RATCHITHA', role: 'Employee', designation: 'Business Development Executive' },
  { id: '14', code: 'E0047', name: 'Samyuktha S', role: 'HR', designation: 'HR - Intern' },
  { id: '15', code: 'E0046', name: 'Rebecasuji.A', role: 'Employee', designation: 'Software Developer Intern' },
  { id: '16', code: 'E0048', name: 'DurgaDevi E', role: 'Employee', designation: 'Software Developer Intern' },
  { id: '17', code: 'E0050', name: 'ZAMEELA BEGAM N.', role: 'Employee', designation: 'Finance Intern' },
  { id: '18', code: 'E0051', name: 'ARUN KUMAR V.', role: 'Employee', designation: 'Finance Intern' },
  { id: '19', code: 'E0052', name: 'D K JYOTHSNA PRIYA', role: 'Employee', designation: 'Software Developer Intern' },
  { id: '20', code: 'E0049', name: 'P PUSHPA', role: 'HR', designation: 'HR & Admin' },
  { id: '21', code: '-', name: 'FAREETHA', role: 'Employee', designation: 'House Keeping' },
  { id: '22', code: 'E0053', name: 'S.NAVEEN KUMAR', role: 'Employee', designation: 'Technical Support' },
];

// Public holidays for 2025
export const HOLIDAYS_2025 = [
  { date: '2025-01-26', name: 'Republic Day' },
  { date: '2025-03-08', name: 'Maha Shivaratri' },
  { date: '2025-03-29', name: 'Holi' },
  { date: '2025-04-14', name: 'Ambedkar Jayanti' },
  { date: '2025-04-18', name: 'Good Friday' },
  { date: '2025-05-23', name: 'Buddha Purnima' },
  { date: '2025-08-15', name: 'Independence Day' },
  { date: '2025-08-27', name: 'Janmashtami' },
  { date: '2025-09-16', name: 'Milad un-Nabi' },
  { date: '2025-10-02', name: 'Gandhi Jayanti' },
  { date: '2025-10-20', name: 'Dussehra' },
  { date: '2025-10-30', name: 'Diwali' },
  { date: '2025-11-01', name: 'Diwali (Day 2)' },
  { date: '2025-11-15', name: 'Guru Nanak Jayanti' },
  { date: '2025-12-25', name: 'Christmas' },
];

// Public holidays for 2026
export const HOLIDAYS_2026 = [
  { date: '2026-01-01', name: 'New Year' },
  { date: '2026-01-15', name: 'Pongal' },
  { date: '2026-01-16', name: 'Thiruvalluvar Day' },
  { date: '2026-01-26', name: 'Republic Day' },
  { date: '2026-05-01', name: 'May Day' },
  { date: '2026-08-15', name: 'Independence Day' },
  { date: '2026-09-14', name: 'Ganesh Chaturthi' },
  { date: '2026-10-02', name: 'Gandhi Jayanti' },
  { date: '2026-10-19', name: 'Ayudha Pooja' },
  { date: '2026-11-08', name: 'Diwali' },
  { date: '2026-12-25', name: 'Christmas' },
];

export const ALL_HOLIDAYS = [...HOLIDAYS_2025, ...HOLIDAYS_2026];

export const INITIAL_LEAVES: LeaveRequest[] = [
  {
    id: '101',
    employeeId: '4',
    employeeName: 'MOHAN RAJ C',
    employeeCode: 'E0041',
    type: 'Sick',
    startDate: '2025-10-10',
    endDate: '2025-10-12',
    duration: 'Full Day',
    description: 'Viral fever',
    status: 'Approved',
    actionBy: 'A0001 (SAM PARKESH)',
    actionDate: '2025-10-09',
    appliedDate: '2025-10-09'
  },
  {
    id: '102',
    employeeId: '5',
    employeeName: 'YUVARAJ S',
    employeeCode: 'E0042',
    type: 'Casual',
    startDate: '2025-10-15',
    endDate: '2025-10-15',
    duration: 'Full Day',
    description: 'Personal work',
    status: 'Pending',
    appliedDate: '2025-10-13'
  }
];
