// Phase 107 — starter rules. Stages are REAL leads.stage values
// (funded -> 'closed'). SMS rules always require approval; the realtor email
// auto-sends. Offered as one-click "starter rules" on the empty state.
export const DEFAULT_RULES = [
  {
    rule_name: 'Application Received',
    trigger_stage: 'application',
    action_type: 'sms_borrower',
    message_template:
      "Hi {{borrower_first_name}}, we received your mortgage application! I'll review it and reach out within 1 business day. — {{lo_name}}, NMLS #{{lo_nmls}}. Reply STOP to opt out.",
    requires_approval: true,
    auto_send_email: false,
    delay_minutes: 0,
  },
  {
    rule_name: 'Conditional Approval',
    trigger_stage: 'conditional_approval',
    action_type: 'sms_borrower',
    message_template:
      "🎉 Great news, {{borrower_first_name}}! You have a conditional approval. See what's needed next in your portal: {{portal_link}} — {{lo_name}}. Reply STOP to opt out.",
    requires_approval: true,
    auto_send_email: false,
    delay_minutes: 0,
  },
  {
    rule_name: 'Clear to Close',
    trigger_stage: 'clear_to_close',
    action_type: 'sms_borrower',
    message_template:
      "🏡 You're CLEAR TO CLOSE, {{borrower_first_name}}! Call me to schedule your closing: {{lo_phone}} — {{lo_name}}. Reply STOP to opt out.",
    requires_approval: true,
    auto_send_email: false,
    delay_minutes: 0,
  },
  {
    rule_name: 'Closed — Notify Realtor',
    trigger_stage: 'closed',
    action_type: 'email_realtor',
    message_template:
      "Hi {{realtor_name}}, great news — {{borrower_first_name}}'s loan has closed! Thank you so much for the referral. Looking forward to more deals together. — {{lo_name}}",
    requires_approval: false,
    auto_send_email: true,
    delay_minutes: 0,
  },
] as const;
