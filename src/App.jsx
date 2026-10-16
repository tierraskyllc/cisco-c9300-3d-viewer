import React, { useState, useMemo, useEffect } from 'react';
import CiscoChassis3D from './components/CiscoChassis3D';
import TopologyViewer from './components/TopologyViewer';
import ControlPanel from './components/ControlPanel';
import ShowCommandUploader from './components/ShowCommandUploader';
import {
  SWITCH_MODELS,
  LED_MODES
} from './data/c9300HardwareData';
import {
  correlateSwitchShowData,
  SAMPLE_CAMPUS_SHOW_OUTPUTS
} from './utils/ciscoCliParser';
import {
  Box,
  Network,
  Columns,
  Wind,
  Eye,
  Tag,
  Cable,
  Sparkles,
  Upload,
  Database,
  Sun,
  Maximize2,
  Grid3X3
} from 'lucide-react';

export default function App() {
  // Parsed CLI & SQL Database State
  const [parsedSwitchData, setParsedSwitchData] = useState(() =>
    correlateSwitchShowData(SAMPLE_CAMPUS_SHOW_OUTPUTS)
  );
  const [savedDevices, setSavedDevices] = useState([]);
  const [storageEngine, setStorageEngine] = useState('PostgreSQL 16 (Docker)');
  const [isUploaderOpen, setIsUploaderOpen] = useState(false);

  // Core Switch Configuration State
  const [switchModelId, setSwitchModelId] = useState('C9300-48U');
  const [networkModuleId, setNetworkModuleId] = useState('C9300-NM-8X');
  const [viewMode, setViewMode] = useState('split'); // '3d' | 'split' | 'topology'
  const [cameraPreset, setCameraPreset] = useState('isometric');

  // 3D Inspection, Backdrop Brightness, Scale & Disassembly Controls
  const [explodeFactor, setExplodeFactor] = useState(0); // 0.0 to 1.0
  const [backdropBrightness, setBackdropBrightness] = useState(0.68); // 0.0 (Dark) -> 0.68 (Studio Slate) -> 1.0 (Light Showroom)
  const [chassisScale, setChassisScale] = useState(1.18); // 0.85x to 1.5x
  const [showStudioGrid, setShowStudioGrid] = useState(true);
  const [xrayMode, setXrayMode] = useState(false);
  const [showAirflow, setShowAirflow] = useState(false);
  const [showLabels, setShowLabels] = useState(true);
  const [showPatchCables, setShowPatchCables] = useState(false);

  // Interactive Switch Hardware States
  const [ledMode, setLedMode] = useState('STAT');
  const [beaconActive, setBeaconActive] = useState(false);
  const [psuStates, setPsuStates] = useState({ psu1: 'ok', psu2: 'ok' });
  const [fanFaults, setFanFaults] = useState({
    fan1: false,
    fan2: false,
    fan3: false
  });

  // Load saved devices from PostgreSQL API on mount
  useEffect(() => {
    fetch('/api/devices')
      .then((r) => r.json())
      .then((data) => {
        if (data.storageEngine) setStorageEngine(data.storageEngine);
        if (Array.isArray(data.devices) && data.devices.length > 0) {
          setSavedDevices(data.devices);
          const first = data.devices[0];
          if (first.parsed_snapshot && first.parsed_snapshot.ports48) {
            setParsedSwitchData(first.parsed_snapshot);
            if (SWITCH_MODELS[first.model]) {
              setSwitchModelId(first.model);
            }
          }
        }
      })
      .catch(() => {
        // Offline / Vite-only fallback
      });
  }, []);

  const currentPorts = parsedSwitchData.ports48;

  const handleModelChange = (newModelId) => {
    setSwitchModelId(newModelId);
  };

  const handleUpdatePortStatus = (portNumber, newStatus) => {
    setParsedSwitchData((prev) => {
      const model = SWITCH_MODELS[switchModelId] || SWITCH_MODELS['C9300-48U'];
      const updatedPorts = prev.ports48.map((p) => {
        if (p.portNumber !== portNumber) return p;
        return {
          ...p,
          status: newStatus,
          operStatusRaw:
            newStatus === 'up'
              ? 'connected'
              : newStatus === 'poe-fault'
              ? 'err-disabled'
              : 'notconnect',
          poeWatts:
            newStatus === 'up' && model.maxPerPortWatts > 0
              ? p.poeWatts || 15.4
              : 0
        };
      });
      return { ...prev, ports48: updatedPorts };
    });
  };

  const handleDeviceIngested = (deviceRecord, newParsedData) => {
    setParsedSwitchData(newParsedData);
    if (SWITCH_MODELS[newParsedData.device.model]) {
      setSwitchModelId(newParsedData.device.model);
    }
    setSavedDevices((prev) => {
      const filtered = prev.filter(
        (d) => d.serial_number !== deviceRecord.serial_number
      );
      return [deviceRecord, ...filtered];
    });
  };

  const handleSelectSavedDevice = (serialNumber) => {
    const found = savedDevices.find((d) => d.serial_number === serialNumber);
    if (found && found.parsed_snapshot) {
      setParsedSwitchData(found.parsed_snapshot);
      if (SWITCH_MODELS[found.model]) {
        setSwitchModelId(found.model);
      }
    }
  };

  // Active Selection (either { type: 'component', id: 'chassis-main' } or { type: 'port', portNumber: 1 })
  const [selectedItem, setSelectedItem] = useState({
    type: 'component',
    id: 'chassis-main'
  });

  const handleSelectWithCamera = (item, preset) => {
    setSelectedItem(item);
    if (preset) {
      setCameraPreset(preset);
      if (preset === 'top' && explodeFactor < 0.25 && !xrayMode) {
        setXrayMode(true);
      }
    }
  };

  const handleCycleLedMode = () => {
    const idx = LED_MODES.findIndex((m) => m.id === ledMode);
    const next = LED_MODES[(idx + 1) % LED_MODES.length];
    setLedMode(next.id);
  };

  const switchModel = SWITCH_MODELS[switchModelId] || SWITCH_MODELS['C9300-48U'];

  // Calculate Total Active PoE Draw and Available PSU PoE Budget
  const totalPoeWatts = useMemo(() => {
    return currentPorts.reduce((acc, p) => acc + (p.poeWatts || 0), 0);
  }, [currentPorts]);

  const poeBudgetWatts = useMemo(() => {
    if (switchModel.maxPerPortWatts === 0) return 0;
    const activePsus =
      (psuStates.psu1 === 'ok' ? 1 : 0) + (psuStates.psu2 === 'ok' ? 1 : 0);
    if (activePsus === 2) return switchModel.dualPsuPoeBudget;
    if (activePsus === 1) return switchModel.defaultPoeBudget;
    return 0;
  }, [switchModel, psuStates]);

  return (
    <div className="flex flex-col w-screen h-screen bg-[#060911] text-slate-100 select-none overflow-hidden">
      {/* =========================================================
          TOP GLOBAL NAVIGATION, SQL DEVICE SELECTOR & CLI UPLOADER
         ========================================================= */}
      <header className="flex flex-wrap items-center justify-between gap-3 px-5 py-2.5 bg-slate-950/90 border-b border-slate-800/90 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-sky-500 to-blue-700 flex items-center justify-center shadow-lg shadow-sky-500/20 font-mono font-black text-white text-sm">
            C93
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base font-bold tracking-tight text-white">
                {parsedSwitchData.device.hostname} — 3D Hardware & Topology Explorer
              </h1>
              <span className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-mono uppercase rounded bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                <Database className="w-2.5 h-2.5" /> S/N: {parsedSwitchData.device.serialNumber}
              </span>
            </div>
            <p className="text-xs text-slate-400">
              IOS-XE {parsedSwitchData.device.iosVersion} • Mgmt: {parsedSwitchData.device.mgmtIp} • {switchModel.downlinkDesc}
            </p>
          </div>
        </div>

        {/* Center/Right Controls: Upload Show Commands + SQL Device Switcher + SKU + View Mode */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Primary Action: Upload / Parse 7 Cisco Show Commands */}
          <button
            onClick={() => setIsUploaderOpen(true)}
            className="px-3 py-1.5 rounded-lg bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-xs font-bold text-slate-950 shadow-lg shadow-emerald-500/20 flex items-center gap-1.5 cursor-pointer transition"
          >
            <Upload className="w-3.5 h-3.5" />
            Upload Show Commands
          </button>

          {/* SQL Database Stored Switches Selector */}
          {savedDevices.length > 0 && (
            <div className="flex items-center gap-1.5 bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1">
              <Database className="w-3.5 h-3.5 text-emerald-400" />
              <select
                value={parsedSwitchData.device.serialNumber}
                onChange={(e) => handleSelectSavedDevice(e.target.value)}
                className="bg-transparent text-xs font-mono font-semibold text-emerald-300 focus:outline-none cursor-pointer"
              >
                {savedDevices.map((d) => (
                  <option
                    key={d.serial_number}
                    value={d.serial_number}
                    className="bg-slate-950 text-slate-100"
                  >
                    {d.hostname} ({d.serial_number})
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Switch SKU Selector */}
          <div className="flex items-center gap-1.5 bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1">
            <span className="text-[11px] font-mono text-slate-400">SKU:</span>
            <select
              value={switchModelId}
              onChange={(e) => handleModelChange(e.target.value)}
              className="bg-transparent text-xs font-mono font-bold text-sky-300 focus:outline-none cursor-pointer"
            >
              {Object.values(SWITCH_MODELS).map((m) => (
                <option key={m.id} value={m.id} className="bg-slate-950 text-slate-100">
                  {m.id} ({m.poeStandard})
                </option>
              ))}
            </select>
          </div>

          {/* Primary Layout Mode Switcher: 3D Only | Split (3D + Topology) | Topology Only */}
          <div className="flex bg-slate-900 p-1 rounded-lg border border-slate-800">
            {[
              { id: '3d', label: '3D Chassis', icon: Box },
              { id: 'split', label: 'Split View', icon: Columns },
              { id: 'topology', label: 'Topology', icon: Network }
            ].map((mode) => {
              const Icon = mode.icon;
              return (
                <button
                  key={mode.id}
                  onClick={() => setViewMode(mode.id)}
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold transition cursor-pointer ${
                    viewMode === mode.id
                      ? 'bg-sky-600 text-white shadow'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  {mode.label}
                </button>
              );
            })}
          </div>
        </div>
      </header>

      {/* =========================================================
          MAIN WORKSPACE: LEFT/CENTER VIEWPORTS + RIGHT INSPECTOR
         ========================================================= */}
      <main className="flex-1 flex flex-col lg:flex-row gap-3 p-3 min-h-0 overflow-hidden">
        {/* Left/Center Interactive Canvas Column */}
        <div className="flex-1 flex flex-col gap-3 min-w-0 min-h-0">
          {/* 3D Viewport Controls Bar (Shown whenever 3D view is visible) */}
          {viewMode !== 'topology' && (
            <div className="flex flex-wrap items-center justify-between gap-2 px-3.5 py-2 bg-slate-900/75 border border-slate-800/90 rounded-xl shrink-0">
              {/* Camera Angle Quick-Jump Buttons */}
              <div className="flex flex-wrap items-center gap-1">
                <span className="text-[11px] font-mono text-slate-400 mr-1">Camera:</span>
                {[
                  { id: 'isometric', label: '3D Iso' },
                  { id: 'front', label: 'Front (0°)' },
                  { id: 'rear', label: 'Rear (180°)' },
                  { id: 'left', label: 'Left (270°)' },
                  { id: 'right', label: 'Right (90°)' },
                  { id: 'top', label: 'Top / PCB' },
                  { id: 'ports', label: '48 Ports' },
                  { id: 'uplink', label: 'Uplink Bay' }
                ].map((cam) => (
                  <button
                    key={cam.id}
                    onClick={() => setCameraPreset(cam.id)}
                    className={`px-2 py-1 rounded-md text-xs font-medium transition cursor-pointer ${
                      cameraPreset === cam.id
                        ? 'bg-sky-500/25 text-sky-300 border border-sky-500/50'
                        : 'bg-slate-800/80 text-slate-300 hover:bg-slate-700 border border-slate-700/50'
                    }`}
                  >
                    {cam.label}
                  </button>
                ))}
              </div>

              {/* Backdrop Brightness Slider + Chassis Scale + Exploded View + Visualization Toggles */}
              <div className="flex flex-wrap items-center gap-2">
                {/* 1. Backdrop Brightness Control (Dark / Slate / Showroom Light) */}
                <div className="flex items-center gap-1.5 bg-slate-950/80 px-2.5 py-1 rounded-lg border border-slate-800">
                  <Sun className="w-3.5 h-3.5 text-sky-400" />
                  <span className="text-[11px] font-mono text-slate-300">Backdrop:</span>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.02"
                    value={backdropBrightness}
                    onChange={(e) => setBackdropBrightness(parseFloat(e.target.value))}
                    className="w-16 accent-sky-400 cursor-pointer"
                    title="Adjust 3D studio backdrop brightness & lighting intensity"
                  />
                  {[
                    { label: 'Dark', val: 0.12 },
                    { label: 'Slate', val: 0.68 },
                    { label: 'Light', val: 0.96 }
                  ].map((preset) => (
                    <button
                      key={preset.label}
                      onClick={() => setBackdropBrightness(preset.val)}
                      className={`text-[10px] font-mono px-1.5 py-0.5 rounded border cursor-pointer transition ${
                        Math.abs(backdropBrightness - preset.val) < 0.1
                          ? 'bg-sky-500/25 text-sky-200 border-sky-400/60 font-bold'
                          : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-slate-200'
                      }`}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>

                {/* 2. Chassis Scale Control */}
                <div className="flex items-center gap-1.5 bg-slate-950/80 px-2.5 py-1 rounded-lg border border-slate-800">
                  <Maximize2 className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="text-[11px] font-mono text-slate-300">
                    Scale {chassisScale.toFixed(2)}×
                  </span>
                  <input
                    type="range"
                    min="0.85"
                    max="1.5"
                    step="0.05"
                    value={chassisScale}
                    onChange={(e) => setChassisScale(parseFloat(e.target.value))}
                    className="w-14 accent-emerald-400 cursor-pointer"
                    title="Scale 3D switch size in viewport"
                  />
                </div>

                {/* 3. Exploded Parts Slider */}
                <div className="flex items-center gap-1.5 bg-slate-950/80 px-2.5 py-1 rounded-lg border border-slate-800">
                  <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                  <span className="text-[11px] font-mono text-slate-300">Explode:</span>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.02"
                    value={explodeFactor}
                    onChange={(e) => setExplodeFactor(parseFloat(e.target.value))}
                    className="w-16 accent-amber-400 cursor-pointer"
                  />
                  <button
                    onClick={() => setExplodeFactor(explodeFactor > 0.1 ? 0 : 0.75)}
                    className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40 hover:bg-amber-500/30 cursor-pointer"
                  >
                    {explodeFactor > 0.1 ? 'Assemble' : 'Explode'}
                  </button>
                </div>

                <button
                  onClick={() => setShowStudioGrid(!showStudioGrid)}
                  className={`flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium border transition cursor-pointer ${
                    showStudioGrid
                      ? 'bg-sky-500/20 text-sky-300 border-sky-500/50'
                      : 'bg-slate-800/80 text-slate-400 border-slate-700/60'
                  }`}
                >
                  <Grid3X3 className="w-3.5 h-3.5" /> Floor Grid
                </button>

                <button
                  onClick={() => setXrayMode(!xrayMode)}
                  className={`flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium border transition cursor-pointer ${
                    xrayMode
                      ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/50'
                      : 'bg-slate-800/80 text-slate-300 border-slate-700/60'
                  }`}
                >
                  <Eye className="w-3.5 h-3.5" /> PCB
                </button>

                <button
                  onClick={() => setShowAirflow(!showAirflow)}
                  className={`flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium border transition cursor-pointer ${
                    showAirflow
                      ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/50'
                      : 'bg-slate-800/80 text-slate-300 border-slate-700/60'
                  }`}
                >
                  <Wind className="w-3.5 h-3.5" /> Airflow
                </button>

                <button
                  onClick={() => setShowPatchCables(!showPatchCables)}
                  className={`flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium border transition cursor-pointer ${
                    showPatchCables
                      ? 'bg-purple-500/20 text-purple-300 border-purple-500/50'
                      : 'bg-slate-800/80 text-slate-300 border-slate-700/60'
                  }`}
                >
                  <Cable className="w-3.5 h-3.5" /> Boots
                </button>

                <button
                  onClick={() => setShowLabels(!showLabels)}
                  className={`flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium border transition cursor-pointer ${
                    showLabels
                      ? 'bg-blue-500/20 text-blue-300 border-blue-500/50'
                      : 'bg-slate-800/80 text-slate-400 border-slate-700/60'
                  }`}
                >
                  <Tag className="w-3.5 h-3.5" /> Callouts
                </button>
              </div>
            </div>
          )}

          {/* 3D Switch Viewport */}
          {viewMode !== 'topology' && (
            <div className={viewMode === 'split' ? 'h-[52%] min-h-[280px]' : 'flex-1 min-h-0'}>
              <CiscoChassis3D
                portsData={currentPorts}
                selectedItem={selectedItem}
                onSelect={setSelectedItem}
                ledMode={ledMode}
                onCycleLedMode={handleCycleLedMode}
                beaconActive={beaconActive}
                onToggleBeacon={() => setBeaconActive(!beaconActive)}
                networkModuleId={networkModuleId}
                explodeFactor={explodeFactor}
                xrayMode={xrayMode}
                showAirflow={showAirflow}
                showLabels={showLabels}
                showPatchCables={showPatchCables}
                psuStates={psuStates}
                fanFaults={fanFaults}
                psuModel={switchModel.defaultPsu}
                cameraPreset={cameraPreset}
                chassisScale={chassisScale}
                backdropBrightness={backdropBrightness}
                showStudioGrid={showStudioGrid}
              />
            </div>
          )}

          {/* Linked Network Topology Viewer */}
          {viewMode !== '3d' && (
            <div className={viewMode === 'split' ? 'flex-1 min-h-0' : 'flex-1 min-h-0'}>
              <TopologyViewer
                portsData={currentPorts}
                selectedItem={selectedItem}
                onSelect={(item) => {
                  setSelectedItem(item);
                  if (item.type === 'port') {
                    setCameraPreset('ports');
                  } else if (item.id === 'uplink-module') {
                    setCameraPreset('uplink');
                  } else if (
                    item.id === 'stackwise-ports' ||
                    item.id === 'stackpower-ports'
                  ) {
                    setCameraPreset('rear');
                  }
                }}
                switchModelId={switchModelId}
                networkModuleId={networkModuleId}
                psuStates={psuStates}
                totalPoeWatts={totalPoeWatts}
                poeBudgetWatts={poeBudgetWatts}
                parsedSwitchData={parsedSwitchData}
              />
            </div>
          )}
        </div>

        {/* Right Hardware & Telemetry Inspector Sidebar */}
        <ControlPanel
          selectedItem={selectedItem}
          onSelectWithCamera={handleSelectWithCamera}
          portsData={currentPorts}
          onUpdatePortStatus={handleUpdatePortStatus}
          ledMode={ledMode}
          onSetLedMode={setLedMode}
          beaconActive={beaconActive}
          onToggleBeacon={() => setBeaconActive(!beaconActive)}
          networkModuleId={networkModuleId}
          onSetNetworkModuleId={setNetworkModuleId}
          psuStates={psuStates}
          onSetPsuStates={setPsuStates}
          fanFaults={fanFaults}
          onSetFanFaults={setFanFaults}
          totalPoeWatts={totalPoeWatts}
          poeBudgetWatts={poeBudgetWatts}
          switchModel={switchModel}
          parsedSwitchData={parsedSwitchData}
        />
      </main>

      {/* CLI Show Command Upload & SQL Ingestion Studio Modal */}
      <ShowCommandUploader
        isOpen={isUploaderOpen}
        onClose={() => setIsUploaderOpen(false)}
        onDeviceIngested={handleDeviceIngested}
        storageEngine={storageEngine}
      />
    </div>
  );
}
