# Slice 30 — ExtraHop API Research: Device Activity

## Key Finding: GET /api/v1/devices/{id}/activity

The ExtraHop REST API provides a dedicated endpoint for device activity:

**Endpoint**: `GET /api/v1/devices/{id}/activity`
**Description**: Retrieve all activity for a device.

The response returns a list of metric activity records for the device. Each record contains:
- `id` — activity record ID
- `stat_name` — the metric category (e.g., "net", "http_client", "dns_client")
- `from_time` — start time of the activity window (epoch ms)
- `until_time` — end time of the activity window (epoch ms)
- `mod_time` — last modification time (epoch ms)

The `stat_name` value matches the `metric_category` value in the metric_catalog, after the final dot.

## Mapping to fact_device_activity Table

| ExtraHop API Field | DB Column | Notes |
|-------------------|-----------|-------|
| (auto) | id | Auto-increment PK |
| (from response) | raw_id | The activity record ID from ExtraHop |
| (from response) | activity_id | Unique activity identifier |
| (from URL) | device_id | The device ID from the request |
| from_time | from_time | Epoch ms |
| until_time | until_time | Epoch ms |
| mod_time | mod_time | Epoch ms |
| stat_name | stat_name | Metric category name |
| (now()) | polled_at | When we fetched this data |

## ETL Strategy

1. **On-demand**: When device-detail is requested in live mode, also call GET /api/v1/devices/{id}/activity
2. **Upsert**: Use activity_id as the unique key to avoid duplicates
3. **Normalize**: Map raw ExtraHop response fields to the DB schema
4. **Return**: Query the DB for the device's activity records and include in the response
