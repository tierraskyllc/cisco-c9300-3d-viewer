import React, { useState, useMemo } from 'react';
import {
  Table2,
  Search,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Building2,
  CheckCircle2,
  AlertCircle,
  Plus,
  RotateCcw,
  Sparkles,
  Wifi,
  PanelRightOpen,
  Layers,
  Filter,
  CheckSquare,
  Square,
  Save
} from 'lucide-react';
import {
  GLOBAL_SITES,
  FDU_BUILDING_DIRECTORY,
  buildGlobalAndSiteTopology
} from '../data/globalNetworkData';

function ipToNumber(ipStr = '') {
  const m = String(ipStr || '')
    .trim()
    .match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (!m) return Number.MAX_SAFE_INTEGER;
  return (
    ((Number(m[1]) & 0xff) << 24) >>> 0 ||
    ((Number(m[1]) * 16777216 +
      Number(m[2]) * 65536 +
      Number(m[3]) * 256 +
      Number(m[4])) >>>
      0)
  );
}

/**
 * Full-Screen Tabulated & All-Column Sortable Switch & Building Group Directory
 * - Identifies switches in 'OTHER' (Unassigned) or any discovered group
 * - Provides per-row and bulk dropdowns to assign switches to any Campus + Building Base Group
 * - Allows creating new custom Building Base Groups on the fly
 * - Persists all group assignments to PostgreSQL + localStorage and updates the 3D Topology Scene live
 */
