import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pg from 'pg';
import {
  correlateSwitchShowData,
  SAMPLE_CAMPUS_SHOW_OUTPUTS
} from '../src/utils/ciscoCliParser.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(cors());
app.use(express.json({ limit: '25mb' }));

const PORT = process.env.PORT || 3001;
const DATABASE_URL =
  process.env.DATABASE_URL ||
  'postgresql://cisco:c9300secret@localhost:5433/c9300_topology';

const { Pool } = pg;
const pool = new Pool({
  connectionString: DATABASE_URL,
  connectionTimeoutMillis: 3000
});

let pgConnected = false;
const LOCAL_STORE_PATH = path.join(__dirname, 'local-devices-fallback.json');

// Initialize PostgreSQL tables on startup (with resilient local JSON fallback if Postgres isn't reachable)
async function initDatabase() {
  try {
    const sqlPath = path.join(__dirname, '..', 'db', 'init.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');
    await pool.query(sql);
    pgConnected = true;
    console.log('✅ Connected to PostgreSQL and verified topology schema.');

    // Seed sample campus device if database is empty
    const { rows } = await pool.query('SELECT COUNT(*)::int AS cnt FROM devices');
    if (rows[0].cnt === 0) {
      await upsertDeviceToPg(SAMPLE_CAMPUS_SHOW_OUTPUTS, {
        siteName: 'FDU Metro Campus',
        buildingName: 'Building 4 — IDF-2'
      });
      console.log('🌱 Seeded default Campus C9300-48U device into PostgreSQL.');
    }
  } catch (err) {
    pgConnected = false;
    console.warn(
      '⚠️ PostgreSQL not yet reachable at',
      DATABASE_URL,
      '— using local persistent JSON store until Postgres container starts:',
      err.message
    );
  }
}

