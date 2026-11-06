# Daily closing snapshots for Saldo, Utang, and Piutang

Status: implemented, verified, and deployed to production on 1 November 2026. This file records the approved snapshot scope. See DAILY_BALANCES.md and VERIFICATION.md for delivered behavior and release evidence.

## Agreed interpretation

History means confirmed daily snapshots in **Laporan → Saldo Harian**, rather than a list of every edit.

When the user confirms **Tutup Hari**, save the latest recorded Saldo, Utang, and Piutang together. Each day's historical detail shows those saved values. Later edits do not alter an earlier confirmed snapshot.

For example, DANA might be edited several times during the day. If its latest balance is **Rp 1.000.000** when Tutup Hari is confirmed, that closing saves **DANA Rp 1.000.000**. Its earlier values and individual edits are not included in the daily snapshot or report detail.

“Latest data” refers to the latest values within each closing. It does not mean deleting or overwriting previous days' snapshots.

## Current application and scope

- The existing Saldo closing already saves the latest bank, e-wallet, and cash values at confirmation. Preserve that behavior.
- Extend future closings to also save Utang and Piutang, including Piutang originating from unpaid transactions.
- Do not add a Riwayat Saldo view, a change-by-change report, or new mutation-history storage for this feature.
- Existing internal balance audit storage remains unchanged. This proposal does not delete existing financial history. The daily detail will focus on saved closing values and comparisons between closings, rather than listing individual balance edits.
- Balances remain manually maintained. Debt settlement or transaction recording does not automatically change bank, e-wallet, or cash values.

## Placement and report

Keep the feature in **Laporan → Saldo Harian**, with the existing month selector and one **Tutup Hari** action.

Each confirmed daily row shows:

1. **Dana tersedia**: bank + e-wallet + physical cash.
2. **Sisa utang**.
3. **Sisa piutang**.
4. **Grand total setelah utang/piutang**: Dana tersedia + Sisa piutang − Sisa utang.
5. Change from the preceding comparable closing and its date.

Example:

| Tanggal | Dana tersedia | Sisa utang | Sisa piutang | Grand total |
| --- | ---: | ---: | ---: | ---: |
| 1 Nov | Rp 1.000.000 | Rp 300.000 | Rp 200.000 | Rp 900.000 |
| 2 Nov | Rp 1.200.000 | Rp 200.000 | Rp 150.000 | Rp 1.150.000 |

The first row stores the latest values at the 1 Nov closing. The second row stores the latest values at the 2 Nov closing. Neither row contains the intermediate edits made during those days.

## Detail of a saved closing

Click a date or **Detail** to open three tabs containing that closing's saved data:

- **Saldo**: one row per bank/e-wallet plus cash, using the latest value captured at closing. Cash denominations may be inspected as part of the saved final cash count.
- **Utang**: saved liabilities with name, initial amount, paid amount, remaining amount, due date, and status at closing.
- **Piutang**: equivalent saved receivables, covering both standalone Piutang and transaction-originated Piutang exactly once.

The detail may compare these final values with the preceding closing. It does not display the sequence of edits between closings. Initial scope does not add payment-by-payment timelines to these report tabs; operational payment history remains available in the existing Utang & Piutang menu.

For example, opening Saldo for 1 Nov can show:

| Sumber | Saldo saat penutupan |
| --- | ---: |
| DANA | Rp 1.000.000 |

Label the detail **Data saat penutupan [date/time]**. If DANA changes to Rp 900.000 afterward, opening that older closing still shows Rp 1.000.000. If a saved Piutang is settled later, the old snapshot still shows its earlier unpaid amount/status.

Do not offer edit, delete, Bayar, or Lunasi actions on historical rows. A separately labeled **Buka data saat ini** action may open an existing live record, but must not replace historical values or be needed to read the saved detail. Deleted/renamed live records must not break historical detail.

Provide **Lihat penutupan terakhir** from Saldo and Utang & Piutang, opening the appropriate tab of the latest confirmed closing with its date visible. Older report rows always open their own date's snapshot. Never silently mix Saldo from one date with debts from another.

## Tutup Hari behavior

