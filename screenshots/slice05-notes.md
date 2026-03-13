# Slice 05 Screenshot Notes

## Populated state (above fold)
- File: webdev-preview-1773410704.png (captured via webdev_check_status)
- Shows: KPI strip + Network Throughput chart
- Does NOT show: Top Talkers or Detections table (below fold)
- TypeScript: No errors
- LSP: No errors

## Full dashboard (browser screenshot)
- Browser screenshot shows the entire dashboard including Top Talkers and Detections side-by-side
- Top Talkers: 5 rows with device names, roles (cyan), bytes in/out, total (gold), sparkline trends
- Detections: 6 detections visible with severity badges (CRITICAL red, HIGH orange), MITRE tactic tags (cyan pills), technique IDs, status, relative time
- Summary strip shows: 6 DETECTIONS, 2 crit, 2 high, 1 med, 1 low
- Two-column layout: Top Talkers 2/3 width, Detections 1/3 width
- Note: The webdev_check_status screenshot (slice05-above-fold.png) only shows KPI + chart. The browser screenshot captured via browser_navigate shows the full layout including both panels.
