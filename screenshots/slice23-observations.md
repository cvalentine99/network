# Slice 23 — Cross-Surface Navigation Screenshot Observations

## slice23-topology-crossnav.png
- Topology page renders with 15 nodes, 20 edges, 3 clusters
- The node detail panel is not visible in this screenshot because no node is clicked
- The cross-nav button ("Blast Radius: {device}") would appear in the detail panel when a node is selected
- Sidebar navigation shows all surfaces including Blast Radius and Flow Theater

## slice23-correlation-crossnav.png
- Correlation page shows 8 events across 7 categories in the event feed
- Category filter pills are visible and functional
- Event rows are collapsed; the cross-nav buttons appear in the expanded EventDetailCard
- When a device/IP/hostname ref is present, it renders as a CrossSurfaceNavButton instead of a plain span
- Non-navigable refs (protocol, detection, alert) still render as plain spans

## slice23-blast-radius-crossnav.png
- Blast Radius page loaded with nav params: brMode=device-id, brValue=1042, brAuto=1
- The entry form shows the pre-filled values from the URL params
- The auto-submit triggered a query (loading/error state visible since BFF returns fixture response)
- The "Trace in Flow Theater" button appears in expanded peer rows

## slice23-flow-theater-crossnav.png
- Flow Theater page loaded with nav params: ftMode=hostname, ftValue=dc01.lab.local, ftAuto=1
- The entry form shows the pre-filled hostname value
- The auto-submit triggered a trace (loading state visible)
- The "Blast Radius: {device}" button appears next to the resolved device in the trace summary

## slice23-blast-radius-idle.png
- Blast Radius page in idle state (no nav params)
- Entry form is empty and ready for manual input
- No cross-nav buttons visible in idle state (correct behavior)

## Notes
- Cross-nav buttons only appear in context-appropriate locations (expanded detail panels, resolved device summaries)
- The compact variant is used for inline refs in Correlation event details
- The standard variant is used for standalone buttons in Topology, Blast Radius, and Flow Theater
- All navigation is via relative URLs (no absolute URLs, no ExtraHop hostnames)
- Time window is preserved across navigation (shared TimeWindowProvider)
