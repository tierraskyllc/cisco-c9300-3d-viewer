import React, { useState, useMemo, useEffect } from 'react';
import CiscoChassis3D from './components/CiscoChassis3D';
import MultiDevice3DTopologyScene from './components/MultiDevice3DTopologyScene';
import TopologyViewer from './components/TopologyViewer';
import ControlPanel from './components/ControlPanel';
import ShowCommandUploader from './components/ShowCommandUploader';
import LeftNavInventoryDrawer from './components/LeftNavInventoryDrawer';
import {
  SWITCH_MODELS,
  LED_MODES,
  getPortCountForModel
} from './data/c9300HardwareData';
import {
  correlateSwitchShowData,
  SAMPLE_CAMPUS_SHOW_OUTPUTS
} from './utils/ciscoCliParser';
import {
  Wind,
  Eye,
  Tag,
  Cable,
  Sparkles,
  Sun,
  Maximize2,
  Grid3X3,
  PanelRightClose,
  PanelRightOpen
} from 'lucide-react';

export default function App() {
  // Parsed CLI & SQL Database State
  const [parsedSwitchData, setParsedSwitchData] = useState(() =>
    correlateSwitchShowData(SAMPLE_CAMPUS_SHOW_OUTPUTS)
  );
  const [savedDevices, setSavedDevices] = useState([]);
  const [storageEngine, setStorageEngine] = useState('PostgreSQL 16 (Docker)');
  const [serverLanIp, setServerLanIp] = useState('');
  const [isUploaderOpen, setIsUploaderOpen] = useState(false);
  const [uploaderMode, setUploaderMode] = useState('manual');
  const [uploaderTargetIp, setUploaderTargetIp] = useState('');
  const [uploaderTargetHostname, setUploaderTargetHostname] = useState('');

  // Core Switch Configuration & Navigation Drawer State
  const [switchModelId, setSwitchModelId] = useState('C9300-48U');
  const [networkModuleId, setNetworkModuleId] = useState('C9300-NM-8X');
  const [viewMode, setViewMode] = useState('multi-3d'); // 'multi-3d' | '3d' | 'split' | 'topology'
  const [isLeftNavOpen, setIsLeftNavOpen] = useState(true);
  const [isRightInspectorOpen, setIsRightInspectorOpen] = useState(false);
  const [selectedInventoryEntity, setSelectedInventoryEntity] = useState(null);
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

  // Load saved devices & server LAN IP from PostgreSQL API on mount
  useEffect(() => {
    fetch('/api/health')
      .then((r) => r.json())
      .then((h) => {
        if (h.serverLanIp) setServerLanIp(h.serverLanIp);
      })
      .catch(() => {});

    fetch('/api/devices')
      .then((r) => r.json())
      .then((data) => {
        if (data.storageEngine) setStorageEngine(data.storageEngine);
        if (Array.isArray(data.devices) && data.devices.length > 0) {
          setSavedDevices(data.devices);
          const first = data.devices[0];
          const snap =
            first.raw_outputs && Object.keys(first.raw_outputs).length > 0
              ? correlateSwitchShowData(first.raw_outputs)
              : first.parsed_snapshot;
          if (snap && snap.ports48) {
            setParsedSwitchData(snap);
            const detectedModel = snap.device?.model || first.model;
            if (detectedModel) {
              setSwitchModelId(detectedModel);
            }
          }
        }
      })
      .catch(() => {
        // Offline / Vite-only fallback
      });
  }, []);

  // Dynamically size ports array to 24 or 48 ports based on the active switch model
  const activePortCount = getPortCountForModel(switchModelId);
  const currentPorts = useMemo(() => {
    const base = parsedSwitchData.ports48 || [];
    if (base.length === activePortCount) return base;
    if (base.length > activePortCount) return base.slice(0, activePortCount);

    // If switching SKU selector from a 24-port model to a 48-port model, pad ports 25..48
    const padded = [...base];
    const isMgig = switchModelId.includes('UX') || switchModelId.includes('XM');
    for (let i = base.length + 1; i <= activePortCount; i++) {
      const intfName = isMgig ? `Te1/0/${i}` : `Gi1/0/${i}`;
      padded.push({
        portNumber: i,
        interfaceName: intfName,
        row: i % 2 === 1 ? 'Top Row (Odd)' : 'Bottom Row (Even)',
        bank: Math.ceil(i / 12),
        status: 'down',
        operStatusRaw: 'notconnect',
        description: 'No Description Set',
        speed: 'auto',
        configuredSpeed: 'auto',
        duplex: 'auto',
        mediaType: isMgig ? '100/1000/2.5G/5G/10GBaseTX' : '10/100/1000BaseTX',
        vlan: 1,
        vlanName: 'default',
        voiceVlan: null,
        isTrunk: false,
        trunkDetails: null,
        poeClass: 'Off',
        poeWatts: 0,
        endpointType: 'none',
        connectedDevice: 'Not Connected (RJ-45 Open)',
        cdpNeighbor: null,
        hostname: '—',
        ipAddress: '—',
        macAddress: `00:50:56:14:${(20 + i).toString(16)}:${(40 + i).toString(16)}`,
        cableLengthMeters: 0,
        cableCategory: 'Cat6 UTP',
        runningConfig: `interface ${intfName}\n switchport access vlan 1\n switchport mode access`
      });
    }
    return padded;
  }, [parsedSwitchData.ports48, activePortCount, switchModelId]);

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
    if (newParsedData.device?.model) {
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
    if (found) {
      const snap =
        found.raw_outputs && Object.keys(found.raw_outputs).length > 0
          ? correlateSwitchShowData(found.raw_outputs)
          : found.parsed_snapshot;
      if (snap) {
        setParsedSwitchData(snap);
        setSwitchModelId(snap.device?.model || found.model || 'C9300-48U');
      }
    }
  };

  const handleOpenHwDrawerForDevice = (serialNumber) => {
    if (serialNumber && serialNumber !== 'UNPOLLED') {
      handleSelectSavedDevice(serialNumber);
    }
    setIsRightInspectorOpen(true);
  };

  const handleOpenLivePoll = (targetIp = '', targetHostname = '') => {
    setUploaderMode('ssh');
    setUploaderTargetIp(targetIp || parsedSwitchData.device.mgmtIp || '');
    setUploaderTargetHostname(targetHostname || parsedSwitchData.device.hostname || '');
    setIsUploaderOpen(true);
  };

  const handleViewModeChange = (nextMode) => {
    setViewMode(nextMode);
    if (nextMode === '3d') {
      setIsRightInspectorOpen(true);
    } else if (nextMode === 'multi-3d' || nextMode === 'topology') {
      setIsRightInspectorOpen(false);
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

  const switchModel =
    SWITCH_MODELS[switchModelId] ||
    (activePortCount === 24 ? SWITCH_MODELS['C9300-24UX'] : SWITCH_MODELS['C9300-48U']);

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
    <div className="flex w-screen h-screen bg-[#060911] text-slate-100 select-none overflow-hidden">
      {/* =========================================================
          LEFT-HAND COLLAPSIBLE NAVIGATION, VIEW SWITCHER & INVENTORY DRAWER
          (Replaces the top header row to reclaim 100% vertical real estate)
         ========================================================= */}
      <LeftNavInventoryDrawer
        isOpen={isLeftNavOpen}
        onToggle={() => setIsLeftNavOpen(!isLeftNavOpen)}
        viewMode={viewMode}
        onSelectViewMode={handleViewModeChange}
        parsedSwitchData={parsedSwitchData}
        savedDevices={savedDevices}
        onSelectSavedDevice={handleSelectSavedDevice}
        switchModelId={switchModelId}
        onModelChange={handleModelChange}
        onOpenLivePoll={handleOpenLivePoll}
        onOpenManualUpload={() => {
          setUploaderMode('manual');
          setIsUploaderOpen(true);
        }}
        isRightInspectorOpen={isRightInspectorOpen}
        onOpenHwDrawerForDevice={handleOpenHwDrawerForDevice}
        selectedInventoryEntity={selectedInventoryEntity}
        onSelectInventoryEntity={setSelectedInventoryEntity}
      />

      {/* =========================================================
          MAIN WORKSPACE: FULL-HEIGHT VIEWPORTS + COLLAPSIBLE RIGHT HW DRAWER
         ========================================================= */}
      <main className="flex-1 flex flex-col lg:flex-row gap-2 p-2 min-w-0 min-h-0 overflow-hidden">
        {/* Center Interactive Canvas Column */}
        <div className="flex-1 flex flex-col gap-2 min-w-0 min-h-0">
          {/* =====================================================
              MODE 1: MULTI-DEVICE 3D NETWORK TOPOLOGY CAMERA SCENE
             ===================================================== */}
          {viewMode === 'multi-3d' && (
            <div className="flex-1 min-h-0">
              <MultiDevice3DTopologyScene
                parsedSwitchData={parsedSwitchData}
                savedDevices={savedDevices}
                onSelectSavedDevice={handleSelectSavedDevice}
                onPollNeighbor={handleOpenLivePoll}
                onSwitchToSingleChassis3D={() => {
                  setViewMode('3d');
                  setIsRightInspectorOpen(true);
                }}
                onOpenHwDrawer={handleOpenHwDrawerForDevice}
                onSelectInventoryEntity={setSelectedInventoryEntity}
                backdropBrightness={backdropBrightness}
              />
            </div>
          )}

          {/* =====================================================
              SINGLE-CHASSIS 3D VIEWPORT CONTROLS BAR (Shown in '3d' & 'split' modes)
             ===================================================== */}
          {(viewMode === '3d' || viewMode === 'split') && (
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
                  { id: 'ports', label: `${activePortCount} Ports` },
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

                <button
                  type="button"
                  onClick={() => setIsRightInspectorOpen(!isRightInspectorOpen)}
                  className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold border transition cursor-pointer ${
                    isRightInspectorOpen
                      ? 'bg-sky-500/25 text-sky-200 border-sky-400/60'
                      : 'bg-slate-800/80 text-sky-300 border-sky-500/40 hover:bg-slate-700'
                  }`}
                  title="Toggle Hardware & Port CLI Inspector Drawer for this chassis"
                >
                  {isRightInspectorOpen ? (
                    <>
                      <PanelRightClose className="w-3.5 h-3.5" /> Hide HW Drawer
                    </>
                  ) : (
                    <>
                      <PanelRightOpen className="w-3.5 h-3.5" /> HW Drawer
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* Single 3D Switch Viewport */}
          {(viewMode === '3d' || viewMode === 'split') && (
            <div className={viewMode === 'split' ? 'h-[48%] min-h-[260px]' : 'flex-1 min-h-0'}>
              <CiscoChassis3D
                portsData={currentPorts}
                selectedItem={selectedItem}
                onSelect={(item) => {
                  setSelectedItem(item);
                  setIsRightInspectorOpen(true);
                }}
                ledMode={ledMode}
                onCycleLedMode={handleCycleLedMode}
                beaconActive={beaconActive}
                onToggleBeacon={() => setBeaconActive(!beaconActive)}
                switchModelId={switchModelId}
                networkModuleId={networkModuleId}
                explodeFactor={explodeFactor}
                xrayMode={xrayMode}
                showAirflow={showAirflow}
                showLabels={showLabels && !isUploaderOpen}
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

          {/* Linked Network Topology Viewer (Shown in 'split' and 'topology' modes) */}
          {(viewMode === 'topology' || viewMode === 'split') && (
            <div className="flex-1 min-h-0">
              <TopologyViewer
                portsData={currentPorts}
                selectedItem={selectedItem}
                onSelect={(item) => {
                  setSelectedItem(item);
                  setIsRightInspectorOpen(true);
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
                savedDevices={savedDevices}
                onSelectSavedDevice={handleSelectSavedDevice}
                onPollNeighbor={handleOpenLivePoll}
                onOpenHwDrawer={handleOpenHwDrawerForDevice}
              />
            </div>
          )}
        </div>

        {/* Collapsible Right Hardware & Telemetry Inspector Sidebar */}
        {isRightInspectorOpen && (
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
            onCollapse={() => setIsRightInspectorOpen(false)}
          />
        )}
      </main>

      {/* CLI Show Command Upload, Live SSH Poller & Self-Push Studio Modal */}
      <ShowCommandUploader
        isOpen={isUploaderOpen}
        onClose={() => setIsUploaderOpen(false)}
        onDeviceIngested={handleDeviceIngested}
        storageEngine={storageEngine}
        initialMode={uploaderMode}
        initialTargetIp={uploaderTargetIp}
        initialTargetHostname={uploaderTargetHostname}
        activeDeviceData={parsedSwitchData}
        storedDevices={savedDevices}
        serverEndpointHost={serverLanIp}
      />
    </div>
  );
}
