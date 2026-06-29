/**
 * ECOA / Regulation B adverse-action notice PDF builder. SERVER-ONLY (pdf-lib).
 *
 * Generates the "Notice of Action Taken" required when a credit application is
 * denied, countered, or closed for incompleteness. Self-contained: callers pass a
 * fully-resolved AdverseActionNoticeData and receive PDF bytes. The reason codes are
 * the Reg B approved set — never free-text a denial reason outside this list.
 */
import 'server-only';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';

export { ECOA_DENIAL_REASONS } from './reasons';

export interface AdverseActionNoticeData {
  applicantName: string;
  applicantAddress: string;
  actionDate: string;
  lenderName: string;
  lenderAddress: string;
  lenderPhone: string;
  actionTaken: 'denied' | 'counteroffer' | 'incomplete';
  reasons: string[]; // max 4; should come from ECOA_DENIAL_REASONS
  creditBureauName?: string;
  creditBureauPhone?: string;
  scoreUsed?: number;
  scoreRange?: string;
  loanOfficerName: string;
  loanOfficerNmls: string;
}

const ACTION_TEXT: Record<AdverseActionNoticeData['actionTaken'], string> = {
  denied: 'Your application for credit has been DENIED.',
  counteroffer: 'We are unable to offer you credit on the terms you requested.',
  incomplete: 'Your application was incomplete. See reasons below.',
};

export async function buildAdverseActionNotice(data: AdverseActionNoticeData): Promise<Buffer> {
  const doc = await PDFDocument.create();
  const page = doc.addPage([612, 792]); // US Letter
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const boldFont = await doc.embedFont(StandardFonts.HelveticaBold);
  const grey = rgb(0.3, 0.3, 0.3);

  page.drawText('NOTICE OF ACTION TAKEN', { x: 50, y: 740, size: 16, font: boldFont });
  page.drawText('(Required by the Equal Credit Opportunity Act)', { x: 50, y: 720, size: 10, font, color: grey });

  page.drawText(`Applicant: ${data.applicantName}`, { x: 50, y: 690, size: 11, font });
  page.drawText(data.applicantAddress, { x: 50, y: 674, size: 11, font });
  page.drawText(`Date: ${data.actionDate}`, { x: 400, y: 690, size: 11, font });

  page.drawText('Creditor:', { x: 50, y: 645, size: 11, font: boldFont });
  page.drawText(data.lenderName, { x: 50, y: 629, size: 11, font });
  page.drawText(data.lenderAddress, { x: 50, y: 613, size: 11, font });
  page.drawText(data.lenderPhone, { x: 50, y: 597, size: 11, font });

  page.drawText('Action Taken:', { x: 50, y: 565, size: 11, font: boldFont });
  page.drawText(ACTION_TEXT[data.actionTaken], { x: 50, y: 549, size: 11, font, color: rgb(0.8, 0, 0) });

  page.drawText('Reasons for Action Taken:', { x: 50, y: 517, size: 11, font: boldFont });
  data.reasons.slice(0, 4).forEach((reason, i) => {
    page.drawText(`${i + 1}. ${reason}`, { x: 65, y: 501 - i * 16, size: 11, font });
  });

  if (data.scoreUsed != null) {
    const scoreY = 501 - Math.min(data.reasons.length, 4) * 16 - 30;
    page.drawText('Credit Score Information:', { x: 50, y: scoreY, size: 11, font: boldFont });
    page.drawText(`Score used in this decision: ${data.scoreUsed} (range: ${data.scoreRange ?? 'N/A'})`, { x: 50, y: scoreY - 16, size: 11, font });
    if (data.creditBureauName) {
      page.drawText(`Source: ${data.creditBureauName}${data.creditBureauPhone ? ` · ${data.creditBureauPhone}` : ''}`, { x: 50, y: scoreY - 32, size: 11, font });
    }
  }

  const bp = 200;
  const boiler = [
    'The federal Equal Credit Opportunity Act prohibits creditors from discriminating against credit applicants',
    'on the basis of race, color, religion, national origin, sex, marital status, age (provided the applicant',
    "has the capacity to enter into a binding contract), because all or part of the applicant's income derives",
    'from any public assistance program, or because the applicant has in good faith exercised any right',
    'under the Consumer Credit Protection Act.',
  ];
  boiler.forEach((line, i) => page.drawText(line, { x: 50, y: bp - i * 13, size: 9, font, color: grey }));

  page.drawText(`Loan Officer: ${data.loanOfficerName} · NMLS# ${data.loanOfficerNmls}`, { x: 50, y: 120, size: 11, font });

  const pdfBytes = await doc.save();
  return Buffer.from(pdfBytes);
}
