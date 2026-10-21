import React, { useState, useMemo } from 'react';
import {
  Sparkles,
  Box,
  Network,
  Wifi,
  Upload,
  Database,
  Server,
  Cpu,
  Globe,
  Search,
  ChevronDown,
  ChevronRight,
  PanelLeftClose,
  PanelLeftOpen,
  PanelRightClose,
  PanelRightOpen,
  Terminal,
  CheckCircle2,
  Layers,
  Building2,
  Eye,
  EyeOff,
  Filter,
  Table2,
  Save
} from 'lucide-react';
import { SWITCH_MODELS, getPortCountForModel } from '../data/c9300HardwareData';
import { GLOBAL_SITES, buildGlobalAndSiteTopology } from '../data/globalNetworkData';

/**
 * Left-Hand Collapsible Navigation & Categorized Network Inventory Drawer
 * Houses:
 * 1) Primary View Mode Switcher (Multi-Device 3D | Switch & Group Table | Single 3D Chassis | 2D Blueprint & Tables)
 * 2) Contextual Selected Device Card (Appears when a device is clicked in the 3D/2D view or selected in Inventory):
 *    - Saved SQL Device Switcher Dropdown
 *    - Hardware Model SKU Dropdown (24-Port / 48-Port)
 *    - Live Poll Switch (SSH) & Upload Show Commands Buttons
 *    - Direct [HW Drawer] Trigger for the Selected Device
 * 3) Building & Device Visibility Filter (Filter by Building code e.g. BAN, CORE, DICK, ROB + toggle individual devices)
 * 4) Categorized Live Network Inventory Tree (Core, Polled Switches, CDP Neighbors, Wi-Fi 6 APs, Campuses & Colos)
 *    - Each switch row includes a direct [HW] icon button to open the right-hand Hardware Drawer + [👁] visibility toggle.
 */
