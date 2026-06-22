/**
 * MISMO 3.4 (ULAD) URLA export — lender-agnostic. SERVER-ONLY.
 *
 * Produces a well-formed MISMO v3.4 residential message from our authoritative
 * application store (loan_applications JSONB sections + decrypted PII + the lead).
 * This is the core ULAD subset — subject property, loan terms, borrower(s) with
 * residence/employment/income/declarations/demographics, assets, liabilities, and
 * REO — the data any lender/AUS needs to ingest a 1003. It is intentionally
 * provider-neutral: no lender-specific extensions, so it uploads to any system
 * that accepts MISMO 3.4. Sparse JSONB is handled gracefully (omit empty nodes).
 *
 * NOTE: this maps the fields we collect; it is not a 100%-of-spec ULAD file. It is
 * structured to extend element-by-element as we add coverage.
 */
import 'server-only';

export interface UrlaInput {
  app: Record<string, any>;            // loan_applications row
  lead: Record<string, any>;           // leads row
  pii: { ssn?: string; dob?: string; coSsn?: string; coDob?: string };
}

const esc = (v: unknown): string =>
  String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** <Tag>value</Tag> — omitted entirely when value is null/empty. */
function el(tag: string, value: unknown): string {
  if (value === null || value === undefined || value === '') return '';
  return `<${tag}>${esc(value)}</${tag}>`;
}
/** Wrap children in a container, omitting the container if all children are empty. */
function wrap(tag: string, children: string, attrs = ''): string {
  const inner = children.trim();
  if (!inner) return '';
  return `<${tag}${attrs ? ' ' + attrs : ''}>${inner}</${tag}>`;
}
const num = (v: unknown): number | '' => { const n = Number(v); return Number.isFinite(n) ? n : ''; };

// ── enum maps (our value → MISMO enum) ─────────────────────────────────────────
const LOAN_PURPOSE: Record<string, string> = { purchase: 'Purchase', rate_term_refinance: 'Refinance', cash_out_refinance: 'Refinance', refinance_rate_term: 'Refinance', refinance_cashout: 'Refinance', construction: 'Construction', heloc: 'Other' };
const MORTGAGE_TYPE: Record<string, string> = { conventional: 'Conventional', fha: 'FHA', va: 'VA', usda: 'USDARuralDevelopment' };
const AMORT: Record<string, string> = { fixed: 'Fixed', arm: 'AdjustableRate', adjustable: 'AdjustableRate' };
const USAGE: Record<string, string> = { primary: 'PrimaryResidence', primary_residence: 'PrimaryResidence', second_home: 'SecondHome', investment: 'Investment', investment_property: 'Investment' };
const CITIZENSHIP: Record<string, string> = { us_citizen: 'USCitizen', permanent_resident: 'PermanentResidentAlien', non_permanent_resident: 'NonPermanentResidentAlien' };
const MARITAL: Record<string, string> = { married: 'Married', separated: 'Separated', unmarried: 'Unmarried' };
const ETHNICITY: Record<string, string> = { hispanic_or_latino: 'HispanicOrLatino', not_hispanic_or_latino: 'NotHispanicOrLatino', information_not_provided: 'InformationNotProvided', not_applicable: 'NotApplicable' };
const RACE: Record<string, string> = { american_indian_alaska_native: 'AmericanIndianOrAlaskaNative', asian: 'Asian', black_african_american: 'BlackOrAfricanAmerican', native_hawaiian_pacific_islander: 'NativeHawaiianOrOtherPacificIslander', white: 'White', information_not_provided: 'InformationNotProvided', not_applicable: 'NotApplicable' };
const SEX: Record<string, string> = { male: 'Male', female: 'Female', information_not_provided: 'InformationNotProvided', not_applicable: 'NotApplicable' };
const map = (m: Record<string, string>, v: unknown): string => (v ? m[String(v).toLowerCase()] ?? '' : '');

