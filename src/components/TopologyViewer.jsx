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
  Filter
} from 'lucide-react';

export default function TopologyViewer({
  portsData,
  selectedItem,
  onSelect,
  switchModelId,
  networkModuleId,
  totalPoeWatts,
  poeBudgetWatts,
  parsedSwitchData
}) {
  const [bankFilter, setBankFilter] = useState('ALL'); // 'ALL' | 1 | 2 | 3 | 4 | 'CONNECTED' | 'ISSUES'
  const [vlanFilter, setVlanFilter] = useState('ALL');

  const vlansList = parsedSwitchData?.vlans || [];
  const uplinkIntfs = parsedSwitchData?.uplinkInterfaces || [];
  const devInfo = parsedSwitchData?.device;

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

  return (
    <div className="w-full h-full flex flex-col bg-[#080d1a] rounded-xl border border-slate-800/90 overflow-hidden shadow-2xl">
      {/* Top Topology Filter & Status Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 bg-slate-900/80 border-b border-slate-800 text-xs">
        <div className="flex flex-wrap items-center gap-1.5">
          <Filter className="w-3.5 h-3.5 text-sky-400" />
          <span className="font-semibold text-slate-200 mr-1">Filter:</span>
          {[
            { id: 'ALL', label: 'All 48 Ports' },
            { id: 'CONNECTED', label: 'Connected Only' },
            { id: 1, label: 'Bank 1 (1–12)' },
            { id: 2, label: 'Bank 2 (13–24)' },
            { id: 3, label: 'Bank 3 (25–36)' },
            { id: 4, label: 'Bank 4 (37–48)' },
            { id: 'ISSUES', label: 'Alerts / Down' }
          ].map((b) => (
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
        </div>

        <div className="flex items-center gap-2">
          <span className="text-slate-400">show vlan Filter:</span>
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
                <option value="40">VLAN 40 (SEC-SURVEILLANCE)</option>
                <option value="50">VLAN 50 (BMS-IOT / UPOE+)</option>
                <option value="30">VLAN 30 (PRINT-SVCS)</option>
              </>
            )}
          </select>
        </div>
      </div>

      {/* Main Interactive Multi-Tier Topology Canvas */}
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
                Upstream Uplink Trunks • {networkModuleId}
              </span>
              <span className="text-[11px] font-mono text-emerald-400 flex items-center gap-1">
                <Activity className="w-3 h-3" /> 802.1Q Active
              </span>
            </div>
            {uplinkIntfs.length > 0 ? (
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
                    802.1Q Trunks (VLAN 10,20,30,40,50,110) via {networkModuleId}
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Center Root Switch: This Catalyst 9300-48 Active Master (Populated from show version & show ip int brief) */}
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
                Active Device • S/N: {devInfo?.serialNumber || 'FOC2534L9K1'}
              </span>
              <span className="text-[11px] font-mono text-amber-300 flex items-center gap-1">
                <Zap className="w-3 h-3" /> {totalPoeWatts.toFixed(0)}W / {poeBudgetWatts}W PoE
              </span>
            </div>
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-lg bg-sky-500/20 border border-sky-400/40 text-sky-300">
                <Layers className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <h4 className="text-sm font-bold text-white truncate">
                  {devInfo?.hostname || 'CAMPUS-BLDG4-IDF2-SW01'} ({switchModelId})
                </h4>
                <p className="text-xs text-slate-400 font-mono truncate">
                  IOS-XE {devInfo?.iosVersion || '17.12.04'} • Mgmt IP: {devInfo?.mgmtIp || '10.254.4.22'}
                </p>
              </div>
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
              <div className="flex-1 p-2 rounded bg-slate-950/70 border border-slate-800">
                <div className="font-semibold text-slate-200">Member #1 (Active)</div>
                <div className="text-[11px] text-slate-400 font-mono">{switchModelId}</div>
              </div>
              <div className="flex-1 p-2 rounded bg-slate-950/70 border border-slate-800">
                <div className="font-semibold text-slate-200">Member #2 (Standby)</div>
                <div className="text-[11px] text-slate-400 font-mono">{switchModelId}</div>
              </div>
            </div>
          </div>
        </div>

        {/* TIER 2: 48-PORT ACCESS LAYER ENDPOINT TOPOLOGY MATRIX */}
        <div>
          <div className="flex items-center justify-between mb-2.5">
            <h3 className="text-xs font-mono uppercase tracking-wider text-slate-400">
              Access Layer Interfaces ({visiblePorts.length} Shown — Correlated from show int status, cdp, vlan & run)
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
                          ? `${port.ipAddress !== '—' ? `${port.ipAddress} • ` : ''}Run:${port.speed}M (Set:${port.configuredSpeed || 'auto'})`
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

      {/* Bottom Interactive 48-Port Physical Faceplate Strip */}
      <div className="px-4 py-2.5 bg-slate-950/90 border-t border-slate-800">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400">
            Interactive 48-Port Physical Faceplate Map (Odd Top Row / Even Bottom Row)
          </span>
          <span className="text-[10px] font-mono text-sky-400">
            Click any port # to inspect its CLI running-config, CDP neighbor & status
          </span>
        </div>
        <div className="grid grid-cols-24 gap-1">
          {portsData.map((p) => {
            const isSel = selectedPortNumber === p.portNumber;
            const color =
              p.status === 'up'
                ? 'bg-emerald-500/25 border-emerald-500/50 text-emerald-200'
                : p.status === 'stp-blocking'
                ? 'bg-amber-500/30 border-amber-500/60 text-amber-200'
                : p.status === 'poe-fault'
                ? 'bg-rose-500/35 border-rose-500/70 text-rose-200'
                : 'bg-slate-900 border-slate-800 text-slate-500';
            return (
              <button
                key={p.portNumber}
                onClick={() => onSelect({ type: 'port', portNumber: p.portNumber })}
                title={`${p.interfaceName}: ${p.connectedDevice}`}
                className={`h-6 rounded text-[10px] font-mono border transition cursor-pointer ${
                  isSel
                    ? 'ring-2 ring-sky-400 bg-sky-500 text-slate-950 font-bold'
                    : `${color} hover:border-sky-400`
                }`}
              >
                {p.portNumber}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
