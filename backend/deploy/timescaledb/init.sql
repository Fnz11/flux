-- deploy/timescaledb/init.sql
-- Runs once on first container start (mounted to /docker-entrypoint-initdb.d).
-- MUST complete before any other agent's migration runs: agents 2/3/4
-- (hypertables, indexes, materialized views) depend on this extension.
CREATE EXTENSION IF NOT EXISTS timescaledb;

-- timescaledb.license=timescale is set explicitly in docker-compose.yml
-- via: command: ["postgres", "-c", "timescaledb.license=timescale"]
-- (TimescaleDB is Apache-2.0; the license GUC just documents intent and
-- keeps the timescale extensions enabled in the image).

-- Verify after startup:
--   SELECT extversion FROM pg_extension WHERE extname = 'timescaledb';
--   SHOW timescaledb.license;
