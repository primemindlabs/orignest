-- ============================================================
-- Ashley IQ — Phase 34 · Wave 1 (seed): platform campaign library
-- 2026-06-09 — idempotent (guards on name + is_library_template).
-- Library campaigns have org_id NULL + is_library_template = true and are
-- readable by every org via the campaigns_library_read policy.
-- ============================================================

INSERT INTO campaigns (name, type, category, description, is_library_template, status, auto_enroll)
SELECT v.name, v.type, v.category, v.description, true, 'active', v.auto_enroll
FROM (VALUES
  ('New Lead Welcome Sequence','drip','nurture','Introduce yourself and build trust with a new lead over the first 2 weeks.', false),
  ('Pre-Approval Nurture','drip','nurture','Keep pre-approved buyers engaged while they are actively shopping.', false),
  ('Under Contract Milestone','milestone','nurture','Triggered when a loan reaches application/processing. Sets expectations.', true),
  ('Clear to Close — Final Countdown','milestone','nurture','Triggered on Clear to Close. Prepares the borrower for closing day.', true),
  ('Post-Close Welcome Home','milestone','retention','Triggered on funded/closed. Celebrates the milestone and plants referral seeds.', true),
  ('Referral Ask — 45 Days Post-Close','referral_ask','referral','The optimal time to ask for referrals after closing.', false),
  ('Happy Birthday','birthday','lifecycle','Annual birthday greeting — warm, no sales pitch.', true),
  ('Loan Anniversary','loan_anniversary','lifecycle','Annual anniversary of the loan closing with an equity nudge.', true),
  ('Happy Thanksgiving','holiday','lifecycle','Warm Thanksgiving greeting — gratitude, no sales content.', false),
  ('Stale Lead Reactivation','reactivation','retention','Re-engages leads with no activity in 90+ days.', true),
  ('First-Time Homebuyer Guide','educational','education','Five-email educational series covering the purchase process.', false),
  ('Rate Drop Alert','rate_drop','nurture','Auto-triggered when rates drop 0.25%+ below a borrower''s rate.', false),
  ('Weekly Market Update','market_update','nurture','Monday morning market update for active leads and past clients.', false),
  ('Pre-Approval Expiring Soon','pre_approval_expiring','nurture','Triggered 30 days before pre-approval expiration.', false)
) AS v(name, type, category, description, auto_enroll)
WHERE NOT EXISTS (SELECT 1 FROM campaigns c WHERE c.name = v.name AND c.is_library_template = true);

