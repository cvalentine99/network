# Project TODO

- [x] Slice 00 — Contract Harness + Shell
- [x] Slice 01 — Metrics Normalization Core
- [x] Slice 02 — Impact Deck KPI Strip
- [x] Slice 03 — Impact Deck Time-Series Chart
- [x] Slice 04 — Top Talkers Table
- [x] Slice 05 — Detections Panel
- [x] Slice 06 — Alerts Panel
- [x] KPI card text truncation fix (c2ecd1ce)
- [x] Document architectural drift (decomposed BFF routes vs single fan-out)
- [x] Update CONTRACTS.md truncation note as superseded (9afe240e)
- [x] Slice 07 — Appliance Status Footer (types, validators, fixtures, BFF route, hook, component, tests)
- [x] Slice 08 — Inspector Shell Wiring: shared inspector types, selection context, click handlers on Top Talkers/Detections/Alerts rows, InspectorShell content routing, fixtures, tests, screenshot, truth receipt
- [x] Slice 09 — Device Detail Inspector Pane: DeviceDetail type, Zod validator, BFF route GET /api/bff/impact/device-detail, useDeviceDetail hook, DeviceDetailPane component (activity summary, associated detections/alerts, protocol breakdown), fixtures, tests, screenshots, truth receipt
- [x] Slice 10 — PCAP Download Contract: PcapRequest/PcapMetadata types, Zod validators, BFF route POST /api/bff/packets/download (binary), usePcapDownload hook, download trigger in DeviceDetailPane, fixtures, tests, screenshot, truth receipt
- [ ] Below-fold screenshots for Slices 04-06
- [ ] Responsive breakpoint audit for 5-column KPI grid