function address(a: { line?: string; unit?: string; city?: string; state?: string; zip?: string }): string {
  return wrap('ADDRESS',
    el('AddressLineText', a.line) + el('AddressUnitIdentifier', a.unit) + el('CityName', a.city) +
    el('StateCode', a.state) + el('PostalCode', a.zip) + el('CountryCode', 'US'));
}

function employmentNode(e: Record<string, any>): string {
  if (!e || !(e.employer_name || e.business_name)) return '';
  const income = wrap('CURRENT_INCOME_ITEMS',
    [['Base', e.base_monthly], ['Overtime', e.overtime_monthly], ['Bonus', e.bonus_monthly], ['Commissions', e.commission_monthly]]
      .map(([t, amt]) => num(amt) ? wrap('CURRENT_INCOME_ITEM', wrap('CURRENT_INCOME_ITEM_DETAIL', el('IncomeType', t) + el('CurrentIncomeMonthlyTotalAmount', num(amt)))) : '').join(''));
  return wrap('EMPLOYER',
    wrap('LEGAL_ENTITY', wrap('LEGAL_ENTITY_DETAIL', el('FullName', e.employer_name ?? e.business_name))) +
    address({ line: e.employer_address, city: e.employer_city, state: e.employer_state, zip: e.employer_zip }) +
    wrap('EMPLOYMENT', el('EmploymentClassificationType', e.is_self_employed ? 'SelfEmployed' : 'Primary') +
      el('EmploymentPositionDescription', e.position_title) + el('EmploymentStartDate', e.start_date) +
      el('SelfEmployedIndicator', e.is_self_employed ? 'true' : '')) +
    income);
}

function borrowerParty(role: 'borrower' | 'coborrower', b: Record<string, any>, ssn: string | undefined, dob: string | undefined, emp: Record<string, any> | undefined, decl: Record<string, any> | undefined, demo: Record<string, any> | undefined): string {
  if (!b || !(b.first_name || b.last_name)) return '';
  const name = wrap('NAME', el('FirstName', b.first_name) + el('MiddleName', b.middle_name) + el('LastName', b.last_name) + el('SuffixName', b.suffix));
  const taxId = ssn ? wrap('TAXPAYER_IDENTIFIERS', wrap('TAXPAYER_IDENTIFIER', el('TaxpayerIdentifierType', 'SocialSecurityNumber') + el('TaxpayerIdentifierValue', ssn))) : '';
  const contacts = wrap('CONTACT_POINTS',
    (b.email ? wrap('CONTACT_POINT', wrap('CONTACT_POINT_EMAIL', el('ContactPointEmailValue', b.email)) + wrap('CONTACT_POINT_DETAIL', el('ContactPointRoleType', 'Home'))) : '') +
    (b.phone_cell || b.phone ? wrap('CONTACT_POINT', wrap('CONTACT_POINT_TELEPHONE', el('ContactPointTelephoneValue', b.phone_cell ?? b.phone)) + wrap('CONTACT_POINT_DETAIL', el('ContactPointRoleType', 'Mobile'))) : ''));

  const declarations = decl ? wrap('DECLARATION', wrap('DECLARATION_DETAIL',
    el('BankruptcyIndicator', boolStr(decl.declared_bankruptcy_7yr)) +
    el('PriorPropertyForeclosureCompletedIndicator', boolStr(decl.property_foreclosed_7yr)) +
    el('OutstandingJudgmentsIndicator', boolStr(decl.outstanding_judgments)) +
    el('PartyToLawsuitIndicator', boolStr(decl.party_to_lawsuit)) +
    el('PresentlyDelinquentIndicatorURLA', boolStr(decl.delinquent_federal_debt)) +
    el('IntentToOccupyType', decl.intend_to_occupy_as_primary === undefined ? '' : decl.intend_to_occupy_as_primary ? 'Yes' : 'No') +
    el('HomeownerPastThreeYearsType', decl.ownership_interest_past_3yr === undefined ? '' : decl.ownership_interest_past_3yr ? 'Yes' : 'No'))) : '';

  const demographics = demo ? wrap('GOVERNMENT_MONITORING', wrap('GOVERNMENT_MONITORING_DETAIL',
    el('HMDAEthnicityType', map(ETHNICITY, demo.ethnicity)) +
    (Array.isArray(demo.races) ? demo.races.map((r: string) => el('HMDARaceType', map(RACE, r))).join('') : '') +
    el('HMDAGenderType', map(SEX, demo.sex)))) : '';

  const detail = wrap('BORROWER_DETAIL',
    el('BorrowerBirthDate', dob) +
    el('CitizenshipResidencyType', map(CITIZENSHIP, b.citizenship)) +
    el('MaritalStatusType', map(MARITAL, b.marital_status)) +
    el('DependentCount', num(b.number_of_dependents)));

  return wrap('PARTY',
    wrap('INDIVIDUAL', name + contacts) +
    taxId +
    wrap('ROLES', wrap('ROLE',
      wrap('BORROWER', detail + declarations + demographics + (emp ? wrap('EMPLOYERS', employmentNode(emp)) : '')) +
      wrap('ROLE_DETAIL', el('PartyRoleType', role === 'borrower' ? 'Borrower' : 'Borrower')))),
    `xlink:label="${role === 'borrower' ? 'BORROWER_1' : 'BORROWER_2'}"`);
}