1. The user updates current Saldo, Utang, and Piutang through their existing menus.
2. Tutup Hari synchronizes the closing device and loads the latest shared data for review.
3. Show all four totals and the final records that will be saved, compared with the previous compatible closing.
4. Require a closing explanation if any comparable component total changes: Dana tersedia, Utang, or Piutang. Opposing movements must not bypass this requirement just because the grand total is unchanged.
5. On confirmation, atomically save one immutable snapshot for the current WIB date, with the server confirmation time, user, explanation, and comparison references.

If relevant data changes after review opens, require a fresh review. Unsynchronized changes on other devices cannot be included; remind users to synchronize those devices before closing.

The snapshot reflects the state at confirmation time, not necessarily midnight. Later updates are visible in current data and the next closing, without replacing the saved closing. Keep the existing one-closing-per-day rule, online-only confirmation, idempotent retries, and missing-day behavior. Do not add automatic closing, backdating, or reopening.

## Storage and compatibility

- Save the final Saldo source IDs, names, categories, amounts, source versions, and cash counts once per closing.
- Save the final Utang/Piutang item IDs, source kinds/versions, names, initial/paid/remaining amounts, relevant dates, status, and notes needed to read that day's detail independently of live records. Do not copy every version or every intermediate edit. Detailed payment timelines are outside the report scope.
- Include settled active items with zero remaining amount so their closing status can be inspected. Deleted items do not contribute to closing totals. Use the existing receivable derivation and amount rules, including transaction charges/admin, to avoid double counting.
- Generate the review from one coherent database read and calculate totals on the server. Extend the revision guard to relevant debt and receivable transaction changes; this needs revision tracking, not a new change-history log.
- Use a new additive migration and a versioned snapshot extension. Do not rewrite deployed migration 0003, mutate old closing rows, or change the existing `total` field's meaning from Dana tersedia.
- Store the complete extension atomically with the base closing. Preserve uniqueness by business date, actor checks, WIB midnight protection, and safe retries with no partially saved snapshot.
- Older closings have no saved Utang/Piutang. Display **Tidak direkam**, not zero or current values. Preserve Saldo comparisons; the first complete closing establishes a baseline for the newly added totals.
- If today already has a Saldo-only closing, full coverage starts with the next eligible closing. Do not attach today's live debts to an earlier confirmed snapshot.
- Once full snapshots are required, an old Saldo-only review must receive a clear refresh/update instruction. Replays of already-successful closing requests still return their original result.
- Keep fetched daily snapshots cached per account for offline reading. Closing itself remains online-only after synchronization and conflict resolution.

## Implementation sequence

1. Add domain functions for final combined snapshots, component totals/comparisons, receivable deduplication, and legacy coverage.
2. Add the versioned snapshot extension and relevant-record revision tracking, preserving existing closings, records, receipts, and audit storage.
3. Extend review, atomic confirmation, report reads, and account-isolated offline caching.
4. Update Saldo Harian and its review/detail dialogs with the four totals and three snapshot tabs. Remove individual Saldo-edit listings from closing detail in favor of final saved values.
5. Add latest-closing shortcuts from Saldo and Utang & Piutang.
6. Test and document migration, compatibility, and rollback before preparing a release. Implementation and deployment were subsequently authorized by the user.

## Acceptance checks

- If DANA is Rp 1.000.000 at confirmation, the saved row is exactly Rp 1.000.000 regardless of earlier edits.
- Multiple edits to DANA before closing produce one saved final DANA row for that day, not multiple change rows.
- Later edits, renames, deletion, or debt settlement cannot change or invalidate older saved details.
- Historical details and latest-closing shortcuts show saved data and the exact closing date, never today's substituted values.
- Utang and both Piutang sources reconcile with their totals without duplicate counting; settled records contribute zero outstanding amount.
- Component changes remain visible even when grand total is unchanged. Comparisons use compatible saved snapshots, not mutation logs.
- Old Saldo-only closings remain untouched and show missing coverage explicitly; missed dates remain unclosed.
- Relevant changes during review, concurrent closers, duplicate requests, lost responses, and WIB midnight cannot create stale, duplicate, or partial closings.
- No new per-edit history view or storage is introduced; existing internal audit data is preserved.
- Offline reading remains account-isolated; offline or conflicting devices cannot confirm a closing.
- Run appropriate domain/API/migration/synchronization tests, syntax checks, production builds, and isolated Cloudflare preview checks at desktop/mobile widths.
