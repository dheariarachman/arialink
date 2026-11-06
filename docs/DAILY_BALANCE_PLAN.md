# Daily closing balance report — implementation plan

Status: implemented and deployed to production on 1 November 2026. This document records the agreed scope; see [usage and deployment notes](DAILY_BALANCES.md) and [verification](VERIFICATION.md) for the delivered behavior and checks.

## Purpose

Show the confirmed balance at the end of each business day and help users investigate changes, particularly decreases. A decrease is not automatically an error: the report must distinguish a recorded explanation from a missing explanation.

The primary balance is **Dana tersedia = rekening + e-wallet + kas**. Utang and piutang remain separate and are excluded from this closing total.

Balances in ARIALink are maintained manually. Transactions and debt payments do not automatically update them. The report must never infer actual cash movement solely from transaction totals or profit.

## Placement

Add two tabs to **Laporan**:

- **Transaksi & Laba**: existing reporting.
- **Saldo Harian**: month selector, daily closing table, and **Tutup Hari** button.

Selecting a date opens its closing details and account-by-account comparison. Reuse existing cards, tables, dialogs, and DESIGN.md spacing and accessibility rules.

## Daily closing flow

1. The user checks and updates bank, e-wallet, and physical cash values in **Saldo**.
2. In **Laporan → Saldo Harian**, the user clicks **Tutup Hari** for the current WIB date.
3. Synchronize pending changes and load the latest shared balances. Closing requires an authenticated online connection and no unresolved conflicts or pending mutations on the closing device.
4. Show a review containing every account, cash total, combined total, previous confirmed closing date and total, and the difference. State explicitly that values are entered manually.
5. Ask for an explanation of the difference; require it whenever the total differs from the previous confirmed closing. The first closing establishes a baseline and may include an optional note.
6. The user confirms **Simpan saldo penutupan**. The server saves a permanent snapshot and identifies the user and server time.

If balances change after the review opens, reject the stale confirmation and require a refreshed review. Do not silently close using values the user has not reviewed. Unsynchronized changes on other devices cannot be included; tell users to sync those devices before closing.

## Report example

| Tanggal | Saldo akhir | Perubahan | Keterangan |
| --- | ---: | ---: | --- |
| 1 Oct | Rp 12.000 | — | Saldo awal |
| 2 Oct | Rp 15.000 | +Rp 3.000 | Ada penjelasan |
| 3 Oct | Rp 14.000 | −Rp 1.000 | Ada penjelasan |

Opening 3 Oct shows:

| Sumber saldo | Penutupan sebelumnya | Penutupan ini | Perubahan |
| --- | ---: | ---: | ---: |
| BCA | Rp 10.000 | Rp 10.000 | Rp 0 |
| Kas | Rp 5.000 | Rp 4.000 | −Rp 1.000 |
| Total | Rp 15.000 | Rp 14.000 | −Rp 1.000 |

Example explanation: “Pengeluaran operasional Rp 1.000.” Display who closed the day and when. An explanation is a user statement, not an automatic verification of the cause.

## Date and comparison rules

- Use WIB for business dates and server timestamps for confirmation.
- An unclosed past day shows **Belum ditutup**, with no confirmed balance. Do not fabricate a closing by carrying forward the previous value.
- Today can show the current balance as **Sementara** until confirmed. Future dates have no closing action.
- If a day is skipped, compare the next closing against the last confirmed closing and show that date clearly. The difference covers the entire gap, not just the latest day.
- The first closing has no comparison or anomaly classification.
- Every decrease receives a visible text indicator. Use **Perlu ditinjau** when an explanation is absent in historical data; otherwise show that an explanation exists without claiming the decrease is verified.
- A closing is a snapshot at confirmation time. Later changes on the same day do not overwrite it. Show that balances have changed since closing and include those changes in the next closing comparison.
- Initial scope allows one confirmed closing per WIB date, with no backdating, editing, or deletion. A correction/reopening workflow is deferred and must preserve the original if introduced later.

