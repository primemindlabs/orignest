import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import type { BorrowerProfile, ProgramResult } from '@/lib/pricing/scenarios';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function fmt(n: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n);
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const { userId, orgId } = await auth();
  if (!userId || !orgId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { profile, results } = (await req.json()) as {
    profile: BorrowerProfile;
    results: ProgramResult[];
  };

  if (!results?.length) {
    return NextResponse.json({ error: 'No results to render' }, { status: 400 });
  }

  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([792, 612]); // landscape
  const { width, height } = page.getSize();
  const bold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const reg = await pdfDoc.embedFont(StandardFonts.Helvetica);

  const brandBlue = rgb(0.114, 0.306, 0.847);
  const dark = rgb(0.1, 0.1, 0.1);
  const med = rgb(0.4, 0.4, 0.4);
  const white = rgb(1, 1, 1);

  page.drawRectangle({ x: 0, y: height - 60, width, height: 60, color: brandBlue });
  page.drawText('MORTGAGE PROGRAM COMPARISON', { x: 40, y: height - 38, size: 16, font: bold, color: white });

  const loanAmount = Math.max(profile.purchasePrice - profile.downPayment, 0);
  const ltv = profile.purchasePrice > 0 ? (loanAmount / profile.purchasePrice) * 100 : 0;
  page.drawText(
    `Purchase ${fmt(profile.purchasePrice)}  ·  Down ${fmt(profile.downPayment)} (${ltv.toFixed(0)}% LTV)  ·  Loan ${fmt(loanAmount)}  ·  Credit ${profile.creditScore}`,
    { x: 40, y: height - 80, size: 10, font: reg, color: med }
  );

  // Table layout
  const rows: Array<[string, (r: ProgramResult) => string]> = [
    ['Interest Rate', (r) => `${r.rate}%`],
    ['Monthly P&I', (r) => fmt(r.monthlyPI)],
    ['Est. Payment (PITI)', (r) => fmt(r.monthlyPayment)],
    ['Cash to Close', (r) => fmt(r.cashToClose)],
    ['Min Credit', (r) => String(r.minCredit)],
    ['PMI', (r) => (r.pmi ? 'Yes' : 'No')],
    ['Best For', (r) => r.tags.join(', ') || '—'],
  ];

  const labelX = 40;
  const colWidth = Math.min(150, (width - 200) / results.length);
  const startX = 200;
  let y = height - 120;

  // Program headers
  results.forEach((r, i) => {
    page.drawText(r.name, { x: startX + i * colWidth, y, size: 10, font: bold, color: brandBlue, maxWidth: colWidth - 8 });
  });
  y -= 22;

  rows.forEach(([label, val]) => {
    page.drawText(label, { x: labelX, y, size: 9, font: bold, color: dark });
    results.forEach((r, i) => {
      page.drawText(val(r), { x: startX + i * colWidth, y, size: 9, font: reg, color: dark, maxWidth: colWidth - 8 });
    });
    page.drawLine({ start: { x: labelX, y: y - 8 }, end: { x: width - 40, y: y - 8 }, thickness: 0.4, color: rgb(0.9, 0.9, 0.9) });
    y -= 26;
  });

  page.drawText(
    'Estimates only. Taxes ($250) + insurance ($100) + PMI assumed; closing costs ~2.5%. Subject to underwriting approval.',
    { x: 40, y: 36, size: 7, font: reg, color: med }
  );

  const pdfBytes = await pdfDoc.save();
  return new NextResponse(Buffer.from(pdfBytes), {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': 'attachment; filename="program-comparison.pdf"',
    },
  });
}
