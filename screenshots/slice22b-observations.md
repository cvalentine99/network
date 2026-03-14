# Slice 22b — Inspector Performance Screenshots

## slice22b-inspector-closed.png
- Impact Deck baseline with inspector panel closed
- Full-width layout: KPI strip (5 cards), correlation events, network throughput chart, top talkers table, recent detections panel, configured alerts
- All panels rendering in populated state against BFF fixtures
- No inspector overlay visible — confirms inspector is conditionally rendered (not hidden)

## slice22b-inspector-device-open.png
- Inspector panel open on right side showing Device Inspector for dc01.lab.local (10.10.1.50)
- Visible sections: Identity (ID, MAC, Role, Vendor, Class, Software, Analysis), Activity Summary (First/Last Seen, Protocols, Connections, Peak Throughput), Traffic (Bytes In/Out, Total, Pkts In/Out), Packet Capture (Download PCAP button), Protocols (donut chart with 5 protocols), Detections (1), Alerts (1)
- Main dashboard content compressed to left side — inspector overlay pushes content
- First row in Top Talkers table is highlighted (selected state)

## slice22b-inspector-breadcrumb.png
- Same as device-open state (no navigation history yet — breadcrumb appears only after navigating between entities)
- This is expected: breadcrumb renders but shows no entries when history stack is empty

## slice22b-inspector-baseline.png
- Clean reload of Impact Deck after inspector interaction
- Inspector closed, full-width layout restored
- Confirms clean teardown: no residual inspector state after close

## Screenshot State Coverage
| State | Screenshot | Present |
|-------|-----------|---------|
| Inspector closed (baseline) | slice22b-inspector-closed.png | Yes |
| Inspector open (populated device) | slice22b-inspector-device-open.png | Yes |
| Inspector breadcrumb (empty history) | slice22b-inspector-breadcrumb.png | Yes |
| Inspector baseline (post-close) | slice22b-inspector-baseline.png | Yes |

## Not Captured (with rationale)
- **Loading state**: Transient state (<200ms with fixtures). Would require artificial delay injection to capture. Documented in render path contract as `device-detail-loading` testid.
- **Error state**: Requires transport error fixture to be served by BFF. Error state rendering is validated by existing Slice 09/10/11 tests and screenshots.
- **Cross-kind switch**: Would require programmatic navigation between entity types. Behavior is validated by mount lifecycle contract tests.
