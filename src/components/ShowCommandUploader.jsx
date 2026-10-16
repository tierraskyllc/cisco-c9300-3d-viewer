import React, { useState, useMemo } from 'react';
import {
  correlateSwitchShowData,
  SAMPLE_CAMPUS_SHOW_OUTPUTS
} from '../utils/ciscoCliParser';
import {
  Upload,
  FileText,
  Database,
  CheckCircle2,
  Sparkles,
  X,
  Terminal,
  Network,
  Layers,
  Server
} from 'lucide-react';

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
    subtitle: 'Device IOS-XE Version, Model SKU & System Serial Number',
    extracts: 'IOS-XE version, Model (e.g. C9300-48U), Serial Number, Hostname, Uptime, Stack Members'
  },
  {
    id: 'showCdpNeighborDetail',
    cmd: 'show cdp neighbor detail',
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
    cmd: 'sho run | section interface',
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
  storageEngine
}) {
  const [activeTab, setActiveTab] = useState('showIntStatus');
  const [siteName, setSiteName] = useState('FDU Metro Campus');
  const [buildingName, setBuildingName] = useState('Building 4 — IDF-2');
  const [rawInputs, setRawInputs] = useState(() => ({
    combinedText: '',
    ...SAMPLE_CAMPUS_SHOW_OUTPUTS
  }));
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState(null);

  // Live instant parse preview whenever inputs change
  const parsedPreview = useMemo(() => {
    return correlateSwitchShowData(rawInputs);
  }, [rawInputs]);

  if (!isOpen) return null;

  const handleFileUpload = async (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;

    const texts = await Promise.all(files.map((f) => f.text()));
    const mergedText = texts.join('\n\n');

    // If user is on a specific command tab and uploaded 1 file, populate that tab OR combinedText
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
      showCdpNeighborDetail: '',
      showIntTrunk: '',
      showIpIntBrief: '',
      showIntStatus: '',
      showRunInterface: '',
      showVlan: ''
    });
    setSaveMessage(null);
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
        onDeviceIngested(data.device, parsedPreview);
        setSaveMessage(
          `Saved ${parsedPreview.device.hostname} (S/N: ${parsedPreview.device.serialNumber}) to ${data.storageEngine}!`
        );
        setTimeout(() => {
          onClose();
        }, 700);
      } else {
        // Fallback if backend isn't reachable: still apply directly to 3D & Topology UI
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

  const connectedDownlinks = parsedPreview.ports48.filter(
    (p) => p.status === 'up'
  ).length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="w-full max-w-6xl h-[88vh] bg-[#0a0f1d] border border-slate-700/80 rounded-2xl shadow-2xl flex flex-col overflow-hidden">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-slate-950 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-sky-500/20 border border-sky-500/40 text-sky-400">
              <Terminal className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2.5">
                <h2 className="text-lg font-bold text-white">
                  Cisco IOS-XE Show Command Ingestion & SQL Parser Studio
                </h2>
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-mono bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
                  <Database className="w-3 h-3" /> {storageEngine || 'PostgreSQL 16 Ready'}
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Upload `.txt`/`.log` CLI captures or paste outputs from your campus switches to populate PostgreSQL, the 3D Switch, and the Topology Graph
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Live Parsed Telemetry Summary Ribbon */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 px-6 py-3 bg-slate-900/70 border-b border-slate-800 text-xs">
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
              {parsedPreview.vlans.length} VLANs • {connectedDownlinks}/48 Up
            </span>
          </div>
        </div>

        {/* Main Body: Left Command Selector Tabs + Center/Right CLI Editor & Live Preview */}
        <div className="flex-1 flex flex-col lg:flex-row min-h-0 overflow-hidden">
          {/* Left Column: 7 Show Command Tabs + Campus Site Metadata */}
          <div className="w-full lg:w-72 bg-slate-950/90 border-r border-slate-800 p-3 flex flex-col justify-between overflow-y-auto shrink-0">
            <div className="space-y-1">
              <div className="text-[10px] font-mono uppercase tracking-wider text-slate-400 px-2 pb-1">
                Required Cisco Show Commands
              </div>
              {COMMAND_TABS.map((tab) => {
                const hasContent = Boolean((rawInputs[tab.id] || '').trim());
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

            {/* Campus Hierarchy Tagging (For Future Globe / Campus Zoom-Out) */}
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
                  Load Sample Campus C9300
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
              value={rawInputs[activeTab] || ''}
              onChange={(e) =>
                setRawInputs((prev) => ({ ...prev, [activeTab]: e.target.value }))
              }
              placeholder={`Paste the output of "${currentTabInfo.cmd}" here, or click "Upload .TXT / .LOG File(s)" above...`}
              className="flex-1 w-full bg-[#050811] border border-slate-800 rounded-xl p-3.5 font-mono text-xs text-emerald-300 focus:outline-none focus:border-sky-500 resize-none leading-relaxed"
            />

            {/* Live Extracted Preview Cards */}
            <div className="h-44 bg-slate-950/90 border border-slate-800 rounded-xl p-3 overflow-y-auto space-y-2">
              <div className="text-[11px] font-mono uppercase tracking-wider text-slate-400 flex items-center justify-between">
                <span>Live Parser Verification Preview (Correlated Across All 7 Commands)</span>
                <span className="text-emerald-400">Ready for SQL Ingestion</span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-xs font-mono">
                {/* Preview 1: Discovered CDP Neighbors */}
                <div className="p-2 rounded bg-slate-900/90 border border-slate-800">
                  <div className="text-amber-300 font-bold mb-1">
                    CDP Neighbors ({parsedPreview.cdpNeighbors.length})
                  </div>
                  <div className="space-y-1 max-h-24 overflow-y-auto text-[11px]">
                    {parsedPreview.cdpNeighbors.map((n, idx) => (
                      <div key={idx} className="text-slate-300 truncate">
                        <span className="text-sky-400">{n.localInterface}</span> → {n.deviceId} (
                        <span className="text-emerald-300">{n.neighborIp}</span>)
                      </div>
                    ))}
                  </div>
                </div>

                {/* Preview 2: Discovered 802.1Q Trunks & IPv4 SVIs */}
                <div className="p-2 rounded bg-slate-900/90 border border-slate-800">
                  <div className="text-indigo-300 font-bold mb-1">
                    Trunks ({parsedPreview.trunks.length}) & IPv4 ({parsedPreview.ipInterfaces.length})
                  </div>
                  <div className="space-y-1 max-h-24 overflow-y-auto text-[11px]">
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

                {/* Preview 3: Discovered VLANs */}
                <div className="p-2 rounded bg-slate-900/90 border border-slate-800">
                  <div className="text-purple-300 font-bold mb-1">
                    Active VLAN Tags ({parsedPreview.vlans.length})
                  </div>
                  <div className="space-y-1 max-h-24 overflow-y-auto text-[11px]">
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

        {/* Modal Footer */}
        <div className="flex items-center justify-between px-6 py-3.5 bg-slate-950 border-t border-slate-800">
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
              Cancel
            </button>
            <button
              onClick={handleSaveAndApply}
              disabled={saving}
              className="px-5 py-2 rounded-lg bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-400 hover:to-blue-500 text-xs font-bold text-white shadow-lg shadow-sky-500/25 flex items-center gap-2 cursor-pointer"
            >
              <Database className="w-4 h-4" />
              {saving
                ? 'Saving to SQL Database...'
                : 'Parse, Save to SQL Database & Render 3D Topology'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
