/** Signal: a borrower's birthday is today or tomorrow. */
import 'server-only';
import type { DraftAction } from '../types';
import { fullName, type SignalCtx } from '../context';
import { draftBirthday } from '../drafts';

function monthDay(d: Date): string {
  return `${d.getMonth()}-${d.getDate()}`;
}

export async function detectBirthdays(ctx: SignalCtx): Promise<DraftAction[]> {
  const todayMd = monthDay(ctx.targetDate);
  const tomorrowMd = monthDay(new Date(ctx.targetDate.getTime() + 86_400_000));

  const out: DraftAction[] = [];
  for (const lead of ctx.leads) {
    if (!lead.date_of_birth) continue;
    // date_of_birth is a 'YYYY-MM-DD' date column — parse without TZ drift.
    const parts = lead.date_of_birth.split('-');
    if (parts.length < 3) continue;
    const dob = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
    if (Number.isNaN(dob.getTime())) continue;
    const md = monthDay(dob);
    if (md !== todayMd && md !== tomorrowMd) continue;
    const isToday = md === todayMd;
    const name = fullName(lead);
    out.push({
      action_type: 'send_sms',
      signal_type: 'birthday',
      signal_reason: `${isToday ? 'Today' : 'Tomorrow'} is ${name}'s birthday.`,
      recommended_content: draftBirthday(lead.first_name),
      entity_type: 'borrower',
      entity_id: lead.id,
      entity_name: name,
      loan_id: lead.id,
      priority: 6,
    });
  }
  return out;
}
