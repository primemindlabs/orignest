// Soft Pull Solutions integration.
// Docs: https://www.softpullsolutions.com/api-documentation (REST, Bearer auth).
// Requires vendor approval (2-3 weeks) before production use.
// Set SOFT_PULL_API_KEY=mock (or "placeholder") to run the full flow with
// realistic fake data during development — no other code changes needed when
// the real key is dropped in after approval.
//
// PII: SSN and DOB are passed to the SPS API only — never persisted to the DB.

import axios from 'axios';

export interface SoftPullTradeline {
  SubscriberName: string;
  AccountNumber: string;
  AccountType: string;
  Bureau: string; // 'Experian' | 'Equifax' | 'TransUnion'
  Balance: number;
  CreditLimit: number;
  OpenDate: string;
  CloseDate: string;
  AccountStatus: string;
  PaymentStatus: string;
  Remarks: string[];
}

export interface SoftPullResponse {
  Scores: { Experian?: number; Equifax?: number; TransUnion?: number };
  ReportDate: string;
  Tradelines: SoftPullTradeline[];
  HardInquiries: Array<{ SubscriberName: string; Date: string; Bureau: string }>;
  PublicRecords: Array<{ Type: string; Date: string; Bureau: string }>;
  ErrorCode?: string;
  ErrorMessage?: string;
}

export interface BorrowerPullInfo {
  firstName: string;
  lastName: string;
  ssn: string;
  dob: string;
  addressLine1: string;
  city: string;
  state: string;
  zip: string;
}

function mockResponse(): SoftPullResponse {
  return {
    Scores: { Experian: 598, Equifax: 602, TransUnion: 594 },
    ReportDate: new Date().toISOString().split('T')[0],
    Tradelines: [
      { SubscriberName: 'CAPITAL ONE', AccountNumber: '****1234', AccountType: 'CREDIT_CARD', Bureau: 'Experian', Balance: 2800, CreditLimit: 3000, OpenDate: '2019-03-15', CloseDate: '', AccountStatus: 'Open', PaymentStatus: '60_days_late', Remarks: ['Late payment 60 days'] },
      { SubscriberName: 'PORTFOLIO RECOVERY', AccountNumber: '****5678', AccountType: 'COLLECTION', Bureau: 'Equifax', Balance: 1450, CreditLimit: 0, OpenDate: '2021-08-01', CloseDate: '', AccountStatus: 'Open', PaymentStatus: 'collection', Remarks: ['In collections', 'Original creditor: Sprint'] },
      { SubscriberName: 'CHASE BANK', AccountNumber: '****9012', AccountType: 'AUTO_LOAN', Bureau: 'TransUnion', Balance: 12500, CreditLimit: 18000, OpenDate: '2020-06-20', CloseDate: '', AccountStatus: 'Open', PaymentStatus: 'current', Remarks: [] },
    ],
    HardInquiries: [{ SubscriberName: 'BEST BUY CREDIT', Date: '2023-11-10', Bureau: 'Experian' }],
    PublicRecords: [],
  };
}

export async function callSoftPullSolutions(info: BorrowerPullInfo): Promise<SoftPullResponse> {
  const key = process.env.SOFT_PULL_API_KEY;
  const isMock = !key || key === 'mock' || key === 'placeholder';
  if (isMock) return mockResponse();

  // Real Soft Pull Solutions call. Confirm exact endpoint/payload during onboarding.
  const response = await axios.post(
    `${process.env.SOFT_PULL_API_URL}/trimerge`,
    {
      SubscriberId: process.env.SOFT_PULL_SUBSCRIBER_ID,
      FirstName: info.firstName,
      LastName: info.lastName,
      SSN: info.ssn,
      DOB: info.dob,
      Address: info.addressLine1,
      City: info.city,
      State: info.state,
      Zip: info.zip,
    },
    { headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' }, timeout: 30000 }
  );
  return response.data as SoftPullResponse;
}
