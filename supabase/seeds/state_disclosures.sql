-- State disclosure library seed. Idempotent (ON CONFLICT DO NOTHING).
-- Paste into the Supabase SQL editor (or run after state_disclosures exists).
-- NOTE: reference content only — confirm current statutory text with compliance counsel.

INSERT INTO state_disclosures (state_code, disclosure_type, title, content, citation) VALUES

('CA', 'right_to_choose_insurance',
 'California Right to Choose Title Insurance',
 'In California, you have the right to choose your own title insurance company and escrow company. The selection of a title insurer or escrow holder may not be required as a condition of your real estate transaction. For more information, contact the California Department of Insurance.',
 'Cal. Ins. Code § 12404'),

('TX', 'state_specific_tila',
 'Texas Home Equity Loan Notice',
 'If this is a Texas home equity loan under Section 50(a)(6): (1) the homestead property is in Texas; (2) you may prepay the loan without penalty; (3) total fees (excluding interest) may not exceed the statutory cap of the original principal balance; and (4) the loan may not close before 12 days after you submit your application or receive this notice, whichever is later.',
 'Tex. Const. Art. XVI, § 50(a)(6)'),

('TX', 'deed_of_trust_trustee',
 'Texas Deed of Trust Trustee',
 'Texas security instruments are deeds of trust naming a trustee who may conduct a non-judicial foreclosure sale on the first Tuesday of the month after proper notice. You have the right to reinstate or cure prior to sale as provided by law.',
 'Tex. Prop. Code § 51.002'),

('FL', 'balloon_payment',
 'Florida Balloon Payment Disclosure',
 'THIS LOAN CONTAINS A BALLOON PAYMENT. After your scheduled monthly payments you will be required to make a single large final payment. If you cannot make that payment you may need to refinance at then-current market rates, which may be higher than the rate on this loan.',
 'Fla. Stat. § 697.05'),

('NY', 'commitment_fee',
 'New York Mortgage Commitment',
 'A mortgage commitment is a written statement by the lender agreeing to make the loan on stated terms. If a commitment is issued, the lender is bound by its terms for the period stated. You have the right to receive a copy of any appraisal report for which you paid.',
 'N.Y. Banking Law § 6-m'),

('GA', 'fair_lending',
 'Georgia Fair Lending Statement',
 'Georgia law prohibits certain abusive and predatory lending practices, including loan flipping without net tangible benefit and financing of excessive fees. This lender does not discriminate in the making of any loan on a prohibited basis.',
 'O.C.G.A. § 7-6A-1 et seq.'),

('IL', 'anti_steering',
 'Illinois Predatory Lending Database Notice',
 'For property in designated Illinois counties, this transaction may be subject to the Predatory Lending Database Program. You may be required to complete loan counseling with a HUD-certified counselor before closing.',
 '765 ILCS 77/70'),

('WA', 'prepayment_penalty',
 'Washington Prepayment Disclosure',
 'Washington law limits prepayment penalties on residential mortgage loans. You have the right to prepay this loan in whole or in part; review your note for any applicable prepayment terms, which are constrained by state law.',
 'RCW 31.04.035'),

('OR', 'fair_lending',
 'Oregon Anti-Discrimination Notice',
 'Oregon law prohibits discrimination in mortgage lending on the basis of any protected class. If you believe you have been treated unfairly, you may contact the Oregon Division of Financial Regulation.',
 'ORS 659A.421'),

('NC', 'homebuyer_counseling',
 'North Carolina High-Cost / Counseling Notice',
 'If this loan is a rate-spread or high-cost home loan under North Carolina law, you may be entitled to home-ownership counseling before closing. Ask your loan officer whether counseling is required for your transaction.',
 'N.C.G.S. § 24-1.1E')

ON CONFLICT (state_code, disclosure_type) DO NOTHING;
