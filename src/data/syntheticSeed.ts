import type { SetupInput } from '../types/showroom';

export const SYNTHETIC_SETUP_DATA: SetupInput = {
  prospectName: 'Northwind Credit Union',
  industry: 'Retail Banking & Member Services',
  brandColor: '#5405BD', // Talkdesk Purple (Cobalt Primary/9); fixed, not user-editable
  targetLength: 90,
  helpContent: `# Northwind Credit Union Member Help Center (Synthetic)

## Article 1: Resetting Online Banking Passwords and Unlocking Access
Members locked out after three failed sign-in attempts can select "Forgot Password" on the login screen. A one-time verification code is sent to the registered mobile number or email on file. Temporary lockouts clear automatically after 30 minutes or immediately upon verifying identity via SMS. Never share one-time passcodes with anyone.

## Article 2: Travel Notices and International Card Usage
Before traveling outside your home country, submit a travel notice in the mobile app under Card Controls at least 24 hours before departure. List destination countries and travel dates so automated fraud alerts do not decline legitimate purchases. Debit and credit cards work at ATMs displaying the Plus or Cirrus network marks.

## Article 3: Disputing an Unrecognized Card Transaction
If you spot an unfamiliar merchant charge, first check whether it is a pending authorization or a parent company name. Freeze the card immediately inside Card Controls to prevent additional charges. To open a formal dispute, a member support specialist must verify the transaction date, merchant name, and whether the card is still in your possession, then file a provisional claim within two business days.

## Article 4: Ordering a Replacement Debit Card
Lost or damaged debit cards can be canceled and reordered from Card Controls. Standard plastic replacement cards arrive by mail in 5 to 7 business days at no fee. Expedited two-day shipping carries a $15 service fee and requires confirmation of the current mailing address on file.

## Article 5: Mobile Check Deposit Limits and Hold Times
Eligible checking accounts can deposit paper checks up to $5,000 per day and $15,000 per month using the mobile app camera. Endorse the back with "For Mobile Deposit Only at Northwind Credit Union." Checks deposited before 4:00 PM ET on a business day typically clear the next business day; larger amounts may receive a two-business-day hold notice.

## Article 6: Setting Up Direct Deposit and Routing Details
Provide your employer with Northwind's routing number (000098765) and your checking account number found inside Account Details. Direct deposits typically post up to two days early depending on payroll submission timing.`,

  discoveryNotes: `Discovery Call Summary — Northwind Credit Union (Synthetic)
Participants: Maya Chen (VP Member Experience), Devon Brooks (Contact Center Director)

Key Challenges & Quotes:
- "Our phone queue spikes every Monday morning with password resets and travel notice calls, pushing average wait times past 14 minutes."
- "When someone calls about a fraudulent charge, we need the bot to freeze panic, gather the merchant name and card possession status, and pass a clean summary straight to a live fraud specialist."
- "Members ask about mobile check deposit holds constantly, and agents spend half the call reading the same 4:00 PM cutoff policy aloud."

Topics Buyer Asked Us to Skip:
- Devon Brooks: "Please skip outbound marketing campaigns and loan origination workflows in this demo — we are strictly evaluating inbound member support right now."
- Maya Chen: "Do not include pricing tiers or multi-year contract terms in the video; our procurement team handles that later."`,

  capabilities: `- Grounded Help-Center Q&A: Answers member questions strictly from approved knowledge base articles with inline source citations.
- Structured Human Handover: Collects pre-triage context (intent, verification status, merchant/date details) and transfers seamlessly to a human specialist queue.
- Queue Deflection for Routine Inquiries: Resolves password reset guidance, travel notice instructions, replacement card policies, and deposit cutoff questions 24/7.
- Card-Freeze Policy Guidance & Escalation Routing: Guides members to freeze lost cards immediately and routes disputes to fraud specialists.
- Session Audit Trail & Policy Guardrails: Enforces redaction of account-specific numbers and prevents unauthorized financial advice.`,
};

export const SYNTHETIC_FOLLOWUP_TRANSCRIPT = `Post-Demo Call Transcript — Northwind Credit Union (Synthetic)
Date: Tuesday, November 16

Maya Chen (VP Member Experience): Thanks for putting this tailored walkthrough together. Watching our own travel notice and dispute handover flow in action made it click for the operations team.

Devon Brooks (Contact Center Director): Agreed. Before we schedule the next step, can you send over the exact SLA numbers for your live agent handover queue sync by this Friday?

Maya Chen (VP Member Experience): Also, our security officer needs a copy of your SOC 2 Type II report and confirmation on whether you mask card digits before logs are stored. Could you share that?

Alex Rivera (Solutions Engineer, Our Team): Absolutely, I will prepare a technical architecture diagram showing how our session guardrail redacts sensitive digits before logging, and send it over by next Wednesday.

Maya Chen (VP Member Experience): Great. One last thing — can your team provide a rough pricing breakdown for 40,000 monthly member conversations? We didn't see that in the video.

Devon Brooks (Contact Center Director): And please confirm if your system connects natively to our Symitar core, or if that requires custom middleware. Look forward to the follow-up email.`;