export default function SwitchGroupDirectoryTable({
  savedDevices = [],
  parsedSwitchData = null,
  switchGroupOverrides = { customGroups: {}, assignments: {} },
  onUpdateSwitchGroupOverrides,
  onSelectSavedDevice,
  onOpenLivePoll,
  onOpenHwDrawerForDevice,
  onJumpTo3DView,
  saveStatus = 'Saved in SQL ✓'
}) {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL'); // 'ALL' | 'UNASSIGNED' | 'OVERRIDDEN' | 'POLLED' | 'UNPOLLED'
  const [campusFilter, setCampusFilter] = useState('ALL');
  const [parentFilter, setParentFilter] = useState('ALL');
  const [buildingFilter, setBuildingFilter] = useState('ALL');

  // Sorting state: sortable by any column
  const [sortColumn, setSortColumn] = useState('buildingCode');
  const [sortDirection, setSortDirection] = useState('asc'); // 'asc' | 'desc'

  // Multi-row selection for bulk group assignment
  const [selectedKeys, setSelectedKeys] = useState([]);
  const [bulkSiteCode, setBulkSiteCode] = useState('');
  const [bulkBuildingCode, setBulkBuildingCode] = useState('');

  // Custom group creation state
  const [isCreatingGroup, setIsCreatingGroup] = useState(false);
  const [newGroupCode, setNewGroupCode] = useState('');
  const [newGroupLabel, setNewGroupLabel] = useState('');
  const [newGroupSite, setNewGroupSite] = useState('Metro');

  // Build unified topology graph with current overrides
  const globalGraph = useMemo(() => {
    return buildGlobalAndSiteTopology(savedDevices, parsedSwitchData, switchGroupOverrides);
  }, [savedDevices, parsedSwitchData, switchGroupOverrides]);

  const allSwitches = globalGraph.switchNodes || [];

  // Complete list of available Building Group options (built-in + custom + discovered)
  const buildingGroupOptions = useMemo(() => {
    const map = new Map();
    for (const [code, label] of Object.entries(FDU_BUILDING_DIRECTORY)) {
      if (code === 'DICK' || code === 'LIB' || code === 'SUB7' || code === 'BOGOTA') continue;
      if (code === 'MAN' || code === 'TWM' || code === 'TWO' || code === 'PARK') continue;
      if (code === 'FSC' || code === 'FER' || code === 'RUTH') continue;
      map.set(code, { code, label, isCustom: false });
    }
    for (const [code, grp] of Object.entries(switchGroupOverrides?.customGroups || {})) {
      map.set(code, {
        code,
        label: grp.label || `${code} (${code})`,
        isCustom: true
      });
    }
    for (const b of globalGraph.buildings || []) {
      if (!map.has(b.code)) {
        map.set(b.code, {
          code: b.code,
          label: b.label || `${b.code} (${b.code})`,
          isCustom: Boolean(b.isCustomGroup)
        });
      }
    }
    return Array.from(map.values()).sort((a, b) => {
      if (a.code === 'OTHER') return 1;
      if (b.code === 'OTHER') return -1;
      if (a.code === 'CORE') return -1;
      if (b.code === 'CORE') return 1;
      return a.code.localeCompare(b.code);
    });
  }, [switchGroupOverrides, globalGraph.buildings]);

  // Distinct Upstream Parent Switches for the quick-filter bar (e.g. tcore-9600, mcore-9600, DC1-9500, DC1-2-9500)
  const parentSwitchCounts = useMemo(() => {
    const counts = new Map();
    for (const sw of allSwitches) {
      const p = (sw.upstreamSwitch || 'Polled Directly (SQL)').replace(/\.net\.fdu\.edu$/i, '');
      counts.set(p, (counts.get(p) || 0) + 1);
    }
    return Array.from(counts.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);
  }, [allSwitches]);

  // KPI metrics
  const kpis = useMemo(() => {
    let polled = 0;
    let unpolled = 0;
    let unassigned = 0;
    let overridden = 0;
    for (const sw of allSwitches) {
      if (sw.isPolled) polled += 1;
      else unpolled += 1;
      if (!sw.buildingCode || sw.buildingCode === 'OTHER') unassigned += 1;
      if (sw.hasManualGroupOverride) overridden += 1;
    }
    return {
      total: allSwitches.length,
      polled,
      unpolled,
      unassigned,
      assigned: allSwitches.length - unassigned,
      overridden
    };
  }, [allSwitches]);

  // Filter switches
  const filteredSwitches = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return allSwitches.filter((sw) => {
      if (statusFilter === 'UNASSIGNED' && sw.buildingCode !== 'OTHER') return false;
      if (statusFilter === 'OVERRIDDEN' && !sw.hasManualGroupOverride) return false;
      if (statusFilter === 'POLLED' && !sw.isPolled) return false;
      if (statusFilter === 'UNPOLLED' && sw.isPolled) return false;

      if (campusFilter !== 'ALL' && sw.siteCode !== campusFilter) return false;
      if (buildingFilter !== 'ALL' && sw.buildingCode !== buildingFilter) return false;

      if (parentFilter !== 'ALL') {
        const cleanParent = (sw.upstreamSwitch || 'Polled Directly (SQL)').replace(
          /\.net\.fdu\.edu$/i,
          ''
        );
        if (cleanParent !== parentFilter) return false;
      }

      if (q) {
        const hay = [
          sw.hostname,
          sw.rawDeviceId,
          sw.mgmtIp,
          sw.model,
          sw.upstreamSwitch,
          sw.upstreamPort,
          sw.remotePort,
          sw.interfaceDescription,
          sw.siteCode,
          sw.buildingCode,
          sw.buildingLabel,
          sw.serialNumber
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        if (!hay.includes(q)) return false;
      }

      return true;
    });
  }, [allSwitches, searchQuery, statusFilter, campusFilter, buildingFilter, parentFilter]);

  // Sort switches by any selected column
  const sortedSwitches = useMemo(() => {
    const arr = [...filteredSwitches];
    const dir = sortDirection === 'asc' ? 1 : -1;

    arr.sort((a, b) => {
      let cmp = 0;
      switch (sortColumn) {
        case 'status': {
          const rankA = a.isPolled ? 0 : 1;
          const rankB = b.isPolled ? 0 : 1;
          cmp = rankA - rankB || (a.hierarchyTier || 3) - (b.hierarchyTier || 3);
          break;
        }
        case 'hostname':
          cmp = String(a.hostname || '').localeCompare(String(b.hostname || ''), undefined, {
            numeric: true
          });
          break;
        case 'mgmtIp':
          cmp = ipToNumber(a.mgmtIp) - ipToNumber(b.mgmtIp);
          break;
        case 'model':
          cmp = String(a.model || '').localeCompare(String(b.model || ''), undefined, {
            numeric: true
          });
          break;
        case 'upstreamSwitch':
          cmp = String(a.upstreamSwitch || '').localeCompare(
            String(b.upstreamSwitch || ''),
            undefined,
            { numeric: true }
          );
          break;
        case 'upstreamPort':
          cmp = String(a.upstreamPort || '').localeCompare(
            String(b.upstreamPort || ''),
            undefined,
            { numeric: true }
          );
          break;
        case 'interfaceDescription':
          cmp = String(a.interfaceDescription || '').localeCompare(
            String(b.interfaceDescription || ''),
            undefined,
            { numeric: true }
          );
          break;
        case 'siteCode':
          cmp = String(a.siteCode || '').localeCompare(String(b.siteCode || ''));
          break;
        case 'buildingCode': {
          // Put OTHER at the top when sorting ascending if user is looking for unassigned, or standard alphabetical
          cmp =
            String(a.buildingCode || '').localeCompare(String(b.buildingCode || '')) ||
            String(a.hostname || '').localeCompare(String(b.hostname || ''));
          break;
        }
        case 'links': {
          const countA = (a.switchLinks?.length || 0) + (a.attachedEndpoints?.length || 0);
          const countB = (b.switchLinks?.length || 0) + (b.attachedEndpoints?.length || 0);
          cmp = countA - countB;
          break;
        }
        default:
          cmp = String(a.hostname || '').localeCompare(String(b.hostname || ''));
      }
      return cmp * dir;
    });

    return arr;
  }, [filteredSwitches, sortColumn, sortDirection]);

  const handleSort = (colId) => {
    if (sortColumn === colId) {
      setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortColumn(colId);
      setSortDirection('asc');
    }
  };

  // Single-row Campus / Building Group assignment handler
  const handleAssignSingleSwitch = (sw, nextFields) => {
    if (!onUpdateSwitchGroupOverrides) return;
    const currAssign = switchGroupOverrides?.assignments?.[sw.key] || {};
    const nextBuildingCode = nextFields.buildingCode ?? currAssign.buildingCode ?? sw.buildingCode;
    const nextSiteCode = nextFields.siteCode ?? currAssign.siteCode ?? sw.siteCode;
    const matchedOpt = buildingGroupOptions.find((o) => o.code === nextBuildingCode);

    const nextOverrides = {
      customGroups: { ...(switchGroupOverrides?.customGroups || {}) },
      assignments: {
        ...(switchGroupOverrides?.assignments || {}),
        [sw.key]: {
          buildingCode: nextBuildingCode,
          buildingLabel:
            matchedOpt?.label ||
            FDU_BUILDING_DIRECTORY[nextBuildingCode] ||
            `${nextBuildingCode} Building (${nextBuildingCode})`,
          siteCode: nextSiteCode
        }
      }
    };
    onUpdateSwitchGroupOverrides(nextOverrides);
  };

  // Reset single switch back to auto-detected group
  const handleResetSingleSwitch = (sw) => {
    if (!onUpdateSwitchGroupOverrides) return;
    const nextAssignments = { ...(switchGroupOverrides?.assignments || {}) };
    delete nextAssignments[sw.key];
    delete nextAssignments[sw.id];
    onUpdateSwitchGroupOverrides({
      customGroups: { ...(switchGroupOverrides?.customGroups || {}) },
      assignments: nextAssignments
    });
  };

  // Bulk assign all selected switches
  const handleApplyBulkAssignment = () => {
    if (!onUpdateSwitchGroupOverrides || selectedKeys.length === 0) return;
    if (!bulkBuildingCode && !bulkSiteCode) return;

    const nextAssignments = { ...(switchGroupOverrides?.assignments || {}) };
    const matchedOpt = buildingGroupOptions.find((o) => o.code === bulkBuildingCode);

    for (const key of selectedKeys) {
      const sw = allSwitches.find((s) => s.key === key);
      if (!sw) continue;
      const existing = nextAssignments[key] || {};
      const finalBldg = bulkBuildingCode || existing.buildingCode || sw.buildingCode;
      const finalSite = bulkSiteCode || existing.siteCode || sw.siteCode;
      nextAssignments[key] = {
        buildingCode: finalBldg,
        buildingLabel:
          matchedOpt?.label ||
          FDU_BUILDING_DIRECTORY[finalBldg] ||
          `${finalBldg} Building (${finalBldg})`,
        siteCode: finalSite
      };
    }

    onUpdateSwitchGroupOverrides({
      customGroups: { ...(switchGroupOverrides?.customGroups || {}) },
      assignments: nextAssignments
    });
    setSelectedKeys([]);
  };

  // Create a new custom Building Group
  const handleCreateCustomGroup = (e) => {
    e.preventDefault();
    const cleanCode = newGroupCode
      .trim()
      .toUpperCase()
      .replace(/[^A-Z0-9_-]/g, '')
      .slice(0, 10);
    if (!cleanCode) return;
    const cleanLabel =
      newGroupLabel.trim() || `${cleanCode} Building (${cleanCode})`;

    const nextCustomGroups = {
      ...(switchGroupOverrides?.customGroups || {}),
      [cleanCode]: {
        code: cleanCode,
        label: cleanLabel.includes(`(${cleanCode})`)
          ? cleanLabel
          : `${cleanLabel} (${cleanCode})`,
        siteCode: newGroupSite
      }
    };

    if (onUpdateSwitchGroupOverrides) {
      onUpdateSwitchGroupOverrides({
        customGroups: nextCustomGroups,
        assignments: { ...(switchGroupOverrides?.assignments || {}) }
      });
    }

    setBulkBuildingCode(cleanCode);
    setNewGroupCode('');
    setNewGroupLabel('');
    setIsCreatingGroup(false);
  };

  const selectedSet = useMemo(() => new Set(selectedKeys), [selectedKeys]);
  const allVisibleSelected =
    sortedSwitches.length > 0 &&
    sortedSwitches.every((sw) => selectedSet.has(sw.key));

  const toggleSelectAllVisible = () => {
    if (allVisibleSelected) {
      const visibleKeys = new Set(sortedSwitches.map((s) => s.key));
      setSelectedKeys((prev) => prev.filter((k) => !visibleKeys.has(k)));
    } else {
      const merged = new Set([...selectedKeys, ...sortedSwitches.map((s) => s.key)]);
      setSelectedKeys(Array.from(merged));
    }
  };

  const toggleSelectRow = (key) => {
    setSelectedKeys((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );
  };

  const renderSortIcon = (colId) => {
    if (sortColumn !== colId) {
      return <ArrowUpDown className="w-3 h-3 text-slate-500 opacity-70" />;
    }
    return sortDirection === 'asc' ? (
      <ArrowUp className="w-3 h-3 text-sky-400" />
    ) : (
      <ArrowDown className="w-3 h-3 text-sky-400" />
    );
  };

  return (
    <div className="w-full h-full flex flex-col bg-[#050b18] rounded-xl border border-slate-800/90 overflow-hidden shadow-2xl select-text">
      {/* ===================================================================
          1. TOP HEADER & KPI SUMMARY STRIP
         =================================================================== */}
      <div className="px-4 py-3 bg-slate-950/95 border-b border-slate-800/90 flex flex-wrap items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-sky-500/25 to-indigo-600/25 border border-sky-400/40 flex items-center justify-center text-sky-300 shadow">
            <Table2 className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-sm font-bold text-white tracking-wide">
                Switch &amp; Building Group Directory Table
              </h1>
              <span className="px-2 py-0.5 rounded-md bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 font-mono text-[10px] font-bold flex items-center gap-1">
                <Save className="w-3 h-3" /> {saveStatus}
              </span>
            </div>
            <p className="text-[11px] font-mono text-slate-400">
              Click any column header to sort • Use the Campus &amp; Building Group dropdowns to place unassigned (<span className="text-amber-300">OTHER</span>) switches onto their 3D Building Base
            </p>
          </div>
        </div>

        {/* KPI Cards */}
        <div className="flex flex-wrap items-center gap-2 font-mono text-xs">
          <button
            type="button"
            onClick={() => setStatusFilter('ALL')}
            className={`px-2.5 py-1.5 rounded-lg border transition cursor-pointer flex items-center gap-2 ${
              statusFilter === 'ALL'
                ? 'bg-sky-500/20 border-sky-400/60 text-white'
                : 'bg-slate-900/90 border-slate-800 text-slate-300 hover:border-slate-700'
            }`}
          >
            <span className="text-[10px] uppercase text-slate-400">Total Switches:</span>
            <span className="font-bold text-sky-300">{kpis.total}</span>
          </button>

          <button
            type="button"
            onClick={() =>
              setStatusFilter(statusFilter === 'UNASSIGNED' ? 'ALL' : 'UNASSIGNED')
            }
            className={`px-2.5 py-1.5 rounded-lg border transition cursor-pointer flex items-center gap-2 ${
              statusFilter === 'UNASSIGNED'
                ? 'bg-amber-500/25 border-amber-400 text-amber-200 ring-1 ring-amber-400/40'
                : kpis.unassigned > 0
                ? 'bg-amber-950/40 border-amber-500/50 text-amber-300 hover:bg-amber-950/70'
                : 'bg-slate-900/90 border-slate-800 text-slate-400'
            }`}
            title="Click to filter only switches currently in OTHER (Unassigned Group)"
          >
            <AlertCircle className="w-3.5 h-3.5 text-amber-400" />
            <span className="text-[10px] uppercase">Unassigned (OTHER):</span>
            <span className="font-bold text-amber-300">{kpis.unassigned}</span>
          </button>

          <button
            type="button"
            onClick={() =>
              setStatusFilter(statusFilter === 'POLLED' ? 'ALL' : 'POLLED')
            }
            className={`px-2.5 py-1.5 rounded-lg border transition cursor-pointer flex items-center gap-2 ${
              statusFilter === 'POLLED'
                ? 'bg-emerald-500/25 border-emerald-400 text-emerald-200'
                : 'bg-slate-900/90 border-slate-800 text-slate-300 hover:border-slate-700'
            }`}
          >
            <span className="text-[10px] uppercase text-slate-400">Polled (SQL):</span>
            <span className="font-bold text-emerald-300">{kpis.polled}</span>
          </button>

          <button
            type="button"
            onClick={() =>
              setStatusFilter(statusFilter === 'OVERRIDDEN' ? 'ALL' : 'OVERRIDDEN')
            }
            className={`px-2.5 py-1.5 rounded-lg border transition cursor-pointer flex items-center gap-2 ${
              statusFilter === 'OVERRIDDEN'
                ? 'bg-purple-500/25 border-purple-400 text-purple-200'
                : 'bg-slate-900/90 border-slate-800 text-slate-300 hover:border-slate-700'
            }`}
          >
            <span className="text-[10px] uppercase text-slate-400">Manual Overrides:</span>
            <span className="font-bold text-purple-300">{kpis.overridden}</span>
          </button>

          <button
            type="button"
            onClick={() => setIsCreatingGroup((prev) => !prev)}
            className="px-2.5 py-1.5 rounded-lg bg-indigo-600/25 hover:bg-indigo-600/40 text-indigo-200 border border-indigo-400/50 font-bold text-[11px] flex items-center gap-1 cursor-pointer transition"
          >
            <Plus className="w-3.5 h-3.5" /> New Building Group
          </button>
        </div>
      </div>

      {/* ===================================================================
          1b. INLINE NEW CUSTOM BUILDING GROUP CREATOR (COLLAPSIBLE)
         =================================================================== */}
      {isCreatingGroup && (
        <form
          onSubmit={handleCreateCustomGroup}
          className="px-4 py-2.5 bg-indigo-950/40 border-b border-indigo-500/40 flex flex-wrap items-center gap-2.5 text-xs font-mono shrink-0"
        >
          <span className="text-indigo-200 font-bold flex items-center gap-1">
            <Building2 className="w-3.5 h-3.5 text-indigo-400" />
            Create Custom Building Base Group:
          </span>
          <input
            type="text"
            value={newGroupCode}
            onChange={(e) => setNewGroupCode(e.target.value.toUpperCase())}
            placeholder="Code (e.g. SUBS, LAB, RIV)"
            maxLength={10}
            className="w-44 bg-slate-950 border border-indigo-500/50 rounded-lg px-2.5 py-1 text-white placeholder-slate-500 focus:outline-none focus:border-indigo-400"
            required
          />
          <input
            type="text"
            value={newGroupLabel}
            onChange={(e) => setNewGroupLabel(e.target.value)}
            placeholder="Building Full Name (e.g. Student Union South)"
            className="w-64 bg-slate-950 border border-indigo-500/50 rounded-lg px-2.5 py-1 text-white placeholder-slate-500 focus:outline-none focus:border-indigo-400"
            required
          />
          <select
            value={newGroupSite}
            onChange={(e) => setNewGroupSite(e.target.value)}
            className="bg-slate-950 border border-indigo-500/50 rounded-lg px-2.5 py-1 text-sky-300 focus:outline-none cursor-pointer"
          >
            {GLOBAL_SITES.map((s) => (
              <option key={s.code} value={s.code} className="bg-slate-950 text-white">
                Campus: {s.shortName} ({s.code})
              </option>
            ))}
          </select>
          <button
            type="submit"
            className="px-3 py-1 rounded-lg bg-indigo-500 hover:bg-indigo-400 text-slate-950 font-bold cursor-pointer transition"
          >
            Create Group
          </button>
          <button
            type="button"
            onClick={() => setIsCreatingGroup(false)}
            className="px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-700 cursor-pointer"
          >
            Cancel
          </button>
        </form>
      )}

      {/* ===================================================================
          2. SEARCH, UPSTREAM PARENT SWITCH PILLS & DROPDOWN FILTERS BAR
         =================================================================== */}
      <div className="px-4 py-2.5 bg-slate-900/75 border-b border-slate-800/90 flex flex-wrap items-center justify-between gap-2.5 text-xs shrink-0">
        {/* Search Input */}
        <div className="relative flex-1 min-w-[240px] max-w-md">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search hostname, port description (northpt, temple, subs), IP, MAC, model..."
            className="w-full bg-slate-950 border border-slate-800 focus:border-sky-500/60 rounded-lg pl-8 pr-7 py-1.5 text-xs font-mono text-slate-100 placeholder-slate-500 focus:outline-none"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] font-mono text-slate-400 hover:text-white cursor-pointer"
            >
              ✕
            </button>
          )}
        </div>

        {/* Upstream Parent Switch Quick Filter Pills (tcore-9600, mcore-9600, DC1-9500, DC1-2-9500) */}
        <div className="flex flex-wrap items-center gap-1 font-mono">
          <span className="text-[10px] text-slate-400 uppercase mr-1 flex items-center gap-1">
            <Filter className="w-3 h-3 text-sky-400" /> Parent Switch:
          </span>
          <button
            type="button"
            onClick={() => setParentFilter('ALL')}
            className={`px-2 py-1 rounded-md text-[10.5px] border cursor-pointer transition ${
              parentFilter === 'ALL'
                ? 'bg-sky-500/25 text-sky-200 border-sky-400/60 font-bold'
                : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-white'
            }`}
          >
            All ({allSwitches.length})
          </button>
          {parentSwitchCounts.map((p) => (
            <button
              key={p.name}
              type="button"
              onClick={() => setParentFilter(parentFilter === p.name ? 'ALL' : p.name)}
              className={`px-2 py-1 rounded-md text-[10.5px] border cursor-pointer transition ${
                parentFilter === p.name
                  ? 'bg-cyan-500/25 text-cyan-200 border-cyan-400/60 font-bold'
                  : 'bg-slate-950 text-slate-300 border-slate-800 hover:text-white'
              }`}
            >
              {p.name} ({p.count})
            </button>
          ))}
        </div>

        {/* Campus & Building Group Filter Dropdowns */}
        <div className="flex flex-wrap items-center gap-2 font-mono">
          <select
            value={campusFilter}
            onChange={(e) => setCampusFilter(e.target.value)}
            className="bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-[11px] text-sky-300 focus:outline-none cursor-pointer"
          >
            <option value="ALL">All Campuses ({allSwitches.length})</option>
            {GLOBAL_SITES.map((s) => (
              <option key={s.code} value={s.code}>
                Campus: {s.shortName} ({s.code})
              </option>
            ))}
          </select>

          <select
            value={buildingFilter}
            onChange={(e) => setBuildingFilter(e.target.value)}
            className="bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-[11px] text-amber-300 focus:outline-none cursor-pointer max-w-[230px]"
          >
            <option value="ALL">All Building Groups ({globalGraph.buildings?.length || 0})</option>
            <option value="OTHER">⚠ OTHER — Unassigned Only ({kpis.unassigned})</option>
            {(globalGraph.buildings || [])
              .filter((b) => b.code !== 'OTHER')
              .map((b) => (
                <option key={b.code} value={b.code}>
                  [{b.code}] {b.label} ({b.switchCount})
                </option>
              ))}
          </select>

          {(statusFilter !== 'ALL' ||
            campusFilter !== 'ALL' ||
            parentFilter !== 'ALL' ||
            buildingFilter !== 'ALL' ||
            searchQuery) && (
            <button
              type="button"
              onClick={() => {
                setStatusFilter('ALL');
                setCampusFilter('ALL');
                setParentFilter('ALL');
                setBuildingFilter('ALL');
                setSearchQuery('');
              }}
              className="px-2 py-1 rounded-lg bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 border border-rose-500/30 text-[10.5px] flex items-center gap-1 cursor-pointer transition"
            >
              <RotateCcw className="w-3 h-3" /> Reset Filters
            </button>
          )}
        </div>
      </div>

      {/* ===================================================================
          3. BULK GROUP ASSIGNMENT BAR (APPEARS WHEN 1+ SWITCHES ARE CHECKED)
         =================================================================== */}
      {selectedKeys.length > 0 && (
        <div className="px-4 py-2 bg-sky-950/60 border-b border-sky-500/50 flex flex-wrap items-center justify-between gap-3 text-xs font-mono shrink-0">
          <div className="flex items-center gap-2 text-sky-200 font-bold">
            <CheckSquare className="w-4 h-4 text-sky-400" />
            <span>{selectedKeys.length} Switch(es) Selected for Bulk Group Assignment</span>
            <button
              type="button"
              onClick={() => setSelectedKeys([])}
              className="text-[10px] text-slate-400 hover:text-white underline ml-2 cursor-pointer"
            >
              Clear Selection
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <select
              value={bulkSiteCode}
              onChange={(e) => setBulkSiteCode(e.target.value)}
              className="bg-slate-950 border border-sky-500/50 rounded-lg px-2.5 py-1 text-[11px] text-sky-300 focus:outline-none cursor-pointer"
            >
              <option value="">Keep Existing Campus</option>
              {GLOBAL_SITES.map((s) => (
                <option key={s.code} value={s.code}>
                  Set Campus → {s.shortName} ({s.code})
                </option>
              ))}
            </select>

            <select
              value={bulkBuildingCode}
              onChange={(e) => setBulkBuildingCode(e.target.value)}
              className="bg-slate-950 border border-amber-500/60 rounded-lg px-2.5 py-1 text-[11px] text-amber-200 focus:outline-none cursor-pointer"
            >
              <option value="">Select Target Building Group...</option>
              {buildingGroupOptions.map((opt) => (
                <option key={opt.code} value={opt.code}>
                  Set Group → [{opt.code}] {opt.label}
                </option>
              ))}
            </select>

            <button
              type="button"
              onClick={handleApplyBulkAssignment}
              disabled={!bulkBuildingCode && !bulkSiteCode}
              className="px-3 py-1 rounded-lg bg-emerald-500 hover:bg-emerald-400 disabled:opacity-40 text-slate-950 font-bold cursor-pointer transition flex items-center gap-1"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              Apply to {selectedKeys.length} Switch(es)
            </button>
          </div>
        </div>
      )}

      {/* ===================================================================
          4. MAIN ALL-COLUMN SORTABLE SWITCH & GROUP ASSIGNMENT TABLE
         =================================================================== */}
      <div className="flex-1 min-h-0 overflow-auto">
        <table className="w-full border-collapse text-left font-mono text-xs">
          <thead className="sticky top-0 z-20 bg-slate-950/95 backdrop-blur-md border-b border-slate-800 text-[10.5px] uppercase tracking-wider text-slate-400 select-none">
            <tr>
              <th className="py-2.5 px-3 w-9 text-center">
                <button
                  type="button"
                  onClick={toggleSelectAllVisible}
                  className="text-slate-400 hover:text-white cursor-pointer"
                  title="Select / Deselect All Visible Switches"
                >
                  {allVisibleSelected ? (
                    <CheckSquare className="w-3.5 h-3.5 text-sky-400" />
                  ) : (
                    <Square className="w-3.5 h-3.5" />
                  )}
                </button>
              </th>

              <th
                onClick={() => handleSort('status')}
                className="py-2.5 px-2.5 cursor-pointer hover:text-white transition whitespace-nowrap"
              >
                <div className="flex items-center gap-1">
                  <span>State / Tier</span>
                  {renderSortIcon('status')}
                </div>
              </th>

              <th
                onClick={() => handleSort('hostname')}
                className="py-2.5 px-2.5 cursor-pointer hover:text-white transition whitespace-nowrap"
              >
                <div className="flex items-center gap-1">
                  <span>Switch Hostname / ID</span>
                  {renderSortIcon('hostname')}
                </div>
              </th>

              <th
                onClick={() => handleSort('mgmtIp')}
                className="py-2.5 px-2.5 cursor-pointer hover:text-white transition whitespace-nowrap"
              >
                <div className="flex items-center gap-1">
                  <span>Mgmt IP</span>
                  {renderSortIcon('mgmtIp')}
                </div>
              </th>

              <th
                onClick={() => handleSort('model')}
                className="py-2.5 px-2.5 cursor-pointer hover:text-white transition whitespace-nowrap"
              >
                <div className="flex items-center gap-1">
                  <span>Model / SKU</span>
                  {renderSortIcon('model')}
                </div>
              </th>

              <th
                onClick={() => handleSort('upstreamSwitch')}
                className="py-2.5 px-2.5 cursor-pointer hover:text-white transition whitespace-nowrap"
              >
                <div className="flex items-center gap-1">
                  <span>Parent Switch</span>
                  {renderSortIcon('upstreamSwitch')}
                </div>
              </th>

              <th
                onClick={() => handleSort('upstreamPort')}
                className="py-2.5 px-2.5 cursor-pointer hover:text-white transition whitespace-nowrap"
              >
                <div className="flex items-center gap-1">
                  <span>Parent Port ↔ Remote</span>
                  {renderSortIcon('upstreamPort')}
                </div>
              </th>

              <th
                onClick={() => handleSort('interfaceDescription')}
                className="py-2.5 px-2.5 cursor-pointer hover:text-white transition whitespace-nowrap"
              >
                <div className="flex items-center gap-1">
                  <span>Port Description</span>
                  {renderSortIcon('interfaceDescription')}
                </div>
              </th>

              <th
                onClick={() => handleSort('siteCode')}
                className="py-2.5 px-2.5 cursor-pointer hover:text-white transition whitespace-nowrap"
              >
                <div className="flex items-center gap-1">
                  <span>Campus Group</span>
                  {renderSortIcon('siteCode')}
                </div>
              </th>

              <th
                onClick={() => handleSort('buildingCode')}
                className="py-2.5 px-2.5 cursor-pointer hover:text-white transition whitespace-nowrap"
              >
                <div className="flex items-center gap-1">
                  <span>Building Base Group (Dropdown)</span>
                  {renderSortIcon('buildingCode')}
                </div>
              </th>

              <th
                onClick={() => handleSort('links')}
                className="py-2.5 px-2.5 cursor-pointer hover:text-white transition whitespace-nowrap text-right"
              >
                <div className="flex items-center justify-end gap-1">
                  <span>Links</span>
                  {renderSortIcon('links')}
                </div>
              </th>

              <th className="py-2.5 px-3 text-right whitespace-nowrap">Actions</th>
            </tr>
          </thead>

          <tbody className="divide-y divide-slate-800/60">
            {sortedSwitches.map((sw) => {
              const isChecked = selectedSet.has(sw.key);
              const isUnassigned = !sw.buildingCode || sw.buildingCode === 'OTHER';
              const cleanParent = (sw.upstreamSwitch || 'Polled Directly (SQL)').replace(
                /\.net\.fdu\.edu$/i,
                ''
              );
              const linkCount =
                (sw.switchLinks?.length || 0) + (sw.attachedEndpoints?.length || 0);

              return (
                <tr
                  key={sw.key}
                  className={`transition ${
                    isChecked
                      ? 'bg-sky-950/35 hover:bg-sky-950/50'
                      : isUnassigned
                      ? 'bg-amber-950/15 hover:bg-amber-950/25'
                      : 'hover:bg-slate-900/65'
                  }`}
                >
                  {/* 1. Row Selection Checkbox */}
                  <td className="py-2 px-3 text-center">
                    <button
                      type="button"
                      onClick={() => toggleSelectRow(sw.key)}
                      className="text-slate-400 hover:text-white cursor-pointer"
                    >
                      {isChecked ? (
                        <CheckSquare className="w-3.5 h-3.5 text-sky-400" />
                      ) : (
                        <Square className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </td>

                  {/* 2. State (SQL vs CDP) & Hierarchy Tier */}
                  <td className="py-2 px-2.5 whitespace-nowrap">
                    <div className="flex items-center gap-1.5">
                      <span
                        className={`px-1.5 py-0.5 rounded text-[9.5px] font-bold border ${
                          sw.isPolled
                            ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                            : 'bg-sky-500/15 text-sky-300 border-sky-500/30'
                        }`}
                      >
                        {sw.isPolled ? 'SQL POLLED' : 'CDP'}
                      </span>
                      <span className="text-[10px] text-slate-400">
                        T{sw.hierarchyTier || 3}
                      </span>
                    </div>
                  </td>

                  {/* 3. Hostname / Raw MAC */}
                  <td className="py-2 px-2.5">
                    <div className="font-bold text-white truncate max-w-[230px]" title={sw.hostname}>
                      {sw.hostname}
                    </div>
                    {sw.rawDeviceId && sw.rawDeviceId !== sw.hostname && (
                      <div className="text-[9.5px] text-slate-400">
                        MAC/ID: {sw.rawDeviceId}
                      </div>
                    )}
                  </td>

                  {/* 4. Management IP */}
                  <td className="py-2 px-2.5 whitespace-nowrap">
                    <span className="text-emerald-300 font-semibold">{sw.mgmtIp || '—'}</span>
                  </td>

                  {/* 5. Hardware Model */}
                  <td className="py-2 px-2.5 whitespace-nowrap">
                    <span className="px-1.5 py-0.5 rounded bg-slate-900 border border-slate-800 text-slate-200 text-[10.5px]">
                      {sw.model || 'Switch'}
                    </span>
                  </td>

                  {/* 6. Upstream Parent Switch */}
                  <td className="py-2 px-2.5 whitespace-nowrap">
                    <span
                      className={`px-2 py-0.5 rounded text-[10.5px] font-semibold border ${
                        /DC1-9500|DC1-2-9500/i.test(cleanParent)
                          ? 'bg-purple-500/20 text-purple-200 border-purple-500/40'
                          : /mcore/i.test(cleanParent)
                          ? 'bg-cyan-500/20 text-cyan-200 border-cyan-500/40'
                          : /tcore/i.test(cleanParent)
                          ? 'bg-amber-500/20 text-amber-200 border-amber-500/40'
                          : 'bg-slate-900 text-slate-300 border-slate-800'
                      }`}
                    >
                      {cleanParent}
                    </span>
                  </td>

                  {/* 7. Parent Port <-> Remote Port */}
                  <td className="py-2 px-2.5 whitespace-nowrap text-[11px] text-slate-300">
                    {sw.upstreamPort && sw.upstreamPort !== '—' ? (
                      <span>
                        <span className="text-sky-300 font-semibold">{sw.upstreamPort}</span>
                        {sw.remotePort && sw.remotePort !== '—' ? (
                          <span className="text-slate-400"> ↔ {sw.remotePort}</span>
                        ) : null}
                      </span>
                    ) : (
                      <span className="text-slate-500">—</span>
                    )}
                  </td>

                  {/* 8. Upstream Port Description */}
                  <td className="py-2 px-2.5 max-w-[220px]">
                    <div
                      className="truncate text-[11px] text-slate-300"
                      title={sw.interfaceDescription || ''}
                    >
                      {sw.interfaceDescription || <span className="text-slate-600">—</span>}
                    </div>
                  </td>

                  {/* 9. Campus / Site Assignment Dropdown */}
                  <td className="py-2 px-2.5 whitespace-nowrap">
                    <select
                      value={sw.siteCode || 'Metro'}
                      onChange={(e) =>
                        handleAssignSingleSwitch(sw, { siteCode: e.target.value })
                      }
                      className="bg-slate-950 border border-slate-700/90 hover:border-sky-400 rounded-md px-2 py-1 text-[11px] text-sky-300 font-semibold focus:outline-none cursor-pointer"
                    >
                      {GLOBAL_SITES.map((s) => (
                        <option key={s.code} value={s.code} className="bg-slate-950 text-white">
                          {s.shortName} ({s.code})
                        </option>
                      ))}
                    </select>
                  </td>

                  {/* 10. Building / Base Group Assignment Dropdown */}
                  <td className="py-2 px-2.5 whitespace-nowrap">
                    <div className="flex items-center gap-1.5">
                      <select
                        value={sw.buildingCode || 'OTHER'}
                        onChange={(e) =>
                          handleAssignSingleSwitch(sw, { buildingCode: e.target.value })
                        }
                        className={`rounded-md px-2 py-1 text-[11px] font-bold border focus:outline-none cursor-pointer max-w-[235px] truncate ${
                          isUnassigned
                            ? 'bg-amber-950/70 border-amber-500/70 text-amber-200 hover:border-amber-300'
                            : sw.hasManualGroupOverride
                            ? 'bg-purple-950/60 border-purple-400/70 text-purple-200 hover:border-purple-300'
                            : 'bg-slate-950 border-slate-700/90 text-emerald-300 hover:border-emerald-400'
                        }`}
                      >
                        {buildingGroupOptions.map((opt) => (
                          <option
                            key={opt.code}
                            value={opt.code}
                            className="bg-slate-950 text-slate-100"
                          >
                            [{opt.code}] {opt.label}
                          </option>
                        ))}
                      </select>

                      {sw.hasManualGroupOverride && (
                        <button
                          type="button"
                          onClick={() => handleResetSingleSwitch(sw)}
                          className="p-1 rounded bg-purple-500/20 hover:bg-purple-500/35 text-purple-200 border border-purple-400/40 cursor-pointer transition"
                          title={`Reset manual override back to auto-detected group (${sw.autoBuildingCode || 'OTHER'})`}
                        >
                          <RotateCcw className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  </td>

                  {/* 11. Connected Links Count */}
                  <td className="py-2 px-2.5 text-right whitespace-nowrap">
                    <span className="px-1.5 py-0.5 rounded bg-slate-900 border border-slate-800 text-slate-300 text-[10.5px]">
                      {linkCount}
                    </span>
                  </td>

                  {/* 12. Row Quick Actions: Jump to 3D Base / Poll SSH / HW Drawer */}
                  <td className="py-2 px-3 text-right whitespace-nowrap">
                    <div className="inline-flex items-center gap-1">
                      {onJumpTo3DView && (
                        <button
                          type="button"
                          onClick={() => onJumpTo3DView(sw)}
                          className="px-2 py-0.5 rounded bg-sky-500/20 hover:bg-sky-500 text-sky-200 hover:text-slate-950 border border-sky-400/40 text-[10px] font-bold flex items-center gap-1 cursor-pointer transition"
                          title={`Jump to ${sw.hostname} (${sw.buildingCode}) in the 3D Multi-Device Scene`}
                        >
                          <Sparkles className="w-2.5 h-2.5" /> 3D
                        </button>
                      )}

                      {sw.isPolled && onOpenHwDrawerForDevice ? (
                        <button
                          type="button"
                          onClick={() => onOpenHwDrawerForDevice(sw.serialNumber)}
                          className="px-2 py-0.5 rounded bg-emerald-500/20 hover:bg-emerald-500 text-emerald-200 hover:text-slate-950 border border-emerald-400/40 text-[10px] font-bold flex items-center gap-1 cursor-pointer transition"
                          title="Open Right Hardware & Port Inspector Drawer"
                        >
                          <PanelRightOpen className="w-2.5 h-2.5" /> HW
                        </button>
                      ) : (
                        onOpenLivePoll && (
                          <button
                            type="button"
                            onClick={() =>
                              onOpenLivePoll(
                                sw.mgmtIp !== '—' ? sw.mgmtIp : '',
                                sw.hostname
                              )
                            }
                            className="px-2 py-0.5 rounded bg-slate-900 hover:bg-emerald-500/25 text-slate-300 hover:text-emerald-200 border border-slate-700 text-[10px] flex items-center gap-1 cursor-pointer transition"
                            title={`Live Poll ${sw.hostname} via SSH`}
                          >
                            <Wifi className="w-2.5 h-2.5" /> Poll
                          </button>
                        )
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}

            {sortedSwitches.length === 0 && (
              <tr>
                <td colSpan={12} className="py-12 text-center text-slate-400 font-mono text-xs">
                  No switches match your current filter criteria. Click &ldquo;Reset Filters&rdquo; to view all {allSwitches.length} switches.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* ===================================================================
          5. BOTTOM FOOTER BAR
         =================================================================== */}
      <div className="px-4 py-2 bg-slate-950 border-t border-slate-800/90 flex flex-wrap items-center justify-between gap-2 text-[11px] font-mono text-slate-400 shrink-0">
        <div>
          Showing <span className="text-white font-bold">{sortedSwitches.length}</span> of{' '}
          <span className="text-white font-bold">{allSwitches.length}</span> switches • Sorted by{' '}
          <span className="text-sky-300 font-bold">{sortColumn}</span> (
          {sortDirection.toUpperCase()})
        </div>
        <div className="flex items-center gap-3">
          <span>
            Assigned to Named Building Bases:{' '}
            <strong className="text-emerald-300">{kpis.assigned}</strong>
          </span>
          <span>•</span>
          <span>
            Remaining in OTHER:{' '}
            <strong className="text-amber-300">{kpis.unassigned}</strong>
          </span>
        </div>
      </div>
    </div>
  );
}
