import React, { useState, useMemo, useEffect } from 'react';
import {
  correlateSwitchShowData,
  SAMPLE_CAMPUS_SHOW_OUTPUTS
} from '../utils/ciscoCliParser';
import {
  Upload,
  Database,
  CheckCircle2,
  Sparkles,
  X,
  Terminal,
  Wifi,
  Copy,
  Check,
  Shield,
  Play,
  AlertCircle,
  RefreshCw,
  Code2
} from 'lucide-react';

// In-memory session vault (never persisted to disk or localStorage)
const SESSION_SSH_VAULT = {
  username: '',
  password: '',
  enableSecret: '',
  port: 22,
  rememberInSession: true
};

const COMMAND_TABS = [
  {
    id: 'combinedText',
    cmd: 'All-in-One Session Log',
    subtitle: 'Paste or upload a single terminal log containing any or all 7 show commands',
    extracts: 'Auto-detects show version, cdp, trunk, ip int brief, status, run intf, and vlan'
  },
  {
    id: 'showVersion',
    cmd: 'show version',
    subtitle: 'Device IOS-XE Version, Model SKU (24/48-Port) & System Serial Number',
    extracts: 'IOS-XE version, Model (e.g. C9300-24UX / C9300-48U), Serial Number, Hostname, Uptime, Stack Members'
  },
  {
    id: 'showCdpNeighbors',
    cmd: 'show cdp nei detail',
    subtitle: 'Physically Connected Neighbors, Interfaces & IPv4 Addresses',
    extracts: 'Neighbor Device ID, Neighbor IPv4 Address, Local Interface, Remote Port, Platform, PoE Draw'
  },
  {
    id: 'showIntTrunk',
    cmd: 'show int trunk',
    subtitle: '802.1Q Trunk Interfaces, Native VLANs & Allowed VLANs',
    extracts: 'Trunk interfaces (Gi/Te/Po), Mode (on/desirable), 802.1q Encap, Native VLAN, Allowed VLAN list'
  },
  {
    id: 'showIpIntBrief',
    cmd: 'show ip interface brief',
    subtitle: 'IPv4 Addressing Across SVIs, Mgmt & Routed Interfaces',
    extracts: 'Interface IPv4 Addresses (Vlan10, Vlan20, Gi0/0), Method, Line & Protocol Status'
  },
  {
    id: 'showIntStatus',
    cmd: 'show interface status',
    subtitle: 'Per-Port Link Status, Running Speed, Set Speed & Description Name',
    extracts: 'Connected/Notconnect/Disabled/Err-disabled, Running Speed, Configured Speed, Duplex, Description'
  },
  {
    id: 'showRunInterface',
    cmd: 'show run | section interface',
    subtitle: 'Full Per-Interface Running Configuration Stanzas',
    extracts: 'Complete CLI block per interface (description, access/voice/trunk vlan, speed/duplex, poe, channel-group)'
  },
  {
    id: 'showVlan',
    cmd: 'show vlan',
    subtitle: 'VLAN ID Numbers, Named VLAN Tags & Port Membership',
    extracts: 'VLAN IDs, Named VLAN tags (e.g., CORP-ENG-WORKSTATIONS), Status, Assigned Access Ports'
  }
];

