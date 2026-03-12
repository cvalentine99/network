# Slice 02 — KPI Strip Screenshot Evidence

## Populated State
- Screenshot captured via browser at /
- Shows 5 KPI cards in a horizontal strip:
  - Total Bytes: 7.96 GB
  - Total Packets: 12.45M pkts
  - Throughput: 27.17 MB/s
  - Packet Rate: 41.50K pps
  - Baseline Delta: +12.3% with ▲ indicator
- Each card has gold accent top line, icon, and monospace value
- Time window selector shows "Last 5 minutes" with resolved time range
- Data is from fixture (BFF in fixture mode, no live ExtraHop)
- Inspector toggle visible in top-right

## Quiet State
- To be captured (requires quiet fixture response)

## Loading State
- Transient state; visible briefly during fetch. 5 skeleton cards render.

## Error State
- To be captured (requires transport failure simulation)

## Malformed State
- To be captured (requires malformed data injection)
