# Slice 31 — Screenshot Evidence

## Activity Timeline — Populated State (Fixture Mode)

**Device:** dc01.lab.local (ID 1042)
**Screenshot captured:** 2026-03-15T10:37Z

**Visible in inspector panel:**
- ACTIVITY TIMELINE section header with Activity icon
- Time axis labels: "Mar 12, 11:00 AM" — "Mar 12, 11:10 AM"
- 7 protocol rows with color-coded horizontal bars:
  - DNS_CLIENT (green)
  - HTTP_CLIENT (cyan)
  - KERBEROS_CLIENT (red)
  - LDAP_CLIENT (amber)
  - NET (gold, two segments)
  - SMB_CLIENT (orange)
  - SSL_CLIENT (purple)
- Summary line: "7 protocols · 8 records" and "11:00 AM — 11:10 AM"

**All 4 UI states implemented:**
- Loading: Spinner with "Loading activity timeline…" text
- Populated: Timeline bars with protocol colors (visible in screenshot)
- Quiet: Clock icon with "No protocol activity recorded for this device."
- Error: AlertTriangle icon with error/message text

## Health Endpoint — ETL Status (Fixture Mode)

**Endpoint:** GET /api/bff/health
**Response includes:** `"etl": null` (ETL not running in fixture mode)
**Schema validation:** BffHealthResponseSchema passes with etl field

## Device Activity Route — Fixture Mode

**Endpoint:** GET /api/bff/impact/device-activity?id=1042
**Response:** 8 activity rows with valid schema
**Input validation:** Returns 400 for invalid/missing device ID