export default function ShowCommandUploader({
  isOpen,
  onClose,
  onDeviceIngested,
  storageEngine,
  initialMode = 'manual',
  initialTargetIp = '',
  initialTargetHostname = '',
  activeDeviceData = null,
  storedDevices = [],
  serverEndpointHost = ''
}) {
  const [studioMode, setStudioMode] = useState(initialMode); // 'manual' | 'ssh' | 'self-push'
  const [activeTab, setActiveTab] = useState('showIntStatus');
  const [siteName, setSiteName] = useState('FDU Metro Campus');
  const [buildingName, setBuildingName] = useState('Building 4 — IDF-2');
  const [rawInputs, setRawInputs] = useState(() => ({
    combinedText: '',
    ...SAMPLE_CAMPUS_SHOW_OUTPUTS
  }));
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState(null);

  // Live SSH Poll State
  const [sshHost, setSshHost] = useState(
    initialTargetIp || activeDeviceData?.device?.mgmtIp || '132.238.8.250'
  );
  const [sshPort, setSshPort] = useState(SESSION_SSH_VAULT.port || 22);
  const [sshUsername, setSshUsername] = useState(SESSION_SSH_VAULT.username || '');
  const [sshPassword, setSshPassword] = useState(SESSION_SSH_VAULT.password || '');
  const [sshEnableSecret, setSshEnableSecret] = useState(SESSION_SSH_VAULT.enableSecret || '');
  const [rememberSession, setRememberSession] = useState(SESSION_SSH_VAULT.rememberInSession);
  const [sshPolling, setSshPolling] = useState(false);
  const [sshError, setSshError] = useState(null);
  const [sshCommandLog, setSshCommandLog] = useState([]);

  // Self-Push EEM Generator State
  const [webhookUrl, setWebhookUrl] = useState(
    `http://${serverEndpointHost || window.location.hostname || '127.0.0.1'}:3001/api/devices/upload-show`
  );
  const [copiedBlock, setCopiedBlock] = useState(null);

  useEffect(() => {
    if (isOpen) {
      setStudioMode(initialMode || 'manual');
      if (initialTargetIp) {
        setSshHost(initialTargetIp);
      } else if (activeDeviceData?.device?.mgmtIp) {
        setSshHost(activeDeviceData.device.mgmtIp);
      }
      setSshError(null);
    }
  }, [isOpen, initialMode, initialTargetIp, activeDeviceData]);

  useEffect(() => {
    if (serverEndpointHost) {
      setWebhookUrl(`http://${serverEndpointHost}:3001/api/devices/upload-show`);
    }
  }, [serverEndpointHost]);

  // Live instant parse preview whenever inputs change
  const parsedPreview = useMemo(() => {
    return correlateSwitchShowData(rawInputs);
  }, [rawInputs]);

  if (!isOpen) return null;

  // Quick-pick targets from active switch + discovered CDP neighbors + stored DB switches
  const quickPickTargets = (() => {
    const map = new Map();
    if (activeDeviceData?.device?.mgmtIp && activeDeviceData.device.mgmtIp !== '—') {
      map.set(activeDeviceData.device.mgmtIp, {
        ip: activeDeviceData.device.mgmtIp,
        label: `${activeDeviceData.device.hostname} (Active Switch)`,
        badge: activeDeviceData.device.model
      });
    }
    for (const n of activeDeviceData?.cdpNeighbors || []) {
      if (n.neighborIp && n.neighborIp !== '—' && !map.has(n.neighborIp)) {
        map.set(n.neighborIp, {
          ip: n.neighborIp,
          label: `${n.deviceId} (via ${n.localInterface})`,
          badge: 'CDP Neighbor'
        });
      }
    }
    for (const d of storedDevices || []) {
      if (d.mgmt_ip && d.mgmt_ip !== '—' && !map.has(d.mgmt_ip)) {
        map.set(d.mgmt_ip, {
          ip: d.mgmt_ip,
          label: d.hostname,
          badge: d.model
        });
      }
    }
    return Array.from(map.values());
  })();

  const handleFileUpload = async (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;

    const texts = await Promise.all(files.map((f) => f.text()));
    const mergedText = texts.join('\n\n');

    if (activeTab === 'combinedText' || files.length > 1) {
      setRawInputs((prev) => ({
        ...prev,
        combinedText: (prev.combinedText ? prev.combinedText + '\n\n' : '') + mergedText
      }));
      setActiveTab('combinedText');
    } else {
      setRawInputs((prev) => ({
        ...prev,
        [activeTab]: mergedText
      }));
    }
  };

  const handleLoadSample = () => {
    setRawInputs({
      combinedText: '',
      ...SAMPLE_CAMPUS_SHOW_OUTPUTS
    });
    setSaveMessage('Loaded authentic Campus C9300-48U outputs for all 7 show commands.');
  };

  const handleClearAll = () => {
    setRawInputs({
      combinedText: '',
      showVersion: '',
      showCdpNeighbors: '',
      showIntTrunk: '',
      showIpIntBrief: '',
      showIntStatus: '',
      showRunInterface: '',
      showVlan: ''
    });
    setSaveMessage(null);
  };

  const handleLiveSshPoll = async (e) => {
    if (e) e.preventDefault();
    setSshError(null);
    setSaveMessage(null);

    if (!sshHost.trim() || !sshUsername.trim() || !sshPassword) {
      setSshError('Please enter Switch IP/Hostname, SSH Username, and SSH Password.');
      return;
    }

    if (rememberSession) {
      SESSION_SSH_VAULT.username = sshUsername;
      SESSION_SSH_VAULT.password = sshPassword;
      SESSION_SSH_VAULT.enableSecret = sshEnableSecret;
      SESSION_SSH_VAULT.port = sshPort;
      SESSION_SSH_VAULT.rememberInSession = true;
    } else {
      SESSION_SSH_VAULT.username = '';
      SESSION_SSH_VAULT.password = '';
      SESSION_SSH_VAULT.enableSecret = '';
      SESSION_SSH_VAULT.rememberInSession = false;
    }

    setSshPolling(true);
    setSshCommandLog([
      { key: 'showVersion', command: 'show version', status: 'running' },
      { key: 'showCdpNeighbors', command: 'show cdp nei detail', status: 'pending' },
      { key: 'showIntTrunk', command: 'show int trunk', status: 'pending' },
      { key: 'showIpIntBrief', command: 'show ip interface brief', status: 'pending' },
      { key: 'showIntStatus', command: 'show interface status', status: 'pending' },
      { key: 'showRunInterface', command: 'show run | section interface', status: 'pending' },
      { key: 'showVlan', command: 'show vlan', status: 'pending' }
    ]);

    try {
      const res = await fetch('/api/devices/live-ssh-poll', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          host: sshHost.trim(),
          port: Number(sshPort) || 22,
          username: sshUsername.trim(),
          password: sshPassword,
          enableSecret: sshEnableSecret,
          siteName,
          buildingName
        })
      });

      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data.error || `SSH Poll failed (${res.status})`);
      }

      if (data.rawOutputs) {
        setRawInputs({
          combinedText: '',
          ...data.rawOutputs
        });
      }
      if (data.commandLog) {
        setSshCommandLog(
          data.commandLog.map((item) => ({
            ...item,
            status: item.ok ? 'done' : 'warn'
          }))
        );
      }

      const freshParsed =
        data.device?.parsed_snapshot || correlateSwitchShowData(data.rawOutputs || {});
      onDeviceIngested(data.device, freshParsed);
      setSaveMessage(
        `Live SSH Poll succeeded! Collected 7 show commands from ${freshParsed.device.hostname} (${freshParsed.device.model}) & saved to ${data.storageEngine}.`
      );
    } catch (err) {
      setSshError(err.message);
      setSshCommandLog([]);
    } finally {
      setSshPolling(false);
    }
  };

  const handleSaveAndApply = async () => {
    setSaving(true);
    setSaveMessage(null);
    try {
      const res = await fetch('/api/devices/upload-show', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rawInputs,
          siteName,
          buildingName
        })
      });
      const data = await res.json();
      if (data.ok && data.device) {
        const snap = data.device.parsed_snapshot || parsedPreview;
        onDeviceIngested(data.device, snap);
        setSaveMessage(
          `Saved ${snap.device.hostname} (${snap.device.model}, S/N: ${snap.device.serialNumber}) to ${data.storageEngine}!`
        );
        setTimeout(() => {
          onClose();
        }, 700);
      } else {
        onDeviceIngested(
          {
            hostname: parsedPreview.device.hostname,
            model: parsedPreview.device.model,
            serial_number: parsedPreview.device.serialNumber,
            ios_version: parsedPreview.device.iosVersion,
            mgmt_ip: parsedPreview.device.mgmtIp,
            site_name: siteName,
            building_name: buildingName,
            parsed_snapshot: parsedPreview
          },
          parsedPreview
        );
        onClose();
      }
    } catch {
      onDeviceIngested(
        {
          hostname: parsedPreview.device.hostname,
          model: parsedPreview.device.model,
          serial_number: parsedPreview.device.serialNumber,
          ios_version: parsedPreview.device.iosVersion,
          mgmt_ip: parsedPreview.device.mgmtIp,
          site_name: siteName,
          building_name: buildingName,
          parsed_snapshot: parsedPreview
        },
        parsedPreview
      );
      onClose();
    } finally {
      setSaving(false);
    }
  };

  const currentTabInfo =
    COMMAND_TABS.find((t) => t.id === activeTab) || COMMAND_TABS[0];

  const totalDownlinkCount = parsedPreview.ports48.length || 48;
  const connectedDownlinks = parsedPreview.ports48.filter(
    (p) => p.status === 'up'
  ).length;

  // Generate Cisco IOS-XE Self-Push EEM + GuestShell Python Script
  const iosXeSelfPushConfig = `! =========================================================================
! CISCO CATALYST 9300 SELF-PUSH TELEMETRY AGENT (IOS-XE EEM + GUESTSHELL)
! Runs all 7 show commands on the switch itself and HTTP-POSTs them
! directly to your C9300 3D & Topology PostgreSQL Server.
! Trigger manually anytime on the switch CLI with:
!   Switch# event manager run C9300-SELF-PUSH
! =========================================================================
ip http client source-interface GigabitEthernet0/0
!
event manager applet C9300-SELF-PUSH
 event none maxrun 60
 action 1.0 cli command "enable"
 action 1.1 cli command "guestshell run python3 /bootflash/c9300_self_push.py"
 action 1.2 syslog msg "C9300-SELF-PUSH: Exported 7 show commands to ${webhookUrl}"
!
! Optional: Also auto-push every 30 minutes or on interface link change
! event timer watchdog time 1800 maxrun 60`;

  const guestShellPythonScript = `# Save to /bootflash/c9300_self_push.py (inside Cisco IOS-XE GuestShell)
import json
import urllib.request
import cli

WEBHOOK_URL = "${webhookUrl}"
SITE_NAME = "${siteName}"
BUILDING_NAME = "${buildingName}"

raw_inputs = {
    "showVersion": cli.execute("show version"),
    "showCdpNeighbors": cli.execute("show cdp neighbors detail"),
    "showIntTrunk": cli.execute("show interfaces trunk"),
    "showIpIntBrief": cli.execute("show ip interface brief"),
    "showIntStatus": cli.execute("show interfaces status"),
    "showRunInterface": cli.execute("show running-config | section ^interface"),
    "showVlan": cli.execute("show vlan brief"),
}

payload = json.dumps({
    "rawInputs": raw_inputs,
    "siteName": SITE_NAME,
    "buildingName": BUILDING_NAME
}).encode("utf-8")

req = urllib.request.Request(
    WEBHOOK_URL,
    data=payload,
    headers={"Content-Type": "application/json"},
    method="POST"
)
with urllib.request.urlopen(req, timeout=20) as resp:
    print("Uploaded switch telemetry:", resp.status)`;

  const copyToClipboard = (text, id) => {
    navigator.clipboard.writeText(text);
    setCopiedBlock(id);
    setTimeout(() => setCopiedBlock(null), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="w-full max-w-6xl h-[90vh] bg-[#0a0f1d] border border-slate-700/80 rounded-2xl shadow-2xl flex flex-col overflow-hidden">
        {/* Modal Header */}
        <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-3.5 bg-slate-950 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-sky-500/20 border border-sky-500/40 text-sky-400">
              <Terminal className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2.5">
                <h2 className="text-base sm:text-lg font-bold text-white">
                  Cisco IOS-XE Show Command Ingestion & Live SSH Poller Studio
                </h2>
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-mono bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
                  <Database className="w-3 h-3" /> {storageEngine || 'PostgreSQL 16 Ready'}
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Collect the 7 Cisco IOS-XE show commands via Manual File/Paste, Direct 1-Click SSH Poll, or On-Switch IOS-XE Self-Push
              </p>
            </div>
          </div>

          {/* 3-Mode Selector Tabs */}
          <div className="flex items-center gap-1.5 bg-slate-900 p-1 rounded-xl border border-slate-800">
            <button
              type="button"
              onClick={() => setStudioMode('manual')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer ${
                studioMode === 'manual'
                  ? 'bg-sky-500 text-slate-950 shadow'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              <Upload className="w-3.5 h-3.5" />
              1. Manual Upload / Paste
            </button>
            <button
              type="button"
              onClick={() => setStudioMode('ssh')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer ${
                studioMode === 'ssh'
                  ? 'bg-emerald-500 text-slate-950 shadow'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              <Wifi className="w-3.5 h-3.5" />
              2. Live Switch Poll (SSH)
            </button>
            <button
              type="button"
              onClick={() => setStudioMode('self-push')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer ${
                studioMode === 'self-push'
                  ? 'bg-indigo-500 text-white shadow'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              <Code2 className="w-3.5 h-3.5" />
              3. Switch Self-Push (IOS-XE Agent)
            </button>
            <button
              type="button"
              onClick={onClose}
              className="ml-1 p-1.5 rounded-lg bg-slate-950 hover:bg-slate-800 text-slate-400 hover:text-white transition cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Live Parsed Telemetry Summary Ribbon */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 px-6 py-2.5 bg-slate-900/70 border-b border-slate-800 text-xs">
          <div className="p-2 rounded-lg bg-slate-950/80 border border-slate-800">
            <span className="text-[10px] text-slate-400 block font-mono">HOSTNAME & MODEL</span>
            <span className="font-mono font-bold text-white truncate block">
              {parsedPreview.device.hostname} ({parsedPreview.device.model})
            </span>
          </div>
          <div className="p-2 rounded-lg bg-slate-950/80 border border-slate-800">
            <span className="text-[10px] text-slate-400 block font-mono">SERIAL & IOS-XE</span>
            <span className="font-mono font-bold text-sky-300 truncate block">
              {parsedPreview.device.serialNumber} • v{parsedPreview.device.iosVersion}
            </span>
          </div>
          <div className="p-2 rounded-lg bg-slate-950/80 border border-slate-800">
            <span className="text-[10px] text-slate-400 block font-mono">MGMT & SVI IPs</span>
            <span className="font-mono font-bold text-emerald-300 truncate block">
              {parsedPreview.device.mgmtIp} ({parsedPreview.ipInterfaces.length} Intfs)
            </span>
          </div>
          <div className="p-2 rounded-lg bg-slate-950/80 border border-slate-800">
            <span className="text-[10px] text-slate-400 block font-mono">CDP NEIGHBORS</span>
            <span className="font-mono font-bold text-amber-300 truncate block">
              {parsedPreview.cdpNeighbors.length} Connected Devices
            </span>
          </div>
          <div className="p-2 rounded-lg bg-slate-950/80 border border-slate-800">
            <span className="text-[10px] text-slate-400 block font-mono">802.1Q TRUNKS</span>
            <span className="font-mono font-bold text-indigo-300 truncate block">
              {parsedPreview.trunks.length} Active Trunks
            </span>
          </div>
          <div className="p-2 rounded-lg bg-slate-950/80 border border-slate-800">
            <span className="text-[10px] text-slate-400 block font-mono">VLANS & ACTIVE PORTS</span>
            <span className="font-mono font-bold text-purple-300 truncate block">
              {parsedPreview.vlans.length} VLANs • {connectedDownlinks}/{totalDownlinkCount} Up
            </span>
          </div>
        </div>

        {/* =====================================================================
            MODE 1: MANUAL UPLOAD / PASTE (EXISTING FEATURE KEPT 100% INTACT)
           ===================================================================== */}
        {studioMode === 'manual' && (
          <div className="flex-1 flex flex-col lg:flex-row min-h-0 overflow-hidden">
            {/* Left Column: 7 Show Command Tabs + Campus Site Metadata */}
            <div className="w-full lg:w-72 bg-slate-950/90 border-r border-slate-800 p-3 flex flex-col justify-between overflow-y-auto shrink-0">
              <div className="space-y-1">
                <div className="text-[10px] font-mono uppercase tracking-wider text-slate-400 px-2 pb-1">
                  7 Cisco Show Commands
                </div>
                {COMMAND_TABS.map((tab) => {
                  const hasContent = Boolean(
                    (rawInputs[tab.id] || (tab.id === 'showCdpNeighbors' ? rawInputs.showCdpNeighborDetail : '') || '').trim()
                  );
                  const isSelected = activeTab === tab.id;
                  return (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id)}
                      className={`w-full text-left px-3 py-2 rounded-lg border transition flex items-center justify-between gap-2 cursor-pointer ${
                        isSelected
                          ? 'bg-sky-500/20 border-sky-400 text-white'
                          : 'bg-slate-900/60 border-slate-800/80 text-slate-300 hover:bg-slate-900'
                      }`}
                    >
                      <div className="min-w-0">
                        <div className="text-xs font-mono font-bold truncate">{tab.cmd}</div>
                        <div className="text-[10px] text-slate-400 truncate">{tab.subtitle}</div>
                      </div>
                      <span
                        className={`w-2 h-2 rounded-full shrink-0 ${
                          hasContent ? 'bg-emerald-400' : 'bg-slate-700'
                        }`}
                      />
                    </button>
                  );
                })}
              </div>

              {/* Campus Hierarchy Tagging */}
              <div className="pt-3 border-t border-slate-800 space-y-2 mt-3">
                <div className="text-[10px] font-mono uppercase tracking-wider text-sky-400">
                  Campus / Globe Location Metadata
                </div>
                <div>
                  <label className="text-[10px] text-slate-400 block">Campus / Site Name</label>
                  <input
                    type="text"
                    value={siteName}
                    onChange={(e) => setSiteName(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs text-white"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-slate-400 block">Building / IDF Closet</label>
                  <input
                    type="text"
                    value={buildingName}
                    onChange={(e) => setBuildingName(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs text-white"
                  />
                </div>
              </div>
            </div>

            {/* Right Column: Raw CLI Input Textarea + File Drop + Live Structured Extraction Table */}
            <div className="flex-1 flex flex-col p-4 gap-3 min-h-0 overflow-hidden">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h3 className="text-sm font-mono font-bold text-sky-300">
                    {currentTabInfo.cmd}
                  </h3>
                  <p className="text-xs text-slate-400">
                    <strong className="text-slate-200">Extracts:</strong> {currentTabInfo.extracts}
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <label className="px-3 py-1.5 rounded-lg bg-sky-600/25 hover:bg-sky-600/35 border border-sky-500/50 text-xs font-semibold text-sky-200 flex items-center gap-1.5 cursor-pointer transition">
                    <Upload className="w-3.5 h-3.5" />
                    Upload .TXT / .LOG File(s)
                    <input
                      type="file"
                      accept=".txt,.log,.cfg,.conf,text/*"
                      multiple
                      onChange={handleFileUpload}
                      className="hidden"
                    />
                  </label>

                  <button
                    onClick={handleLoadSample}
                    className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-medium text-slate-200 flex items-center gap-1.5 cursor-pointer transition"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                    Load Sample 48-Port C9300
                  </button>

                  <button
                    onClick={handleClearAll}
                    className="px-2.5 py-1.5 rounded-lg bg-slate-900 hover:bg-rose-950/60 border border-slate-800 hover:border-rose-500/40 text-xs text-slate-400 hover:text-rose-200 cursor-pointer transition"
                  >
                    Clear All
                  </button>
                </div>
              </div>

              {/* Raw CLI Output Editor */}
              <textarea
                value={
                  rawInputs[activeTab] ||
                  (activeTab === 'showCdpNeighbors' ? rawInputs.showCdpNeighborDetail || '' : '')
                }
                onChange={(e) =>
                  setRawInputs((prev) => ({ ...prev, [activeTab]: e.target.value }))
                }
                placeholder={`Paste the output of "${currentTabInfo.cmd}" here, or click "Upload .TXT / .LOG File(s)" above...`}
                className="flex-1 w-full bg-[#050811] border border-slate-800 rounded-xl p-3.5 font-mono text-xs text-emerald-300 focus:outline-none focus:border-sky-500 resize-none leading-relaxed"
              />

              {/* Live Extracted Preview Cards */}
              <div className="h-40 bg-slate-950/90 border border-slate-800 rounded-xl p-3 overflow-y-auto space-y-2">
                <div className="text-[11px] font-mono uppercase tracking-wider text-slate-400 flex items-center justify-between">
                  <span>Live Parser Verification Preview ({totalDownlinkCount}-Port {parsedPreview.device.model})</span>
                  <span className="text-emerald-400">Ready for SQL Ingestion</span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-xs font-mono">
                  <div className="p-2 rounded bg-slate-900/90 border border-slate-800">
                    <div className="text-amber-300 font-bold mb-1">
                      CDP Neighbors ({parsedPreview.cdpNeighbors.length})
                    </div>
                    <div className="space-y-1 max-h-20 overflow-y-auto text-[11px]">
                      {parsedPreview.cdpNeighbors.map((n, idx) => (
                        <div key={idx} className="text-slate-300 truncate">
                          <span className="text-sky-400">{n.localInterface}</span> → {n.deviceId} (
                          <span className="text-emerald-300">{n.neighborIp}</span>)
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="p-2 rounded bg-slate-900/90 border border-slate-800">
                    <div className="text-indigo-300 font-bold mb-1">
                      Trunks ({parsedPreview.trunks.length}) & IPv4 ({parsedPreview.ipInterfaces.length})
                    </div>
                    <div className="space-y-1 max-h-20 overflow-y-auto text-[11px]">
                      {parsedPreview.trunks.map((t, idx) => (
                        <div key={idx} className="text-slate-300 truncate">
                          <span className="text-indigo-400">{t.interfaceName}</span> ({t.encapsulation}) VLANs:{' '}
                          {t.allowedVlans}
                        </div>
                      ))}
                      {parsedPreview.ipInterfaces
                        .filter((ip) => ip.ipAddress !== 'unassigned')
                        .map((ip, idx) => (
                          <div key={`ip-${idx}`} className="text-slate-300 truncate">
                            <span className="text-emerald-400">{ip.interfaceName}</span>: {ip.ipAddress} ({ip.status})
                          </div>
                        ))}
                    </div>
                  </div>

                  <div className="p-2 rounded bg-slate-900/90 border border-slate-800">
                    <div className="text-purple-300 font-bold mb-1">
                      Active VLAN Tags ({parsedPreview.vlans.length})
                    </div>
                    <div className="space-y-1 max-h-20 overflow-y-auto text-[11px]">
                      {parsedPreview.vlans.map((v) => (
                        <div key={v.vlanId} className="text-slate-300 truncate">
                          <span className="text-purple-400">VLAN {v.vlanId}</span>: {v.name} (
                          {v.ports.length} ports)
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* =====================================================================
            MODE 2: LIVE SWITCH POLL (DIRECT SSH CONNECTION FOR ALL 7 COMMANDS)
           ===================================================================== */}
        {studioMode === 'ssh' && (
          <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-5 p-6 overflow-y-auto">
            {/* Left 7 Columns: SSH Target & Credential Form */}
            <form onSubmit={handleLiveSshPoll} className="lg:col-span-7 space-y-4">
              <div className="p-4 rounded-xl bg-slate-900/80 border border-emerald-500/30 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <Wifi className="w-4 h-4 text-emerald-400" />
                    1-Click Live Cisco IOS-XE Switch SSH Poller
                  </h3>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                    SSH2 Encrypted PTY • TACACS+ / Local AAA Ready
                  </span>
                </div>
                <p className="text-xs text-slate-300">
                  Connects directly to your switch over SSH, sets <code className="text-sky-300">terminal length 0</code>, executes all 7 <code className="text-sky-300">show</code> commands automatically, correlates the 24-port or 48-port hardware layout, and saves to PostgreSQL.
                </p>

                {/* Quick-Pick Discovered Switches & CDP Neighbors */}
                {quickPickTargets.length > 0 && (
                  <div className="space-y-1.5 pt-1">
                    <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400 block">
                      Quick-Select Switch or Discovered CDP Neighbor IP:
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {quickPickTargets.map((t) => (
                        <button
                          key={t.ip}
                          type="button"
                          onClick={() => setSshHost(t.ip)}
                          className={`px-2.5 py-1 rounded-lg text-xs font-mono border transition flex items-center gap-1.5 cursor-pointer ${
                            sshHost === t.ip
                              ? 'bg-emerald-500/25 border-emerald-400 text-emerald-200 font-bold'
                              : 'bg-slate-950 border-slate-800 text-slate-300 hover:border-slate-600'
                          }`}
                        >
                          <span>{t.ip}</span>
                          <span className="text-[10px] text-slate-400">({t.label})</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 pt-2">
                  <div className="sm:col-span-3">
                    <label className="text-xs font-mono text-slate-300 block mb-1">
                      Switch Management IP or Hostname *
                    </label>
                    <input
                      type="text"
                      required
                      value={sshHost}
                      onChange={(e) => setSshHost(e.target.value)}
                      placeholder="e.g. 132.238.8.250"
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm font-mono text-white focus:border-emerald-400 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-mono text-slate-300 block mb-1">
                      SSH Port
                    </label>
                    <input
                      type="number"
                      value={sshPort}
                      onChange={(e) => setSshPort(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm font-mono text-white focus:border-emerald-400 focus:outline-none"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="text-xs font-mono text-slate-300 block mb-1">
                      SSH Username *
                    </label>
                    <input
                      type="text"
                      required
                      value={sshUsername}
                      onChange={(e) => setSshUsername(e.target.value)}
                      placeholder="admin / netadmin"
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs font-mono text-white focus:border-emerald-400 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-mono text-slate-300 block mb-1">
                      SSH Password *
                    </label>
                    <input
                      type="password"
                      required
                      value={sshPassword}
                      onChange={(e) => setSshPassword(e.target.value)}
                      placeholder="••••••••••••"
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs font-mono text-white focus:border-emerald-400 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-mono text-slate-300 block mb-1">
                      Enable Secret (If Needed)
                    </label>
                    <input
                      type="password"
                      value={sshEnableSecret}
                      onChange={(e) => setSshEnableSecret(e.target.value)}
                      placeholder="Optional (for priv 15)"
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs font-mono text-white focus:border-emerald-400 focus:outline-none"
                    />
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-800/80">
                  <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={rememberSession}
                      onChange={(e) => setRememberSession(e.target.checked)}
                      className="rounded border-slate-600 text-emerald-500"
                    />
                    <Shield className="w-3.5 h-3.5 text-sky-400" />
                    Keep credentials in RAM for this browser session only (never saved to disk/DB)
                  </label>

                  <button
                    type="submit"
                    disabled={sshPolling}
                    className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-xs font-bold text-slate-950 shadow-lg shadow-emerald-500/20 flex items-center gap-2 cursor-pointer disabled:opacity-50"
                  >
                    {sshPolling ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        Polling {sshHost} via SSH...
                      </>
                    ) : (
                      <>
                        <Play className="w-4 h-4 fill-current" />
                        Fetch All 7 Commands Live via SSH
                      </>
                    )}
                  </button>
                </div>

                {sshError && (
                  <div className="p-3 rounded-lg bg-rose-950/70 border border-rose-500/50 text-xs text-rose-200 flex items-start gap-2 font-mono">
                    <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                    <div>
                      <div className="font-bold">SSH Connection / Execution Error:</div>
                      <div>{sshError}</div>
                    </div>
                  </div>
                )}
              </div>
            </form>

            {/* Right 5 Columns: Live 7-Command Execution Checklist */}
            <div className="lg:col-span-5 p-4 rounded-xl bg-slate-950/90 border border-slate-800 flex flex-col justify-between space-y-3">
              <div>
                <div className="text-xs font-mono uppercase tracking-wider text-slate-400 mb-2">
                  Automated 7-Command SSH Execution Plan
                </div>
                <div className="space-y-2">
                  {[
                    { key: 'showVersion', cmd: 'show version', desc: 'IOS-XE version, Model (24/48-Port), Serial #' },
                    { key: 'showCdpNeighbors', cmd: 'show cdp nei detail', desc: 'Connected neighbors, ports & management IPs' },
                    { key: 'showIntTrunk', cmd: 'show int trunk', desc: '802.1Q trunk interfaces & allowed VLANs' },
                    { key: 'showIpIntBrief', cmd: 'show ip interface brief', desc: 'SVI & management IPv4 addresses' },
                    { key: 'showIntStatus', cmd: 'show interface status', desc: 'Link state, running speed, set speed & names' },
                    { key: 'showRunInterface', cmd: 'show run | section interface', desc: 'Per-interface CLI configuration stanzas' },
                    { key: 'showVlan', cmd: 'show vlan', desc: 'VLAN IDs, named tags & port assignments' }
                  ].map((item, idx) => {
                    const logEntry = sshCommandLog.find((l) => l.key === item.key);
                    return (
                      <div
                        key={item.key}
                        className="p-2.5 rounded-lg bg-slate-900/80 border border-slate-800 flex items-center justify-between gap-2 text-xs font-mono"
                      >
                        <div>
                          <div className="text-white font-bold">
                            {idx + 1}. {item.cmd}
                          </div>
                          <div className="text-[10px] text-slate-400">{item.desc}</div>
                        </div>
                        <div className="shrink-0">
                          {logEntry?.status === 'done' ? (
                            <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-[10px]">
                              ✓ {logEntry.bytes}B ({logEntry.durationMs}ms)
                            </span>
                          ) : logEntry?.status === 'warn' ? (
                            <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40 text-[10px]">
                              {logEntry.note}
                            </span>
                          ) : sshPolling ? (
                            <span className="px-2 py-0.5 rounded bg-sky-500/20 text-sky-300 border border-sky-500/40 text-[10px] animate-pulse">
                              Running...
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-400 text-[10px]">
                              Ready
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="p-2.5 rounded-lg bg-slate-900/60 border border-slate-800 text-[11px] text-slate-400">
                Tip: Once polled, all 7 command outputs also populate Tab 1 (<strong>Manual Upload / Paste</strong>) so you can inspect or export the raw CLI text anytime.
              </div>
            </div>
          </div>
        )}

        {/* =====================================================================
            MODE 3: SWITCH SELF-PUSH (CISCO IOS-XE EEM / GUESTSHELL GENERATOR)
           ===================================================================== */}
        {studioMode === 'self-push' && (
          <div className="flex-1 grid grid-cols-1 lg:grid-cols-2 gap-5 p-6 overflow-y-auto">
            {/* Left Column: IOS-XE EEM Applet CLI Config */}
            <div className="p-4 rounded-xl bg-slate-900/80 border border-indigo-500/30 flex flex-col space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Code2 className="w-4 h-4 text-indigo-400" />
                  Step 1: Cisco IOS-XE EEM Self-Push Applet
                </h3>
                <button
                  type="button"
                  onClick={() => copyToClipboard(iosXeSelfPushConfig, 'eem')}
                  className="px-2.5 py-1 rounded-lg bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-200 border border-indigo-500/40 text-xs font-mono flex items-center gap-1.5 cursor-pointer"
                >
                  {copiedBlock === 'eem' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  {copiedBlock === 'eem' ? 'Copied!' : 'Copy CLI'}
                </button>
              </div>
              <p className="text-xs text-slate-300">
                Want the Catalyst 9300 switch itself to gather its own 7 <code className="text-sky-300">show</code> outputs and push them to this server? Set your server webhook URL below and paste this EEM applet on the switch:
              </p>
              <div>
                <label className="text-[11px] font-mono text-slate-400 block mb-1">
                  Target Server Webhook Endpoint (Reachable from Switch):
                </label>
                <input
                  type="text"
                  value={webhookUrl}
                  onChange={(e) => setWebhookUrl(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-xs font-mono text-emerald-300"
                />
              </div>
              <pre className="flex-1 bg-[#050811] border border-slate-800 rounded-xl p-3.5 font-mono text-[11px] text-indigo-200 overflow-x-auto leading-relaxed">
                {iosXeSelfPushConfig}
              </pre>
            </div>

            {/* Right Column: On-Box GuestShell Python Script */}
            <div className="p-4 rounded-xl bg-slate-900/80 border border-sky-500/30 flex flex-col space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Terminal className="w-4 h-4 text-sky-400" />
                  Step 2: On-Switch GuestShell Python Script
                </h3>
                <button
                  type="button"
                  onClick={() => copyToClipboard(guestShellPythonScript, 'py')}
                  className="px-2.5 py-1 rounded-lg bg-sky-500/20 hover:bg-sky-500/30 text-sky-200 border border-sky-500/40 text-xs font-mono flex items-center gap-1.5 cursor-pointer"
                >
                  {copiedBlock === 'py' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  {copiedBlock === 'py' ? 'Copied!' : 'Copy Python'}
                </button>
              </div>
              <p className="text-xs text-slate-300">
                Runs locally inside Cisco IOS-XE GuestShell (<code className="text-sky-300">import cli</code>), collects all 7 commands on the switch itself, and HTTP-POSTs the JSON bundle straight into PostgreSQL:
              </p>
              <pre className="flex-1 bg-[#050811] border border-slate-800 rounded-xl p-3.5 font-mono text-[11px] text-emerald-300 overflow-x-auto leading-relaxed">
                {guestShellPythonScript}
              </pre>
            </div>
          </div>
        )}

        {/* Modal Footer */}
        <div className="flex items-center justify-between px-6 py-3 bg-slate-950 border-t border-slate-800">
          <div className="text-xs text-emerald-400 font-mono">
            {saveMessage && (
              <span className="flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4" /> {saveMessage}
              </span>
            )}
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-xs font-semibold text-slate-300 cursor-pointer"
            >
              Close
            </button>
            <button
              onClick={handleSaveAndApply}
              disabled={saving}
              className="px-5 py-2 rounded-lg bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-400 hover:to-blue-500 text-xs font-bold text-white shadow-lg shadow-sky-500/25 flex items-center gap-2 cursor-pointer"
            >
              <Database className="w-4 h-4" />
              {saving
                ? 'Saving to SQL Database...'
                : `Parse, Save to SQL Database & Render ${totalDownlinkCount}-Port Topology`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
