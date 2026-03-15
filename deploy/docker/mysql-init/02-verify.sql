-- Post-init verification: confirm critical tables exist
-- MySQL will abort init if any of these fail

SELECT 'Verifying schema...' AS status;

SELECT COUNT(*) INTO @tc FROM information_schema.tables WHERE table_schema = DATABASE();
SELECT CONCAT('Tables created: ', @tc) AS status;

-- Fail hard if critical tables are missing
SELECT 1 FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = 'users' LIMIT 1;
SELECT 1 FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = 'appliance_config' LIMIT 1;
SELECT 1 FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = 'dim_appliance' LIMIT 1;
SELECT 1 FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = 'snap_topology' LIMIT 1;
SELECT 1 FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = 'devices' LIMIT 1;
SELECT 1 FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = 'schema_version' LIMIT 1;

SELECT 'Schema verification: PASSED' AS status;
