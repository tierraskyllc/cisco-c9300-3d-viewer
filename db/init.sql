-- PostgreSQL Relational Schema for Multi-Scale Campus & Global Topology System
-- Stores parsed data from:
-- 1. show version
-- 2. show cdp neighbors detail
-- 3. show int trunk
-- 4. show ip interface brief
-- 5. show interface status
-- 6. show run | section interface
-- 7. show vlan

CREATE TABLE IF NOT EXISTS devices (
  id SERIAL PRIMARY KEY,
  hostname VARCHAR(128) NOT NULL,
  model VARCHAR(64) NOT NULL DEFAULT 'C9300-48U',
  serial_number VARCHAR(64) UNIQUE NOT NULL,
  ios_version VARCHAR(64),
  uptime VARCHAR(128),
  base_mac VARCHAR(32),
  mgmt_ip VARCHAR(64),
  site_name VARCHAR(128) DEFAULT 'Main Campus',
  building_name VARCHAR(128) DEFAULT 'Building 4 IDF-2',
  latitude DOUBLE PRECISION DEFAULT 40.8923,
  longitude DOUBLE PRECISION DEFAULT -74.0285,
  raw_outputs JSONB DEFAULT '{}'::jsonb,
  parsed_snapshot JSONB DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS device_vlans (
  id SERIAL PRIMARY KEY,
  device_id INTEGER NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
  vlan_id INTEGER NOT NULL,
  vlan_name VARCHAR(128) NOT NULL,
  status VARCHAR(32) DEFAULT 'active',
  assigned_ports TEXT[] DEFAULT '{}',
  UNIQUE(device_id, vlan_id)
);

CREATE TABLE IF NOT EXISTS device_interfaces (
  id SERIAL PRIMARY KEY,
  device_id INTEGER NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
  interface_name VARCHAR(64) NOT NULL,
  port_number INTEGER,
  port_tier VARCHAR(32) DEFAULT 'downlink',
  description VARCHAR(255),
  oper_status VARCHAR(32),
  vlan_tag VARCHAR(64),
  duplex VARCHAR(32),
  running_speed VARCHAR(32),
  configured_speed VARCHAR(32),
  media_type VARCHAR(64),
  ipv4_address VARCHAR(64),
  is_trunk BOOLEAN DEFAULT FALSE,
  trunk_mode VARCHAR(32),
  trunk_encap VARCHAR(32),
  native_vlan INTEGER,
  allowed_vlans VARCHAR(255),
  running_config TEXT,
  UNIQUE(device_id, interface_name)
);

CREATE TABLE IF NOT EXISTS cdp_neighbors (
  id SERIAL PRIMARY KEY,
  device_id INTEGER NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
  local_interface VARCHAR(64) NOT NULL,
  neighbor_device_id VARCHAR(128) NOT NULL,
  neighbor_ip VARCHAR(64),
  neighbor_platform VARCHAR(128),
  neighbor_capabilities VARCHAR(128),
  neighbor_port VARCHAR(64),
  software_version TEXT,
  power_watts DOUBLE PRECISION,
  UNIQUE(device_id, local_interface, neighbor_device_id)
);
