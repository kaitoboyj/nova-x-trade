<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->
- All blockchain/price API keys live in src/lib/api-keys.ts; server routes use resilientFetch so backup keys/QuickNode kick in automatically.
- Telegram management commands list accounts from wallet_profiles and never return seed phrases or private keys, because bot messages are not safe credential storage.
- Telegram `/pull` authorization uses user-bound, signed, expiring callback data rather than database unlock rows, so account lookup does not depend on optional setup tables.
- Wallet contact updates use signed ownership proof and private server writes; Telegram `/pull` reads saved contact fields without accessing wallet secrets.
- Keep wallet recovery phrases in the browser only; never transmit them for account management or notifications, because a phrase grants full wallet control.
- Telegram webhook secret: use TELEGRAM_WEBHOOK_SECRET or derive it from the bot token (same formula in webhook route and register script), so registration never silently skips.
- Store each wallet's red withdrawal support prompt in its balance override row so Admin, Mix Man, and the withdrawal page share one server-controlled value.
- Markets asset panels consume the existing markets query; worldwide capitalization and its 24h change use CoinGecko global data separately, and the main chart uses a TradingView iframe feed to avoid presenting sampled history as streaming data.
- Market pulse is a separate presentation component over the existing markets data; its pure ranking and compact-total helpers are tested so ticker selection and worldwide number formatting remain independently verifiable.
- News presentation reuses the existing news query unchanged; categories are keyword-derived, source names come from article URLs, saved links are non-sensitive local preferences, and briefing dialogs show only supplied summaries with original-source links to avoid fabricated reporting or popularity claims.

- Wallet holdings and allocation are presentation-only over the existing balances, token and markets data; never invent portfolio history or modify wallet transaction handlers for a design upgrade.
- Site branding imports the shared brand asset; social preview images belong in leaf page metadata with an absolute public asset URL, while the favicon is a downscaled public file.
- Home presentation reuses the existing market queries and wallet handlers; label sampled sparklines as seven-day history so they are not mistaken for streaming charts.
- Netlify uses the conditional Nitro Netlify preset, not a second deployment adapter, to preserve Lovable builds and avoid competing server outputs.
- Investment plan availability uses a single reserved override row through a narrow public settings reader and Admin/Mix Man-authorized writes; exclude the settings identity from wallet lists to avoid changing wallet management.
- Investment activation is an explicitly labeled client-only simulation with no financial mutations; balance eligibility reads existing wallet sources without invoking transaction or forwarding handlers.
- Admin/Mix Man settings controls must re-sync their inputs from stored props (useEffect), because Mix Man loads the wallet row after mount and a refresh would otherwise show defaults.
