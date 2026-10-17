import React, { useState, useMemo } from 'react';
import {
  Wifi,
  Phone,
  Camera,
  Monitor,
  Cpu,
  Printer,
  Server,
  Layers,
  Zap,
  AlertTriangle,
  Activity,
  Filter,
  Terminal,
  Globe,
  GitCompareArrows,
  Cloud,
  CheckCircle2,
  Search,
  ArrowLeftRight,
  ArrowUpDown,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  Box
} from 'lucide-react';
import {
  GLOBAL_SITES,
  ISP_PROVIDERS,
  BACKBONE_CIRCUITS,
  buildGlobalAndSiteTopology
} from '../data/globalNetworkData';

export default function TopologyViewer({
  portsData,
  selectedItem,
  onSelect,
  switchModelId,
  networkModuleId,
  totalPoeWatts,
  poeBudgetWatts,
  parsedSwitchData,
  savedDevices = [],
  onSelectSavedDevice,
  onPollNeighbor
}) {
  // 3-Level Zoom Architecture:
  // 'switch-ports' (Level 3: Active Switch Ports & Faceplate)
  // 'site-links'   (Level 2: Visual Multi-Switch Interconnect Diagram + Point-A <-> Point-B Table)
  // 'global-wan'   (Level 1: US & Canada Campuses, Colocations & ISPs)
  const [topologyLevel, setTopologyLevel] = useState('site-links');
  const [selectedSiteFilter, setSelectedSiteFilter] = useState('ALL');
  const [linkTypeFilter, setLinkTypeFilter] = useState('SWITCHES_ONLY'); // 'SWITCHES_ONLY' | 'ALL_LINKS'
  const [expandedApSwitches, setExpandedApSwitches] = useState({ 'T-BAN-2FL-WL': true });
  const [searchQuery, setSearchQuery] = useState('');

  const [bankFilter, setBankFilter] = useState('ALL'); // 'ALL' | 1 | 2 | 3 | 4 | 'CONNECTED' | 'ISSUES'
  const [vlanFilter, setVlanFilter] = useState('ALL');

  const totalPortCount = portsData.length <= 24 ? 24 : 48;
  const is24Port = totalPortCount === 24;
  const vlansList = parsedSwitchData?.vlans || [];
  const uplinkIntfs = parsedSwitchData?.uplinkInterfaces || [];
  const cdpNeighbors = parsedSwitchData?.cdpNeighbors || [];
  const devInfo = parsedSwitchData?.device;

  // Build live multi-campus & Point-A <-> Point-B topology from PostgreSQL savedDevices + active switch
  const globalGraph = useMemo(() => {
    return buildGlobalAndSiteTopology(savedDevices, parsedSwitchData);
  }, [savedDevices, parsedSwitchData]);

  // Group ports into 12-port physical banks (2 banks for 24-port switches, 4 banks for 48-port switches)
  // Within each bank of 12 ports, group into 6 vertical columns of [oddTopPort, evenBottomPort]
  const physicalBanks = useMemo(() => {
    const numBanks = is24Port ? 2 : 4;
    const byPortNum = {};
    for (const p of portsData) {
      byPortNum[p.portNumber] = p;
    }

    return Array.from({ length: numBanks }, (_, bIdx) => {
      const bankNumber = bIdx + 1;
      const startPort = bIdx * 12 + 1;
      const endPort = startPort + 11;
      const columns = [];
      for (let colIdx = 0; colIdx < 6; colIdx++) {
        const oddNum = startPort + colIdx * 2;
        const evenNum = oddNum + 1;
        columns.push({
          oddPort: byPortNum[oddNum] || {
            portNumber: oddNum,
            status: 'down',
            interfaceName: `Port ${oddNum}`,
            connectedDevice: 'Not Connected'
          },
          evenPort: byPortNum[evenNum] || {
            portNumber: evenNum,
            status: 'down',
            interfaceName: `Port ${evenNum}`,
            connectedDevice: 'Not Connected'
          }
        });
      }
      return {
        bankNumber,
        label: `Bank ${bankNumber} (${startPort}–${endPort})`,
        columns
      };
    });
  }, [portsData, is24Port]);

  // Filter downlink ports for the interactive access-layer graph
  const visiblePorts = useMemo(() => {
    return portsData.filter((p) => {
      if (bankFilter === 'CONNECTED') return p.status === 'up';
      if (bankFilter === 'ISSUES') {
        return p.status === 'stp-blocking' || p.status === 'poe-fault' || p.status === 'down';
      }
      if (bankFilter !== 'ALL' && p.bank !== Number(bankFilter)) return false;
      if (vlanFilter !== 'ALL' && String(p.vlan) !== String(vlanFilter)) return false;
      return true;
    });
  }, [portsData, bankFilter, vlanFilter]);

  // Filter Switch Nodes in Level 2 by site & search query, grouped into Tier 1 (Core), Tier 2 (MDF/Distribution), Tier 3 (IDF/Access)
  const filteredSwitchNodes = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return (globalGraph.switchNodes || []).filter((n) => {
      if (selectedSiteFilter !== 'ALL' && n.siteCode !== selectedSiteFilter) {
        return false;
      }
      if (!q) return true;
      return (
        n.hostname.toLowerCase().includes(q) ||
        (n.mgmtIp || '').toLowerCase().includes(q) ||
        (n.model || '').toLowerCase().includes(q)
      );
    });
  }, [globalGraph.switchNodes, selectedSiteFilter, searchQuery]);

  const tier1CoreSwitches = useMemo(
    () => filteredSwitchNodes.filter((n) => n.hierarchyTier === 1),
    [filteredSwitchNodes]
  );
  const tier2MdfSwitches = useMemo(
    () => filteredSwitchNodes.filter((n) => n.hierarchyTier === 2),
    [filteredSwitchNodes]
  );
  const tier3IdfSwitches = useMemo(
    () => filteredSwitchNodes.filter((n) => n.hierarchyTier === 3),
    [filteredSwitchNodes]
  );

  // Filter Point-A <-> Point-B links in Level 2 by site, linkTypeFilter, and search query
  const filteredSiteLinks = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return globalGraph.links.filter((lnk) => {
      if (selectedSiteFilter !== 'ALL' && lnk.siteCode !== selectedSiteFilter) {
        return false;
      }
      if (linkTypeFilter === 'SWITCHES_ONLY' && !lnk.isSwitchInterconnect) {
        return false;
      }
      if (!q) return true;
      return (
        lnk.sourceHostname.toLowerCase().includes(q) ||
        lnk.targetHostname.toLowerCase().includes(q) ||
        lnk.sourcePort.toLowerCase().includes(q) ||
        lnk.targetPort.toLowerCase().includes(q) ||
        (lnk.targetIp || '').toLowerCase().includes(q) ||
        (lnk.sourceIp || '').toLowerCase().includes(q)
      );
    });
  }, [globalGraph.links, selectedSiteFilter, linkTypeFilter, searchQuery]);

  // Links specifically between Tier 1 Core and Tier 2 Distribution
  const coreToMdfLinks = useMemo(() => {
    const t1Keys = new Set(tier1CoreSwitches.map((s) => s.key));
    const t2Keys = new Set(tier2MdfSwitches.map((s) => s.key));
    return (globalGraph.switchLinks || []).filter(
      (l) =>
        (t1Keys.has(l.sourceKey) && t2Keys.has(l.targetKey)) ||
        (t2Keys.has(l.sourceKey) && t1Keys.has(l.targetKey))
    );
  }, [globalGraph.switchLinks, tier1CoreSwitches, tier2MdfSwitches]);

  // Links specifically between Tier 2 Distribution and Tier 3 Access/IDF
  const mdfToIdfLinks = useMemo(() => {
    const t2Keys = new Set(tier2MdfSwitches.map((s) => s.key));
    const t3Keys = new Set(tier3IdfSwitches.map((s) => s.key));
    return (globalGraph.switchLinks || []).filter(
      (l) =>
        (t2Keys.has(l.sourceKey) && t3Keys.has(l.targetKey)) ||
        (t3Keys.has(l.sourceKey) && t2Keys.has(l.targetKey))
    );
  }, [globalGraph.switchLinks, tier2MdfSwitches, tier3IdfSwitches]);

  const toggleApDrawer = (nodeKey) => {
    setExpandedApSwitches((prev) => ({
      ...prev,
      [nodeKey]: !prev[nodeKey]
    }));
  };

  const getDeviceIcon = (type) => {
    switch (type) {
      case 'ap':
        return Wifi;
      case 'phone':
        return Phone;
      case 'camera':
        return Camera;
      case 'workstation':
        return Monitor;
      case 'iot':
      case 'led':
        return Cpu;
      case 'printer':
        return Printer;
      default:
        return Server;
    }
  };

  const selectedPortNumber =
    selectedItem?.type === 'port' ? selectedItem.portNumber : null;

  const bankButtons = [
    { id: 'ALL', label: `All ${totalPortCount} Ports` },
    { id: 'CONNECTED', label: 'Connected Only' },
    { id: 1, label: 'Bank 1 (1–12)' },
    { id: 2, label: 'Bank 2 (13–24)' },
    ...(is24Port
      ? []
      : [
          { id: 3, label: 'Bank 3 (25–36)' },
          { id: 4, label: 'Bank 4 (37–48)' }
        ]),
    { id: 'ISSUES', label: 'Alerts / Down' }
  ];

  const renderFaceplatePortButton = (p) => {
    const isSel = selectedPortNumber === p.portNumber;
    const color =
      p.status === 'up'
        ? 'bg-emerald-500/25 border-emerald-500/60 text-emerald-200'
        : p.status === 'stp-blocking'
        ? 'bg-amber-500/30 border-amber-500/60 text-amber-200'
        : p.status === 'poe-fault'
        ? 'bg-rose-500/35 border-rose-500/70 text-rose-200'
        : 'bg-slate-900 border-slate-800 text-slate-400';

    return (
      <button
        key={p.portNumber}
        onClick={() => onSelect({ type: 'port', portNumber: p.portNumber })}
        title={`${p.interfaceName} (${p.portNumber % 2 === 1 ? 'Top Row Odd' : 'Bottom Row Even'}): ${p.connectedDevice}`}
        className={`h-6 w-full rounded text-[10px] font-mono border transition cursor-pointer flex items-center justify-center ${
          isSel
            ? 'ring-2 ring-sky-400 bg-sky-500 text-slate-950 font-bold'
            : `${color} hover:border-sky-400`
        }`}
      >
        {p.portNumber}
      </button>
    );
  };

  // Renders a visual switch card inside the Multi-Switch Hierarchy Diagram
  const renderVisualSwitchNode = (node) => {
    const isActiveIn3D =
      node.isPolled &&
      devInfo?.serialNumber &&
      node.serialNumber === devInfo.serialNumber;
    const hasAps = (node.attachedEndpoints || []).length > 0;
    const isApExpanded = Boolean(expandedApSwitches[node.key]);

    // Find all switch-to-switch links connected to this node
    const connectedSwitchLinks = (globalGraph.switchLinks || []).filter(
      (l) => l.sourceKey === node.key || l.targetKey === node.key
    );

    return (
      <div
        key={node.key}
        className={`p-3.5 rounded-xl border transition flex flex-col justify-between gap-2.5 ${
          isActiveIn3D
            ? 'bg-sky-950/50 border-sky-400 ring-2 ring-sky-400/50 shadow-xl shadow-sky-500/10'
            : node.isPolled
            ? 'bg-slate-900/90 border-emerald-500/50 hover:border-emerald-400'
            : 'bg-slate-950/85 border-purple-500/50 border-dashed hover:border-purple-400'
        }`}
      >
        {/* Top Header Badge Row */}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-1.5">
            <span
              className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                node.hierarchyTier === 1
                  ? 'bg-purple-500/25 text-purple-200 border border-purple-400/40'
                  : node.isPolled
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                  : 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
              }`}
            >
              {node.tierLabel}
            </span>
            <span className="px-1.5 py-0.5 rounded bg-slate-800 text-sky-300 text-[10px] font-mono">
              {node.siteCode}
            </span>
            {isActiveIn3D && (
              <span className="px-2 py-0.5 rounded bg-sky-500 text-slate-950 text-[10px] font-mono font-bold">
                ACTIVE IN 3D VIEW
              </span>
            )}
          </div>

          <div className="flex items-center gap-1.5">
            {node.totalPoeWatts > 0 && (
              <span className="px-2 py-0.5 rounded bg-amber-500/15 text-amber-300 border border-amber-500/30 text-[10px] font-mono">
                ⚡ {node.totalPoeWatts.toFixed(1)}W PoE
              </span>
            )}
            {node.isPolled ? (
              <button
                type="button"
                onClick={() => {
                  if (onSelectSavedDevice && node.serialNumber !== 'UNPOLLED') {
                    onSelectSavedDevice(node.serialNumber);
                  }
                }}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-mono font-bold flex items-center gap-1 cursor-pointer transition ${
                  isActiveIn3D
                    ? 'bg-sky-500/25 text-sky-200 border border-sky-400'
                    : 'bg-sky-500 hover:bg-sky-400 text-slate-950 shadow'
                }`}
                title="Load this switch into the 3D Hardware Chassis & Port Inspector"
              >
                <Box className="w-3 h-3" />
                {isActiveIn3D ? 'Viewing in 3D' : 'Load in 3D View'}
              </button>
            ) : (
              node.mgmtIp &&
              node.mgmtIp !== '—' &&
              onPollNeighbor && (
                <button
                  type="button"
                  onClick={() => onPollNeighbor(node.mgmtIp, node.hostname)}
                  className="px-2.5 py-1 rounded-lg bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-slate-950 text-[11px] font-mono font-bold flex items-center gap-1 shadow cursor-pointer"
                  title={`Poll ${node.hostname} (${node.mgmtIp}) via SSH`}
                >
                  <Terminal className="w-3 h-3" /> Poll SSH
                </button>
              )
            )}
          </div>
        </div>

        {/* Switch Identity & Hardware Info */}
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div
              className={`p-2.5 rounded-xl border ${
                node.hierarchyTier === 1
                  ? 'bg-purple-500/20 border-purple-400/40 text-purple-300'
                  : 'bg-sky-500/20 border-sky-400/40 text-sky-300'
              }`}
            >
              <Server className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="text-sm font-bold text-white truncate">
                {node.hostname}
              </div>
              <div className="text-xs font-mono text-slate-300">
                Model: <span className="text-sky-300 font-bold">{node.model}</span> • Mgmt IP:{' '}
                <span className="text-emerald-300 font-bold">{node.mgmtIp}</span>
                {node.serialNumber !== 'UNPOLLED' && (
                  <span className="text-slate-400"> • S/N: {node.serialNumber}</span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Physical Switch-to-Switch Port Connections Summary Pill */}
        {connectedSwitchLinks.length > 0 && (
          <div className="space-y-1 pt-1 border-t border-slate-800/80">
            <div className="text-[10px] font-mono uppercase tracking-wider text-slate-400">
              Inter-Switch Physical Trunk Interfaces ({connectedSwitchLinks.length}):
            </div>
            <div className="flex flex-wrap gap-1.5">
              {connectedSwitchLinks.map((lnk) => {
                const isSource = lnk.sourceKey === node.key;
                const myPort = isSource ? lnk.sourcePort : lnk.targetPort;
                const peerHost = isSource ? lnk.targetHostname : lnk.sourceHostname;
                const peerPort = isSource ? lnk.targetPort : lnk.sourcePort;
                return (
                  <div
                    key={lnk.id}
                    className={`px-2 py-1 rounded-md text-[11px] font-mono border flex items-center gap-1.5 ${
                      lnk.verifiedBiDirectional
                        ? 'bg-emerald-950/50 border-emerald-500/50 text-emerald-200'
                        : 'bg-slate-950 border-slate-700 text-slate-200'
                    }`}
                  >
                    <span className="font-bold text-sky-300">[{myPort}]</span>
                    <span className="text-slate-400">↔</span>
                    <span className="font-bold text-indigo-300">[{peerPort}]</span>
                    <span className="text-white">{peerHost}</span>
                    {lnk.verifiedBiDirectional && (
                      <CheckCircle2 className="w-3 h-3 text-emerald-400 shrink-0" />
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Attached Wireless APs / Endpoints Drawer (if any) */}
        {hasAps && (
          <div className="pt-1 border-t border-slate-800/80">
            <button
              type="button"
              onClick={() => toggleApDrawer(node.key)}
              className="w-full flex items-center justify-between text-xs font-mono text-amber-300 hover:text-amber-200 py-1 cursor-pointer"
            >
              <span className="flex items-center gap-1.5">
                <Wifi className="w-3.5 h-3.5" />
                {node.attachedEndpoints.length} Connected Wireless APs / Endpoints (
                {node.totalPoeWatts.toFixed(1)}W PoE)
              </span>
              {isApExpanded ? (
                <ChevronUp className="w-3.5 h-3.5" />
              ) : (
                <ChevronDown className="w-3.5 h-3.5" />
              )}
            </button>

            {isApExpanded && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 mt-1.5">
                {node.attachedEndpoints.map((ep, idx) => (
                  <div
                    key={`${ep.localPort}-${idx}`}
                    className="p-1.5 rounded bg-slate-950/90 border border-slate-800 flex items-center justify-between text-[11px] font-mono"
                  >
                    <div className="truncate">
                      <span className="text-sky-400 font-bold">{ep.localPort}</span> →{' '}
                      <span className="text-white font-semibold">{ep.hostname}</span>
                      <span className="text-slate-400 ml-1">({ep.model})</span>
                    </div>
                    <div className="shrink-0 flex items-center gap-1.5 ml-2">
                      <span className="text-emerald-300">{ep.ip}</span>
                      {ep.poeWatts > 0 && (
                        <span className="px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 text-[10px]">
                          {ep.poeWatts.toFixed(1)}W
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="w-full h-full flex flex-col bg-[#080d1a] rounded-xl border border-slate-800/90 overflow-hidden shadow-2xl">
      {/* ===================================================================
          TOP BAR: 3-LEVEL TOPOLOGY ZOOM SWITCHER + CONTEXTUAL FILTERS
         =================================================================== */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 bg-slate-900/90 border-b border-slate-800 text-xs">
        {/* Left: 3-Level Zoom Selector */}
        <div className="flex flex-wrap items-center gap-1.5">
          <div className="flex items-center bg-slate-950 p-1 rounded-lg border border-slate-800 mr-2">
            <button
              type="button"
              onClick={() => setTopologyLevel('global-wan')}
              className={`px-2.5 py-1 rounded-md text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer ${
                topologyLevel === 'global-wan'
                  ? 'bg-indigo-600 text-white shadow'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Globe className="w-3.5 h-3.5" />
              1. Global Campuses, Colos & ISPs
            </button>
            <button
              type="button"
              onClick={() => setTopologyLevel('site-links')}
              className={`px-2.5 py-1 rounded-md text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer ${
                topologyLevel === 'site-links'
                  ? 'bg-emerald-600 text-white shadow'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <GitCompareArrows className="w-3.5 h-3.5" />
              2. Multi-Switch Interconnect Map ({(globalGraph.switchNodes || []).length} Switches)
            </button>
            <button
              type="button"
              onClick={() => setTopologyLevel('switch-ports')}
              className={`px-2.5 py-1 rounded-md text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer ${
                topologyLevel === 'switch-ports'
                  ? 'bg-sky-600 text-white shadow'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              3. Active Switch ({totalPortCount} Ports)
            </button>
          </div>

          {/* Contextual Controls for Level 3 (Single Switch Ports) */}
          {topologyLevel === 'switch-ports' && (
            <>
              <Filter className="w-3.5 h-3.5 text-sky-400" />
              {bankButtons.map((b) => (
                <button
                  key={b.id}
                  onClick={() => setBankFilter(b.id)}
                  className={`px-2 py-1 rounded-md font-medium transition cursor-pointer ${
                    bankFilter === b.id
                      ? 'bg-sky-500/20 text-sky-300 border border-sky-500/50'
                      : 'bg-slate-800/70 text-slate-400 hover:text-slate-200 border border-slate-700/50'
                  }`}
                >
                  {b.label}
                </button>
              ))}
            </>
          )}

          {/* Contextual Controls for Level 2 (Site Switch-to-Switch Interconnects) */}
          {topologyLevel === 'site-links' && (
            <div className="flex flex-wrap items-center gap-1">
              <button
                type="button"
                onClick={() => setSelectedSiteFilter('ALL')}
                className={`px-2 py-1 rounded-md font-mono text-[11px] border cursor-pointer transition ${
                  selectedSiteFilter === 'ALL'
                    ? 'bg-emerald-500/25 text-emerald-200 border-emerald-400 font-bold'
                    : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-white'
                }`}
              >
                All Sites ({(globalGraph.switchNodes || []).length} Switches)
              </button>
              {GLOBAL_SITES.map((s) => {
                const count =
                  (globalGraph.siteSummary[s.code]?.polledCount || 0) +
                  (globalGraph.siteSummary[s.code]?.unpolledSwitchCount || 0);
                return (
                  <button
                    key={s.code}
                    type="button"
                    onClick={() => setSelectedSiteFilter(s.code)}
                    className={`px-2 py-1 rounded-md font-mono text-[11px] border cursor-pointer transition ${
                      selectedSiteFilter === s.code
                        ? 'bg-emerald-500/25 text-emerald-200 border-emerald-400 font-bold'
                        : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-white'
                    }`}
                  >
                    {s.flag} {s.code} ({count})
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Right Side Filter: VLAN Filter (Level 3) or Search Box (Level 2) */}
        {topologyLevel === 'switch-ports' && (
          <div className="flex items-center gap-2">
            <span className="text-slate-400">VLAN:</span>
            <select
              value={vlanFilter}
              onChange={(e) => setVlanFilter(e.target.value)}
              className="bg-slate-950 border border-slate-700 rounded-md px-2 py-1 text-xs text-slate-200 font-mono"
            >
              <option value="ALL">All VLANs</option>
              <option value="TRUNK">802.1Q Trunks</option>
              {vlansList.length > 0 ? (
                vlansList.map((v) => (
                  <option key={v.vlanId} value={String(v.vlanId)}>
                    VLAN {v.vlanId} — {v.name}
                  </option>
                ))
              ) : (
                <>
                  <option value="20">VLAN 20 (WLAN-MGMT)</option>
                  <option value="110">VLAN 110 (VOICE-CORP)</option>
                  <option value="10">VLAN 10 (CORP-DATA)</option>
                </>
              )}
            </select>
          </div>
        )}

        {topologyLevel === 'site-links' && (
          <div className="flex items-center gap-1.5 bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1">
            <Search className="w-3.5 h-3.5 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search switch, IP, or port..."
              className="bg-transparent text-xs font-mono text-white focus:outline-none w-48"
            />
          </div>
        )}
      </div>

      {/* ===================================================================
          LEVEL 1: GLOBAL MULTI-CAMPUS, COLOCATION & ISP WAN ARCHITECTURE
          (US: Metro <-> Halsey165 <-> Florham + US ISPs)
          (CA: VancOakridge <-> Hastings + CA ISPs)
         =================================================================== */}
      {topologyLevel === 'global-wan' && (
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2 bg-slate-900/70 border border-slate-800 rounded-xl p-3">
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Globe className="w-4 h-4 text-sky-400" />
                FDU Multi-Country Enterprise Network Architecture (~3,000 Devices • 3 Campuses • 2 Colocations • Dual-Country ISPs)
              </h3>
              <p className="text-xs text-slate-400">
                Click any Campus or Colocation below to inspect its live interconnected switches, discovered CDP neighbors, and Point-A ↔ Point-B links.
              </p>
            </div>
            <div className="flex items-center gap-3 text-xs font-mono">
              <span className="px-2.5 py-1 rounded-lg bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                Polled Switches: {globalGraph.nodes.filter((n) => n.isPolled).length}
              </span>
              <span className="px-2.5 py-1 rounded-lg bg-purple-500/15 text-purple-300 border border-purple-500/30">
                Discovered Switches: {globalGraph.switchNodes.filter((n) => !n.isPolled).length}
              </span>
              <span className="px-2.5 py-1 rounded-lg bg-amber-500/15 text-amber-300 border border-amber-500/30">
                Connected APs: {globalGraph.nodes.filter((n) => !n.isSwitchNode).length}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
            {/* UNITED STATES REGION (Metro + Florham <-> Halsey165 <-> US ISPs) */}
            <div className="lg:col-span-7 p-4 rounded-xl bg-slate-900/50 border border-sky-500/30 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                <span className="text-xs font-mono font-bold uppercase tracking-wider text-sky-300">
                  🇺🇸 United States Region (New Jersey — 2 Campuses + Halsey165 Colocation + US ISPs)
                </span>
                <span className="text-[11px] font-mono text-slate-400">~2,000 Target Devices</span>
              </div>

              {/* Top Row: US ISP Providers connected to Halsey165 */}
              <div className="space-y-1.5">
                <div className="text-[10px] font-mono uppercase tracking-wider text-amber-300">
                  US Upstream ISP & Optical Transit Providers (Terminating at Halsey165)
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  {ISP_PROVIDERS.filter((p) => p.country === 'US').map((isp) => (
                    <div
                      key={isp.id}
                      className="p-2.5 rounded-lg bg-slate-950/90 border border-amber-500/30 flex flex-col justify-between"
                    >
                      <div className="flex items-center justify-between text-[11px] font-mono">
                        <span className="text-amber-300 font-bold flex items-center gap-1">
                          <Cloud className="w-3 h-3" /> {isp.name}
                        </span>
                        <span className="text-slate-400">{isp.asn}</span>
                      </div>
                      <div className="text-[10px] text-slate-400 mt-1">{isp.role}</div>
                      <div className="text-[10px] font-mono text-emerald-300 mt-1">
                        Handoff: {isp.handoff} → {isp.peeringSite}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Middle Row: Halsey165 Colocation Hub */}
              {GLOBAL_SITES.filter((s) => s.code === 'Halsey165').map((colo) => {
                const stats = globalGraph.siteSummary[colo.code] || {};
                return (
                  <div
                    key={colo.code}
                    onClick={() => {
                      setSelectedSiteFilter(colo.code);
                      setTopologyLevel('site-links');
                    }}
                    className="p-3.5 rounded-xl bg-gradient-to-r from-indigo-950/70 via-slate-900 to-indigo-950/70 border border-indigo-400/60 hover:border-indigo-300 transition cursor-pointer shadow-lg"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="px-2 py-0.5 rounded bg-indigo-500/30 text-indigo-200 border border-indigo-400/40 text-[10px] font-mono font-bold">
                            US COLOCATION HUB
                          </span>
                          <h4 className="text-sm font-bold text-white">
                            {colo.flag} {colo.code} — {colo.name} ({colo.location})
                          </h4>
                        </div>
                        <p className="text-xs text-slate-300 mt-1">{colo.description}</p>
                      </div>
                      <div className="flex items-center gap-2 font-mono text-xs">
                        <span className="px-2 py-1 rounded bg-slate-950 border border-slate-800 text-emerald-300">
                          {stats.polledCount || 0} Polled
                        </span>
                        <span className="px-2 py-1 rounded bg-slate-950 border border-slate-800 text-amber-300">
                          {stats.neighborCount || 0} Neighbors
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}

              {/* Bottom Row: Metro Campus & Florham Campus */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {GLOBAL_SITES.filter((s) => s.code === 'Metro' || s.code === 'Florham').map((campus) => {
                  const stats = globalGraph.siteSummary[campus.code] || {};
                  return (
                    <div
                      key={campus.code}
                      onClick={() => {
                        setSelectedSiteFilter(campus.code);
                        setTopologyLevel('site-links');
                      }}
                      className="p-3.5 rounded-xl bg-slate-950/90 border border-sky-500/40 hover:border-sky-400 transition cursor-pointer flex flex-col justify-between gap-2"
                    >
                      <div>
                        <div className="flex items-center justify-between">
                          <span className="px-2 py-0.5 rounded bg-sky-500/20 text-sky-300 border border-sky-500/30 text-[10px] font-mono font-bold">
                            US CAMPUS • {campus.code}
                          </span>
                          <span className="text-[10px] font-mono text-slate-400">
                            Cap: ~{campus.targetDevices} Devices
                          </span>
                        </div>
                        <h4 className="text-sm font-bold text-white mt-1.5">
                          {campus.flag} {campus.name}
                        </h4>
                        <p className="text-[11px] text-slate-400">{campus.location}</p>
                        <p className="text-[11px] text-slate-300 mt-1">{campus.description}</p>
                      </div>

                      <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-[11px] font-mono">
                        <span className="text-emerald-300 font-bold">
                          {stats.polledCount || 0} Polled Switches
                        </span>
                        <span className="text-purple-300">
                          {stats.unpolledSwitchCount || 0} Core/Peer
                        </span>
                        <span className="text-amber-300 flex items-center gap-0.5">
                          {stats.endpointCount || 0} APs <ExternalLink className="w-3 h-3 ml-0.5" />
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* CANADA REGION (VancOakridge <-> Hastings <-> Canada ISPs) */}
            <div className="lg:col-span-5 p-4 rounded-xl bg-slate-900/50 border border-rose-500/30 space-y-4 flex flex-col justify-between">
              <div className="space-y-4">
                <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                  <span className="text-xs font-mono font-bold uppercase tracking-wider text-rose-300">
                    🇨🇦 Canada Region (British Columbia — VancOakridge + Hastings Colo + CA ISPs)
                  </span>
                  <span className="text-[11px] font-mono text-slate-400">~1,000 Target Devices</span>
                </div>

                {/* Canada ISP Providers */}
                <div className="space-y-1.5">
                  <div className="text-[10px] font-mono uppercase tracking-wider text-amber-300">
                    Canada Upstream ISP & R&E Peering Providers (Terminating at Hastings)
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    {ISP_PROVIDERS.filter((p) => p.country === 'CA').map((isp) => (
                      <div
                        key={isp.id}
                        className="p-2.5 rounded-lg bg-slate-950/90 border border-amber-500/30 flex flex-col justify-between"
                      >
                        <div className="flex items-center justify-between text-[11px] font-mono">
                          <span className="text-amber-300 font-bold truncate">{isp.name}</span>
                        </div>
                        <div className="text-[10px] text-slate-400 mt-1">{isp.role}</div>
                        <div className="text-[10px] font-mono text-emerald-300 mt-1">
                          {isp.handoff} → {isp.peeringSite}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Hastings Colocation Hub */}
                {GLOBAL_SITES.filter((s) => s.code === 'Hastings').map((colo) => {
                  const stats = globalGraph.siteSummary[colo.code] || {};
                  return (
                    <div
                      key={colo.code}
                      onClick={() => {
                        setSelectedSiteFilter(colo.code);
                        setTopologyLevel('site-links');
                      }}
                      className="p-3.5 rounded-xl bg-gradient-to-r from-purple-950/70 via-slate-900 to-purple-950/70 border border-purple-400/60 hover:border-purple-300 transition cursor-pointer shadow-lg"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="px-2 py-0.5 rounded bg-purple-500/30 text-purple-200 border border-purple-400/40 text-[10px] font-mono font-bold">
                              CANADA COLOCATION HUB
                            </span>
                            <h4 className="text-sm font-bold text-white">
                              {colo.flag} {colo.code} — {colo.name}
                            </h4>
                          </div>
                          <p className="text-xs text-slate-300 mt-1">{colo.description}</p>
                        </div>
                        <div className="flex items-center gap-2 font-mono text-xs">
                          <span className="px-2 py-1 rounded bg-slate-950 border border-slate-800 text-emerald-300">
                            {stats.polledCount || 0} Polled
                          </span>
                          <span className="px-2 py-1 rounded bg-slate-950 border border-slate-800 text-amber-300">
                            {stats.neighborCount || 0} Neighbors
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}

                {/* VancOakridge Campus */}
                {GLOBAL_SITES.filter((s) => s.code === 'VancOakridge').map((campus) => {
                  const stats = globalGraph.siteSummary[campus.code] || {};
                  return (
                    <div
                      key={campus.code}
                      onClick={() => {
                        setSelectedSiteFilter(campus.code);
                        setTopologyLevel('site-links');
                      }}
                      className="p-3.5 rounded-xl bg-slate-950/90 border border-emerald-500/40 hover:border-emerald-400 transition cursor-pointer space-y-2"
                    >
                      <div className="flex items-center justify-between">
                        <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[10px] font-mono font-bold">
                          CANADA CAMPUS • {campus.code}
                        </span>
                        <span className="text-[10px] font-mono text-slate-400">
                          Cap: ~{campus.targetDevices} Devices
                        </span>
                      </div>
                      <h4 className="text-sm font-bold text-white">
                        {campus.flag} {campus.name} ({campus.location})
                      </h4>
                      <p className="text-[11px] text-slate-300">{campus.description}</p>
                      <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-[11px] font-mono">
                        <span className="text-emerald-300 font-bold">
                          {stats.polledCount || 0} Polled Switches
                        </span>
                        <span className="text-amber-300">
                          {stats.neighborCount || 0} CDP Neighbors
                        </span>
                        <span className="text-sky-300 flex items-center gap-0.5">
                          {stats.linkCount || 0} Links <ExternalLink className="w-3 h-3" />
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Inter-Colocation & Campus Backbone Circuits Summary */}
              <div className="p-3 rounded-lg bg-slate-950/80 border border-slate-800 space-y-1.5">
                <div className="text-[10px] font-mono uppercase tracking-wider text-indigo-300">
                  Core Optical / WAN Interconnect Circuits
                </div>
                {BACKBONE_CIRCUITS.map((c) => (
                  <div
                    key={c.id}
                    className="flex items-center justify-between text-[11px] font-mono text-slate-300"
                  >
                    <span>
                      <strong className="text-white">{c.from}</strong> ↔{' '}
                      <strong className="text-white">{c.to}</strong>
                    </span>
                    <span className="text-sky-300">{c.type}</span>
                    <span className="text-emerald-300">{c.bandwidth}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================
          LEVEL 2: VISUAL MULTI-SWITCH HIERARCHY DIAGRAM + POINT-A <-> POINT-B
          (Shows all switches interconnected from Core -> MDF -> IDF + APs)
         =================================================================== */}
      {topologyLevel === 'site-links' && (
        <div className="flex-1 overflow-y-auto p-4 space-y-5">
          {/* SECTION 1: VISUAL INTERCONNECTED MULTI-SWITCH HIERARCHY DIAGRAM */}
          <div className="p-4 rounded-2xl bg-gradient-to-b from-slate-900/90 via-[#070c18] to-slate-900/90 border border-slate-800 space-y-3 shadow-xl">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800/90 pb-2.5">
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <GitCompareArrows className="w-4 h-4 text-emerald-400" />
                  Live Multi-Switch Interconnected Topology Diagram (
                  {selectedSiteFilter === 'ALL' ? 'All Sites' : selectedSiteFilter})
                </h3>
                <p className="text-xs text-slate-400">
                  Visualizes all polled switches and discovered upstream/downstream switches connected together in real time. Click <strong className="text-sky-300">Load in 3D View</strong> on any switch to inspect its 3D chassis, or <strong className="text-emerald-300">Poll SSH</strong> to expand the tree.
                </p>
              </div>
              <div className="flex items-center gap-2 text-xs font-mono">
                <span className="px-2.5 py-1 rounded-lg bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                  Polled Switches: {filteredSwitchNodes.filter((n) => n.isPolled).length}
                </span>
                <span className="px-2.5 py-1 rounded-lg bg-purple-500/15 text-purple-300 border border-purple-500/30">
                  Discovered Core/Peer Switches: {filteredSwitchNodes.filter((n) => !n.isPolled).length}
                </span>
              </div>
            </div>

            {/* TIER 1: CORE / BACKBONE SWITCHES (e.g. tcore-9600.net.fdu.edu) */}
            {tier1CoreSwitches.length > 0 && (
              <div className="space-y-2">
                <div className="text-[10px] font-mono uppercase tracking-wider text-purple-300 px-1">
                  ▲ Tier 1 — Campus Core / Colocation Backbone Switches
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                  {tier1CoreSwitches.map((sw) => renderVisualSwitchNode(sw))}
                </div>
              </div>
            )}

            {/* VISUAL FIBER / TRUNK CABLES BETWEEN TIER 1 (CORE) AND TIER 2 (MDF) */}
            {coreToMdfLinks.length > 0 && (
              <div className="py-1 flex flex-col items-center justify-center">
                <div className="w-0.5 h-3 bg-cyan-400/70" />
                <div className="flex flex-wrap items-center justify-center gap-2 px-3 py-1.5 rounded-xl bg-cyan-950/40 border border-cyan-500/40 text-xs font-mono">
                  <ArrowUpDown className="w-3.5 h-3.5 text-cyan-300" />
                  <span className="text-cyan-200 font-bold">
                    Core ↔ MDF Fiber Uplinks ({coreToMdfLinks.length}):
                  </span>
                  {coreToMdfLinks.map((lnk) => (
                    <span
                      key={lnk.id}
                      className="px-2 py-0.5 rounded bg-slate-950 border border-cyan-500/40 text-slate-200"
                    >
                      <strong className="text-purple-300">{lnk.targetHostname}</strong>{' '}
                      <span className="text-indigo-300">[{lnk.targetPort}]</span> ↔{' '}
                      <span className="text-sky-300">[{lnk.sourcePort}]</span>{' '}
                      <strong className="text-emerald-300">{lnk.sourceHostname}</strong> (
                      {lnk.mediaShortLabel})
                    </span>
                  ))}
                </div>
                <div className="w-0.5 h-3 bg-cyan-400/70" />
              </div>
            )}

            {/* TIER 2: MDF / DISTRIBUTION SWITCHES (e.g. T-BAN-2FL-WL) */}
            {tier2MdfSwitches.length > 0 && (
              <div className="space-y-2">
                <div className="text-[10px] font-mono uppercase tracking-wider text-emerald-300 px-1">
                  ◆ Tier 2 — MDF / Distribution Switches & Attached Wireless APs
                </div>
                <div className="grid grid-cols-1 gap-3">
                  {tier2MdfSwitches.map((sw) => renderVisualSwitchNode(sw))}
                </div>
              </div>
            )}

            {/* VISUAL TRUNK CABLES BETWEEN TIER 2 (MDF) AND TIER 3 (IDF / WORKSTUDY) */}
            {mdfToIdfLinks.length > 0 && (
              <div className="py-1 flex flex-col items-center justify-center">
                <div className="w-0.5 h-3 bg-emerald-400" />
                <div className="flex flex-wrap items-center justify-center gap-2 px-3 py-1.5 rounded-xl bg-emerald-950/40 border border-emerald-500/50 text-xs font-mono">
                  <ArrowUpDown className="w-3.5 h-3.5 text-emerald-300" />
                  <span className="text-emerald-200 font-bold">
                    MDF ↔ IDF Switch Trunk Interconnect ({mdfToIdfLinks.length}):
                  </span>
                  {mdfToIdfLinks.map((lnk) => (
                    <span
                      key={lnk.id}
                      className="px-2.5 py-0.5 rounded bg-slate-950 border border-emerald-500/50 text-slate-100 flex items-center gap-1.5"
                    >
                      <strong className="text-emerald-300">{lnk.sourceHostname}</strong>{' '}
                      <span className="text-sky-300 font-bold">[{lnk.sourcePort}]</span> ↔{' '}
                      <span className="text-indigo-300 font-bold">[{lnk.targetPort}]</span>{' '}
                      <strong className="text-emerald-300">{lnk.targetHostname}</strong> •{' '}
                      <span className="text-amber-300">Native VLAN {lnk.nativeVlan}</span>
                      {lnk.verifiedBiDirectional && (
                        <span className="px-1.5 py-0.2 rounded bg-emerald-500/25 text-emerald-200 text-[10px] font-bold">
                          ✓ Verified Both Ends
                        </span>
                      )}
                    </span>
                  ))}
                </div>
                <div className="w-0.5 h-3 bg-emerald-400" />
              </div>
            )}

            {/* TIER 3: DOWNSTREAM IDF / ACCESS SWITCHES (e.g. T-BAN-2FL-WorkStudy-C9300) */}
            {tier3IdfSwitches.length > 0 && (
              <div className="space-y-2">
                <div className="text-[10px] font-mono uppercase tracking-wider text-sky-300 px-1">
                  ▼ Tier 3 — Downstream IDF / Access Switches
                </div>
                <div className="grid grid-cols-1 gap-3">
                  {tier3IdfSwitches.map((sw) => renderVisualSwitchNode(sw))}
                </div>
              </div>
            )}
          </div>

          {/* SECTION 2: DETAILED POINT-A <-> POINT-B PHYSICAL INTERFACE TABLE */}
          <div className="space-y-2.5">
            <div className="flex flex-wrap items-center justify-between gap-2 bg-slate-900/75 border border-slate-800 rounded-xl p-3">
              <div>
                <h4 className="text-xs font-mono font-bold uppercase tracking-wider text-slate-200">
                  Point-A ↔ Point-B Physical Interface Link Matrix ({filteredSiteLinks.length} Links Shown)
                </h4>
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setLinkTypeFilter('SWITCHES_ONLY')}
                  className={`px-2.5 py-1 rounded-lg text-xs font-mono cursor-pointer transition ${
                    linkTypeFilter === 'SWITCHES_ONLY'
                      ? 'bg-emerald-500 text-slate-950 font-bold'
                      : 'bg-slate-950 text-slate-300 border border-slate-800'
                  }`}
                >
                  Switch-to-Switch Links ({(globalGraph.switchLinks || []).length})
                </button>
                <button
                  type="button"
                  onClick={() => setLinkTypeFilter('ALL_LINKS')}
                  className={`px-2.5 py-1 rounded-lg text-xs font-mono cursor-pointer transition ${
                    linkTypeFilter === 'ALL_LINKS'
                      ? 'bg-sky-500 text-slate-950 font-bold'
                      : 'bg-slate-950 text-slate-300 border border-slate-800'
                  }`}
                >
                  All Links Incl. APs ({globalGraph.links.length})
                </button>
              </div>
            </div>

            {filteredSiteLinks.map((lnk) => {
              const isFiber = lnk.mediaCategory === 'fiber';
              return (
                <div
                  key={lnk.id}
                  className={`p-3 rounded-xl border transition grid grid-cols-1 lg:grid-cols-12 gap-3 items-center ${
                    lnk.verifiedBiDirectional
                      ? 'bg-emerald-950/20 border-emerald-500/50 shadow-lg shadow-emerald-500/5'
                      : 'bg-slate-900/75 border-slate-800 hover:border-sky-500/40'
                  }`}
                >
                  {/* POINT A: Local Polled Switch + Physical Interface */}
                  <div className="lg:col-span-4 p-2.5 rounded-lg bg-slate-950/90 border border-sky-500/40 flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="px-1.5 py-0.5 rounded bg-sky-500/20 text-sky-300 text-[9px] font-mono font-bold">
                          POINT A • {lnk.siteCode}
                        </span>
                        <span className="text-[10px] font-mono text-emerald-400">
                          {lnk.sourceIp}
                        </span>
                      </div>
                      <div className="text-xs font-bold text-white truncate mt-1">
                        {lnk.sourceHostname}
                      </div>
                      <div className="text-[10px] font-mono text-slate-400">
                        Model: {lnk.sourceModel}
                      </div>
                    </div>
                    <div className="shrink-0 text-right">
                      <span className="px-2.5 py-1 rounded-lg bg-sky-500/25 border border-sky-400 text-sky-200 font-mono text-xs font-bold block">
                        {lnk.sourcePort}
                      </span>
                      <span className="text-[9px] font-mono text-slate-400 block mt-0.5">
                        Local Intf
                      </span>
                    </div>
                  </div>

                  {/* CENTER: Physical Cable / Fiber Media, Speed, 802.1Q Trunk VLANs & Verification Status */}
                  <div className="lg:col-span-4 flex flex-col items-center justify-center px-2 text-center">
                    <div className="flex flex-wrap items-center justify-center gap-1.5 mb-1">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-bold border ${
                          isFiber
                            ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40'
                            : 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                        }`}
                      >
                        {lnk.mediaLabel}
                      </span>
                      {lnk.isTrunk && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-indigo-500/25 text-indigo-300 border border-indigo-500/40">
                          802.1Q VLANs: {lnk.allowedVlans}
                        </span>
                      )}
                    </div>

                    <div className="w-full flex items-center gap-2 my-0.5">
                      <div
                        className={`h-0.5 flex-1 ${
                          lnk.verifiedBiDirectional
                            ? 'bg-emerald-400'
                            : isFiber
                            ? 'bg-cyan-400/70'
                            : 'bg-sky-400/70'
                        }`}
                      />
                      <ArrowLeftRight
                        className={`w-4 h-4 shrink-0 ${
                          lnk.verifiedBiDirectional ? 'text-emerald-400' : 'text-sky-400'
                        }`}
                      />
                      <div
                        className={`h-0.5 flex-1 ${
                          lnk.verifiedBiDirectional
                            ? 'bg-emerald-400'
                            : isFiber
                            ? 'bg-cyan-400/70'
                            : 'bg-sky-400/70'
                        }`}
                      />
                    </div>

                    <div className="text-[10px] font-mono mt-0.5">
                      {lnk.verifiedBiDirectional ? (
                        <span className="text-emerald-300 flex items-center gap-1 justify-center font-bold">
                          <CheckCircle2 className="w-3 h-3" /> Bi-Directionally Verified (Both Switches Polled)
                        </span>
                      ) : (
                        <span className="text-amber-300">
                          Discovered via CDP {lnk.poeWatts > 0 ? `• ⚡ ${lnk.poeWatts.toFixed(1)}W PoE` : ''}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* POINT B: Neighbor Switch / AP + Remote Physical Interface + Action Button */}
                  <div
                    className={`lg:col-span-4 p-2.5 rounded-lg border flex items-center justify-between gap-2 ${
                      lnk.verifiedBiDirectional
                        ? 'bg-slate-950/90 border-emerald-500/50'
                        : 'bg-slate-950/70 border-amber-500/40 border-dashed'
                    }`}
                  >
                    <div className="shrink-0 text-left">
                      <span className="px-2.5 py-1 rounded-lg bg-indigo-500/25 border border-indigo-400 text-indigo-200 font-mono text-xs font-bold block">
                        {lnk.targetPort}
                      </span>
                      <span className="text-[9px] font-mono text-slate-400 block mt-0.5">
                        Remote Intf
                      </span>
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span
                          className={`px-1.5 py-0.5 rounded text-[9px] font-mono font-bold ${
                            lnk.verifiedBiDirectional
                              ? 'bg-emerald-500/20 text-emerald-300'
                              : 'bg-amber-500/20 text-amber-300'
                          }`}
                        >
                          POINT B • {lnk.verifiedBiDirectional ? 'POLLED SWITCH' : 'CDP NEIGHBOR'}
                        </span>
                        <span className="text-[10px] font-mono text-emerald-400">
                          {lnk.targetIp}
                        </span>
                      </div>
                      <div className="text-xs font-bold text-white truncate mt-1">
                        {lnk.targetHostname}
                      </div>
                      <div className="text-[10px] font-mono text-slate-400 truncate">
                        Platform: {lnk.targetModel}
                      </div>
                    </div>

                    <div className="shrink-0">
                      {!lnk.verifiedBiDirectional &&
                      lnk.isSwitchInterconnect &&
                      lnk.targetIp &&
                      lnk.targetIp !== '—' &&
                      onPollNeighbor ? (
                        <button
                          type="button"
                          onClick={() => onPollNeighbor(lnk.targetIp, lnk.targetHostname)}
                          className="px-2.5 py-1.5 rounded-lg bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-slate-950 font-mono font-bold text-[11px] flex items-center gap-1 shadow cursor-pointer"
                          title={`Connect via SSH to ${lnk.targetHostname} (${lnk.targetIp}) and pull its 7 show commands`}
                        >
                          <Terminal className="w-3 h-3" />
                          Poll SSH
                        </button>
                      ) : lnk.verifiedBiDirectional ? (
                        <span className="px-2 py-1 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[10px] font-mono font-bold">
                          ✓ Polled
                        </span>
                      ) : (
                        <span className="px-2 py-1 rounded bg-slate-800 text-slate-300 text-[10px] font-mono">
                          AP / Edge
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ===================================================================
          LEVEL 3: ACTIVE SWITCH PORTS & TRUE ODD/EVEN PHYSICAL FACEPLATE
         =================================================================== */}
      {topologyLevel === 'switch-ports' && (
        <>
          <div className="flex-1 overflow-y-auto p-4 space-y-5">
            {/* TIER 1: CORE / AGGREGATION UPLINKS & STACKWISE-480 RING */}
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
              {/* Upstream Core Distribution Node (Populated from show int trunk & show cdp neighbor detail) */}
              <div
                onClick={() => onSelect({ type: 'component', id: 'uplink-module' })}
                className={`p-3.5 rounded-xl border transition cursor-pointer ${
                  selectedItem?.id === 'uplink-module'
                    ? 'bg-indigo-950/50 border-indigo-400 shadow-lg shadow-indigo-500/10'
                    : 'bg-slate-900/55 border-slate-800 hover:border-indigo-500/50'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-mono uppercase tracking-wider px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                    Upstream Uplink & CDP Neighbors • {networkModuleId}
                  </span>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setTopologyLevel('site-links');
                    }}
                    className="text-[10px] font-mono text-sky-300 hover:text-sky-200 underline cursor-pointer"
                  >
                    View Multi-Switch Map
                  </button>
                </div>
                {cdpNeighbors.length > 0 ? (
                  <div className="space-y-1.5 text-xs font-mono">
                    {cdpNeighbors.slice(0, 3).map((n, idx) => (
                      <div
                        key={`${n.localInterface}-${idx}`}
                        className="p-1.5 rounded bg-slate-950/70 border border-slate-800 flex items-center justify-between gap-2"
                      >
                        <div className="truncate">
                          <span className="text-indigo-300 font-bold">{n.localInterface}</span> →{' '}
                          <span className="text-white">{n.deviceId}</span>{' '}
                          <span className="text-sky-400">[{n.remotePort}]</span>
                          {n.neighborIp && n.neighborIp !== '—' && (
                            <span className="text-emerald-300 ml-1">({n.neighborIp})</span>
                          )}
                        </div>
                        {n.neighborIp && n.neighborIp !== '—' && onPollNeighbor && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onPollNeighbor(n.neighborIp, n.deviceId);
                            }}
                            className="px-2 py-0.5 rounded bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 text-[10px] flex items-center gap-1 shrink-0 cursor-pointer"
                            title={`Live SSH Poll ${n.deviceId} (${n.neighborIp})`}
                          >
                            <Terminal className="w-2.5 h-2.5" /> Poll SSH
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                ) : uplinkIntfs.length > 0 ? (
                  <div className="space-y-1.5 text-xs font-mono">
                    {uplinkIntfs.slice(0, 2).map((u) => (
                      <div
                        key={u.interfaceName}
                        className="p-1.5 rounded bg-slate-950/70 border border-slate-800 flex items-center justify-between"
                      >
                        <div className="truncate">
                          <span className="text-indigo-300 font-bold">{u.interfaceName}</span> →{' '}
                          <span className="text-white">
                            {u.cdpNeighbor?.deviceId || u.description || 'Core Trunk'}
                          </span>
                        </div>
                        <span className="text-emerald-300 shrink-0 ml-2">
                          {u.cdpNeighbor?.neighborIp || u.runningSpeed}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-lg bg-indigo-500/15 border border-indigo-500/30 text-indigo-300">
                      <Server className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-white">
                        Catalyst 9500 Core Pair (VSS / StackWise Virtual)
                      </h4>
                      <p className="text-xs text-slate-400">
                        802.1Q Trunks via {networkModuleId}
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* Center Root Switch: This Catalyst 9300 Active Master (Populated from show version & show ip int brief) */}
              <div
                onClick={() => onSelect({ type: 'component', id: 'chassis-main' })}
                className={`p-3.5 rounded-xl border transition cursor-pointer ${
                  selectedItem?.id === 'chassis-main'
                    ? 'bg-sky-950/50 border-sky-400 shadow-lg shadow-sky-500/10'
                    : 'bg-slate-900/75 border-sky-500/40 hover:border-sky-400'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-mono uppercase tracking-wider px-2 py-0.5 rounded bg-sky-500/20 text-sky-300 border border-sky-500/30">
                    Active {totalPortCount}-Port Switch • S/N: {devInfo?.serialNumber || 'FOC2534L9K1'}
                  </span>
                  <span className="text-[11px] font-mono text-amber-300 flex items-center gap-1">
                    <Zap className="w-3 h-3" /> {totalPoeWatts.toFixed(0)}W / {poeBudgetWatts}W PoE
                  </span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="p-2.5 rounded-lg bg-sky-500/20 border border-sky-400/40 text-sky-300">
                      <Layers className="w-5 h-5" />
                    </div>
                    <div className="min-w-0">
                      <h4 className="text-sm font-bold text-white truncate">
                        {devInfo?.hostname || 'CAMPUS-BLDG4-IDF2-SW01'} ({switchModelId} • {totalPortCount}-Port)
                      </h4>
                      <p className="text-xs text-slate-400 font-mono truncate">
                        IOS-XE {devInfo?.iosVersion || '17.12.04'} • Mgmt IP: {devInfo?.mgmtIp || '10.254.4.22'}
                      </p>
                    </div>
                  </div>
                  {devInfo?.mgmtIp && onPollNeighbor && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onPollNeighbor(devInfo.mgmtIp, devInfo.hostname);
                      }}
                      className="px-2.5 py-1.5 rounded-lg bg-sky-500/20 hover:bg-sky-500/30 text-sky-300 border border-sky-500/40 text-[11px] font-mono font-semibold flex items-center gap-1 shrink-0 cursor-pointer"
                      title="Live Re-Poll this Switch via SSH"
                    >
                      <Terminal className="w-3.5 h-3.5" /> Re-Poll SSH
                    </button>
                  )}
                </div>
              </div>

              {/* Peer StackWise-480 & StackPower Ring Members */}
              <div
                onClick={() => onSelect({ type: 'component', id: 'stackwise-ports' })}
                className={`p-3.5 rounded-xl border transition cursor-pointer ${
                  selectedItem?.id === 'stackwise-ports' || selectedItem?.id === 'stackpower-ports'
                    ? 'bg-purple-950/50 border-purple-400 shadow-lg shadow-purple-500/10'
                    : 'bg-slate-900/55 border-slate-800 hover:border-purple-500/50'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-mono uppercase tracking-wider px-2 py-0.5 rounded bg-purple-500/20 text-purple-300 border border-purple-500/30">
                    StackWise-480 & StackPower Ring
                  </span>
                  <span className="text-[11px] font-mono text-emerald-400">480 Gbps Ring Full</span>
                </div>
                <div className="flex items-center justify-between gap-2 text-xs">
                  {(devInfo?.stackSwitches && devInfo.stackSwitches.length > 0
                    ? devInfo.stackSwitches
                    : [{ switchNumber: 1, model: switchModelId, ports: totalPortCount }]
                  ).map((sw) => (
                    <div key={sw.switchNumber} className="flex-1 p-2 rounded bg-slate-950/70 border border-slate-800">
                      <div className="font-semibold text-slate-200">
                        Member #{sw.switchNumber} {sw.switchNumber === 1 ? '(Active)' : '(Member)'}
                      </div>
                      <div className="text-[11px] text-slate-400 font-mono">
                        {sw.model} ({totalPortCount} Downlink Ports)
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* TIER 2: 24-PORT OR 48-PORT ACCESS LAYER ENDPOINT TOPOLOGY MATRIX */}
            <div>
              <div className="flex items-center justify-between mb-2.5">
                <h3 className="text-xs font-mono uppercase tracking-wider text-slate-400">
                  {totalPortCount}-Port Access Layer Interfaces ({visiblePorts.length} of {totalPortCount} Shown — Correlated from show int status, cdp, vlan & run)
                </h3>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2.5">
                {visiblePorts.map((port) => {
                  const Icon = getDeviceIcon(port.endpointType);
                  const isSelected = selectedPortNumber === port.portNumber;

                  const statusStyles =
                    port.status === 'up'
                      ? 'border-slate-800 hover:border-emerald-500/50 bg-slate-900/50'
                      : port.status === 'stp-blocking'
                      ? 'border-amber-500/50 bg-amber-950/20'
                      : port.status === 'poe-fault'
                      ? 'border-rose-500/60 bg-rose-950/25'
                      : 'border-slate-800/50 bg-slate-950/40 opacity-65';

                  return (
                    <div
                      key={port.portNumber}
                      onClick={() => onSelect({ type: 'port', portNumber: port.portNumber })}
                      className={`p-2.5 rounded-lg border transition cursor-pointer flex flex-col justify-between gap-2 ${
                        isSelected
                          ? 'ring-2 ring-sky-400 border-sky-400 bg-sky-950/40 shadow-lg'
                          : statusStyles
                      }`}
                    >
                      {/* Top Row: Port Interface Badge + Trunk/VLAN + PoE Draw */}
                      <div className="flex items-center justify-between gap-1">
                        <div className="flex items-center gap-1.5">
                          <span
                            className={`w-2 h-2 rounded-full ${
                              port.status === 'up'
                                ? 'bg-emerald-400'
                                : port.status === 'stp-blocking'
                                ? 'bg-amber-400'
                                : port.status === 'poe-fault'
                                ? 'bg-rose-500 animate-pulse'
                                : 'bg-slate-600'
                            }`}
                          />
                          <span className="font-mono text-xs font-bold text-white">
                            {port.interfaceName}
                          </span>
                          <span
                            className={`text-[10px] px-1.5 py-0.5 rounded font-mono ${
                              port.isTrunk
                                ? 'bg-indigo-500/25 text-indigo-300 border border-indigo-500/40'
                                : 'bg-slate-800 text-slate-300'
                            }`}
                          >
                            {port.isTrunk ? 'TRUNK' : `VLAN ${port.vlan}`}
                          </span>
                        </div>

                        <div className="flex items-center gap-1">
                          {port.cdpNeighbor && (
                            <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-sky-500/20 text-sky-300 border border-sky-500/40">
                              CDP
                            </span>
                          )}
                          {port.cdpNeighbor?.neighborIp && port.cdpNeighbor.neighborIp !== '—' && onPollNeighbor && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                onPollNeighbor(port.cdpNeighbor.neighborIp, port.cdpNeighbor.deviceId);
                              }}
                              className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-emerald-500/20 hover:bg-emerald-500/35 text-emerald-300 border border-emerald-500/40 cursor-pointer"
                              title={`Live Poll ${port.cdpNeighbor.deviceId} (${port.cdpNeighbor.neighborIp}) via SSH`}
                            >
                              Poll SSH
                            </button>
                          )}
                          {port.poeWatts > 0 && (
                            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-300 border border-amber-500/30">
                              ⚡ {port.poeWatts}W
                            </span>
                          )}
                          {port.status === 'poe-fault' && (
                            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-300 border border-rose-500/40 flex items-center gap-0.5">
                              <AlertTriangle className="w-2.5 h-2.5" /> Err
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Endpoint Device Identity & Speed */}
                      <div className="flex items-center gap-2.5">
                        <div
                          className={`p-2 rounded-lg border ${
                            port.status === 'up'
                              ? 'bg-slate-800/90 border-slate-700 text-sky-400'
                              : 'bg-slate-900 border-slate-800 text-slate-500'
                          }`}
                        >
                          <Icon className="w-4 h-4" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="text-xs font-semibold text-slate-100 truncate">
                            {port.connectedDevice}
                          </div>
                          <div className="text-[11px] font-mono text-slate-400 truncate">
                            {port.status === 'up'
                              ? `${port.ipAddress !== '—' ? `${port.ipAddress} • ` : ''}Run:${port.speed} (Set:${port.configuredSpeed || 'auto'})`
                              : port.operStatusRaw || port.status.toUpperCase()}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Bottom Interactive Physical Faceplate Strip (True Cisco Odd-Over-Even Vertical Pairs) */}
          <div className="px-4 py-2.5 bg-slate-950/90 border-t border-slate-800">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono uppercase tracking-wider text-slate-300 font-semibold">
                  Interactive {totalPortCount}-Port Physical Faceplate Map ({switchModelId})
                </span>
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-800 text-amber-300 border border-slate-700">
                  ▲ Top Row: Odd (1, 3, 5…) • ▼ Bottom Row: Even (2, 4, 6…)
                </span>
              </div>
              <span className="text-[10px] font-mono text-sky-400">
                Click any port # to inspect its CLI running-config, CDP neighbor & status
              </span>
            </div>

            {/* Grouped into authentic 12-Port Banks (6 vertical Odd/Even columns per bank) */}
            <div className={`grid gap-3 ${is24Port ? 'grid-cols-1 md:grid-cols-2 max-w-3xl' : 'grid-cols-1 md:grid-cols-2 xl:grid-cols-4'}`}>
              {physicalBanks.map((bank) => (
                <div
                  key={bank.bankNumber}
                  className="p-2 rounded-lg bg-slate-900/70 border border-slate-800/90"
                >
                  <div className="flex items-center justify-between mb-1.5 px-0.5">
                    <span className="text-[9px] font-mono uppercase tracking-wider text-amber-400/90">
                      {bank.label}
                    </span>
                    <span className="text-[9px] font-mono text-slate-500">
                      6 Vertical Pairs
                    </span>
                  </div>
                  <div className="grid grid-cols-6 gap-1.5">
                    {bank.columns.map((col) => (
                      <div key={col.oddPort.portNumber} className="flex flex-col gap-1">
                        {/* Top Row: Odd Port (1, 3, 5, 7, 9, 11...) */}
                        {renderFaceplatePortButton(col.oddPort)}
                        {/* Bottom Row: Even Port directly below (2, 4, 6, 8, 10, 12...) */}
                        {renderFaceplatePortButton(col.evenPort)}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
