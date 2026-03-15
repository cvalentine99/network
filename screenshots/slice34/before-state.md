# BEFORE STATE — Split-brain mode fix

## /api/bff/health
```json
{
    "status": "not_configured",
    "bff": { "uptime": 1324.5, "memoryMB": 99, "cache": { "size": 0, "maxSize": 500 } },
    "appliance": null,
    "etl": null,
    "timestamp": "2026-03-15T17:05:25.159Z"
}
```
Status is "not_configured" even though appliance_config DB row has real credentials.

## /api/bff/impact/headline
```json
{
    "headline": {
        "totalBytes": 8547321600,
        "totalPackets": 12450000,
        "bytesPerSecond": 28491072,
        "packetsPerSecond": 41500,
        "baselineDeltaPct": 12.3
    }
}
```
Returns fixture data (hardcoded values from fixture JSON) instead of querying ExtraHop.
