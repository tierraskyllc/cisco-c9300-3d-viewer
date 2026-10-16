import React, { useState } from 'react';
import {
  COMPONENTS_CATALOG,
  NETWORK_MODULES,
  LED_MODES,
  RJ45_PINOUT_SPEC
} from '../data/c9300HardwareData';
import {
  Cpu,
  Zap,
  Fan,
  Terminal,
  Radio,
  Cable,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Sliders,
  ChevronRight
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
  switchModel
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

  return (
    <aside className="isolated-panel w-full lg:w-[430px] xl:w-[460px] h-full bg-slate-900/65 border border-slate-800/90 rounded-xl flex flex-col overflow-hidden backdrop-blur-md shadow-2xl">
      {/* 1. PoE Power Budget & Hardware Health Summary Header */}
      <div className="p-3.5 bg-slate-950/80 border-b border-slate-800 space-y-2.5">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-mono uppercase tracking-wider text-sky-400 font-bold flex items-center gap-1.5">
            <Zap className="w-3.5 h-3.5" /> {switchModel.id} PoE Budget Telemetry
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
          <div className="grid grid-cols-2 gap-1 max-h-28 overflow-y-auto pr-1">
            {filteredComponents.map((item) => {
              const isActive =
                !isPortSelected && selectedItem?.id === item.id;
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

      {/* 2. Contextual Inspector Body (Selected Component OR Selected RJ-45 Port) */}
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
                <p className="text-xs text-slate-300 mt-0.5">
                  {activePort.connectedDevice}
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

            {/* Interactive Port State Simulator */}
            <div className="p-3 rounded-lg bg-slate-950/70 border border-slate-800 space-y-2">
              <div className="text-[11px] font-mono uppercase text-slate-400 flex items-center gap-1.5">
                <Sliders className="w-3.5 h-3.5 text-sky-400" /> Simulate Port State (Updates 3D LED & Topology)
              </div>
              <div className="grid grid-cols-4 gap-1.5">
                {[
                  { id: 'up', label: 'Link Up', color: 'emerald' },
                  { id: 'stp-blocking', label: 'STP Block', color: 'amber' },
                  { id: 'poe-fault', label: 'PoE Fault', color: 'rose' },
                  { id: 'down', label: 'Shut / Down', color: 'slate' }
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

            {/* Port Telemetry Key-Value Grid */}
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="p-2.5 rounded-lg bg-slate-950/50 border border-slate-800/80">
                <span className="text-[10px] text-slate-400 block">Speed / Duplex</span>
                <span className="font-mono font-semibold text-slate-100">
                  {activePort.speed === 'auto' ? 'Auto' : `${activePort.speed} Mbps`} /{' '}
                  {activePort.duplex.toUpperCase()}
                </span>
              </div>
              <div className="p-2.5 rounded-lg bg-slate-950/50 border border-slate-800/80">
                <span className="text-[10px] text-slate-400 block">VLAN Assignment</span>
                <span className="font-mono font-semibold text-sky-300">
                  VLAN {activePort.vlan} ({activePort.vlanName})
                </span>
              </div>
              <div className="p-2.5 rounded-lg bg-slate-950/50 border border-slate-800/80">
                <span className="text-[10px] text-slate-400 block">IEEE PoE Draw / Class</span>
                <span className="font-mono font-semibold text-amber-300">
                  {activePort.poeWatts} W ({activePort.poeClass})
                </span>
              </div>
              <div className="p-2.5 rounded-lg bg-slate-950/50 border border-slate-800/80">
                <span className="text-[10px] text-slate-400 block">TDR Cable Length</span>
                <span className="font-mono font-semibold text-slate-100">
                  {activePort.cableLengthMeters}m ({activePort.cableCategory})
                </span>
              </div>
              <div className="p-2.5 rounded-lg bg-slate-950/50 border border-slate-800/80">
                <span className="text-[10px] text-slate-400 block">Endpoint IP / Host</span>
                <span className="font-mono text-slate-200 truncate block">
                  {activePort.ipAddress}
                </span>
              </div>
              <div className="p-2.5 rounded-lg bg-slate-950/50 border border-slate-800/80">
                <span className="text-[10px] text-slate-400 block">Learned MAC Address</span>
                <span className="font-mono text-slate-200">{activePort.macAddress}</span>
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
                  PID: {activeComponent.partNumber}
                </span>
              </div>
              <h2 className="text-lg font-bold text-white mt-1.5 leading-snug">
                {activeComponent.title}
              </h2>
              <p className="text-xs text-sky-300/90 font-medium mt-0.5">
                {activeComponent.subtitle}
              </p>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed bg-slate-950/60 p-3 rounded-lg border border-slate-800">
              {activeComponent.summary}
            </p>

            {/* Interactive Hardware Simulation Controls Based on Active Component */}
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
                    <span className="text-slate-500 select-none">C9300-SW1# </span>
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
