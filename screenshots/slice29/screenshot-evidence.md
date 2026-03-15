# Slice 29 — Screenshot Evidence

## 1. Health Endpoint — Fixture Mode
- **URL**: `GET /api/bff/health`
- **Status**: `not_configured` (honest — no appliance configured)
- **Cache**: `{ size: 0, maxSize: 500 }` (real TTL cache stats)
- **Appliance**: `null` (honest — no appliance configured)
- **Timestamp**: Valid ISO string
- **Evidence**: `health-fixture-mode-response.json`

## 2. Impact Deck — Fixture Mode (Populated)
- **URL**: `/` (Impact Deck)
- **State**: Populated with fixture data
- **KPI Strip**: Total Bytes 7.96 GB, Total Packets 12.45M, Throughput 27.17 MB/s, Packet Rate 41.50K pps, Baseline Delta +12.3%
- **Throughput Chart**: Rendered with time-series data
- **Top Talkers**: 4 devices visible (dc01.lab.local, nas01.lab.local, web-proxy-01, db-replica-02)
- **Detections**: 6 detections (2 critical, 2 high, 1 medium, 1 low)
- **Alerts**: 6 configured alerts visible
- **Correlation Events**: 8 events with category badges
- **Sidebar**: Shows "FIXTURE MODE — DEMO DATA" badge (honest labeling)
- **Evidence**: Browser screenshot captured (viewport screenshot in task context)

## 3. Fixture Mode Badge
- Visible in sidebar footer: "FIXTURE MODE — DEMO DATA"
- This is the DataSourceBadge component from Slice 28
- Dynamically determined via `useDataSourceMode` hook querying `GET /api/bff/health`

## 4. Live Mode Screenshots
- **Not captured**: Live mode requires a real ExtraHop appliance
- **Deferred by contract**: live hardware / appliance / packet store / environment access is not part of the current frontend phase

## Screenshot State Coverage

| State | Captured | Evidence |
|-------|----------|----------|
| Fixture mode — populated | Yes | Browser screenshot, JSON response |
| Fixture mode — health endpoint | Yes | health-fixture-mode-response.json |
| Fixture mode — badge visible | Yes | Browser screenshot shows "FIXTURE MODE — DEMO DATA" |
| Live mode — connected | No | Deferred by contract |
| Live mode — degraded | No | Deferred by contract |
| Live mode — error | No | Deferred by contract |