const boolStr = (v: unknown): string => (v === true ? 'true' : v === false ? 'false' : '');

function assetsNode(a: Record<string, any>): string {
  const list: any[] = Array.isArray(a?.assets) ? a.assets : [];
  const items = list.map((x) => wrap('ASSET', wrap('ASSET_DETAIL',
    el('AssetType', 'CheckingAccount') + el('AssetAccountIdentifier', x.account_last4) +
    el('AssetCashOrMarketValueAmount', num(x.current_balance))) +
    wrap('OWNED_PROPERTY', '') )).join('');
  return wrap('ASSETS', items);
}

function liabilitiesNode(l: Record<string, any>): string {
  const list: any[] = Array.isArray(l?.liabilities) ? l.liabilities : [];
  const items = list.map((x) => wrap('LIABILITY', wrap('LIABILITY_DETAIL',
    el('LiabilityType', 'Revolving') + el('LiabilityMonthlyPaymentAmount', num(x.monthly_payment)) +
    el('LiabilityUnpaidBalanceAmount', num(x.unpaid_balance)) +
    el('LiabilityRemainingTermMonthsCount', num(x.months_remaining)) +
    el('LiabilityExclusionIndicator', boolStr(x.omit_from_dti))) +
    wrap('LIABILITY_HOLDER', wrap('NAME', el('FullName', x.creditor_name))))).join('');
  return wrap('LIABILITIES', items);
}

function reoNode(reo: any[]): string {
  if (!Array.isArray(reo) || !reo.length) return '';
  const items = reo.map((p) => wrap('OWNED_PROPERTY', wrap('OWNED_PROPERTY_DETAIL',
    el('OwnedPropertyMaintenanceExpenseAmount', '') +
    el('OwnedPropertyLienUPBAmount', num(p.current_mortgage_balance)) +
    el('OwnedPropertyRentalIncomeGrossAmount', num(p.monthly_gross_rental_income)) +
    el('OwnedPropertyRentalIncomeNetAmount', num(p.monthly_net_rental_income)) +
    el('OwnedPropertyDispositionStatusType', p.property_status === 'sold_at_closing' ? 'Sell' : p.property_status === 'pending_sale' ? 'PendingSale' : 'Retain')) +
    address({ line: p.property_address }))).join('');
  return wrap('OWNED_PROPERTIES', items);
}

