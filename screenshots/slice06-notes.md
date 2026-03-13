# Slice 06 Screenshot Notes

## slice06-above-fold.png
- Captured via webdev_check_status
- Shows: KPI strip (5 cards), Network Throughput chart, time window selector
- Does NOT show: Top Talkers, Detections, or Alerts panels (below fold)

## slice06-alerts-panel.png (browser scroll to bottom)
- Captured via browser scroll to bottom of page
- Shows: Top Talkers table, Recent Detections panel, and CONFIGURED ALERTS panel
- Alerts panel title: "CONFIGURED ALERTS (6 ACTIVE)"
- 6 alert cards visible in 3-column grid:
  - Row 1: "High Packet Loss Detected" (CRITICAL/THRESHOLD), "DNS Latency Spike" (CRITICAL/THRESHOLD), "Unusual Outbound Volume" (HIGH/THRESHOLD)
  - Row 2: "HTTP 5xx Error Rate" (HIGH/THRESHOLD), "New Device on Network" (MEDIUM/DETECTION), "Low Traffic Warning" (LOW/THRESHOLD)
- Each card shows: severity badge, alert type pill, name, metric expression (monospace), description
- Severity badges use color coding: red=critical, orange=high, yellow=medium, green=low
- Alert type pills: THRESHOLD or DETECTION
- Metric expressions shown in monospace font (e.g., "extrahop.device.net pkts_dropped > 500")
- Layout: 3-column responsive grid
- Below alerts: placeholder "Additional Impact Deck panels will be built in subsequent slices"
