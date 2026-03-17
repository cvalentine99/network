-- ============================================================================
-- 03-indexes.sql — Performance indexes and constraints
-- Addresses: DB-C1, DB-H1, DB-H2, DB-H3, DB-H4, DB-H6, DB-H8
-- ============================================================================

-- DB-C1: Indexes on raw_api_response (grows unbounded, needs time/host filtering)
CREATE INDEX idx_raw_api_response_capture_time
  ON raw_api_response (capture_time);
CREATE INDEX idx_raw_api_response_host_endpoint
  ON raw_api_response (eh_host, endpoint_name);
CREATE INDEX idx_raw_api_response_endpoint_time
  ON raw_api_response (endpoint_name, capture_time);

-- DB-H1: Index on fact_metric_stat.metric_response_id (used in vw_metric_latest_by_object join)
CREATE INDEX idx_fact_metric_stat_response_id
  ON fact_metric_stat (metric_response_id);

-- DB-H2: Index on fact_record.search_id (used in v_record_searches correlated subquery)
CREATE INDEX idx_fact_record_search_id
  ON fact_record (search_id);

-- DB-H3: Index on fact_device_activity.device_id
CREATE INDEX idx_fact_device_activity_device_id
  ON fact_device_activity (device_id);

-- DB-H4: Indexes on snapshot table device_id columns
CREATE INDEX idx_snap_device_ipaddr_device_id
  ON snap_device_ipaddr (device_id);
CREATE INDEX idx_snap_device_dnsname_device_id
  ON snap_device_dnsname (device_id);
CREATE INDEX idx_snap_device_software_device_id
  ON snap_device_software (device_id);

-- DB-H6: Index on snap_topology.polled_at for scalar subqueries in topology views
CREATE INDEX idx_snap_topology_polled_at
  ON snap_topology (polled_at);
CREATE INDEX idx_snap_topology_node_topology_id
  ON snap_topology_node (topology_id);
CREATE INDEX idx_snap_topology_edge_topology_id
  ON snap_topology_edge (topology_id);

-- DB-H8: UNIQUE constraint on appliance_config.hostname
CREATE UNIQUE INDEX idx_appliance_config_hostname_unique
  ON appliance_config (hostname);