export function buildUrlaXml(input: UrlaInput): string {
  const { app, lead, pii } = input;
  const b = app.borrower_data ?? {};
  const emp = (app.employment_data ?? {}).primary_employer ?? app.employment_data ?? {};
  const assets = app.assets_data ?? {};
  const liabilities = app.liabilities_data ?? {};
  const reo = app.real_estate_data ?? [];
  const loan = app.loan_data ?? {};
  const decl = app.declarations_data ?? {};
  const demo = app.demographic_data ?? {};

  // Subject property + loan terms fall back to the synced leads columns.
  const propUsage = map(USAGE, loan.subject_property_usage ?? lead.occupancy_type);
  const purpose = map(LOAN_PURPOSE, loan.loan_purpose ?? lead.loan_purpose);
  const mortgageType = MORTGAGE_TYPE[String(loan.loan_type ?? lead.loan_type ?? '').toLowerCase()] ?? 'Other';
  const loanAmount = num(loan.loan_amount ?? lead.loan_amount);
  const rate = num(loan.interest_rate ?? lead.rate);
  const termMonths = num(loan.loan_term_months) || (num(lead.term) ? Number(lead.term) * 12 : '');
  const amort = map(AMORT, loan.amortization_type) || 'Fixed';
  const cashOut = String(loan.loan_purpose ?? lead.loan_purpose ?? '').includes('cash') ? 'CashOut' : '';

  const collateral = wrap('COLLATERALS', wrap('COLLATERAL', wrap('SUBJECT_PROPERTY',
    address({ line: loan.subject_property_address ?? lead.property_address, city: lead.property_city, state: lead.property_state, zip: lead.property_zip }) +
    wrap('PROPERTY_DETAIL', el('PropertyUsageType', propUsage) + el('FinancedUnitCount', num(loan.number_of_units) || 1) + el('PropertyEstimatedValueAmount', num(lead.estimated_value ?? loan.appraised_value))) +
    wrap('SALES_CONTRACTS', num(loan.purchase_price ?? lead.purchase_price) ? wrap('SALES_CONTRACT', wrap('SALES_CONTRACT_DETAIL', el('SalesContractAmount', num(loan.purchase_price ?? lead.purchase_price)))) : ''))));

  const loanNode = wrap('LOANS', wrap('LOAN',
    wrap('TERMS_OF_LOAN', el('BaseLoanAmount', loanAmount) + el('LoanPurposeType', purpose) + el('MortgageType', mortgageType) + el('NoteRatePercent', rate) + el('LoanAmortizationMaximumLoanTermMonthsCount', termMonths) + el('CashOutDeterminationType', cashOut)) +
    wrap('AMORTIZATION', wrap('AMORTIZATION_RULE', el('AmortizationType', amort) + el('LoanAmortizationPeriodCount', termMonths) + el('LoanAmortizationPeriodType', 'Month'))) +
    el('LoanRoleType', 'SubjectLoan'),
    'xlink:label="SubjectLoan"'));

  const parties = wrap('PARTIES',
    borrowerParty('borrower', b, pii.ssn, pii.dob, emp, decl, demo) +
    borrowerParty('coborrower', b.co_borrower ?? app.coborrower_data ?? {}, pii.coSsn, pii.coDob, undefined, undefined, undefined));

  const deal = wrap('DEAL', collateral + loanNode + parties + assetsNode(assets) + liabilitiesNode(liabilities) + reoNode(reo));

  const header = wrap('ABOUT_VERSIONS', wrap('ABOUT_VERSION', el('DataVersionIdentifier', 'ULAD 3.4') + el('DataVersionName', 'AshleyIQ MISMO 3.4 URLA Export')));

  return `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<MESSAGE xmlns="http://www.mismo.org/residential/2009/schemas" xmlns:xlink="http://www.w3.org/1999/xlink" MISMOReferenceModelIdentifier="3.4.0">` +
    header +
    wrap('DEAL_SETS', wrap('DEAL_SET', wrap('DEALS', deal))) +
    `</MESSAGE>`;
}
