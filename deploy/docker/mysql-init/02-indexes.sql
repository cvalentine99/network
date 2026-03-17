-- =====================================================================
-- Rec 8: Database indexes for query optimization
-- Applied after 01-schema.sql. Safe to re-run (IF NOT EXISTS).
-- =====================================================================

-- dim_device: filtered by deviceClass, role, analysis, critical, onWatchlist
CREATE INDEX IF NOT EXISTS idx_dim_device_class ON dim_device (device_class);
CREATE INDEX IF NOT EXISTS idx_dim_device_role ON dim_device (role);
CREATE INDEX IF NOT EXISTS idx_dim_device_analysis ON dim_device (analysis);
CREATE INDEX IF NOT EXISTS idx_dim_device_critical ON dim_device (critical);
CREATE INDEX IF NOT EXISTS idx_dim_device_watchlist ON dim_device (on_watchlist);
CREATE INDEX IF NOT EXISTS idx_dim_device_last_seen ON dim_device (last_seen_time);

-- dim_alert: filtered by severity, type, disabled
CREATE INDEX IF NOT EXISTS idx_dim_alert_severity ON dim_alert (severity);
CREATE INDEX IF NOT EXISTS idx_dim_alert_type ON dim_alert (type);
CREATE INDEX IF NOT EXISTS idx_dim_alert_disabled ON dim_alert (disabled);

-- dim_detection: filtered by type, risk_score, status; sorted by updateTime
CREATE INDEX IF NOT EXISTS idx_dim_detection_type ON dim_detection (type);
CREATE INDEX IF NOT EXISTS idx_dim_detection_status ON dim_detection (status);
CREATE INDEX IF NOT EXISTS idx_dim_detection_risk ON dim_detection (risk_score);
CREATE INDEX IF NOT EXISTS idx_dim_detection_update ON dim_detection (update_time);

-- fact_metric_stat: critical for vw_metric_latest_by_object correlated subquery
CREATE INDEX IF NOT EXISTS idx_fact_metric_stat_oid_time ON fact_metric_stat (oid, stat_time);
CREATE INDEX IF NOT EXISTS idx_fact_metric_stat_response ON fact_metric_stat (metric_response_id);

-- fact_metric_response: filtered by metric_category, object_type; sorted by polled_at
CREATE INDEX IF NOT EXISTS idx_fact_metric_response_cat ON fact_metric_response (metric_category);
CREATE INDEX IF NOT EXISTS idx_fact_metric_response_cat_obj ON fact_metric_response (metric_category, object_type);

-- fact_device_activity: filtered by deviceId; sorted by fromTime
CREATE INDEX IF NOT EXISTS idx_fact_device_activity_device ON fact_device_activity (device_id);
CREATE INDEX IF NOT EXISTS idx_fact_device_activity_device_time ON fact_device_activity (device_id, from_time);

-- snap_topology: sorted by polled_at (for latest topology query)
CREATE INDEX IF NOT EXISTS idx_snap_topology_polled ON snap_topology (polled_at);

-- snap_topology_node / snap_topology_edge: filtered by topology_id
CREATE INDEX IF NOT EXISTS idx_snap_topology_node_topo ON snap_topology_node (topology_id);
CREATE INDEX IF NOT EXISTS idx_snap_topology_edge_topo ON snap_topology_edge (topology_id);

-- bridge tables: filtered by device_id
CREATE INDEX IF NOT EXISTS idx_bridge_device_tag_device ON bridge_device_tag (device_id);
CREATE INDEX IF NOT EXISTS idx_bridge_device_group_device ON bridge_device_device_group (device_id);

-- snap_device_*: filtered by device_id + is_current
CREATE INDEX IF NOT EXISTS idx_snap_device_ipaddr_device ON snap_device_ipaddr (device_id, is_current);
CREATE INDEX IF NOT EXISTS idx_snap_device_dnsname_device ON snap_device_dnsname (device_id, is_current);
CREATE INDEX IF NOT EXISTS idx_snap_device_software_device ON snap_device_software (device_id, is_current);

-- fact_record / fact_record_search
CREATE INDEX IF NOT EXISTS idx_fact_record_search ON fact_record (search_id);
CREATE INDEX IF NOT EXISTS idx_fact_record_search_polled ON fact_record_search (polled_at);

-- saved_topology_views: filtered by user_id
CREATE INDEX IF NOT EXISTS idx_saved_views_user ON saved_topology_views (user_id);

-- raw_api_response: filtered by endpoint_name, eh_host
CREATE INDEX IF NOT EXISTS idx_raw_api_response_endpoint ON raw_api_response (endpoint_name);
CREATE INDEX IF NOT EXISTS idx_raw_api_response_host ON raw_api_response (eh_host);