export default function LeftNavInventoryDrawer({
  isOpen,
  onToggleOpen,
  onToggle,
  viewMode,
  onChangeViewMode,
  onSelectViewMode,
  parsedSwitchData,
  savedDevices = [],
  switchGroupOverrides = null,
  switchModelId,
  onModelChange,
  onSelectSavedDevice,
  onOpenLivePoll,
  onOpenUploadModal,
  onOpenManualUpload,
  isRightInspectorOpen,
  onOpenHwDrawerForDevice,
  selectedInventoryEntity,
  onSelectInventoryEntity,
  selectedBuildingFilter = 'ALL',
  onSelectBuildingFilter,
  showUnpolledCdpNeighbors = false,
  onToggleUnpolledCdpNeighbors,
  hiddenDeviceKeys = [],
  onToggleDeviceVisibility,
  onResetDeviceVisibility,
  layoutSaveStatus = 'Saved in SQL'
}) {
  const handleToggleOpen = onToggleOpen || onToggle;
  const handleChangeViewMode = onChangeViewMode || onSelectViewMode;
  const handleOpenUploadModal = onOpenUploadModal || onOpenManualUpload;
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedCategories, setExpandedCategories] = useState({
    core: true,
    polledSwitches: true,
    cdpSwitches: true,
    wirelessAps: true,
    campusesColos: false
  });

  const toggleCategory = (key) => {
    setExpandedCategories((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  // Build unified multi-switch & multi-campus topology graph for inventory categorization
  const globalGraph = useMemo(() => {
    return buildGlobalAndSiteTopology(savedDevices, parsedSwitchData, switchGroupOverrides);
  }, [savedDevices, parsedSwitchData, switchGroupOverrides]);

  const activePortCount = getPortCountForModel(switchModelId);
  const hiddenSet = useMemo(() => new Set(hiddenDeviceKeys), [hiddenDeviceKeys]);
  const unassignedCount = useMemo(() => {
    return (globalGraph.switchNodes || []).filter(
      (n) => !n.buildingCode || n.buildingCode === 'OTHER'
    ).length;
  }, [globalGraph]);

  // Categorize all discovered & polled inventory items (filtered by searchQuery + selectedBuildingFilter)
  const inventory = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const matchesSearch = (str) => !q || String(str || '').toLowerCase().includes(q);
    const matchesBuilding = (nodeOrEp) => {
      if (!selectedBuildingFilter || selectedBuildingFilter === 'ALL') return true;
      if (nodeOrEp.hierarchyTier === 1 || nodeOrEp.buildingCode === 'CORE') {
        return selectedBuildingFilter === 'CORE' || true; // Always keep Core visible in list for reference
      }
      return nodeOrEp.buildingCode === selectedBuildingFilter;
    };

    const switchNodes = globalGraph.switchNodes || [];

    const coreSwitches = switchNodes.filter(
      (n) =>
        n.hierarchyTier === 1 &&
        (matchesSearch(n.hostname) || matchesSearch(n.mgmtIp) || matchesSearch(n.model))
    );

    const polledSwitches = switchNodes.filter(
      (n) =>
        n.isPolled &&
        n.hierarchyTier !== 1 &&
        matchesBuilding(n) &&
        (matchesSearch(n.hostname) ||
          matchesSearch(n.mgmtIp) ||
          matchesSearch(n.model) ||
          matchesSearch(n.serialNumber) ||
          matchesSearch(n.buildingLabel))
    );

    const cdpSwitches = switchNodes.filter(
      (n) =>
        !n.isPolled &&
        n.hierarchyTier !== 1 &&
        matchesBuilding(n) &&
        (matchesSearch(n.hostname) ||
          matchesSearch(n.mgmtIp) ||
          matchesSearch(n.model) ||
          matchesSearch(n.buildingLabel))
    );

    // Collect all Wi-Fi 6 APs across all polled switches
    const allAps = [];
    for (const sw of switchNodes) {
      if (selectedBuildingFilter !== 'ALL' && sw.buildingCode !== selectedBuildingFilter) {
        continue;
      }
      for (const ep of sw.attachedEndpoints || []) {
        if (
          matchesSearch(ep.hostname) ||
          matchesSearch(ep.ip) ||
          matchesSearch(ep.model) ||
          matchesSearch(ep.localPort)
        ) {
          allAps.push({
            ...ep,
            parentSwitch: sw.hostname,
            parentSerial: sw.serialNumber
          });
        }
      }
    }

    const campusesAndColos = GLOBAL_SITES.filter(
      (s) => matchesSearch(s.name) || matchesSearch(s.code) || matchesSearch(s.location)
    );

    return {
      coreSwitches,
      polledSwitches,
      cdpSwitches,
      allAps,
      campusesAndColos,
      buildings: globalGraph.buildings || []
    };
  }, [globalGraph, searchQuery, selectedBuildingFilter]);

  // Determine the currently focused device for the Contextual Device Card
  const focusedDevice = useMemo(() => {
    if (selectedInventoryEntity?.data) {
      return selectedInventoryEntity;
    }
    const dev = parsedSwitchData?.device || {};
    return {
      type: 'polled-switch',
      id: dev.serialNumber || dev.hostname,
      data: {
        hostname: dev.hostname,
        model: switchModelId || dev.model,
        mgmtIp: dev.mgmtIp,
        serialNumber: dev.serialNumber,
        iosVersion: dev.iosVersion,
        isPolled: true
      }
    };
  }, [selectedInventoryEntity, parsedSwitchData, switchModelId]);

  const navModes = [
    { id: 'multi-3d', label: 'Multi-Device 3D', short: '3D Scene', icon: Sparkles },
    {
      id: 'switch-table',
      label: 'Switch & Group Table',
      short: 'Group Table',
      icon: Table2,
      badge: unassignedCount
    },
    { id: '3d', label: 'Single 3D Chassis', short: 'Chassis', icon: Box },
    { id: 'topology', label: '2D Blueprint & Tables', short: 'Blueprint', icon: Network }
  ];

  // =========================================================================
  // COLLAPSED SLIM ICON RAIL (56px wide — maximizes 3D & Blueprint viewport)
  // =========================================================================
  if (!isOpen) {
    return (
      <aside className="w-14 h-full bg-slate-950 border-r border-slate-800/90 flex flex-col items-center py-2.5 gap-2 shrink-0 z-30 select-none">
        {/* Brand & Expand Button */}
        <button
          type="button"
          onClick={handleToggleOpen}
          className="w-9 h-9 rounded-lg bg-gradient-to-br from-sky-500 to-blue-700 hover:from-sky-400 hover:to-blue-600 flex items-center justify-center shadow-lg shadow-sky-500/20 font-mono font-black text-white text-xs cursor-pointer transition"
          title="Expand Left Navigation & Inventory Drawer"
        >
          <PanelLeftOpen className="w-4 h-4" />
        </button>

        <div className="w-8 h-[1px] bg-slate-800 my-0.5" />

        {/* 4 View Mode Icons */}
        {navModes.map((m) => {
          const Icon = m.icon;
          const active = viewMode === m.id;
          return (
            <button
              key={m.id}
              type="button"
              onClick={() => handleChangeViewMode && handleChangeViewMode(m.id)}
              className={`relative w-9 h-9 rounded-lg flex items-center justify-center transition cursor-pointer ${
                active
                  ? 'bg-sky-600 text-white shadow-lg shadow-sky-600/30'
                  : 'bg-slate-900 text-slate-400 hover:text-white hover:bg-slate-800 border border-slate-800'
              }`}
              title={m.label}
            >
              <Icon className="w-4 h-4" />
              {m.badge > 0 && (
                <span className="absolute -top-1 -right-1 px-1 rounded-full bg-amber-500 text-slate-950 text-[8px] font-mono font-black">
                  {m.badge}
                </span>
              )}
            </button>
          );
        })}

        <div className="w-8 h-[1px] bg-slate-800 my-0.5" />

        {/* Quick Action Icons when Collapsed */}
        <button
          type="button"
          onClick={() =>
            onOpenLivePoll(
              parsedSwitchData?.device?.mgmtIp,
              parsedSwitchData?.device?.hostname
            )
          }
          className="w-9 h-9 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 flex items-center justify-center cursor-pointer transition"
          title="Live Poll Switch (SSH)"
        >
          <Wifi className="w-4 h-4" />
        </button>

        <button
          type="button"
          onClick={handleOpenUploadModal}
          className="w-9 h-9 rounded-lg bg-slate-900 hover:bg-slate-800 text-sky-300 border border-sky-500/40 flex items-center justify-center cursor-pointer transition"
          title="Upload Show Commands"
        >
          <Upload className="w-4 h-4" />
        </button>

        <button
          type="button"
          onClick={() => onOpenHwDrawerForDevice(parsedSwitchData?.device?.serialNumber)}
          className={`w-9 h-9 rounded-lg border flex items-center justify-center cursor-pointer transition ${
            isRightInspectorOpen
              ? 'bg-sky-500 text-slate-950 border-sky-300 shadow-lg shadow-sky-500/25'
              : 'bg-slate-900 text-slate-300 border-slate-800 hover:text-white'
          }`}
          title={
            isRightInspectorOpen
              ? 'Collapse Right Hardware (HW) Drawer'
              : 'Open Right Hardware (HW) Drawer for Active Switch'
          }
        >
          {isRightInspectorOpen ? (
            <PanelRightClose className="w-4 h-4" />
          ) : (
            <PanelRightOpen className="w-4 h-4" />
          )}
        </button>
      </aside>
    );
  }

  // =========================================================================
  // EXPANDED LEFT NAVIGATION & CATEGORIZED INVENTORY DRAWER
  // =========================================================================
  return (
    <aside className="w-72 xl:w-80 h-full bg-slate-950/95 border-r border-slate-800/90 flex flex-col overflow-hidden shrink-0 z-30 select-none shadow-2xl">
      {/* 1. COMPACT BRAND & COLLAPSE HEADER */}
      <div className="px-3 py-2.5 bg-slate-900/90 border-b border-slate-800 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-sky-500 to-blue-700 flex items-center justify-center font-mono font-black text-white text-xs shrink-0">
            C93
          </div>
          <div className="min-w-0">
            <div className="text-xs font-bold text-white truncate">
              FDU 3D &amp; Topology Explorer
            </div>
            <div className="text-[10px] font-mono text-slate-400 truncate flex items-center gap-1.5">
              <span>{savedDevices.length} Polled • {inventory.allAps.length} APs</span>
              <span className="px-1.5 py-0.2 rounded bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 font-mono text-[9.5px] inline-flex items-center gap-1">
                <Save className="w-2.5 h-2.5" />
                {layoutSaveStatus}
              </span>
            </div>
          </div>
        </div>
        <button
          type="button"
          onClick={handleToggleOpen}
          className="px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white border border-slate-700 flex items-center gap-1 text-[10px] font-mono cursor-pointer transition shrink-0"
          title="Collapse Left Drawer to Slim Rail"
        >
          <PanelLeftClose className="w-3.5 h-3.5 text-sky-400" />
          <span>◀</span>
        </button>
      </div>

      {/* 2. VIEW MODE NAVIGATION SECTION */}
      <div className="p-2.5 border-b border-slate-800/90 bg-slate-950">
        <div className="text-[10px] font-mono uppercase tracking-wider text-slate-400 font-bold mb-1.5 px-1">
          Workspace View Mode
        </div>
        <div className="grid grid-cols-2 gap-1.5">
          {navModes.map((mode) => {
            const Icon = mode.icon;
            const active = viewMode === mode.id;
            return (
              <button
                key={mode.id}
                type="button"
                onClick={() => handleChangeViewMode && handleChangeViewMode(mode.id)}
                className={`flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-lg text-[11px] font-semibold transition cursor-pointer ${
                  active
                    ? mode.id === 'multi-3d'
                      ? 'bg-gradient-to-r from-cyan-600 to-blue-600 text-white shadow'
                      : mode.id === 'switch-table'
                      ? 'bg-gradient-to-r from-emerald-600 to-cyan-600 text-white shadow'
                      : 'bg-sky-600 text-white shadow'
                    : mode.id === 'switch-table'
                    ? 'bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20 border border-emerald-500/30'
                    : 'bg-slate-900 text-slate-300 hover:text-white border border-slate-800/90'
                }`}
              >
                <Icon className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate">{mode.label}</span>
                {mode.badge > 0 && (
                  <span className="px-1 py-0.2 rounded-full bg-amber-500 text-slate-950 text-[9px] font-mono font-black shrink-0">
                    {mode.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* 3. CONTEXTUAL SELECTED DEVICE CONTROLS (Shown when a device is clicked in View or Inventory) */}
      <div className="p-2.5 border-b border-slate-800/90 bg-slate-900/50 space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-mono uppercase tracking-wider text-cyan-400 font-bold flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3 text-emerald-400" />
            Selected Device Controls
          </span>
          <button
            type="button"
            onClick={() =>
              onOpenHwDrawerForDevice(
                focusedDevice?.data?.serialNumber ||
                  parsedSwitchData?.device?.serialNumber
              )
            }
            className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold flex items-center gap-1 border cursor-pointer transition ${
              isRightInspectorOpen
                ? 'bg-sky-500 text-slate-950 border-sky-300'
                : 'bg-sky-500/20 text-sky-300 border-sky-500/40 hover:bg-sky-500/30'
            }`}
            title={
              isRightInspectorOpen
                ? 'Collapse Right Hardware & Port Inspector Drawer'
                : 'Open Right Hardware & Port Inspector Drawer for this Device'
            }
          >
            {isRightInspectorOpen ? (
              <>
                <PanelRightClose className="w-3 h-3" />
                Hide HW
              </>
            ) : (
              <>
                <PanelRightOpen className="w-3 h-3" />
                HW Drawer
              </>
            )}
          </button>
        </div>

        {/* Active / Selected Device Summary Pill */}
        <div className="p-2 rounded-lg bg-slate-950 border border-slate-800 font-mono">
          <div className="flex items-center justify-between gap-1">
            <span className="text-xs font-bold text-white truncate">
              {focusedDevice?.data?.hostname || parsedSwitchData?.device?.hostname}
            </span>
            <span className="px-1.5 py-0.5 rounded bg-sky-500/15 text-sky-300 border border-sky-500/30 text-[9px] shrink-0">
              {activePortCount}-Port
            </span>
          </div>
          <div className="text-[10px] text-slate-400 mt-0.5 truncate">
            IP: <span className="text-emerald-300">{focusedDevice?.data?.mgmtIp || parsedSwitchData?.device?.mgmtIp}</span> • S/N:{' '}
            <span className="text-slate-200">{focusedDevice?.data?.serialNumber || parsedSwitchData?.device?.serialNumber}</span>
          </div>
        </div>

        {/* Stored SQL Switch Selector Dropdown */}
        {savedDevices.length > 0 && (
          <div className="flex items-center gap-1.5 bg-slate-950 border border-slate-800 rounded-lg px-2 py-1">
            <Database className="w-3 h-3 text-emerald-400 shrink-0" />
            <span className="text-[10px] font-mono text-slate-400 shrink-0">Switch:</span>
            <select
              value={parsedSwitchData?.device?.serialNumber || ''}
              onChange={(e) => onSelectSavedDevice(e.target.value)}
              className="bg-transparent text-[11px] font-mono font-semibold text-emerald-300 focus:outline-none cursor-pointer w-full truncate"
            >
              {savedDevices.map((d) => (
                <option
                  key={d.serial_number}
                  value={d.serial_number}
                  className="bg-slate-950 text-slate-100"
                >
                  {d.hostname} ({d.model || 'C9300'} • {d.serial_number})
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Hardware Model SKU Dropdown (Hidden in Multi-Device 3D view where each switch uses its actual model) */}
        {viewMode !== 'multi-3d' && (
          <div className="flex items-center gap-1.5 bg-slate-950 border border-slate-800 rounded-lg px-2 py-1">
            <Cpu className="w-3 h-3 text-sky-400 shrink-0" />
            <span className="text-[10px] font-mono text-slate-400 shrink-0">Model:</span>
            <select
              value={switchModelId}
              onChange={(e) => onModelChange(e.target.value)}
              className="bg-transparent text-[11px] font-mono font-bold text-sky-300 focus:outline-none cursor-pointer w-full truncate"
            >
              {Object.values(SWITCH_MODELS).map((m) => (
                <option key={m.id} value={m.id} className="bg-slate-950 text-slate-100">
                  {m.id} ({m.portCount}-Port • {m.poeStandard})
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Live Poll Switch (SSH) & Upload Show Commands Buttons */}
        <div className="grid grid-cols-2 gap-1.5 pt-0.5">
          <button
            type="button"
            onClick={() =>
              onOpenLivePoll(
                focusedDevice?.data?.mgmtIp || parsedSwitchData?.device?.mgmtIp,
                focusedDevice?.data?.hostname || parsedSwitchData?.device?.hostname
              )
            }
            className="px-2 py-1.5 rounded-lg bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-[11px] font-bold text-slate-950 shadow flex items-center justify-center gap-1 cursor-pointer transition"
            title="Live Poll this Switch via SSH"
          >
            <Wifi className="w-3 h-3 shrink-0" />
            <span className="truncate">Live Poll (SSH)</span>
          </button>

          <button
            type="button"
            onClick={handleOpenUploadModal}
            className="px-2 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-sky-500/40 text-[11px] font-bold text-sky-200 flex items-center justify-center gap-1 cursor-pointer transition"
            title="Upload 7 Cisco IOS-XE Show Commands"
          >
            <Upload className="w-3 h-3 text-sky-400 shrink-0" />
            <span className="truncate">Upload CLI</span>
          </button>
        </div>
      </div>

      {/* 4. CATEGORIZED NETWORK INVENTORY TREE + BUILDING & DEVICE VISIBILITY FILTERS */}
      <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
        {/* Building & Device Filter Header */}
        <div className="p-2.5 pb-2 bg-slate-950 border-b border-slate-800/80 space-y-1.5">
          <div className="text-[10px] font-mono uppercase tracking-wider text-slate-400 font-bold px-0.5 flex items-center justify-between">
            <span className="flex items-center gap-1">
              <Filter className="w-3 h-3 text-cyan-400" />
              Building &amp; Device Filter
            </span>
            <span className="text-emerald-400">
              {inventory.coreSwitches.length +
                inventory.polledSwitches.length +
                inventory.cdpSwitches.length +
                inventory.allAps.length}{' '}
              Shown
            </span>
          </div>

          {/* Building Filter Selector */}
          <div className="flex items-center gap-1.5 bg-slate-900 border border-slate-800 rounded-lg px-2 py-1">
            <Building2 className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
            <span className="text-[10px] font-mono text-slate-400 shrink-0">Bldg:</span>
            <select
              value={selectedBuildingFilter}
              onChange={(e) =>
                onSelectBuildingFilter && onSelectBuildingFilter(e.target.value)
              }
              className="bg-transparent text-[11px] font-mono font-bold text-cyan-300 focus:outline-none cursor-pointer w-full truncate"
              title="Filter 3D Scene, 2D Blueprint, and Inventory by Campus Building"
            >
              <option value="ALL" className="bg-slate-950 text-slate-100">
                All Campus Buildings ({inventory.buildings.length})
              </option>
              {inventory.buildings.map((b) => (
                <option
                  key={b.code}
                  value={b.code}
                  className="bg-slate-950 text-slate-100"
                >
                  {b.label} — {b.polledCount} Polled
                  {b.unpolledCount > 0 ? `, ${b.unpolledCount} CDP` : ''}
                  {b.apCount > 0 ? `, ${b.apCount} APs` : ''}
                </option>
              ))}
            </select>
          </div>

          {/* Canvas Scope Toggle (Polled Only vs + Unpolled CDP Neighbors) + Hidden Reset */}
          <div className="flex items-center justify-between gap-1.5">
            <button
              type="button"
              onClick={() =>
                onToggleUnpolledCdpNeighbors &&
                onToggleUnpolledCdpNeighbors(!showUnpolledCdpNeighbors)
              }
              className={`flex-1 px-2 py-1 rounded-md text-[10px] font-mono font-semibold border flex items-center justify-center gap-1 cursor-pointer transition ${
                showUnpolledCdpNeighbors
                  ? 'bg-purple-500/20 text-purple-200 border-purple-400/50'
                  : 'bg-slate-900 text-emerald-300 border-slate-800 hover:border-slate-700'
              }`}
              title="Keep 3D & 2D canvas focused on Polled Switches + Core, or include unpolled CDP switches"
            >
              {showUnpolledCdpNeighbors
                ? '3D/2D: Polled + CDP Neighbors'
                : '3D/2D: Polled + Core Only'}
            </button>

            {hiddenDeviceKeys.length > 0 && (
              <button
                type="button"
                onClick={() => onResetDeviceVisibility && onResetDeviceVisibility()}
                className="px-2 py-1 rounded-md bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 text-[10px] font-mono font-bold shrink-0 cursor-pointer transition"
                title="Unhide all manually hidden devices"
              >
                Show All ({hiddenDeviceKeys.length})
              </button>
            )}
          </div>

          {/* Search Input */}
          <div className="flex items-center gap-1.5 bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1">
            <Search className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search hostname, building, IP..."
              className="bg-transparent text-xs font-mono text-white focus:outline-none w-full"
            />
          </div>
        </div>

        {/* Scrollable Category Accordions */}
        <div className="flex-1 overflow-y-auto px-2.5 pt-2 pb-3 space-y-2 text-xs font-mono">
          {/* CATEGORY 1: TIER 1 CORE BACKBONE */}
          <div className="rounded-xl border border-slate-800/90 bg-slate-900/40 overflow-hidden">
            <button
              type="button"
              onClick={() => toggleCategory('core')}
              className="w-full px-2.5 py-1.5 bg-slate-900/90 hover:bg-slate-900 flex items-center justify-between text-left cursor-pointer"
            >
              <span className="text-[11px] font-bold text-amber-300 flex items-center gap-1.5">
                {expandedCategories.core ? (
                  <ChevronDown className="w-3.5 h-3.5" />
                ) : (
                  <ChevronRight className="w-3.5 h-3.5" />
                )}
                Tier 1 Core Backbone
              </span>
              <span className="px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 text-[10px]">
                {inventory.coreSwitches.length}
              </span>
            </button>

            {expandedCategories.core && (
              <div className="p-1.5 space-y-1">
                {inventory.coreSwitches.map((core) => {
                  const isSel = focusedDevice?.data?.hostname === core.hostname;
                  const isHidden = hiddenSet.has(core.key);
                  return (
                    <div
                      key={core.id}
                      onClick={() => {
                        if (core.isPolled && core.serialNumber) {
                          onSelectSavedDevice(core.serialNumber);
                        }
                        if (onSelectInventoryEntity) {
                          onSelectInventoryEntity({
                            type: 'device',
                            id: core.id,
                            data: core
                          });
                        }
                      }}
                      className={`p-2 rounded-lg border flex items-center justify-between gap-1.5 cursor-pointer transition ${
                        isHidden ? 'opacity-45 ' : ''
                      }${
                        isSel
                          ? 'bg-amber-950/50 border-amber-400'
                          : 'bg-slate-950/80 border-slate-800/80 hover:border-amber-500/50'
                      }`}
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-1">
                          <span
                            className={`w-2 h-2 rounded-full shrink-0 ${
                              core.isPolled ? 'bg-emerald-400' : 'bg-amber-400'
                            }`}
                          />
                          <span className="text-[11px] font-bold text-white truncate">
                            {core.hostname}
                          </span>
                        </div>
                        <div className="text-[9.5px] text-slate-400 truncate">
                          {core.model} • <span className="text-emerald-300">{core.mgmtIp}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        {onToggleDeviceVisibility && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onToggleDeviceVisibility(core.key);
                            }}
                            className={`p-1 rounded border cursor-pointer transition ${
                              isHidden
                                ? 'bg-slate-900 text-slate-500 border-slate-800 hover:text-slate-300'
                                : 'bg-slate-900 text-emerald-400 border-slate-700 hover:text-white'
                            }`}
                            title={
                              isHidden
                                ? `Show ${core.hostname} in 3D/2D views`
                                : `Hide ${core.hostname} from 3D/2D views`
                            }
                          >
                            {isHidden ? (
                              <EyeOff className="w-3 h-3" />
                            ) : (
                              <Eye className="w-3 h-3" />
                            )}
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onOpenLivePoll(core.mgmtIp, core.hostname);
                          }}
                          className="px-1.5 py-1 rounded bg-emerald-500/20 hover:bg-emerald-500/35 text-emerald-300 border border-emerald-500/40 text-[9px] font-bold shrink-0 cursor-pointer"
                          title="Poll Core Switch via SSH"
                        >
                          SSH
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* CATEGORY 2: POLLED CATALYST SWITCHES (SQL VERIFIED) */}
          <div className="rounded-xl border border-slate-800/90 bg-slate-900/40 overflow-hidden">
            <button
              type="button"
              onClick={() => toggleCategory('polledSwitches')}
              className="w-full px-2.5 py-1.5 bg-slate-900/90 hover:bg-slate-900 flex items-center justify-between text-left cursor-pointer"
            >
              <span className="text-[11px] font-bold text-emerald-300 flex items-center gap-1.5">
                {expandedCategories.polledSwitches ? (
                  <ChevronDown className="w-3.5 h-3.5" />
                ) : (
                  <ChevronRight className="w-3.5 h-3.5" />
                )}
                Polled Switches (SQL)
              </span>
              <span className="px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-300 text-[10px]">
                {inventory.polledSwitches.length}
              </span>
            </button>

            {expandedCategories.polledSwitches && (
              <div className="p-1.5 space-y-1">
                {inventory.polledSwitches.map((sw) => {
                  const isActiveSwitch =
                    parsedSwitchData?.device?.serialNumber === sw.serialNumber;
                  const isHidden = hiddenSet.has(sw.key);
                  return (
                    <div
                      key={sw.id}
                      onClick={() => {
                        if (sw.serialNumber) {
                          onSelectSavedDevice(sw.serialNumber);
                        }
                        if (onSelectInventoryEntity) {
                          onSelectInventoryEntity({
                            type: 'device',
                            id: sw.id,
                            data: sw
                          });
                        }
                      }}
                      className={`p-2 rounded-lg border flex items-center justify-between gap-1.5 cursor-pointer transition ${
                        isHidden ? 'opacity-45 ' : ''
                      }${
                        isActiveSwitch
                          ? 'bg-sky-950/60 border-sky-400'
                          : 'bg-slate-950/80 border-slate-800/80 hover:border-sky-500/50'
                      }`}
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-1">
                          <span className="w-2 h-2 rounded-full bg-emerald-400 shrink-0" />
                          <span className="text-[11px] font-bold text-white truncate">
                            {sw.hostname}
                          </span>
                        </div>
                        <div className="text-[9.5px] text-slate-400 truncate">
                          <span className="text-cyan-300">[{sw.buildingCode}]</span> {sw.model} •{' '}
                          <span className="text-sky-300">{sw.mgmtIp}</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        {onToggleDeviceVisibility && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onToggleDeviceVisibility(sw.key);
                            }}
                            className={`p-1 rounded border cursor-pointer transition ${
                              isHidden
                                ? 'bg-slate-900 text-slate-500 border-slate-800 hover:text-slate-300'
                                : 'bg-slate-900 text-emerald-400 border-slate-700 hover:text-white'
                            }`}
                            title={
                              isHidden
                                ? `Show ${sw.hostname} in 3D/2D views`
                                : `Hide ${sw.hostname} from 3D/2D views`
                            }
                          >
                            {isHidden ? (
                              <EyeOff className="w-3 h-3" />
                            ) : (
                              <Eye className="w-3 h-3" />
                            )}
                          </button>
                        )}
                        {/* Direct [HW] Drawer Icon on Device Row */}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onOpenHwDrawerForDevice(sw.serialNumber);
                          }}
                          className="px-1.5 py-1 rounded bg-sky-500/20 hover:bg-sky-500 text-sky-300 hover:text-slate-950 border border-sky-500/40 text-[9px] font-bold flex items-center gap-0.5 shrink-0 cursor-pointer transition"
                          title={`Open Hardware & Port Drawer for ${sw.hostname}`}
                        >
                          <PanelRightOpen className="w-3 h-3" />
                          HW
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* CATEGORY 3: DISCOVERED CDP NEIGHBOR SWITCHES (If any unpolled switches exist) */}
          {inventory.cdpSwitches.length > 0 && (
            <div className="rounded-xl border border-slate-800/90 bg-slate-900/40 overflow-hidden">
              <button
                type="button"
                onClick={() => toggleCategory('cdpSwitches')}
                className="w-full px-2.5 py-1.5 bg-slate-900/90 hover:bg-slate-900 flex items-center justify-between text-left cursor-pointer"
              >
                <span className="text-[11px] font-bold text-purple-300 flex items-center gap-1.5">
                  {expandedCategories.cdpSwitches ? (
                    <ChevronDown className="w-3.5 h-3.5" />
                  ) : (
                    <ChevronRight className="w-3.5 h-3.5" />
                  )}
                  CDP Neighbor Switches
                </span>
                <span className="px-1.5 py-0.2 rounded bg-purple-500/20 text-purple-300 text-[10px]">
                  {inventory.cdpSwitches.length}
                </span>
              </button>

              {expandedCategories.cdpSwitches && (
                <div className="p-1.5 space-y-1">
                  {inventory.cdpSwitches.map((sw) => {
                    const isHidden = hiddenSet.has(sw.key);
                    return (
                      <div
                        key={sw.id}
                        onClick={() => {
                          if (onSelectInventoryEntity) {
                            onSelectInventoryEntity({
                              type: 'device',
                              id: sw.id,
                              data: sw
                            });
                          }
                        }}
                        className={`p-2 rounded-lg bg-slate-950/80 border border-slate-800/80 hover:border-purple-500/50 flex items-center justify-between gap-1.5 cursor-pointer transition ${
                          isHidden ? 'opacity-45' : ''
                        }`}
                      >
                        <div className="min-w-0">
                          <div className="text-[11px] font-bold text-white truncate">
                            {sw.hostname}
                          </div>
                          <div className="text-[9.5px] text-slate-400 truncate">
                            <span className="text-purple-300">[{sw.buildingCode}]</span> {sw.model}{' '}
                            • {sw.mgmtIp}
                          </div>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          {onToggleDeviceVisibility && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                onToggleDeviceVisibility(sw.key);
                              }}
                              className={`p-1 rounded border cursor-pointer transition ${
                                isHidden
                                  ? 'bg-slate-900 text-slate-500 border-slate-800 hover:text-slate-300'
                                  : 'bg-slate-900 text-purple-300 border-slate-700 hover:text-white'
                              }`}
                              title={
                                isHidden
                                  ? `Show ${sw.hostname}`
                                  : `Hide ${sw.hostname}`
                              }
                            >
                              {isHidden ? (
                                <EyeOff className="w-3 h-3" />
                              ) : (
                                <Eye className="w-3 h-3" />
                              )}
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onOpenLivePoll(sw.mgmtIp, sw.hostname);
                            }}
                            className="px-1.5 py-1 rounded bg-emerald-500/20 hover:bg-emerald-500/35 text-emerald-300 border border-emerald-500/40 text-[9px] font-bold shrink-0 cursor-pointer"
                            title={`Poll ${sw.hostname} via SSH`}
                          >
                            SSH
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* CATEGORY 4: WI-FI 6 UPOE ACCESS POINTS */}
          <div className="rounded-xl border border-slate-800/90 bg-slate-900/40 overflow-hidden">
            <button
              type="button"
              onClick={() => toggleCategory('wirelessAps')}
              className="w-full px-2.5 py-1.5 bg-slate-900/90 hover:bg-slate-900 flex items-center justify-between text-left cursor-pointer"
            >
              <span className="text-[11px] font-bold text-sky-300 flex items-center gap-1.5">
                {expandedCategories.wirelessAps ? (
                  <ChevronDown className="w-3.5 h-3.5" />
                ) : (
                  <ChevronRight className="w-3.5 h-3.5" />
                )}
                Wi-Fi 6 UPOE APs
              </span>
              <span className="px-1.5 py-0.2 rounded bg-sky-500/20 text-sky-300 text-[10px]">
                {inventory.allAps.length}
              </span>
            </button>

            {expandedCategories.wirelessAps && (
              <div className="p-1.5 space-y-1">
                {inventory.allAps.map((ap, idx) => {
                  const isSel = focusedDevice?.data?.hostname === ap.hostname;
                  return (
                    <div
                      key={`${ap.localPort}-${idx}`}
                      onClick={() => {
                        if (onSelectInventoryEntity) {
                          onSelectInventoryEntity({
                            type: 'ap',
                            id: ap.hostname,
                            data: ap
                          });
                        }
                      }}
                      className={`p-1.5 rounded-lg border flex items-center justify-between gap-1.5 cursor-pointer transition ${
                        isSel
                          ? 'bg-sky-950/60 border-sky-400'
                          : 'bg-slate-950/80 border-slate-800/80 hover:border-sky-500/40'
                      }`}
                    >
                      <div className="min-w-0">
                        <div className="text-[10.5px] font-bold text-white truncate">
                          <span className="text-sky-400">[{ap.localPort}]</span> {ap.hostname}
                        </div>
                        <div className="text-[9px] text-slate-400 truncate">
                          {ap.ip} • {ap.model}
                        </div>
                      </div>
                      <span className="px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-300 border border-amber-500/30 text-[9px] shrink-0">
                        ⚡{ap.poeWatts}W
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* CATEGORY 5: CAMPUSES & COLOCATION HUBS */}
          <div className="rounded-xl border border-slate-800/90 bg-slate-900/40 overflow-hidden">
            <button
              type="button"
              onClick={() => toggleCategory('campusesColos')}
              className="w-full px-2.5 py-1.5 bg-slate-900/90 hover:bg-slate-900 flex items-center justify-between text-left cursor-pointer"
            >
              <span className="text-[11px] font-bold text-purple-300 flex items-center gap-1.5">
                {expandedCategories.campusesColos ? (
                  <ChevronDown className="w-3.5 h-3.5" />
                ) : (
                  <ChevronRight className="w-3.5 h-3.5" />
                )}
                Campuses &amp; Colos
              </span>
              <span className="px-1.5 py-0.2 rounded bg-purple-500/20 text-purple-300 text-[10px]">
                {inventory.campusesAndColos.length}
              </span>
            </button>

            {expandedCategories.campusesColos && (
              <div className="p-1.5 space-y-1">
                {inventory.campusesAndColos.map((site) => (
                  <div
                    key={site.code}
                    onClick={() => {
                      if (onSelectInventoryEntity) {
                        onSelectInventoryEntity({
                          type: 'site',
                          id: site.code,
                          data: site
                        });
                      }
                    }}
                    className="p-1.5 rounded-lg bg-slate-950/80 border border-slate-800/80 hover:border-purple-500/40 flex items-center justify-between gap-1.5 cursor-pointer transition"
                  >
                    <div className="min-w-0">
                      <div className="text-[10.5px] font-bold text-white truncate">
                        {site.flag} {site.code}
                      </div>
                      <div className="text-[9px] text-slate-400 truncate">
                        {site.location}
                      </div>
                    </div>
                    <span className="px-1.5 py-0.5 rounded bg-purple-500/15 text-purple-300 text-[8.5px] uppercase shrink-0">
                      {site.type === 'colocation' ? 'Colo' : 'Campus'}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </aside>
  );
}