## Stored data and integrity

Use dedicated D1 storage for closings, separate from mutable balance records and the offline mutation queue. Store:

- Unique closing ID and unique WIB business date.
- Server confirmation timestamp and closing user ID, with a historical display name.
- Account IDs, names, categories, exact amounts, and source record versions.
- Cash denomination counts and total.
- Combined available balance, explanation, and reference to the previous confirmed closing.

The server calculates totals, validates the explanation and current business date, verifies source versions, and saves atomically. Use a uniqueness constraint and an idempotency key so retries or concurrent closing attempts cannot create duplicates. A replay must return its original result. An ambiguous network failure must be recoverable by checking the saved closing before retrying.

Compare account identities rather than names. Show new, removed, or renamed accounts explicitly; removing an account from the balance list must not be described as a proven expense. Historical snapshots retain their original names and amounts.

## Balance change history

Retain each successful bank, e-wallet, and cash mutation, including deletions, so a closing detail can offer supporting changes since the previous closing: source, before/after values, timestamp, user, and optional adjustment reason.

Add an **Alasan perubahan** field to **Ubah saldo** and **Catat pecahan kas**. Require a reason for a decrease when saving new changes. Keep a separate closing explanation because it describes the overall difference across accounts.

Existing mutation receipts contain record versions and may support historical reconstruction. Audit their completeness before reuse. If necessary, add dedicated append-only history captured atomically with mutations. Never assume all historical versions exist, and never present reconstructed values as user-confirmed closings. Old days without confirmed snapshots remain unclosed.

## Offline and authorization

- Existing balance entry remains available offline, including adjustment reasons.
- Closing is online only; never show a queued closing as confirmed.
- Cache previously fetched closings per signed-in account for offline reading. Label cached results with the last synchronization time.
- Follow existing shared workspace access: authenticated active users can view and close; the server records the actor. Enforce authentication and existing request-origin checks on all new endpoints.
- All members see the same confirmed closings after synchronization. Logout and account changes preserve cache isolation.

## Implementation sequence

1. Audit existing balance history, mutation retries, synchronization, and report components. Confirm history completeness and document any reconstruction limitations.
2. Add the D1 closing schema and authenticated read/close API with atomic stale-review checks, idempotency, and one-closing-per-date enforcement.
3. Add adjustment reasons and durable balance history without changing manually maintained balance behavior.
4. Add Saldo Harian, month filtering, daily statuses, closing review, and date detail comparisons.
5. Add account-isolated read caching and clear synchronization/error handling.
6. Verify domain and API behavior, then desktop/mobile dialogs, tables, and offline reading in Cloudflare preview. Update deployment and verification documentation.

## Acceptance checks

- Closing totals of Rp 12.000, Rp 15.000, and Rp 14.000 show changes of —, +Rp 3.000, and −Rp 1.000 respectively.
- Per-account changes reconcile exactly to the total difference, including cash and account removal.
- Multiple balance edits in one day preserve supporting history; later edits never alter a confirmed snapshot.
- Missing days stay unclosed, with comparisons explicitly referencing the last confirmed date.
- WIB midnight, first closing, zero balances, renamed/removed accounts, and incomplete historical data are handled correctly.
- Duplicate requests, concurrent users, stale reviews, failed requests, and retry-after-timeout cannot create inconsistent or duplicate closings.
- Unauthenticated and inactive users cannot access or create closings. Client-supplied totals, actor IDs, or dates cannot override server validation.
- Offline changes must synchronize before closing; cached closings remain readable offline and isolated by account.
- Tests cover changed calculations, authorization, history preservation, concurrency, and retries. Run npm test, npm run check, and npm run build; verify UI and offline behavior in Cloudflare preview.

## Outside initial scope

Automatic scheduled closing, automatic balance changes from transactions, expense categorization, automatic proof of a stated cause, backdated closings, reopening/correcting closings, and notifications.
