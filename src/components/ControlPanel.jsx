import React, { useState } from 'react';
import {
  COMPONENTS_CATALOG,
  NETWORK_MODULES,
  LED_MODES,
  RJ45_PINOUT_SPEC
} from '../data/c9300HardwareData';
import {
  Zap,
  Terminal,
  Radio,
  Cable,
  Sliders,
  ChevronRight,
  Database,
  Network,
  FileCode
} from 'lucide-react';

export default function ControlPanel({
  selectedItem,
  onSelectWithCamera,
  portsData,
  onUpdatePortStatus,
  ledMode,
  onSetLedMode,
  beaconActive,
  onToggleBeacon,
  networkModuleId,
  onSetNetworkModuleId,
  psuStates,
  onSetPsuStates,
  fanFaults,
  onSetFanFaults,
  totalPoeWatts,
  poeBudgetWatts,
  switchModel,
  parsedSwitchData,
  onCollapse
}) {
  const [showPinout, setShowPinout] = useState(false);
  const [zoneTab, setZoneTab] = useState('ALL'); // 'ALL' | 'FRONT' | 'REAR' | 'INTERNAL'

  const isPortSelected = selectedItem?.type === 'port';
  const activePort = isPortSelected
    ? portsData.find((p) => p.portNumber === selectedItem.portNumber)
    : null;

  const activeComponent = !isPortSelected
    ? COMPONENTS_CATALOG[selectedItem?.id] || COMPONENTS_CATALOG['chassis-main']
    : null;

  const currentLedModeObj = LED_MODES.find((m) => m.id === ledMode) || LED_MODES[0];

  const componentList = [
    { id: 'beacon-uid', label: '#1 UID Beacon', zone: 'FRONT', cam: 'front' },
    { id: 'mode-button', label: '#2 Mode Button', zone: 'FRONT', cam: 'front' },
    { id: 'status-leds', label: '#3 Status LEDs', zone: 'FRONT', cam: 'front' },
    { id: 'usb-mini-console', label: '#4 USB Mini-B', zone: 'FRONT', cam: 'front' },
    { id: 'usb-type-a', label: '#5 USB-A Storage', zone: 'FRONT', cam: 'front' },
    { id: 'uplink-module', label: '#6 Uplink Bay', zone: 'FRONT', cam: 'uplink' },
    { id: 'psu-1', label: '#11 PSU 1 (PS1)', zone: 'REAR', cam: 'rear' },
    { id: 'psu-2', label: '#11 PSU 2 (PS2)', zone: 'REAR', cam: 'rear' },
    { id: 'stackwise-ports', label: '#10 StackWise-480', zone: 'REAR', cam: 'rear' },
    { id: 'stackpower-ports', label: '#7 StackPower', zone: 'REAR', cam: 'rear' },
    { id: 'fan-1', label: '#6 Fan Modules', zone: 'REAR', cam: 'rear' },
    { id: 'rear-mgmt-block', label: '#1–5 Mgmt & SSD', zone: 'REAR', cam: 'rear' },
    { id: 'internal-uadp-asic', label: 'UADP 2.0 ASIC', zone: 'INTERNAL', cam: 'top' },
    { id: 'internal-x86-cpu', label: 'x86 CPU & DRAM', zone: 'INTERNAL', cam: 'top' },
    { id: 'internal-poe-board', label: 'PoE+ Magnetics', zone: 'INTERNAL', cam: 'top' },
    { id: 'rack-brackets', label: '19" Rack Ears', zone: 'INTERNAL', cam: 'right' }
  ];

  const filteredComponents = componentList.filter(
    (c) => zoneTab === 'ALL' || c.zone === zoneTab
  );

  const poeUsagePercent =
    poeBudgetWatts > 0 ? Math.min(100, (totalPoeWatts / poeBudgetWatts) * 100) : 0;

  const devMeta = parsedSwitchData?.device;

  return (
    <aside className="isolated-panel w-full lg:w-[410px] xl:w-[435px] h-full bg-slate-900/65 border border-slate-800/90 rounded-xl flex flex-col overflow-hidden backdrop-blur-md shadow-2xl shrink-0">
      {/* 1. Device Identity (show version) + PoE Power Budget Header */}
      <div className="p-3.5 bg-slate-950/85 border-b border-slate-800 space-y-2">
        {devMeta && (
          <div className="flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg bg-slate-900/90 border border-slate-800 text-[11px] font-mono">
            <div className="truncate">
              <span className="text-sky-400 font-bold">{devMeta.hostname}</span>{' '}
              <span className="text-slate-400">• S/N:</span>{' '}
              <span className="text-emerald-300">{devMeta.serialNumber}</span>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <span className="text-slate-300">IOS-XE {devMeta.iosVersion}</span>
              {onCollapse && (
                <button
                  type="button"
                  onClick={onCollapse}
                  className="px-1.5 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px] cursor-pointer"
                  title="Collapse right hardware inspector drawer"
                >
                  ▶
                </button>
              )}
            </div>
          </div>
        )}

        <div className="flex items-center justify-between">
          <span className="text-[11px] font-mono uppercase tracking-wider text-sky-400 font-bold flex items-center gap-1.5">
            <Zap className="w-3.5 h-3.5" /> {switchModel.id} PoE Budget
          </span>
          <span className="text-xs font-mono text-slate-200 font-semibold">
            {totalPoeWatts.toFixed(1)} W / {poeBudgetWatts} W ({poeUsagePercent.toFixed(0)}%)
          </span>
        </div>
        <div className="w-full h-2 rounded-full bg-slate-800 overflow-hidden">
          <div
            className={`h-full transition-all duration-300 ${
              poeUsagePercent > 85
                ? 'bg-rose-500'
                : poeUsagePercent > 65
                ? 'bg-amber-400'
                : 'bg-emerald-400'
            }`}
            style={{ width: `${poeUsagePercent}%` }}
          />
        </div>

        {/* Quick Hardware Part Jump Navigator */}
        <div className="pt-1">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400">
              Hardware Component Drill-Down Index
            </span>
            <div className="flex gap-1">
              {['ALL', 'FRONT', 'REAR', 'INTERNAL'].map((tab) => (
                <button
                  key={tab}
                  onClick={() => setZoneTab(tab)}
                  className={`px-1.5 py-0.5 rounded text-[9px] font-mono cursor-pointer transition ${
                    zoneTab === tab
                      ? 'bg-sky-500/25 text-sky-300 border border-sky-500/40'
                      : 'bg-slate-900 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {tab}
                </button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-1 max-h-24 overflow-y-auto pr-1">
            {filteredComponents.map((item) => {
              const isActive = !isPortSelected && selectedItem?.id === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() =>
                    onSelectWithCamera({ type: 'component', id: item.id }, item.cam)
                  }
                  className={`px-2 py-1 rounded text-left text-[11px] font-medium flex items-center justify-between transition cursor-pointer ${
                    isActive
                      ? 'bg-sky-500/25 text-sky-200 border border-sky-400/60'
                      : 'bg-slate-900/90 text-slate-300 hover:bg-slate-800 border border-slate-800'
                  }`}
                >
                  <span className="truncate">{item.label}</span>
                  <ChevronRight className="w-3 h-3 text-slate-500 shrink-0" />
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* 2. Contextual Inspector Body (Selected Port OR Selected Chassis Component) */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {isPortSelected && activePort ? (
          /* =================================================
             SELECTED INDIVIDUAL RJ-45 PORT DRILL-DOWN VIEW
             ================================================= */
          <>
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded bg-sky-500/20 border border-sky-500/40 text-sky-300 text-[10px] font-mono uppercase">
                    Downlink Port #{activePort.portNumber}
                  </span>
                  <span className="text-[11px] font-mono text-slate-400">
                    Bank {activePort.bank} • {activePort.row}
                  </span>
                </div>
                <h2 className="text-xl font-bold text-white mt-1 font-mono">
                  Interface {activePort.interfaceName}
                </h2>
                <p className="text-xs text-emerald-300 font-mono mt-0.5">
                  Desc: {activePort.description || activePort.connectedDevice}
                </p>
              </div>
              <button
                onClick={() =>
                  onSelectWithCamera({ type: 'component', id: 'chassis-main' }, null)
                }
                className="text-xs text-slate-400 hover:text-white px-2 py-1 rounded bg-slate-800/80 cursor-pointer"
              >
                ← Chassis
              </button>
            </div>

            {/* Parsed show interface status + show int trunk + show vlan Grid */}
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="p-2.5 rounded-lg bg-slate-950/60 border border-slate-800/90">
                <span className="text-[10px] text-slate-400 block font-mono">
                  show interface status
                </span>
                <span className="font-mono font-bold text-slate-100">
                  {activePort.operStatusRaw || activePort.status} ({activePort.mediaType || '10/100/1000BaseTX'})
                </span>
              </div>
              <div className="p-2.5 rounded-lg bg-slate-950/60 border border-slate-800/90">
                <span className="text-[10px] text-slate-400 block font-mono">
                  Running vs Set Speed
                </span>
                <span className="font-mono font-bold text-sky-300">
                  Run: {activePort.speed}M | Set: {activePort.configuredSpeed || 'auto'} ({activePort.duplex})
                </span>
              </div>
              <div className="p-2.5 rounded-lg bg-slate-950/60 border border-slate-800/90">
                <span className="text-[10px] text-slate-400 block font-mono">
                  show vlan / show int trunk
                </span>
                <span className="font-mono font-semibold text-purple-300 truncate block">
                  {activePort.isTrunk
                    ? `TRUNK (Native ${activePort.vlan})`
                    : `VLAN ${activePort.vlan}: ${activePort.vlanName}`}
                </span>
              </div>
              <div className="p-2.5 rounded-lg bg-slate-950/60 border border-slate-800/90">
                <span className="text-[10px] text-slate-400 block font-mono">
                  PoE / Voice VLAN
                </span>
                <span className="font-mono font-semibold text-amber-300">
                  {activePort.poeWatts}W {activePort.voiceVlan ? `• Voice VLAN ${activePort.voiceVlan}` : ''}
                </span>
              </div>
            </div>

            {/* Parsed show cdp neighbor detail Card */}
            {activePort.cdpNeighbor && (
              <div className="p-3 rounded-lg bg-amber-950/20 border border-amber-500/40 space-y-1.5 text-xs">
                <div className="text-[10px] font-mono uppercase tracking-wider text-amber-300 font-bold flex items-center gap-1.5">
                  <Network className="w-3.5 h-3.5" /> Discovered via show cdp neighbor detail
                </div>
                <div className="grid grid-cols-2 gap-1.5 font-mono text-[11px]">
                  <div>
                    <span className="text-slate-400 block text-[10px]">Neighbor Device ID</span>
                    <span className="text-white font-bold">{activePort.cdpNeighbor.deviceId}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px]">Neighbor IPv4 Address</span>
                    <span className="text-emerald-300 font-bold">{activePort.cdpNeighbor.neighborIp}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px]">Hardware Platform</span>
                    <span className="text-slate-200">{activePort.cdpNeighbor.platform}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px]">Remote Port ID</span>
                    <span className="text-sky-300">{activePort.cdpNeighbor.remotePort}</span>
                  </div>
                </div>
              </div>
            )}

            {/* Parsed show int trunk Details (if port is Trunk) */}
            {activePort.isTrunk && activePort.trunkDetails && (
              <div className="p-3 rounded-lg bg-indigo-950/25 border border-indigo-500/40 space-y-1 text-xs font-mono">
                <div className="text-[10px] uppercase tracking-wider text-indigo-300 font-bold">
                  show int trunk — 802.1Q Trunk State
                </div>
                <div className="text-[11px] text-slate-300">
                  Mode: <strong className="text-white">{activePort.trunkDetails.mode}</strong> | Encap:{' '}
                  <strong className="text-white">{activePort.trunkDetails.encapsulation}</strong> | Native VLAN:{' '}
                  <strong className="text-amber-300">{activePort.trunkDetails.nativeVlan}</strong>
                </div>
                <div className="text-[11px] text-slate-300">
                  Allowed VLANs: <span className="text-emerald-300">{activePort.trunkDetails.allowedVlans}</span>
                </div>
              </div>
            )}

            {/* Parsed sho run | section interface Stanza */}
            {activePort.runningConfig && (
              <div className="space-y-1">
                <div className="text-[10px] font-mono uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                  <FileCode className="w-3.5 h-3.5 text-sky-400" /> sho run | section interface ({activePort.interfaceName})
                </div>
                <pre className="p-3 rounded-lg bg-[#050811] border border-slate-800 font-mono text-[11px] text-emerald-300 overflow-x-auto leading-relaxed">
                  {activePort.runningConfig}
                </pre>
              </div>
            )}

            {/* Interactive Port State Simulator */}
            <div className="p-3 rounded-lg bg-slate-950/70 border border-slate-800 space-y-2">
              <div className="text-[11px] font-mono uppercase text-slate-400 flex items-center gap-1.5">
                <Sliders className="w-3.5 h-3.5 text-sky-400" /> Simulate Port State Override
              </div>
              <div className="grid grid-cols-4 gap-1.5">
                {[
                  { id: 'up', label: 'Link Up' },
                  { id: 'stp-blocking', label: 'STP Block' },
                  { id: 'poe-fault', label: 'PoE Fault' },
                  { id: 'down', label: 'Shut / Down' }
                ].map((st) => (
                  <button
                    key={st.id}
                    onClick={() => onUpdatePortStatus(activePort.portNumber, st.id)}
                    className={`py-1.5 px-2 rounded text-[11px] font-semibold border transition cursor-pointer ${
                      activePort.status === st.id
                        ? 'bg-sky-500/25 border-sky-400 text-white'
                        : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {st.label}
                  </button>
                ))}
              </div>
            </div>

            {/* RJ-45 Pinout Reference Accordion */}
            <div className="rounded-lg border border-slate-800 bg-slate-950/60 overflow-hidden">
              <button
                onClick={() => setShowPinout(!showPinout)}
                className="w-full px-3 py-2 flex items-center justify-between text-xs font-semibold text-slate-200 hover:bg-slate-900 transition cursor-pointer"
              >
                <span className="flex items-center gap-1.5">
                  <Cable className="w-3.5 h-3.5 text-sky-400" /> RJ-45 1000BASE-T & UPOE 4-Pair Pinout
                </span>
                <span className="text-[10px] font-mono text-sky-400">
                  {showPinout ? 'Hide ▲' : 'Inspect 8 Pins ▼'}
                </span>
              </button>
              {showPinout && (
                <div className="p-2.5 border-t border-slate-800 text-[11px] overflow-x-auto">
                  <table className="w-full text-left font-mono">
                    <thead>
                      <tr className="text-slate-400 border-b border-slate-800">
                        <th className="pb-1">Pin</th>
                        <th className="pb-1">1000BASE-T</th>
                        <th className="pb-1">T568B Wire</th>
                        <th className="pb-1">UPOE 4-Pair</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60 text-slate-300">
                      {RJ45_PINOUT_SPEC.map((row) => (
                        <tr key={row.pin}>
                          <td className="py-1 font-bold text-sky-400">#{row.pin}</td>
                          <td className="py-1">{row.signal1000T}</td>
                          <td className="py-1">{row.colorT568B}</td>
                          <td className="py-1 text-amber-300">{row.poe4PairUpoe}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        ) : (
          /* =================================================
             SELECTED CHASSIS COMPONENT DRILL-DOWN VIEW
             ================================================= */
          <>
            <div>
              <div className="flex items-center justify-between gap-2">
                <span className="px-2 py-0.5 rounded bg-sky-500/20 border border-sky-500/40 text-sky-300 text-[10px] font-mono uppercase">
                  {activeComponent.higCallout} • {activeComponent.zone}
                </span>
                <span className="text-[11px] font-mono text-slate-400">
                  PID: {activeComponent.id === 'chassis-main' ? switchModel.id : activeComponent.partNumber}
                </span>
              </div>
              <h2 className="text-lg font-bold text-white mt-1.5 leading-snug">
                {activeComponent.id === 'chassis-main'
                  ? `1RU Galvanized Steel Chassis (${switchModel.id} — ${switchModel.portCount}-Port)`
                  : activeComponent.title}
              </h2>
              <p className="text-xs text-sky-300/90 font-medium mt-0.5">
                {activeComponent.subtitle}
              </p>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed bg-slate-950/60 p-3 rounded-lg border border-slate-800">
              {activeComponent.id === 'chassis-main'
                ? `Heavy-duty 1RU enterprise rackmount enclosure with front-to-back and side-to-rear cooling channels, housing the UADP 2.0 ASIC, x86 CPU complex, ${switchModel.portCount} downlink RJ-45 ports (${switchModel.downlinkDesc}), modular network uplink bay, dual hot-swap PSU bays, and 3 hot-swap fan bays.`
                : activeComponent.summary}
            </p>

            {/* Parsed show ip interface brief & show vlan Summary (When Chassis / Uplinks Selected) */}
            {parsedSwitchData &&
              (activeComponent.id === 'chassis-main' ||
                activeComponent.id === 'rear-mgmt-block' ||
                activeComponent.id === 'uplink-module') && (
                <div className="p-3 rounded-lg bg-slate-950/80 border border-slate-800 space-y-2">
                  <div className="text-[10px] font-mono uppercase tracking-wider text-emerald-400 font-bold">
                    Parsed IPv4 SVIs & Management (show ip interface brief)
                  </div>
                  <div className="grid grid-cols-2 gap-1.5 font-mono text-[11px]">
                    {parsedSwitchData.ipInterfaces
                      .filter((ip) => ip.ipAddress !== 'unassigned')
                      .map((ip, i) => (
                        <div
                          key={i}
                          className="px-2 py-1 rounded bg-slate-900 border border-slate-800 flex items-center justify-between"
                        >
                          <span className="text-sky-300 font-bold">{ip.interfaceName}</span>
                          <span className="text-emerald-300">{ip.ipAddress}</span>
                        </div>
                      ))}
                  </div>
                </div>
              )}

            {/* Interactive Hardware Simulation Controls */}
            <div className="p-3 rounded-lg bg-slate-950/80 border border-slate-800 space-y-3">
              <div className="text-[11px] font-mono uppercase tracking-wider text-sky-400 font-semibold flex items-center gap-1.5">
                <Sliders className="w-3.5 h-3.5" /> Live Interactive Hardware Controls
              </div>

              {/* 1. Uplink Network Module Hot-Swap Selector */}
              <div>
                <label className="text-[11px] text-slate-400 block mb-1">
                  Hot-Swap Network Uplink Module (Front Right Slot):
                </label>
                <select
                  value={networkModuleId}
                  onChange={(e) => onSetNetworkModuleId(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-md px-2.5 py-1.5 text-xs text-white font-mono"
                >
                  {Object.values(NETWORK_MODULES).map((nm) => (
                    <option key={nm.id} value={nm.id}>
                      {nm.name} — {nm.speed}
                    </option>
                  ))}
                </select>
              </div>

              {/* 2. Front Panel LED Mode Button Selector */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-[11px] text-slate-400">
                    Front Panel Mode Button (Port LED Meaning):
                  </label>
                  <button
                    onClick={onToggleBeacon}
                    className={`px-2 py-0.5 rounded text-[10px] font-mono border transition cursor-pointer ${
                      beaconActive
                        ? 'bg-sky-500 text-slate-950 font-bold border-sky-300 shadow-md shadow-sky-500/30'
                        : 'bg-slate-900 text-sky-300 border-sky-500/40'
                    }`}
                  >
                    <Radio className="w-3 h-3 inline mr-1" />
                    {beaconActive ? 'UID BEACON: ON' : 'UID BEACON: OFF'}
                  </button>
                </div>
                <div className="grid grid-cols-4 gap-1">
                  {LED_MODES.map((m) => (
                    <button
                      key={m.id}
                      onClick={() => onSetLedMode(m.id)}
                      className={`py-1 rounded text-[10px] font-mono font-bold border transition cursor-pointer ${
                        ledMode === m.id
                          ? 'bg-emerald-500/25 border-emerald-400 text-emerald-200'
                          : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      {m.label}
                    </button>
                  ))}
                </div>
                <p className="text-[11px] text-slate-400 mt-1.5 bg-slate-900/60 p-2 rounded border border-slate-800/80">
                  <strong className="text-emerald-300">{currentLedModeObj.title}:</strong>{' '}
                  {currentLedModeObj.description}
                </p>
              </div>

              {/* 3. Rear PSU & Fan Fault Simulation Toggles */}
              <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-800/80">
                <div>
                  <span className="text-[10px] text-slate-400 block mb-1">
                    Power Supply 2 (PS2) State:
                  </span>
                  <div className="flex gap-1">
                    {[
                      { id: 'ok', label: 'Active' },
                      { id: 'fault', label: 'Fault' },
                      { id: 'blank', label: 'Blank' }
                    ].map((st) => (
                      <button
                        key={st.id}
                        onClick={() =>
                          onSetPsuStates((prev) => ({ ...prev, psu2: st.id }))
                        }
                        className={`flex-1 py-1 rounded text-[10px] font-mono border cursor-pointer ${
                          psuStates.psu2 === st.id
                            ? 'bg-sky-500/25 border-sky-400 text-white font-bold'
                            : 'bg-slate-900 border-slate-800 text-slate-400'
                        }`}
                      >
                        {st.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <span className="text-[10px] text-slate-400 block mb-1">
                    Fan Modules (FAN-T2=):
                  </span>
                  <div className="flex gap-1">
                    {['fan1', 'fan2', 'fan3'].map((fKey, idx) => (
                      <button
                        key={fKey}
                        onClick={() =>
                          onSetFanFaults((prev) => ({
                            ...prev,
                            [fKey]: !prev[fKey]
                          }))
                        }
                        className={`flex-1 py-1 rounded text-[10px] font-mono border cursor-pointer ${
                          fanFaults[fKey]
                            ? 'bg-rose-500/30 border-rose-500 text-rose-200 font-bold'
                            : 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300'
                        }`}
                      >
                        F{idx + 1}:{fanFaults[fKey] ? 'ERR' : 'OK'}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Technical Specifications Table from Cisco HIG */}
            <div className="space-y-1.5">
              <h3 className="text-[11px] font-mono uppercase tracking-wider text-slate-400">
                Cisco Hardware Installation Guide Specifications
              </h3>
              <div className="divide-y divide-slate-800/80 rounded-lg border border-slate-800 bg-slate-950/50">
                {activeComponent.specs.map((sp, i) => (
                  <div key={i} className="px-3 py-2 flex justify-between gap-3 text-xs">
                    <span className="text-slate-400 shrink-0">{sp.label}</span>
                    <span className="text-slate-100 font-medium text-right">{sp.value}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Cisco IOS-XE CLI Verification Commands */}
            <div className="space-y-1.5">
              <h3 className="text-[11px] font-mono uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <Terminal className="w-3.5 h-3.5 text-emerald-400" /> IOS-XE CLI Verification Commands
              </h3>
              <div className="p-2.5 rounded-lg bg-[#050811] border border-slate-800 font-mono text-[11px] text-emerald-300 space-y-1">
                {activeComponent.cliCommands.map((cmd, idx) => (
                  <div key={idx} className="truncate">
                    <span className="text-slate-500 select-none">
                      {devMeta?.hostname || 'C9300-SW1'}#{' '}
                    </span>
                    {cmd}
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </aside>
  );
}
