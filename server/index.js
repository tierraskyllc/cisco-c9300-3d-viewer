import express from 'express';
import cors from 'cors';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';
import pg from 'pg';
import { Client as SshClient } from 'ssh2';
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

// Helper to detect local LAN IP for the Switch Self-Push EEM generator
function getServerLanIp() {
  const nets = os.networkInterfaces();
  for (const name of Object.keys(nets)) {
    for (const net of nets[name] || []) {
      if (net.family === 'IPv4' && !net.internal) {
        return net.address;
      }
    }
  }
  return '127.0.0.1';
}

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
    } else {
      // Re-correlate existing devices so any 24-port models (e.g., C9300-24UX) have accurate port counts & models
      const existing = await pool.query(
        'SELECT id, hostname, raw_outputs, site_name, building_name FROM devices'
      );
      for (const row of existing.rows) {
        if (row.raw_outputs && Object.keys(row.raw_outputs).length > 0) {
          await upsertDeviceToPg(row.raw_outputs, {
            siteName: row.site_name,
            buildingName: row.building_name
          });
        }
      }
      console.log(`🔄 Re-verified ${existing.rows.length} existing switch device(s) in PostgreSQL.`);
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
  const finalMgmtIp = metadata.overrideMgmtIp || dev.mgmtIp;
  parsed.device.mgmtIp = finalMgmtIp;

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
        finalMgmtIp,
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

async function saveDeviceRecord(rawInputs, metadata = {}) {
  if (pgConnected) {
    const saved = await upsertDeviceToPg(rawInputs, metadata);
    return { storageEngine: 'PostgreSQL 16', device: saved };
  }

  const parsed = correlateSwitchShowData(rawInputs);
  if (metadata.overrideMgmtIp) {
    parsed.device.mgmtIp = metadata.overrideMgmtIp;
  }
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
    site_name: metadata.siteName || 'Main Campus',
    building_name: metadata.buildingName || 'IDF Closet',
    raw_outputs: rawInputs,
    parsed_snapshot: parsed,
    updated_at: new Date().toISOString()
  };
  if (existingIdx >= 0) list[existingIdx] = record;
  else list.unshift(record);
  fs.writeFileSync(LOCAL_STORE_PATH, JSON.stringify(list, null, 2));
  return { storageEngine: 'Local JSON Store', device: record };
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

// Execute all 7 Cisco IOS-XE show commands over an interactive SSH2 PTY session
function pollCiscoSwitchViaSsh({
  host,
  port = 22,
  username,
  password,
  enableSecret = '',
  timeoutMs = 300000
}) {
  return new Promise((resolve, reject) => {
    const conn = new SshClient();
    let settled = false;

    const timer = setTimeout(() => {
      if (!settled) {
        settled = true;
        conn.end();
        reject(new Error(`SSH poll timed out after ${Math.round(timeoutMs / 1000)}s connecting to ${host}:${port}`));
      }
    }, timeoutMs);

    const finishError = (err) => {
      if (!settled) {
        settled = true;
        clearTimeout(timer);
        try {
          conn.end();
        } catch {}
        reject(err);
      }
    };

    const COMMAND_PLAN = [
      { key: 'showVersion', cmd: 'show version', label: 'show version' },
      { key: 'showCdpNeighbors', cmd: 'show cdp neighbors detail', label: 'show cdp nei detail' },
      { key: 'showIntTrunk', cmd: 'show interfaces trunk', label: 'show int trunk' },
      { key: 'showIpIntBrief', cmd: 'show ip interface brief', label: 'show ip interface brief' },
      { key: 'showIntStatus', cmd: 'show interfaces status', label: 'show interface status' },
      { key: 'showRunInterface', cmd: 'show running-config | section ^interface', label: 'show run | section interface' },
      { key: 'showVlan', cmd: 'show vlan brief', label: 'show vlan' }
    ];

    conn.on('keyboard-interactive', (_name, _instructions, _lang, prompts, finish) => {
      finish(prompts.map(() => password));
    });

    conn.on('ready', () => {
      conn.shell({ term: 'vt100', cols: 240, rows: 60 }, (err, stream) => {
        if (err) return finishError(err);

        let buffer = '';
        const rawOutputs = {};
        const commandLog = [];

        const waitForPattern = (regex, stepTimeoutMs = 25000) =>
          new Promise((res, rej) => {
            const start = Date.now();
            const check = () => {
              const cleaned = buffer.replace(/\x1b\[[0-9;]*[A-Za-z]/g, '');
              if (regex.test(cleaned)) {
                return res(cleaned);
              }
              if (Date.now() - start > stepTimeoutMs) {
                return rej(new Error(`Timeout waiting for CLI prompt on ${host}`));
              }
              setTimeout(check, 60);
            };
            check();
          });

        const runSession = async () => {
          try {
            // Wait for initial IOS-XE prompt (e.g. Switch> or Switch#)
            await waitForPattern(/[>#]\s*$/, 20000);

            // Elevate to enable mode if currently at user exec prompt (>) and enableSecret is provided
            if (/>\s*$/.test(buffer.trim()) && enableSecret) {
              buffer = '';
              stream.write('enable\n');
              await waitForPattern(/Password:\s*|[>#]\s*$/i, 10000);
              if (/Password:/i.test(buffer)) {
                buffer = '';
                stream.write(`${enableSecret}\n`);
                await waitForPattern(/[>#]\s*$/, 10000);
              }
            }

            // Disable pagination and line wrapping
            for (const initCmd of ['terminal length 0', 'terminal width 511']) {
              buffer = '';
              stream.write(`${initCmd}\n`);
              await waitForPattern(/[>#]\s*$/, 10000);
            }

            // Execute each of the 7 show commands sequentially (120s per command for 300+ neighbor core chassis like mcore-9600 / tcore-9600)
            for (const item of COMMAND_PLAN) {
              const t0 = Date.now();
              buffer = '';
              stream.write(`${item.cmd}\n`);
              const rawText = await waitForPattern(/\r?\n[^\r\n]*[>#]\s*$/, 120000);
              const durationMs = Date.now() - t0;

              // Strip trailing prompt line cleanly while keeping the command header
              const lines = rawText.replace(/\r/g, '').split('\n');
              const cleanedOutput = lines.slice(0, -1).join('\n').trim();
              const isInvalid =
                /% Invalid input detected|% Authorization failed|% Ambiguous command/i.test(
                  cleanedOutput
                );

              rawOutputs[item.key] = isInvalid ? '' : `${ lines[lines.length - 1]?.trim() || 'Switch#' } ${item.cmd}\n${cleanedOutput}`;
              commandLog.push({
                key: item.key,
                command: item.label,
                ok: !isInvalid && cleanedOutput.length > 0,
                bytes: cleanedOutput.length,
                durationMs,
                note: isInvalid ? 'Restricted by privilege level / AAA' : 'OK'
              });
            }

            stream.end('exit\n');
            if (!settled) {
              settled = true;
              clearTimeout(timer);
              conn.end();
              resolve({ rawOutputs, commandLog });
            }
          } catch (runErr) {
            finishError(runErr);
          }
        };

        stream.on('data', (chunk) => {
          buffer += chunk.toString('utf8');
        });

        stream.stderr.on('data', (chunk) => {
          buffer += chunk.toString('utf8');
        });

        runSession();
      });
    });

    conn.on('error', (err) => {
      finishError(err);
    });

    conn.connect({
      host,
      port: Number(port) || 22,
      username,
      password,
      tryKeyboard: true,
      readyTimeout: 12000,
      algorithms: {
        kex: [
          'ecdh-sha2-nistp256',
          'ecdh-sha2-nistp384',
          'ecdh-sha2-nistp521',
          'diffie-hellman-group-exchange-sha256',
          'diffie-hellman-group14-sha256',
          'diffie-hellman-group14-sha1',
          'diffie-hellman-group1-sha1'
        ],
        cipher: [
          'aes128-ctr',
          'aes192-ctr',
          'aes256-ctr',
          'aes128-gcm',
          'aes128-gcm@openssh.com',
          'aes256-gcm',
          'aes256-gcm@openssh.com',
          'aes256-cbc',
          'aes128-cbc',
          '3des-cbc'
        ]
      }
    });
  });
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
    pgConnected,
    serverLanIp: getServerLanIp(),
    serverPort: PORT
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

// Upload & Parse 7 Show Commands for a Switch Device (Manual Upload OR Switch Self-Push Webhook)
app.post('/api/devices/upload-show', async (req, res) => {
  try {
    const { rawInputs = {}, siteName, buildingName, overrideMgmtIp } = req.body;
    const result = await saveDeviceRecord(rawInputs, {
      siteName,
      buildingName,
      overrideMgmtIp
    });
    return res.json({
      ok: true,
      storageEngine: result.storageEngine,
      device: result.device
    });
  } catch (err) {
    console.error('Upload error:', err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

// Live SSH Poll Endpoint: Connects directly to a Cisco Catalyst switch & runs all 7 show commands
app.post('/api/devices/live-ssh-poll', async (req, res) => {
  try {
    const {
      host,
      port = 22,
      username,
      password,
      enableSecret = '',
      siteName = 'FDU Metro Campus',
      buildingName = 'Live SSH Polled IDF'
    } = req.body;

    if (!host || !username || !password) {
      return res.status(400).json({
        ok: false,
        error: 'Switch IP/Hostname, SSH Username, and SSH Password are required.'
      });
    }

    const { rawOutputs, commandLog } = await pollCiscoSwitchViaSsh({
      host: String(host).trim(),
      port: Number(port) || 22,
      username: String(username).trim(),
      password: String(password),
      enableSecret: String(enableSecret || '')
    });

    const saved = await saveDeviceRecord(rawOutputs, {
      siteName,
      buildingName,
      overrideMgmtIp: String(host).trim()
    });

    return res.json({
      ok: true,
      storageEngine: saved.storageEngine,
      device: saved.device,
      rawOutputs,
      commandLog
    });
  } catch (err) {
    console.error('Live SSH Poll error:', err.message);
    return res.status(502).json({
      ok: false,
      error: err.message || 'Failed to poll switch over SSH.'
    });
  }
});

// Local fallback file for saved topology layouts when Postgres is unreachable
const LOCAL_LAYOUTS_PATH = path.join(__dirname, 'local-layouts-fallback.json');

function readLocalLayouts() {
  try {
    if (fs.existsSync(LOCAL_LAYOUTS_PATH)) {
      return JSON.parse(fs.readFileSync(LOCAL_LAYOUTS_PATH, 'utf8'));
    }
  } catch {
    // ignore
  }
  return {};
}

function writeLocalLayouts(layouts) {
  try {
    fs.writeFileSync(LOCAL_LAYOUTS_PATH, JSON.stringify(layouts, null, 2), 'utf8');
  } catch {
    // ignore
  }
}

// Get Saved Custom Topology Layout (2D Isometric Blueprint or 3D Multi-Device Scene)
app.get('/api/topology/layouts/:key', async (req, res) => {
  const { key } = req.params;
  try {
    if (pgConnected) {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS topology_layouts (
          layout_key VARCHAR(128) PRIMARY KEY,
          layout_data JSONB NOT NULL DEFAULT '{}'::jsonb,
          updated_at TIMESTAMPTZ DEFAULT NOW()
        )
      `);
      const { rows } = await pool.query(
        'SELECT layout_data, updated_at FROM topology_layouts WHERE layout_key = $1',
        [key]
      );
      if (rows.length > 0) {
        return res.json({
          ok: true,
          storageEngine: 'PostgreSQL 16',
          layoutKey: key,
          layoutData: rows[0].layout_data,
          updatedAt: rows[0].updated_at
        });
      }
    }
  } catch (err) {
    console.warn('PG layout read warning:', err.message);
  }

  const localLayouts = readLocalLayouts();
  return res.json({
    ok: true,
    storageEngine: pgConnected ? 'PostgreSQL 16' : 'Local JSON Store',
    layoutKey: key,
    layoutData: localLayouts[key] || null,
    updatedAt: null
  });
});

// Save / Update Custom Topology Layout (2D Isometric Blueprint or 3D Multi-Device Scene)
app.post('/api/topology/layouts/:key', async (req, res) => {
  const { key } = req.params;
  const { layoutData = {} } = req.body || {};

  // Always update local fallback cache as well
  const localLayouts = readLocalLayouts();
  localLayouts[key] = layoutData;
  writeLocalLayouts(localLayouts);

  try {
    if (pgConnected) {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS topology_layouts (
          layout_key VARCHAR(128) PRIMARY KEY,
          layout_data JSONB NOT NULL DEFAULT '{}'::jsonb,
          updated_at TIMESTAMPTZ DEFAULT NOW()
        )
      `);
      const { rows } = await pool.query(
        `INSERT INTO topology_layouts (layout_key, layout_data, updated_at)
         VALUES ($1, $2, NOW())
         ON CONFLICT (layout_key) DO UPDATE SET
           layout_data = EXCLUDED.layout_data,
           updated_at = NOW()
         RETURNING updated_at`,
        [key, JSON.stringify(layoutData)]
      );
      return res.json({
        ok: true,
        storageEngine: 'PostgreSQL 16',
        layoutKey: key,
        updatedAt: rows[0]?.updated_at
      });
    }
  } catch (err) {
    console.warn('PG layout save warning:', err.message);
  }

  return res.json({
    ok: true,
    storageEngine: 'Local JSON Store',
    layoutKey: key,
    updatedAt: new Date().toISOString()
  });
});

// Reset / Delete Saved Topology Layout
app.delete('/api/topology/layouts/:key', async (req, res) => {
  const { key } = req.params;
  const localLayouts = readLocalLayouts();
  delete localLayouts[key];
  writeLocalLayouts(localLayouts);

  try {
    if (pgConnected) {
      await pool.query('DELETE FROM topology_layouts WHERE layout_key = $1', [key]);
    }
  } catch (err) {
    console.warn('PG layout delete warning:', err.message);
  }

  return res.json({ ok: true, layoutKey: key });
});

initDatabase().then(() => {
  app.listen(PORT, () => {
    console.log(`🚀 Cisco C9300 Topology & CLI Parser API listening on http://localhost:${PORT}`);
  });
});