INSERT INTO campaign_steps (campaign_id, org_id, step_number, delay_days, channel, subject, body, ai_personalize)
SELECT c.id, NULL, s.step_number, s.delay_days, s.channel, s.subject, s.body, true
FROM (VALUES
  ('New Lead Welcome Sequence',1,0,'email','Welcome, {{first_name}} — I''m here to help','Hi {{first_name}}, thanks for reaching out! I''m {{lo_name}} and I''ll be your guide through the {{loan_type}} process. No pressure, no jargon — just straight answers whenever you need them. Reply any time.'),
  ('New Lead Welcome Sequence',2,0,'sms',NULL,'Hi {{first_name}}, it''s {{lo_name}}! I just emailed you a welcome note. Text me any time — I''m here to make this easy.'),
  ('New Lead Welcome Sequence',3,3,'email','Quick question for you, {{first_name}}','Hi {{first_name}} — what''s the one thing about getting a {{loan_type}} that feels confusing or stressful right now? Tell me and I''ll clear it up.'),
  ('New Lead Welcome Sequence',4,7,'email','What every homebuyer should know before applying','Hi {{first_name}}, before you apply, here are three things worth knowing: how much you can comfortably afford, what documents speed things up, and how your credit factors in. Want me to walk you through yours?'),
  ('New Lead Welcome Sequence',5,7,'sms',NULL,'Hey {{first_name}}, just checking in! Still thinking about your {{loan_type}}? Happy to answer anything — reply here.'),
  ('New Lead Welcome Sequence',6,14,'email','Ready when you are, {{first_name}}','Hi {{first_name}}, whenever you''re ready to take the next step, I''m here. A quick 10-minute call can map out your whole path. Just say the word.'),

  ('Pre-Approval Nurture',1,0,'email','Congrats on your pre-approval! Here''s what''s next','Hi {{first_name}}, congratulations — you''re pre-approved! That puts you ahead of most buyers. Next: let''s find the right home. I''m here for offer strategy and any questions along the way.'),
  ('Pre-Approval Nurture',2,7,'email','Home shopping tips for {{first_name}}','Hi {{first_name}}, a few tips as you shop: stick to your comfortable budget, keep your finances steady, and loop me in before you make an offer so we can move fast.'),
  ('Pre-Approval Nurture',3,14,'sms',NULL,'Hi {{first_name}}! How''s the home search going? Found anything you love yet?'),
  ('Pre-Approval Nurture',4,30,'email','Keeping your pre-approval current','Hi {{first_name}}, just a heads-up to keep your pre-approval current as you shop. If anything changes with your timeline, let me know and I''ll keep you ready to move.'),

  ('Under Contract Milestone',1,0,'email','You''re under contract — here''s the roadmap','Congrats {{first_name}}! You''re under contract. Here''s the path ahead: appraisal, underwriting, and clear to close. I''ll keep you posted at every step.'),
  ('Under Contract Milestone',2,0,'sms',NULL,'Great news, {{first_name}}! You''re under contract. I''ll keep you updated every step of the way. Let''s do this!'),
  ('Under Contract Milestone',3,3,'email','Your appraisal — what to expect','Hi {{first_name}}, the appraisal confirms the home''s value for your loan. It usually takes a few days. Nothing for you to do — I''ll let you know the moment it''s back.'),
  ('Under Contract Milestone',4,7,'email','Documents I need from you, {{first_name}}','Hi {{first_name}}, to keep things moving smoothly, I may need a couple of updated documents. I''ll send a quick list — the faster we get them, the faster we close.'),

  ('Clear to Close — Final Countdown',1,0,'email','Clear to Close! You''re almost there, {{first_name}}','{{first_name}}, you''re Clear to Close! Everything checks out. I''ll send your closing details shortly — so excited for you.'),
  ('Clear to Close — Final Countdown',2,0,'sms',NULL,'CLEAR TO CLOSE, {{first_name}}! This is the moment we''ve been working toward. Closing details coming your way!'),
  ('Clear to Close — Final Countdown',3,1,'email','Your closing day checklist','Hi {{first_name}}, for closing bring a valid ID and follow the wire instructions exactly (call to verify). And please don''t make any big purchases or open new credit before closing.'),

  ('Post-Close Welcome Home',1,0,'email','Welcome home, {{first_name}}!','{{first_name}}, congratulations — you''re a homeowner! It was an honor working with you. Enjoy every moment, and know I''m always here if you need anything.'),
  ('Post-Close Welcome Home',2,0,'sms',NULL,'CONGRATULATIONS {{first_name}}!! You''re a homeowner! It was an honor working with you.'),
  ('Post-Close Welcome Home',3,7,'email','Settling in? A few first-week tips','Hi {{first_name}}, hope you''re settling in! A few first-week tips: change the locks, find your water shut-off, and save my number for anything mortgage-related down the road.'),
  ('Post-Close Welcome Home',4,30,'email','Your first mortgage payment','Hi {{first_name}}, your first mortgage payment is coming up. Your servicer will have the details. Any questions at all, I''m here.'),

  ('Referral Ask — 45 Days Post-Close',1,0,'email','A quick favor, {{first_name}}','Hi {{first_name}}, hope you''re loving the new place! If you know anyone thinking about buying or refinancing, I''d be grateful for an introduction — I''ll take great care of them, just like I did for you.'),
  ('Referral Ask — 45 Days Post-Close',2,7,'sms',NULL,'Hey {{first_name}}! Hope you''re loving the new place. If anyone you know is thinking about buying or refinancing, a quick intro means the world to me!'),
  ('Referral Ask — 45 Days Post-Close',3,14,'task','Follow up','Follow up with {{first_name}} on the referral ask if no response to email/SMS.'),

  ('Happy Birthday',1,0,'email','Happy Birthday, {{first_name}}!','Happy Birthday, {{first_name}}! Wishing you a wonderful day and a fantastic year ahead. — {{lo_name}}'),
  ('Happy Birthday',2,0,'sms',NULL,'Happy Birthday {{first_name}}!! Hope your day is amazing! — {{lo_name}}'),

  ('Loan Anniversary',1,0,'email','Happy {{anniversary_number}}-year home anniversary, {{first_name}}!','Happy {{anniversary_number}}-year anniversary in your home, {{first_name}}! You''ve likely built meaningful equity since then. If you''d ever like a quick update on where you stand, just reply. — {{lo_name}}'),

  ('Happy Thanksgiving',1,0,'email','Thankful for clients like you, {{first_name}}','Hi {{first_name}}, as Thanksgiving approaches, I just wanted to say thank you. Clients like you are what make this work meaningful. Wishing you and your family a wonderful holiday. — {{lo_name}}'),

  ('Stale Lead Reactivation',1,0,'email','Still thinking about it, {{first_name}}?','Hi {{first_name}}, it''s been a little while! The market has shifted since we last spoke. If you''re still considering a {{loan_type}}, I''d love to catch up — no pressure at all.'),
  ('Stale Lead Reactivation',2,5,'sms',NULL,'Hey {{first_name}}, it''s {{lo_name}}! Things have changed in the market since we last talked — still exploring a {{loan_type}}? Happy to catch up.'),
  ('Stale Lead Reactivation',3,12,'task','Final reactivation attempt','Final reactivation attempt: call {{first_name}}. If no response, mark the lead cold and exit the campaign.'),

  ('First-Time Homebuyer Guide',1,0,'email','Part 1: How much home can you afford?','Hi {{first_name}}, welcome to your homebuyer guide. Part 1: affordability isn''t just the price — it''s the comfortable monthly payment. I can run your numbers any time.'),
  ('First-Time Homebuyer Guide',2,3,'email','Part 2: Understanding your credit score','Part 2, {{first_name}}: your credit score shapes your options. Small moves can help. Want a quick, no-impact review of where you stand?'),
  ('First-Time Homebuyer Guide',3,3,'email','Part 3: The pre-approval process explained','Part 3, {{first_name}}: pre-approval makes your offers stronger and your search focused. It''s simpler than most people expect — I''ll walk you through it.'),
  ('First-Time Homebuyer Guide',4,3,'email','Part 4: What to expect at closing','Part 4, {{first_name}}: closing day, demystified — what you''ll sign, what to bring, and how to avoid last-minute surprises.'),
  ('First-Time Homebuyer Guide',5,3,'email','Part 5: Your homeownership roadmap with me','Part 5, {{first_name}}: whenever you''re ready, here''s how we''ll work together from first call to keys in hand. Reply and let''s start.'),

  ('Rate Drop Alert',1,0,'email','Rates just dropped — this could save you money, {{first_name}}','Hi {{first_name}}, rates have moved in your favor. Depending on your situation, this could lower your payment on a {{loan_type}}. Want me to run the new numbers for you?'),
  ('Rate Drop Alert',2,0,'sms',NULL,'Hey {{first_name}}! Rates just dropped — this could lower your payment. Want me to run the new numbers? — {{lo_name}}'),

  ('Weekly Market Update',1,0,'email','Mortgage market update — week of {{current_week}}','Hi {{first_name}}, here''s your quick market update for the week of {{current_week}}. Rates and conditions shift weekly — if you''d like to know what it means for you specifically, just reply.'),

  ('Pre-Approval Expiring Soon',1,0,'email','Your pre-approval expires soon, {{first_name}}','Hi {{first_name}}, your pre-approval is approaching its expiration. Let''s renew it so you''re ready the moment you find the right home — it only takes a few minutes.'),
  ('Pre-Approval Expiring Soon',2,15,'sms',NULL,'{{first_name}}, your pre-approval expires soon! Let''s renew so you''re ready to move. Reply and I''ll get it started — {{lo_name}}'),
  ('Pre-Approval Expiring Soon',3,12,'task','Renew pre-approval','Pre-approval for {{first_name}} expires soon. Call to renew or transition to cold lead.')
) AS s(cname, step_number, delay_days, channel, subject, body)
JOIN campaigns c ON c.name = s.cname AND c.is_library_template = true
WHERE NOT EXISTS (SELECT 1 FROM campaign_steps cs WHERE cs.campaign_id = c.id AND cs.step_number = s.step_number);

-- Keep total_steps in sync for the library rows.
UPDATE campaigns c SET total_steps = (SELECT count(*) FROM campaign_steps cs WHERE cs.campaign_id = c.id)
WHERE c.is_library_template = true;