async function upsertDeviceToPg(rawInputs, metadata = {}) {
  const parsed = correlateSwitchShowData(rawInputs);
  const dev = parsed.device;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const upsertRes = await client.query(
      `INSERT INTO devices (
        hostname, model, serial_number, ios_version, uptime, base_mac, mgmt_ip,
        site_name, building_name, raw_outputs, parsed_snapshot, updated_at
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,NOW())
      ON CONFLICT (serial_number) DO UPDATE SET
        hostname = EXCLUDED.hostname,
        model = EXCLUDED.model,
        ios_version = EXCLUDED.ios_version,
        uptime = EXCLUDED.uptime,
        base_mac = EXCLUDED.base_mac,
        mgmt_ip = EXCLUDED.mgmt_ip,
        site_name = EXCLUDED.site_name,
        building_name = EXCLUDED.building_name,
        raw_outputs = EXCLUDED.raw_outputs,
        parsed_snapshot = EXCLUDED.parsed_snapshot,
        updated_at = NOW()
      RETURNING *`,
      [
        dev.hostname,
        dev.model,
        dev.serialNumber,
        dev.iosVersion,
        dev.uptime,
        dev.baseMac,
        dev.mgmtIp,
        metadata.siteName || 'Main Campus',
        metadata.buildingName || 'IDF Closet',
        JSON.stringify(rawInputs),
        JSON.stringify(parsed)
      ]
    );

    const deviceRow = upsertRes.rows[0];
    const deviceId = deviceRow.id;

    // Refresh relational child tables for SQL querying
    await client.query('DELETE FROM device_vlans WHERE device_id = $1', [deviceId]);
    for (const v of parsed.vlans) {
      await client.query(
        `INSERT INTO device_vlans (device_id, vlan_id, vlan_name, status, assigned_ports)
         VALUES ($1,$2,$3,$4,$5)`,
        [deviceId, v.vlanId, v.name, v.status, v.ports]
      );
    }

    await client.query('DELETE FROM device_interfaces WHERE device_id = $1', [deviceId]);
    for (const p of parsed.ports48) {
      await client.query(
        `INSERT INTO device_interfaces (
          device_id, interface_name, port_number, port_tier, description,
          oper_status, vlan_tag, duplex, running_speed, configured_speed,
          media_type, ipv4_address, is_trunk, trunk_mode, trunk_encap,
          native_vlan, allowed_vlans, running_config
        ) VALUES ($1,$2,$3,'downlink',$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)`,
        [
          deviceId,
          p.interfaceName,
          p.portNumber,
          p.description,
          p.operStatusRaw,
          String(p.vlan),
          p.duplex,
          p.speed,
          p.configuredSpeed,
          p.mediaType,
          p.ipAddress,
          p.isTrunk,
          p.trunkDetails?.mode || null,
          p.trunkDetails?.encapsulation || null,
          p.trunkDetails?.nativeVlan || null,
          p.trunkDetails?.allowedVlans || null,
          p.runningConfig
        ]
      );
    }

    await client.query('DELETE FROM cdp_neighbors WHERE device_id = $1', [deviceId]);
    for (const n of parsed.cdpNeighbors) {
      await client.query(
        `INSERT INTO cdp_neighbors (
          device_id, local_interface, neighbor_device_id, neighbor_ip,
          neighbor_platform, neighbor_capabilities, neighbor_port,
          software_version, power_watts
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
        ON CONFLICT (device_id, local_interface, neighbor_device_id) DO NOTHING`,
        [
          deviceId,
          n.localInterface,
          n.deviceId,
          n.neighborIp,
          n.platform,
          n.capabilities,
          n.remotePort,
          n.softwareVersion,
          n.powerWatts
        ]
      );
    }

    await client.query('COMMIT');
    return deviceRow;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

function readLocalFallbackDevices() {
  if (!fs.existsSync(LOCAL_STORE_PATH)) {
    const sampleParsed = correlateSwitchShowData(SAMPLE_CAMPUS_SHOW_OUTPUTS);
    const seed = [
      {
        id: 1,
        hostname: sampleParsed.device.hostname,
        model: sampleParsed.device.model,
        serial_number: sampleParsed.device.serialNumber,
        ios_version: sampleParsed.device.iosVersion,
        uptime: sampleParsed.device.uptime,
        mgmt_ip: sampleParsed.device.mgmtIp,
        site_name: 'FDU Metro Campus',
        building_name: 'Building 4 — IDF-2',
        raw_outputs: SAMPLE_CAMPUS_SHOW_OUTPUTS,
        parsed_snapshot: sampleParsed,
        updated_at: new Date().toISOString()
      }
    ];
    fs.writeFileSync(LOCAL_STORE_PATH, JSON.stringify(seed, null, 2));
    return seed;
  }
  return JSON.parse(fs.readFileSync(LOCAL_STORE_PATH, 'utf8'));
}

// Health & Database Engine Status Endpoint
app.get('/api/health', async (_req, res) => {
  try {
    await pool.query('SELECT 1');
    pgConnected = true;
  } catch {
    pgConnected = false;
  }
  res.json({
    ok: true,
    storageEngine: pgConnected ? 'PostgreSQL 16 (Docker)' : 'Local Persistent JSON Store',
    pgConnected
  });
});

// List All Stored Switch Devices
app.get('/api/devices', async (_req, res) => {
  try {
    if (pgConnected) {
      const { rows } = await pool.query(
        'SELECT * FROM devices ORDER BY updated_at DESC'
      );
      return res.json({ storageEngine: 'PostgreSQL 16', devices: rows });
    }
  } catch (err) {
    console.warn('PG query error, falling back:', err.message);
  }
  const devices = readLocalFallbackDevices();
  return res.json({ storageEngine: 'Local JSON Store', devices });
});

// Upload & Parse 7 Show Commands for a Switch Device
app.post('/api/devices/upload-show', async (req, res) => {
  try {
    const { rawInputs = {}, siteName, buildingName } = req.body;
    if (pgConnected) {
      const saved = await upsertDeviceToPg(rawInputs, { siteName, buildingName });
      return res.json({
        ok: true,
        storageEngine: 'PostgreSQL 16',
        device: saved
      });
    }

    // Fallback persistent store
    const parsed = correlateSwitchShowData(rawInputs);
    const list = readLocalFallbackDevices();
    const existingIdx = list.findIndex(
      (d) => d.serial_number === parsed.device.serialNumber
    );
    const record = {
      id: existingIdx >= 0 ? list[existingIdx].id : list.length + 1,
      hostname: parsed.device.hostname,
      model: parsed.device.model,
      serial_number: parsed.device.serialNumber,
      ios_version: parsed.device.iosVersion,
      uptime: parsed.device.uptime,
      mgmt_ip: parsed.device.mgmtIp,
      site_name: siteName || 'Main Campus',
      building_name: buildingName || 'IDF Closet',
      raw_outputs: rawInputs,
      parsed_snapshot: parsed,
      updated_at: new Date().toISOString()
    };
    if (existingIdx >= 0) list[existingIdx] = record;
    else list.unshift(record);
    fs.writeFileSync(LOCAL_STORE_PATH, JSON.stringify(list, null, 2));

    return res.json({
      ok: true,
      storageEngine: 'Local JSON Store',
      device: record
    });
  } catch (err) {
    console.error('Upload error:', err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

initDatabase().then(() => {
  app.listen(PORT, () => {
    console.log(`🚀 Cisco C9300 Topology & CLI Parser API listening on http://localhost:${PORT}`);
  });
});
