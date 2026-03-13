# Slice 08 — Inspector Shell Wiring Screenshot Notes

## Screenshot 1: Populated state — Device Inspector open
- Captured after clicking dc01.lab.local row in Top Talkers table
- Inspector panel opened on the right side with title "Device Inspector"
- Device identity shown: dc01.lab.local, 10.10.1.50
- Identity section: ID 1042, MAC 02:42:AC:11:00:02, Role domain_controller, Vendor Microsoft, Class node, Software Windows Server 2022, Analysis advanced
- Traffic section: Bytes In 1.16 GB, Bytes Out 941.90 MB, Total 2.08 GB, Pkts In 1,890,000, Pkts Out 1,456,000
- Flags section: CRITICAL, WATCHLIST, L3 badges visible
- Row 1 (dc01.lab.local) has a subtle gold-tinted background indicating selection
- Close button (X) visible in inspector header
- All other panels (KPI strip, chart, detections, alerts) still visible behind the inspector

## Observation: Row highlighting
- The selected row has a visible gold-tinted background (oklch(0.769 0.108 85.805 / 8%))
- Other rows remain default background

## Observation: Inspector title
- Title correctly shows "Device Inspector" (not generic "Inspector")

## Screenshot 2: Detection Inspector open
- Captured after clicking "Lateral Movement via SMB" detection row
- Inspector title: "Detection Inspector"
- Header: "Lateral Movement via SMB" with CRITICAL badge and RISK 92
- Detection section: ID 4001, Type lateral_movement, Status new
- Timeline section: Start/End/Created ISO timestamps
- MITRE ATT&CK section: LATERAL MOVEMENT tactic pill, T1021.002 technique pill
- Participants section: OFFENDER device:101, VICTIM device:205
- Detection row has gold-tinted highlight
- Previous device row selection cleared (no highlight on Top Talkers rows)
