# Telegram Approval Progress (Paused)

## Completed
- Added shared Telegram helper for sending messages: lib/telegram.ts.
- Refactored Telegram notify route to use helper: app/api/telegram/notify/route.ts.
- Added approval request API that creates pending approval and sends Telegram link: app/api/quote-approvals/route.ts.
- Added approval endpoint for bosses to approve by link: app/api/quote-approvals/[quoteId]/approve/route.ts.
- Added approval review page and client component: app/approve/[id]/page.tsx and app/approve/[id]/ApprovalClient.tsx.
- Wired Export PDF to request approval before generating PDF, and disabled button while requesting: app/page.tsx.
- Stored TELEGRAM_CHAT_ID in .env.local (token updated by user).

## Pending / Issues
- Supabase table quote_approvals not created yet (SQL still needs to be run).
- Need APP_BASE_URL in .env.local so Telegram links point to the correct domain (uses request origin if not set).
- app/page.tsx: Thai strings in requestQuoteApproval are corrupted (appear as "???") and should be restored.
- Approval page missing blob-button SVG filter block (attempt failed); add same SVG used on other pages if button effect is desired.
- Optional: update approval page to show if already approved and/or hide approve button for non-admins (currently disabled but still visible).

## Notes
- Approval flow is "approve once per quote"; user re-clicks Export PDF after approval to download.
- No webhook is used; approval happens via web link and PIN-admin check.
