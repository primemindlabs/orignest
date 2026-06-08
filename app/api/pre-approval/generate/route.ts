import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const ROLE_TITLES: Record<string, string> = {
  loan_officer: 'Loan Officer',
  branch_manager: 'Branch Manager',
  admin: 'Loan Officer',
  processor: 'Loan Processor',
};

export async function POST(req: NextRequest): Promise<NextResponse> {
  const { userId, orgId } = await auth();
  if (!userId || !orgId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const sb = createAdminClient();

  const { data: org } = await sb
    .from('organizations')
    .select('id, name')
    .eq('clerk_org_id', orgId)
    .maybeSingle();

  if (!org) {
    return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
  }

  const body = (await req.json()) as {
    lead_id: string;
    loan_amount: number;
    loan_program: string;
    loan_purpose: string;
    property_type: string;
    expiration_date: string;
  };

  const { lead_id, loan_amount, loan_program, loan_purpose, property_type, expiration_date } = body;

  if (!lead_id || !loan_amount || !loan_program || !loan_purpose || !property_type || !expiration_date) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
  }

  const { data: lead } = await sb
    .from('leads')
    .select('first_name, last_name, email')
    .eq('id', lead_id)
    .eq('org_id', org.id)
    .maybeSingle();

  if (!lead) {
    return NextResponse.json({ error: 'Lead not found' }, { status: 404 });
  }

  const { data: profile } = await sb
    .from('profiles')
    .select('first_name, last_name, nmls_id, phone, email, role')
    .eq('clerk_user_id', userId)
    .eq('org_id', org.id)
    .maybeSingle();

  const loName = profile
    ? `${profile.first_name as string} ${profile.last_name as string}`.trim() || 'Your Loan Officer'
    : 'Your Loan Officer';
  const loTitle = profile ? ROLE_TITLES[profile.role as string] ?? 'Loan Officer' : 'Loan Officer';
  const brokerageName = (org.name as string) || 'Ashley AI Mortgage';

  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([612, 792]);
  const { width, height } = page.getSize();
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const regularFont = await pdfDoc.embedFont(StandardFonts.Helvetica);

  const brandBlue = rgb(0.114, 0.306, 0.847);
  const darkGray = rgb(0.1, 0.1, 0.1);
  const medGray = rgb(0.4, 0.4, 0.4);
  const lightBlue = rgb(0.937, 0.965, 1.0);
  const white = rgb(1, 1, 1);

  // Header bar
  page.drawRectangle({ x: 0, y: height - 80, width, height: 80, color: brandBlue });
  page.drawText('MORTGAGE PRE-APPROVAL LETTER', {
    x: 40, y: height - 44, size: 14, font: boldFont, color: white,
  });
  page.drawText(brokerageName, {
    x: 40, y: height - 63, size: 9, font: regularFont, color: rgb(0.75, 0.87, 0.98),
  });

  const today = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  page.drawText(today, { x: width - 160, y: height - 50, size: 10, font: regularFont, color: white });

  let yPos = height - 115;

  const borrowerName = `${lead.first_name as string} ${lead.last_name as string}`;
  page.drawText(`Re: Pre-Approval — ${borrowerName}`, {
    x: 40, y: yPos, size: 13, font: boldFont, color: darkGray,
  });
  yPos -= 28;

  page.drawText(`Dear ${lead.first_name as string},`, { x: 40, y: yPos, size: 11, font: regularFont, color: darkGray });
  yPos -= 22;

  const amountFmt = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(loan_amount);
  page.drawText(`This letter confirms that ${borrowerName} has been pre-approved for a ${loan_program}`, {
    x: 40, y: yPos, size: 11, font: regularFont, color: darkGray,
  });
  yPos -= 17;
  page.drawText(`home loan up to a maximum loan amount of ${amountFmt}.`, {
    x: 40, y: yPos, size: 11, font: regularFont, color: darkGray,
  });
  yPos -= 22;

  page.drawText('This pre-approval is based on a preliminary review of credit, income, and assets and is', {
    x: 40, y: yPos, size: 10, font: regularFont, color: medGray,
  });
  yPos -= 15;
  page.drawText('subject to final underwriting approval, appraisal, title search, and verification of all information.', {
    x: 40, y: yPos, size: 10, font: regularFont, color: medGray,
  });
  yPos -= 35;

  // Details box
  const boxHeight = 95;
  page.drawRectangle({
    x: 40, y: yPos - boxHeight, width: width - 80, height: boxHeight,
    color: lightBlue, borderColor: brandBlue, borderWidth: 0.75,
  });

  const detailsY = yPos - 22;
  const cols = [60, 230, 400];
  const details: Array<[string, string]> = [
    ['PROPERTY TYPE', property_type],
    ['LOAN PURPOSE', loan_purpose],
    ['LOAN PROGRAM', loan_program],
  ];
  details.forEach(([label, value], i) => {
    page.drawText(label, { x: cols[i], y: detailsY, size: 7, font: boldFont, color: brandBlue });
    page.drawText(value, { x: cols[i], y: detailsY - 14, size: 11, font: boldFont, color: darkGray });
  });

  const expFmt = new Date(expiration_date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  page.drawText('VALID THROUGH', { x: 60, y: detailsY - 44, size: 7, font: boldFont, color: brandBlue });
  page.drawText(expFmt, { x: 60, y: detailsY - 58, size: 11, font: boldFont, color: darkGray });

  yPos -= boxHeight + 30;

  page.drawText(`Questions? Contact ${loName} directly:`, { x: 40, y: yPos, size: 11, font: regularFont, color: darkGray });
  yPos -= 18;
  if (profile?.phone) { page.drawText(profile.phone as string, { x: 40, y: yPos, size: 10, font: regularFont, color: medGray }); yPos -= 15; }
  if (profile?.email) { page.drawText(profile.email as string, { x: 40, y: yPos, size: 10, font: regularFont, color: medGray }); yPos -= 30; }

  page.drawText('Sincerely,', { x: 40, y: yPos, size: 11, font: regularFont, color: darkGray });
  yPos -= 40;

  page.drawLine({ start: { x: 40, y: yPos + 5 }, end: { x: 260, y: yPos + 5 }, thickness: 0.5, color: medGray });
  page.drawText(loName, { x: 40, y: yPos - 13, size: 11, font: boldFont, color: darkGray });
  page.drawText(loTitle, { x: 40, y: yPos - 27, size: 9, font: regularFont, color: medGray });
  if (profile?.nmls_id) { page.drawText(`NMLS #${profile.nmls_id as string}`, { x: 40, y: yPos - 40, size: 9, font: regularFont, color: medGray }); }

  // Footer
  page.drawLine({ start: { x: 40, y: 52 }, end: { x: width - 40, y: 52 }, thickness: 0.5, color: rgb(0.8, 0.8, 0.8) });
  page.drawText(
    'This pre-approval does not constitute a commitment to lend. All loans subject to credit and property approval.',
    { x: 40, y: 38, size: 7, font: regularFont, color: medGray }
  );

  const pdfBytes = await pdfDoc.save();
  const safeFilename = `pre-approval-${borrowerName.replace(/\s+/g, '-').toLowerCase()}.pdf`;

  return new NextResponse(Buffer.from(pdfBytes), {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${safeFilename}"`,
    },
  });
}
