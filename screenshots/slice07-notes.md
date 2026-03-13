# Slice 07 — Appliance Status Footer Screenshots

## Above-fold screenshot
- File: slice07-above-fold.png
- Shows: Full Impact Deck from top through KPI Strip, chart, top talkers, detections
- Footer is below the fold (expected — it's the last element on the page)

## Below-fold screenshot (scrolled to bottom)
- File: slice07-below-fold.png
- Shows: Top Talkers table, Detections panel, Alerts grid (6 cards), and Appliance Footer
- Footer visible at very bottom of page
- Footer renders in **quiet state**: gray dot + message "Appliance not configured — configure appliance connection settings to enable sensor monitoring"
- This is correct behavior: BFF is in fixture mode (no EH_HOST/EH_API_KEY), so connectionStatus = not_configured with empty hostname → quiet state

## State coverage
- **Loading**: Transient pulse animation skeleton. Not separately captured (< 200ms on local dev).
- **Quiet**: Visible in below-fold screenshot. Gray dot + configuration message.
- **Populated**: Not visible in current fixture mode. Would show hostname, version, edition, capture/license/connection status indicators, modules, mgmt IP, BFF uptime. Proven by code path and populated fixture passing ApplianceStatusSchema.
- **Error**: Not separately screenshotted. Renders ErrorState type="transport". Proven by code path and test.
- **Malformed**: Not separately screenshotted. Renders ErrorState type="contract". Proven by code path and test.
