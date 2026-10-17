import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Download,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Box,
  Terminal,
  CheckCircle2,
  Sparkles,
  Layers,
  Globe,
  ChevronUp,
  ChevronDown,
  Move,
  ArrowUpDown,
  Save
} from 'lucide-react';

const LAYOUT_STORAGE_KEY = 'fdu_iso_blueprint_layout_v1';
const API_LAYOUT_ENDPOINT = '/api/topology/layouts/isometric_blueprint_v1';

/**
 * Default coordinates for all Isometric Square Bases (Zone Pads) and relative device offsets
 * Devices store (dx, dy) relative to their parent square base so:
 * 1) Dragging a square base moves the base AND all of its devices together.
 * 2) Dragging an individual device moves it freely while clamping it within/near its square base.
 */
const DEFAULT_BLUEPRINT_LAYOUT = {
  pads: {
    // Campus Detail Scope Pads
    corePad: { cx: 280, cy: 225, w: 360, h: 155 },
    switchPad: { cx: 425, cy: 515, w: 660, h: 295 },
    apPad: { cx: 1125, cy: 310, w: 480, h: 260 },
    coloPad: { cx: 1125, cy: 590, w: 460, h: 190 },
    // Multi-Country Scope Pads
    halseyPad: { cx: 415, cy: 245, w: 390, h: 165 },
    metroPad: { cx: 245, cy: 525, w: 340, h: 185 },
    florhamPad: { cx: 585, cy: 525, w: 340, h: 185 },
    hastingsPad: { cx: 1115, cy: 245, w: 380, h: 165 },
    vancPad: { cx: 1115, cy: 525, w: 380, h: 185 }
  },
  devices: {
    // Relative to corePad (280, 225)
    coreNode: { dx: 0, dy: -10, padId: 'corePad', maxDx: 155, maxDy: 78 },
    // Relative to switchPad (425, 515)
    mdfNode: { dx: 140, dy: -65, padId: 'switchPad', maxDx: 285, maxDy: 135 },
    idfNode: { dx: -220, dy: 40, padId: 'switchPad', maxDx: 285, maxDy: 135 },
    // 7 APs relative to apPad (1125, 310)
    'ap-0': { dx: -220, dy: -115, padId: 'apPad', maxDx: 255, maxDy: 145 },
    'ap-1': { dx: 20, dy: -115, padId: 'apPad', maxDx: 255, maxDy: 145 },
    'ap-2': { dx: -220, dy: -59, padId: 'apPad', maxDx: 255, maxDy: 145 },
    'ap-3': { dx: 20, dy: -59, padId: 'apPad', maxDx: 255, maxDy: 145 },
    'ap-4': { dx: -220, dy: -3, padId: 'apPad', maxDx: 255, maxDy: 145 },
    'ap-5': { dx: 20, dy: -3, padId: 'apPad', maxDx: 255, maxDy: 145 },
    'ap-6': { dx: -220, dy: 53, padId: 'apPad', maxDx: 255, maxDy: 145 },
    // Relative to coloPad (1125, 590)
    halseyColo: { dx: -155, dy: -25, padId: 'coloPad', maxDx: 215, maxDy: 92 },
    hastingsColo: { dx: 100, dy: -25, padId: 'coloPad', maxDx: 215, maxDy: 92 },
    // Multi-Country Nodes relative to their pads
    globalHalsey: { dx: 0, dy: -15, padId: 'halseyPad', maxDx: 165, maxDy: 80 },
    globalMetro: { dx: 0, dy: -10, padId: 'metroPad', maxDx: 155, maxDy: 85 },
    globalFlorham: { dx: 0, dy: -10, padId: 'florhamPad', maxDx: 155, maxDy: 85 },
    globalHastings: { dx: 0, dy: -15, padId: 'hastingsPad', maxDx: 165, maxDy: 80 },
    globalVanc: { dx: 0, dy: -10, padId: 'vancPad', maxDx: 165, maxDy: 85 }
  }
};

function mergeWithDefaultLayout(saved) {
  if (!saved || typeof saved !== 'object') return structuredClone(DEFAULT_BLUEPRINT_LAYOUT);
  const merged = structuredClone(DEFAULT_BLUEPRINT_LAYOUT);
  if (saved.pads && typeof saved.pads === 'object') {
    for (const [k, v] of Object.entries(saved.pads)) {
      if (merged.pads[k] && typeof v?.cx === 'number' && typeof v?.cy === 'number') {
        merged.pads[k] = { ...merged.pads[k], cx: v.cx, cy: v.cy };
      }
    }
  }
  if (saved.devices && typeof saved.devices === 'object') {
    for (const [k, v] of Object.entries(saved.devices)) {
      if (merged.devices[k] && typeof v?.dx === 'number' && typeof v?.dy === 'number') {
        merged.devices[k] = { ...merged.devices[k], dx: v.dx, dy: v.dy };
      }
    }
  }
  return merged;
}

function clamp(val, min, max) {
  return Math.max(min, Math.min(max, val));
}

/**
 * Isometric 3D Engineering Blueprint Network Topology Renderer
 * - Supports interactive drag-and-drop repositioning of both:
 *   1) Isometric Square Zone Bases (dragging a base moves the base + all devices on it)
 *   2) Individual 3D Devices (clamped so each device stays within or near its parent square base)
 * - Conduits & callout pills dynamically recalculate in real time
 * - Automatically persists layout coordinates to PostgreSQL + localStorage
 */
export default function IsometricBlueprintView({
  globalGraph,
  activeDeviceSerial,
  onSelectSavedDevice,
  onPollNeighbor
}) {
  const svgRef = useRef(null);
  const [zoom, setZoom] = useState(1);
  const [selectedNodeKey, setSelectedNodeKey] = useState(null);
  const [hoveredDeviceInfo, setHoveredDeviceInfo] = useState(null);
  const [blueprintScope, setBlueprintScope] = useState('campus-detail'); // 'campus-detail' | 'multi-country'
  const [isBottomDrawerOpen, setIsBottomDrawerOpen] = useState(false);

  // Layout state (initialized from localStorage, then synced with PostgreSQL backend)
  const [layout, setLayout] = useState(() => {
    try {
      const raw = localStorage.getItem(LAYOUT_STORAGE_KEY);
      if (raw) return mergeWithDefaultLayout(JSON.parse(raw));
    } catch {
      // ignore
    }
    return structuredClone(DEFAULT_BLUEPRINT_LAYOUT);
  });

  const [saveStatus, setSaveStatus] = useState('Saved'); // 'Saved' | 'Saving...' | 'Custom Saved ✓'
  const [activeDrag, setActiveDrag] = useState(null);
  // activeDrag: { kind: 'pad' | 'device', id: string, padId?: string, startSvgX, startSvgY, origX, origY, moved: boolean }
  const dragRef = useRef(null);

  // Load saved layout from PostgreSQL on mount
  useEffect(() => {
    let cancelled = false;
    fetch(API_LAYOUT_ENDPOINT)
      .then((r) => (r.ok ? r.json() : null))
      .then((res) => {
        if (!cancelled && res?.layoutData && Object.keys(res.layoutData).length > 0) {
          const merged = mergeWithDefaultLayout(res.layoutData);
          setLayout(merged);
          try {
            localStorage.setItem(LAYOUT_STORAGE_KEY, JSON.stringify(merged));
          } catch {
            // ignore
          }
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  // Persist layout to localStorage + PostgreSQL
  const persistLayout = useCallback((nextLayout) => {
    setSaveStatus('Saving...');
    try {
      localStorage.setItem(LAYOUT_STORAGE_KEY, JSON.stringify(nextLayout));
    } catch {
      // ignore
    }
    fetch(API_LAYOUT_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ layoutData: nextLayout })
    })
      .then(() => setSaveStatus('Saved in SQL ✓'))
      .catch(() => setSaveStatus('Saved Locally ✓'));
  }, []);

  // Convert client (mouse) coordinates into SVG viewBox (1440x820) coordinates
  const clientToSvgPoint = useCallback((clientX, clientY) => {
    const svg = svgRef.current;
    if (!svg) return { x: clientX, y: clientY };
    const pt = svg.createSVGPoint();
    pt.x = clientX;
    pt.y = clientY;
    const ctm = svg.getScreenCTM();
    if (!ctm) return { x: clientX, y: clientY };
    const transformed = pt.matrixTransform(ctm.inverse());
    return { x: transformed.x, y: transformed.y };
  }, []);

  // Begin dragging a Square Base (Zone Pad)
  const handleStartPadDrag = (e, padId) => {
    e.stopPropagation();
    const pad = layout.pads[padId];
    if (!pad) return;
    const svgPt = clientToSvgPoint(e.clientX, e.clientY);
    const dragInfo = {
      kind: 'pad',
      id: padId,
      startSvgX: svgPt.x,
      startSvgY: svgPt.y,
      origX: pad.cx,
      origY: pad.cy,
      moved: false
    };
    dragRef.current = dragInfo;
    setActiveDrag(dragInfo);
  };

  // Begin dragging an individual 3D Device (clamped near its parent Square Base)
  const handleStartDeviceDrag = (e, deviceId, onClickCallback) => {
    e.stopPropagation();
    const dev = layout.devices[deviceId];
    if (!dev) return;
    const svgPt = clientToSvgPoint(e.clientX, e.clientY);
    const dragInfo = {
      kind: 'device',
      id: deviceId,
      padId: dev.padId,
      startSvgX: svgPt.x,
      startSvgY: svgPt.y,
      origX: dev.dx,
      origY: dev.dy,
      moved: false,
      onClickCallback
    };
    dragRef.current = dragInfo;
    setActiveDrag(dragInfo);
  };

  // Global window pointer move & pointer up handlers for smooth 60fps dragging
  useEffect(() => {
    if (!activeDrag) return;

    const handlePointerMove = (e) => {
      const current = dragRef.current;
      if (!current) return;
      const svgPt = clientToSvgPoint(e.clientX, e.clientY);
      const deltaX = svgPt.x - current.startSvgX;
      const deltaY = svgPt.y - current.startSvgY;

      if (Math.hypot(deltaX, deltaY) > 3.5) {
        current.moved = true;
      }

      if (current.kind === 'pad') {
        const nextCx = Math.round(clamp(current.origX + deltaX, 140, 1300));
        const nextCy = Math.round(clamp(current.origY + deltaY, 150, 665));
        setLayout((prev) => ({
          ...prev,
          pads: {
            ...prev.pads,
            [current.id]: {
              ...prev.pads[current.id],
              cx: nextCx,
              cy: nextCy
            }
          }
        }));
      } else if (current.kind === 'device') {
        const spec = DEFAULT_BLUEPRINT_LAYOUT.devices[current.id] || {
          maxDx: 220,
          maxDy: 120
        };
        const nextDx = Math.round(
          clamp(current.origX + deltaX, -spec.maxDx, spec.maxDx)
        );
        const nextDy = Math.round(
          clamp(current.origY + deltaY, -spec.maxDy, spec.maxDy)
        );
        setLayout((prev) => ({
          ...prev,
          devices: {
            ...prev.devices,
            [current.id]: {
              ...prev.devices[current.id],
              dx: nextDx,
              dy: nextDy
            }
          }
        }));
      }
    };

    const handlePointerUp = () => {
      const current = dragRef.current;
      dragRef.current = null;
      setActiveDrag(null);
      if (!current) return;

      if (!current.moved && current.kind === 'device' && current.onClickCallback) {
        current.onClickCallback();
      } else if (current.moved) {
        setLayout((latest) => {
          persistLayout(latest);
          return latest;
        });
      }
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };
  }, [activeDrag, clientToSvgPoint, persistLayout]);

  // 1-Click Helper: Swap the Purplish Colocation Base (move UP) and Cyan Access Point Base (move DOWN)
  const handleSwapColoAndApBases = () => {
    setLayout((prev) => {
      const currentApCy = prev.pads.apPad.cy;
      const currentColoCy = prev.pads.coloPad.cy;
      const isDefaultOrder = currentApCy < currentColoCy;
      const nextLayout = {
        ...prev,
        pads: {
          ...prev.pads,
          coloPad: {
            ...prev.pads.coloPad,
            cx: prev.pads.coloPad.cx,
            cy: isDefaultOrder ? 235 : 590
          },
          apPad: {
            ...prev.pads.apPad,
            cx: prev.pads.apPad.cx,
            cy: isDefaultOrder ? 510 : 310
          }
        }
      };
      persistLayout(nextLayout);
      return nextLayout;
    });
  };

  // Reset all bases & devices back to factory default positions
  const handleResetLayout = () => {
    const fresh = structuredClone(DEFAULT_BLUEPRINT_LAYOUT);
    setLayout(fresh);
    try {
      localStorage.removeItem(LAYOUT_STORAGE_KEY);
    } catch {
      // ignore
    }
    fetch(API_LAYOUT_ENDPOINT, { method: 'DELETE' })
      .then(() => setSaveStatus('Reset to Default'))
      .catch(() => setSaveStatus('Reset to Default'));
  };

  const switchNodes = globalGraph?.switchNodes || [];
  const switchLinks = globalGraph?.switchLinks || [];

  // Identify our live nodes from the database graph
  const coreNode =
    switchNodes.find((n) => n.hierarchyTier === 1) || {
      key: 'TCORE-9600',
      hostname: 'tcore-9600.net.fdu.edu',
      model: 'C9606R',
      mgmtIp: '132.238.1.40',
      serialNumber: 'UNPOLLED',
      iosVersion: '17.12.4',
      siteCode: 'Metro',
      isPolled: false,
      hierarchyTier: 1
    };

  const mdfNode =
    switchNodes.find((n) => n.hierarchyTier === 2) ||
    switchNodes.find((n) => n.hostname.includes('WL')) ||
    switchNodes[0] || {
      key: 'T-BAN-2FL-WL',
      hostname: 'T-BAN-2FL-WL',
      model: 'C9300-24UX',
      mgmtIp: '132.238.8.58',
      serialNumber: 'FOC2540Y44H',
      iosVersion: '17.15.04',
      siteCode: 'Metro',
      isPolled: true,
      totalPoeWatts: 194.0,
      attachedEndpoints: []
    };

  const idfNode =
    switchNodes.find((n) => n.hierarchyTier === 3) ||
    switchNodes.find((n) => n.hostname.includes('WorkStudy')) ||
    switchNodes[1] || {
      key: 'T-BAN-2FL-WORKSTUDY-C9300',
      hostname: 'T-BAN-2FL-WorkStudy-C9300',
      model: 'C9300-24UX',
      mgmtIp: '132.238.8.250',
      serialNumber: 'FCW2250D0KN',
      iosVersion: '17.15.04',
      siteCode: 'Metro',
      isPolled: true,
      totalPoeWatts: 0,
      attachedEndpoints: []
    };

  const attachedAps = mdfNode?.attachedEndpoints || [];

  // Find actual link metadata between Core <-> MDF and MDF <-> IDF
  const coreLinks = switchLinks.filter(
    (l) =>
      (l.sourceKey === mdfNode.key && l.targetKey === coreNode.key) ||
      (l.sourceKey === coreNode.key && l.targetKey === mdfNode.key)
  );
  const mdfToIdfLink = switchLinks.find(
    (l) =>
      (l.sourceKey === mdfNode.key && l.targetKey === idfNode.key) ||
      (l.sourceKey === idfNode.key && l.targetKey === mdfNode.key)
  );

  // Compute live world coordinates for each pad and each device
  const getDeviceWorldPos = (deviceId) => {
    const dev = layout.devices[deviceId] || DEFAULT_BLUEPRINT_LAYOUT.devices[deviceId];
    const pad = layout.pads[dev.padId] || DEFAULT_BLUEPRINT_LAYOUT.pads[dev.padId];
    return {
      x: pad.cx + dev.dx,
      y: pad.cy + dev.dy,
      pad
    };
  };

  const coreWorld = getDeviceWorldPos('coreNode');
  const mdfWorld = getDeviceWorldPos('mdfNode');
  const idfWorld = getDeviceWorldPos('idfNode');
  const halseyColoWorld = getDeviceWorldPos('halseyColo');
  const hastingsColoWorld = getDeviceWorldPos('hastingsColo');

  const apPad = layout.pads.apPad;
  const coloPad = layout.pads.coloPad;

  // Export SVG blueprint to a high-resolution PNG file
  const handleExportBlueprintPng = () => {
    if (!svgRef.current) return;
    const svgElement = svgRef.current;
    const serializer = new XMLSerializer();
    const svgString = serializer.serializeToString(svgElement);
    const svgBlob = new Blob([svgString], {
      type: 'image/svg+xml;charset=utf-8'
    });
    const url = URL.createObjectURL(svgBlob);

    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = 2560;
      canvas.height = 1440;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);

      const pngUrl = canvas.toDataURL('image/png');
      const a = document.createElement('a');
      a.href = pngUrl;
      a.download = `FDU-Isometric-Network-Blueprint-${new Date()
        .toISOString()
        .slice(0, 10)}.png`;
      a.click();
    };
    img.src = url;
  };

  // Helper to draw a Draggable Isometric 3D Rounded Zone Pad (Square Base in 2.5D projection)
  const renderIsometricZonePad = ({
    padId,
    fill,
    stroke,
    glowId,
    label,
    sublabel,
    labelColor = '#ffffff'
  }) => {
    const pad = layout.pads[padId] || DEFAULT_BLUEPRINT_LAYOUT.pads[padId];
    const { cx, cy, w, h } = pad;
    const hw = w / 2;
    const hh = h / 2;
    const pts = `${cx},${cy - hh} ${cx + hw},${cy} ${cx},${cy + hh} ${cx - hw},${cy}`;
    const depth = 8;
    const sidePts = `${cx - hw},${cy} ${cx},${cy + hh} ${cx + hw},${cy} ${cx + hw},${cy + depth} ${cx},${cy + hh + depth} ${cx - hw},${cy + depth}`;

    const isDraggingThisPad = activeDrag?.kind === 'pad' && activeDrag?.id === padId;
    const isParentOfDraggedDevice =
      activeDrag?.kind === 'device' && activeDrag?.padId === padId;

    return (
      <g
        onPointerDown={(e) => handleStartPadDrag(e, padId)}
        style={{ cursor: isDraggingThisPad ? 'grabbing' : 'grab' }}
      >
        {/* Subtle boundary tether halo when a child device inside this base is being dragged */}
        {(isDraggingThisPad || isParentOfDraggedDevice) && (
          <polygon
            points={`${cx},${cy - hh - 10} ${cx + hw + 14},${cy} ${cx},${cy + hh + 14} ${cx - hw - 14},${cy}`}
            fill="none"
            stroke="#ffffff"
            strokeWidth="2"
            strokeDasharray="6 4"
          />
        )}

        <polygon points={sidePts} fill={stroke} fillOpacity="0.35" />
        <polygon
          points={pts}
          fill={fill}
          fillOpacity={isDraggingThisPad ? '0.42' : '0.28'}
          stroke={isDraggingThisPad ? '#ffffff' : stroke}
          strokeWidth={isDraggingThisPad ? '3.2' : '2.5'}
          filter={glowId ? `url(#${glowId})` : undefined}
          strokeLinejoin="round"
        />

        {/* Drag Handle Grip Pill on Top Corner of Square Base */}
        <g transform={`translate(${cx}, ${cy - hh + 14})`}>
          <rect
            x="-46"
            y="-9"
            width="92"
            height="16"
            rx="4"
            fill="#020617"
            fillOpacity="0.78"
            stroke={stroke}
            strokeWidth="1"
          />
          <text
            x="0"
            y="2"
            textAnchor="middle"
            fill={labelColor}
            fontSize="8"
            fontWeight="800"
            fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace"
          >
            ✥ DRAG BASE
          </text>
        </g>

        {label && (
          <text
            x={cx - hw * 0.48}
            y={cy + hh * 0.66}
            fill={labelColor}
            fontSize="11"
            fontWeight="800"
            fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace"
            letterSpacing="0.8"
            transform={`rotate(24, ${cx - hw * 0.48}, ${cy + hh * 0.66})`}
          >
            {label}
          </text>
        )}
        {sublabel && (
          <text
            x={cx - hw * 0.48}
            y={cy + hh * 0.66 + 13}
            fill="#cbd5e1"
            fontSize="9.5"
            fontWeight="600"
            fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace"
            transform={`rotate(24, ${cx - hw * 0.48}, ${cy + hh * 0.66 + 13})`}
          >
            {sublabel}
          </text>
        )}
      </g>
    );
  };

  // Helper to draw a Draggable 3D Isometric Cisco Catalyst 9300 Switch Box
  const renderIsometric3DSwitch = ({
    deviceId,
    scale = 1,
    title,
    subtitle,
    ip,
    serial,
    model,
    poeText,
    portSummary,
    isActive3D,
    isPolled,
    accentColor = '#38bdf8',
    onClick
  }) => {
    const { x, y } = getDeviceWorldPos(deviceId);
    const isSelected = selectedNodeKey === title;
    const isDraggingThis = activeDrag?.kind === 'device' && activeDrag?.id === deviceId;

    return (
      <g
        transform={`translate(${x}, ${y}) scale(${scale})`}
        onPointerDown={(e) =>
          handleStartDeviceDrag(e, deviceId, () => {
            setSelectedNodeKey(title);
            setHoveredDeviceInfo({
              title,
              model,
              ip,
              serial,
              subtitle: `IOS-XE ${subtitle}`,
              extra: `${poeText || ''} ${portSummary ? `• ${portSummary}` : ''}`
            });
            if (onClick) onClick();
          })
        }
        onMouseEnter={() =>
          setHoveredDeviceInfo({
            title,
            model,
            ip,
            serial,
            subtitle: `IOS-XE ${subtitle}`,
            extra: `${poeText || ''} ${portSummary ? `• ${portSummary}` : ''}`
          })
        }
        style={{ cursor: isDraggingThis ? 'grabbing' : 'grab' }}
      >
        {/* Selection / Active Halo */}
        {(isActive3D || isSelected || isDraggingThis) && (
          <ellipse
            cx="0"
            cy="8"
            rx="72"
            ry="38"
            fill={accentColor}
            fillOpacity="0.22"
            stroke={isDraggingThis ? '#ffffff' : accentColor}
            strokeWidth="2.2"
            strokeDasharray="5 3"
          />
        )}

        {/* Drop Shadow */}
        <polygon
          points="0,-24 58,4 0,32 -58,4"
          transform="translate(0, 18)"
          fill="#020617"
          fillOpacity="0.7"
        />

        {/* 3D Switch Top Face (Isometric Diamond) */}
        <polygon
          points="0,-28 56,0 0,28 -56,0"
          fill="url(#isoSwitchTopGrad)"
          stroke={isActive3D ? '#38bdf8' : '#94a3b8'}
          strokeWidth={isActive3D ? '2.2' : '1.5'}
        />

        {/* 3D Switch Left Front Face (24-Port Faceplate with Odd/Even Port LEDs) */}
        <polygon
          points="-56,0 0,28 0,46 -56,18"
          fill="#1e293b"
          stroke="#64748b"
          strokeWidth="1.2"
        />

        {/* 3D Switch Right Side Face (Uplink Module & Chassis Vents) */}
        <polygon
          points="0,28 56,0 56,18 0,46"
          fill="#0f172a"
          stroke="#475569"
          strokeWidth="1.2"
        />

        {/* Cisco 4-Way Switching Arrows on Top Face */}
        <g stroke={accentColor} strokeWidth="2.2" strokeLinecap="round">
          <line x1="-22" y1="-4" x2="22" y2="-4" />
          <polyline points="15,-8 22,-4 15,0" fill="none" />
          <line x1="22" y1="5" x2="-22" y2="5" />
          <polyline points="-15,1 -22,5 -15,9" fill="none" />
          <line x1="-6" y1="-13" x2="14" y2="11" />
          <line x1="6" y1="-13" x2="-14" y2="11" />
        </g>

        {/* Mini Odd/Even Port LEDs along Left Faceplate */}
        {[-44, -36, -28, -20, -12, -4].map((px, i) => {
          const py = (px + 56) * 0.5 + 4;
          return (
            <g key={i}>
              <circle
                cx={px}
                cy={py}
                r="1.7"
                fill={i < 4 ? '#34d399' : '#38bdf8'}
              />
              <circle
                cx={px}
                cy={py + 5}
                r="1.7"
                fill={i % 2 === 0 ? '#34d399' : '#64748b'}
              />
            </g>
          );
        })}

        {/* Floating Engineering Telemetry Callout Tag */}
        <g transform="translate(0, -68)">
          <rect
            x="-105"
            y="-28"
            width="210"
            height="58"
            rx="7"
            fill="#061024"
            fillOpacity="0.94"
            stroke={
              isDraggingThis
                ? '#ffffff'
                : isActive3D
                ? '#38bdf8'
                : isPolled
                ? '#10b981'
                : '#a855f7'
            }
            strokeWidth="1.8"
          />
          <text
            x="0"
            y="-12"
            textAnchor="middle"
            fill="#ffffff"
            fontSize="11.5"
            fontWeight="800"
            fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace"
          >
            {title}
          </text>
          <text
            x="0"
            y="2"
            textAnchor="middle"
            fill="#38bdf8"
            fontSize="9.5"
            fontWeight="700"
            fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace"
          >
            {model} • IP: {ip}
          </text>
          <text
            x="0"
            y="14"
            textAnchor="middle"
            fill="#a7f3d0"
            fontSize="9"
            fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace"
          >
            S/N: {serial} • IOS-XE {subtitle}
          </text>
          {poeText && (
            <text
              x="0"
              y="25"
              textAnchor="middle"
              fill="#fcd34d"
              fontSize="8.8"
              fontWeight="700"
              fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace"
            >
              {poeText} {portSummary ? `• ${portSummary}` : ''}
            </text>
          )}
        </g>
      </g>
    );
  };

  // Helper to draw a Draggable 3D Isometric Core Chassis Tower (e.g. Cisco C9606R Core Switch)
  const renderIsometric3DCoreTower = ({
    deviceId,
    hostname,
    model,
    ip,
    statusLabel,
    onClick
  }) => {
    const { x, y } = getDeviceWorldPos(deviceId);
    const isDraggingThis = activeDrag?.kind === 'device' && activeDrag?.id === deviceId;

    return (
      <g
        transform={`translate(${x}, ${y})`}
        onPointerDown={(e) =>
          handleStartDeviceDrag(e, deviceId, () => {
            setSelectedNodeKey(hostname);
            setHoveredDeviceInfo({
              title: hostname,
              model: `Cisco ${model} Modular Core`,
              ip,
              serial: 'CORE-CHASSIS',
              subtitle: 'Tier 1 Backbone',
              extra: statusLabel
            });
            if (onClick) onClick();
          })
        }
        onMouseEnter={() =>
          setHoveredDeviceInfo({
            title: hostname,
            model: `Cisco ${model} Modular Core`,
            ip,
            serial: 'CORE-CHASSIS',
            subtitle: 'Tier 1 Backbone',
            extra: statusLabel
          })
        }
        style={{ cursor: isDraggingThis ? 'grabbing' : 'grab' }}
      >
        {/* Glowing Base Pad */}
        <ellipse
          cx="0"
          cy="28"
          rx="58"
          ry="28"
          fill="#f97316"
          fillOpacity="0.24"
          stroke={isDraggingThis ? '#ffffff' : '#fb923c'}
          strokeWidth="2"
        />

        {/* Isometric Tall Modular Chassis (C9606R 6-Slot Core) */}
        <polygon
          points="0,-52 44,-30 0,-8 -44,-30"
          fill="#334155"
          stroke="#cbd5e1"
          strokeWidth="1.5"
        />
        <polygon
          points="-44,-30 0,-8 0,34 -44,12"
          fill="#1e293b"
          stroke="#94a3b8"
          strokeWidth="1.5"
        />
        <polygon
          points="0,-8 44,-30 44,12 0,34"
          fill="#0f172a"
          stroke="#64748b"
          strokeWidth="1.5"
        />

        {/* 6 Modular Linecard Slots + Dual Supervisor LEDs on C9606R */}
        {[-20, -12, -4, 4, 12, 20].map((ly, idx) => (
          <g key={idx}>
            <line
              x1="-38"
              y1={ly - 16}
              x2="-4"
              y2={ly + 1}
              stroke={idx === 2 || idx === 3 ? '#f59e0b' : '#38bdf8'}
              strokeWidth="2"
            />
            <circle cx="-8" cy={ly - 1} r="1.8" fill="#34d399" />
          </g>
        ))}

        {/* Core Shield / Routing Emblem */}
        <circle
          cx="22"
          cy="-4"
          r="11"
          fill="#ea580c"
          fillOpacity="0.85"
          stroke="#fed7aa"
          strokeWidth="1.5"
        />
        <text
          x="22"
          y="0"
          textAnchor="middle"
          fill="#ffffff"
          fontSize="8.5"
          fontWeight="900"
          fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace"
        >
          CORE
        </text>

        {/* Callout Banner Above Core Tower */}
        <g transform="translate(0, -86)">
          <rect
            x="-98"
            y="-22"
            width="196"
            height="48"
            rx="7"
            fill="#090d1c"
            fillOpacity="0.95"
            stroke={isDraggingThis ? '#ffffff' : '#fb923c'}
            strokeWidth="1.8"
          />
          <text
            x="0"
            y="-6"
            textAnchor="middle"
            fill="#ffffff"
            fontSize="11"
            fontWeight="800"
            fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace"
          >
            {hostname}
          </text>
          <text
            x="0"
            y="8"
            textAnchor="middle"
            fill="#fdba74"
            fontSize="9.5"
            fontWeight="700"
            fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace"
          >
            Cisco {model} Modular Core • {ip}
          </text>
          <text
            x="0"
            y="20"
            textAnchor="middle"
            fill="#38bdf8"
            fontSize="8.8"
            fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace"
          >
            {statusLabel}
          </text>
        </g>
      </g>
    );
  };

  // Helper to draw a Draggable 3D Isometric Catalyst Wi-Fi 6 Access Point Node
  const renderIsometric3DApNode = ({
    deviceId,
    hostname,
    ip,
    model,
    localPort,
    poeWatts
  }) => {
    const { x, y } = getDeviceWorldPos(deviceId);
    const isDraggingThis = activeDrag?.kind === 'device' && activeDrag?.id === deviceId;
    const isSelected = selectedNodeKey === hostname;

    return (
      <g
        key={deviceId}
        transform={`translate(${x}, ${y})`}
        onPointerDown={(e) =>
          handleStartDeviceDrag(e, deviceId, () => {
            setSelectedNodeKey(hostname);
            setHoveredDeviceInfo({
              title: hostname,
              model,
              ip,
              serial: `Port ${localPort}`,
              subtitle: 'Wi-Fi 6 UPOE AP',
              extra: `Connected to ${mdfNode.hostname} [${localPort}] • ⚡ ${poeWatts ? `${poeWatts.toFixed(0)}W` : '30W'}`
            });
          })
        }
        onMouseEnter={() =>
          setHoveredDeviceInfo({
            title: hostname,
            model,
            ip,
            serial: `Port ${localPort}`,
            subtitle: 'Wi-Fi 6 UPOE AP',
            extra: `Connected to ${mdfNode.hostname} [${localPort}] • ⚡ ${poeWatts ? `${poeWatts.toFixed(0)}W` : '30W'}`
          })
        }
        style={{ cursor: isDraggingThis ? 'grabbing' : 'grab' }}
      >
        {/* Isometric AP Puck / Box */}
        <polygon
          points="0,-13 26,0 0,13 -26,0"
          fill="#0ea5e9"
          fillOpacity={isDraggingThis || isSelected ? '0.65' : '0.35'}
          stroke={isDraggingThis || isSelected ? '#ffffff' : '#7dd3fc'}
          strokeWidth="1.5"
        />
        <polygon
          points="-26,0 0,13 0,21 -26,8"
          fill="#0369a1"
          stroke="#38bdf8"
          strokeWidth="1.2"
        />
        <polygon
          points="0,13 26,0 26,8 0,21"
          fill="#075985"
          stroke="#0284c7"
          strokeWidth="1.2"
        />
        {/* Wi-Fi Signal Rings on Top */}
        <circle cx="0" cy="0" r="3" fill="#34d399" />
        <path
          d="M -8,-2 Q 0,-9 8,-2"
          fill="none"
          stroke="#e0f2fe"
          strokeWidth="1.4"
        />

        {/* Label pill next to AP */}
        <g transform="translate(34, -12)">
          <rect
            x="0"
            y="0"
            width="182"
            height="28"
            rx="5"
            fill="#041122"
            fillOpacity="0.92"
            stroke={isDraggingThis || isSelected ? '#ffffff' : '#0284c7'}
            strokeWidth="1.3"
          />
          <text
            x="7"
            y="11"
            fill="#ffffff"
            fontSize="9.5"
            fontWeight="800"
            fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace"
          >
            [{localPort}] {hostname}
          </text>
          <text
            x="7"
            y="22"
            fill="#7dd3fc"
            fontSize="8.5"
            fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace"
          >
            {ip} • {model} • ⚡{poeWatts ? `${poeWatts.toFixed(0)}W` : 'PoE'}
          </text>
        </g>
      </g>
    );
  };

  // Dynamic Conduit Path Calculations for Campus Detail Scope
  const fiberMidX = Math.round((coreWorld.x + mdfWorld.x) / 2);
  const fiberMidY = Math.round((coreWorld.y + mdfWorld.y) / 2);

  const trunkMidX = Math.round((mdfWorld.x + idfWorld.x) / 2);
  const trunkMidY = Math.round((mdfWorld.y + idfWorld.y) / 2);

  // Cyan PoE Conduit from T-BAN-2FL-WL to Cyan AP Pad
  const poeStartX = mdfWorld.x + 42;
  const poeStartY = mdfWorld.y - 5;
  const poeEndX = apPad.cx - apPad.w / 2 + 40;
  const poeEndY = apPad.cy - 15;
  const poeTurnX = Math.round((poeStartX + poeEndX) / 2 + 25);

  // Purple Dark Fiber Conduit from tcore-9600 to Purplish Colocation Pad
  const coloStartX = coreWorld.x + 52;
  const coloStartY = coreWorld.y - 10;
  const coloEndX = coloPad.cx - coloPad.w / 2 + 35;
  const coloEndY = coloPad.cy - 5;
  const coloTurnX = Math.round((coloStartX + coloEndX) / 2 - 20);

  return (
    <div className="w-full flex-1 min-h-0 flex flex-col bg-[#060c1a] overflow-hidden">
      {/* Blueprint Control Header */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-2 bg-slate-950 border-b border-slate-800 text-xs shrink-0">
        <div className="flex flex-wrap items-center gap-2">
          <span className="px-2.5 py-1 rounded-lg bg-sky-500/20 text-sky-300 border border-sky-500/40 font-mono font-bold flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            Isometric 3D Blueprint
          </span>

          {/* Scope Switcher */}
          <div className="flex items-center bg-slate-900 p-0.5 rounded-lg border border-slate-800">
            <button
              type="button"
              onClick={() => setBlueprintScope('campus-detail')}
              className={`px-2.5 py-1 rounded-md text-xs font-semibold flex items-center gap-1 cursor-pointer transition ${
                blueprintScope === 'campus-detail'
                  ? 'bg-sky-500 text-slate-950 font-bold'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              Live Polled Switch Fabric ({mdfNode.hostname} ↔ {idfNode.hostname})
            </button>
            <button
              type="button"
              onClick={() => setBlueprintScope('multi-country')}
              className={`px-2.5 py-1 rounded-md text-xs font-semibold flex items-center gap-1 cursor-pointer transition ${
                blueprintScope === 'multi-country'
                  ? 'bg-indigo-500 text-white font-bold'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              <Globe className="w-3.5 h-3.5" />
              US &amp; Canada Campuses + Colos
            </button>
          </div>

          {/* Drag & Save Quick Controls */}
          <button
            type="button"
            onClick={handleSwapColoAndApBases}
            className="px-2.5 py-1 rounded-lg bg-purple-500/20 hover:bg-purple-500/30 text-purple-200 border border-purple-500/50 font-mono font-bold text-[11px] flex items-center gap-1.5 cursor-pointer transition"
            title="Move the Purplish Colocation Base upward across from Core and move the Cyan Access Point Base downward across from T-BAN-2FL-WL"
          >
            <ArrowUpDown className="w-3.5 h-3.5 text-purple-300" />
            Swap Colo ▲ / AP ▼ Bases
          </button>

          <button
            type="button"
            onClick={handleResetLayout}
            className="px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-700 font-mono text-[11px] flex items-center gap-1 cursor-pointer transition"
            title="Reset all dragged bases and devices back to default positions"
          >
            <RotateCcw className="w-3 h-3" />
            Reset Layout
          </button>

          <span className="px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 font-mono text-[10px] flex items-center gap-1">
            <Save className="w-3 h-3" />
            {saveStatus} • Drag any Square Base or Device
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          {hoveredDeviceInfo && (
            <div className="hidden xl:flex items-center gap-2 px-2.5 py-1 rounded-lg bg-slate-900 border border-sky-500/40 font-mono text-[11px]">
              <span className="text-white font-bold">{hoveredDeviceInfo.title}</span>
              <span className="text-sky-300">{hoveredDeviceInfo.model}</span>
              <span className="text-emerald-300">{hoveredDeviceInfo.ip}</span>
            </div>
          )}

          <button
            type="button"
            onClick={() => setZoom((z) => Math.max(0.75, +(z - 0.1).toFixed(2)))}
            className="p-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-300 cursor-pointer"
            title="Zoom Out"
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </button>
          <span className="text-[11px] font-mono text-slate-300 px-1">
            {Math.round(zoom * 100)}%
          </span>
          <button
            type="button"
            onClick={() => setZoom((z) => Math.min(1.5, +(z + 0.1).toFixed(2)))}
            className="p-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-300 cursor-pointer"
            title="Zoom In"
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => setZoom(1)}
            className="p-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-300 cursor-pointer"
            title="Reset Zoom"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>

          <button
            type="button"
            onClick={handleExportBlueprintPng}
            className="ml-1 px-3 py-1.5 rounded-lg bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-400 hover:to-blue-500 text-white font-mono font-bold text-xs flex items-center gap-1.5 shadow cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            Export Slide PNG
          </button>
        </div>
      </div>

      {/* Main Blueprint SVG Canvas — Auto-Fits 100% into the Camera Viewport */}
      <div className="flex-1 min-h-0 w-full overflow-auto bg-[#d4e4f7] p-1.5 flex items-center justify-center">
        <div
          className="w-full h-full flex items-center justify-center"
          style={{
            transform: `scale(${zoom})`,
            transformOrigin: 'center center',
            transition: activeDrag ? 'none' : 'transform 150ms ease-out'
          }}
        >
          <svg
            ref={svgRef}
            viewBox="0 0 1440 820"
            preserveAspectRatio="xMidYMid meet"
            className="w-full h-full max-h-full rounded-lg shadow-inner select-none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <defs>
              {/* Outer Blueprint Paper Grid */}
              <pattern
                id="outerBlueprintGrid"
                width="24"
                height="24"
                patternUnits="userSpaceOnUse"
              >
                <path
                  d="M 24 0 L 0 0 0 24"
                  fill="none"
                  stroke="#9ab8db"
                  strokeWidth="0.6"
                />
              </pattern>

              {/* Inner Dark Navy Zone Grid */}
              <pattern
                id="innerZoneGrid"
                width="28"
                height="28"
                patternUnits="userSpaceOnUse"
              >
                <path
                  d="M 28 0 L 0 0 0 28"
                  fill="none"
                  stroke="#1e3a6e"
                  strokeWidth="0.7"
                />
              </pattern>

              {/* 3D Switch Top Metallic Gradient */}
              <linearGradient id="isoSwitchTopGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#334155" />
                <stop offset="50%" stopColor="#1e293b" />
                <stop offset="100%" stopColor="#0f172a" />
              </linearGradient>

              {/* Neon Glow Filters for Conduits & Isometric Pads */}
              <filter id="glowCyan" x="-20%" y="-20%" width="140%" height="140%">
                <feGaussianBlur stdDeviation="4" result="blur" />
                <feMerge>
                  <feMergeNode in="blur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
              <filter id="glowOrange" x="-20%" y="-20%" width="140%" height="140%">
                <feGaussianBlur stdDeviation="4.5" result="blur" />
                <feMerge>
                  <feMergeNode in="blur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
              <filter id="glowPurple" x="-20%" y="-20%" width="140%" height="140%">
                <feGaussianBlur stdDeviation="4.5" result="blur" />
                <feMerge>
                  <feMergeNode in="blur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            </defs>

            {/* 1. OUTER ARCHITECTURAL DRAFTING PAPER & RULERS */}
            <rect width="1440" height="820" fill="#d4e4f7" />
            <rect width="1440" height="820" fill="url(#outerBlueprintGrid)" />

            {/* Outer Drafting Frame Box */}
            <rect
              x="18"
              y="16"
              width="1404"
              height="788"
              fill="none"
              stroke="#1e3a5f"
              strokeWidth="2"
            />

            {/* Top Ruler Ticks (0', 10', 20' ... 80') */}
            {[0, 10, 20, 30, 40, 50, 60, 70, 80].map((mark, i) => {
              const rx = 210 + i * 135;
              return (
                <g key={mark}>
                  <line
                    x1={rx}
                    y1="10"
                    x2={rx}
                    y2="16"
                    stroke="#1e3a5f"
                    strokeWidth="1.5"
                  />
                  <text
                    x={rx}
                    y="9"
                    textAnchor="middle"
                    fill="#1e3a5f"
                    fontSize="8.5"
                    fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace"
                  >
                    {mark}&apos;
                  </text>
                </g>
              );
            })}

            {/* Left Ruler Ticks (10, 20, 30, 40, 50) */}
            {[50, 40, 30, 20, 10].map((mark, i) => {
              const ry = 140 + i * 130;
              return (
                <g key={mark}>
                  <line
                    x1="12"
                    y1={ry}
                    x2="18"
                    y2={ry}
                    stroke="#1e3a5f"
                    strokeWidth="1.5"
                  />
                  <text
                    x="9"
                    y={ry + 3}
                    textAnchor="end"
                    fill="#1e3a5f"
                    fontSize="8.5"
                    fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace"
                  >
                    {mark}
                  </text>
                </g>
              );
            })}

            {/* ARCHITECTURAL TITLE HEADER */}
            <text
              x="42"
              y="52"
              fill="#0f294a"
              fontSize="24"
              fontWeight="900"
              fontFamily="ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, sans-serif"
              letterSpacing="0.5"
            >
              FDU ENTERPRISE NETWORK ARCHITECTURE:{' '}
              <tspan fontWeight="400" fill="#1e3a5f">
                {blueprintScope === 'campus-detail'
                  ? 'METRO CAMPUS (BANCROFT HALL) LIVE 3D TOPOLOGY'
                  : 'US & CANADA MULTI-CAMPUS, COLOCATION & ISP BLUEPRINT'}
              </tspan>
            </text>

            {/* Subtle Ruler Scale Bar under Title */}
            <g stroke="#3b6291" strokeWidth="1">
              <line x1="42" y1="60" x2="220" y2="60" />
              {Array.from({ length: 19 }).map((_, idx) => (
                <line
                  key={idx}
                  x1={42 + idx * 9.5}
                  y1="60"
                  x2={42 + idx * 9.5}
                  y2={idx % 5 === 0 ? '67' : '64'}
                />
              ))}
            </g>

            {blueprintScope === 'campus-detail' ? (
              <>
                {/* =========================================================
                    LEFT CONTAINER: METRO CAMPUS — BANCROFT HALL SWITCH FABRIC
                   ========================================================= */}
                <rect
                  x="38"
                  y="78"
                  width="790"
                  height="655"
                  rx="16"
                  fill="#0b1d3a"
                  stroke="#38bdf8"
                  strokeWidth="2.5"
                  strokeDasharray="8 5"
                />
                <rect
                  x="38"
                  y="78"
                  width="790"
                  height="655"
                  rx="16"
                  fill="url(#innerZoneGrid)"
                />

                {/* Top-Left Container Header Pill */}
                <rect
                  x="38"
                  y="78"
                  width="390"
                  height="32"
                  rx="8"
                  fill="#12305e"
                  stroke="#38bdf8"
                  strokeWidth="1.5"
                  strokeDasharray="4 3"
                />
                <text
                  x="54"
                  y="99"
                  fill="#7dd3fc"
                  fontSize="14"
                  fontWeight="800"
                  fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace"
                  letterSpacing="0.8"
                >
                  METRO CAMPUS • BANCROFT HALL (MDF / IDF)
                </text>

                {/* =========================================================
                    RIGHT CONTAINER: WIRELESS ACCESS & COLOCATION / WAN ZONE
                   ========================================================= */}
                <rect
                  x="848"
                  y="78"
                  width="554"
                  height="655"
                  rx="16"
                  fill="#0b1d3a"
                  stroke="#10b981"
                  strokeWidth="2.5"
                  strokeDasharray="8 5"
                />
                <rect
                  x="848"
                  y="78"
                  width="554"
                  height="655"
                  rx="16"
                  fill="url(#innerZoneGrid)"
                />

                {/* Top-Right Container Header Pill */}
                <rect
                  x="848"
                  y="78"
                  width="430"
                  height="32"
                  rx="8"
                  fill="#0d333a"
                  stroke="#10b981"
                  strokeWidth="1.5"
                  strokeDasharray="4 3"
                />
                <text
                  x="864"
                  y="99"
                  fill="#6ee7b7"
                  fontSize="14"
                  fontWeight="800"
                  fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace"
                  letterSpacing="0.8"
                >
                  WI-FI 6 UPOE ACCESS &amp; COLOCATION WAN ZONE
                </text>

                {/* =========================================================
                    DRAGGABLE ISOMETRIC SQUARE BASES (ZONE PADS)
                   ========================================================= */}
                {/* 1. Orange Square Base: Campus Core Backbone (tcore-9600) */}
                {renderIsometricZonePad({
                  padId: 'corePad',
                  fill: '#f97316',
                  stroke: '#fb923c',
                  glowId: 'glowOrange',
                  label: 'TIER 1 CORE BACKBONE',
                  sublabel: '25G SFP28 OPTICAL DISTRIBUTION',
                  labelColor: '#fed7aa'
                })}

                {/* 2. Green/Cyan Square Base: Polled Catalyst 9300 Switch Fabric (MDF + IDF) */}
                {renderIsometricZonePad({
                  padId: 'switchPad',
                  fill: '#10b981',
                  stroke: '#34d399',
                  glowId: 'glowCyan',
                  label: 'SECURE CAMPUS SWITCH FABRIC (VLAN 133 TRUNK)',
                  sublabel: '2x POLLED CISCO CATALYST C9300-24UX SWITCHES',
                  labelColor: '#a7f3d0'
                })}

                {/* 3. Cyan Square Base: 7 Connected Wi-Fi 6 Access Points */}
                {renderIsometricZonePad({
                  padId: 'apPad',
                  fill: '#06b6d4',
                  stroke: '#22d3ee',
                  glowId: 'glowCyan',
                  label: '802.11AX WI-FI 6 AP FLEET (194W UPOE)',
                  sublabel: '7x C9130AXI-B / C9105AXW-B ACCESS POINTS',
                  labelColor: '#cffafe'
                })}

                {/* 4. Purplish Square Base: Colocations (Halsey165 <-> Hastings) & ISP Transit */}
                {renderIsometricZonePad({
                  padId: 'coloPad',
                  fill: '#a855f7',
                  stroke: '#c084fc',
                  glowId: 'glowPurple',
                  label: 'COLOCATION & ISP TRANSIT HUB',
                  sublabel: 'HALSEY165 (US) ↔ HASTINGS (CA) + BGP ISPs',
                  labelColor: '#f3e8ff'
                })}

                {/* =========================================================
                    DYNAMIC GLOWING NEON DATA CONDUITS (FOLLOW DRAGGED BASES & DEVICES)
                   ========================================================= */}

                {/* CONDUIT A: Dual 25G Fiber Optic Uplinks between tcore-9600 and T-BAN-2FL-WL */}
                <g filter="url(#glowOrange)">
                  <path
                    d={`M ${coreWorld.x + 18} ${coreWorld.y + 18} L ${mdfWorld.x - 18} ${mdfWorld.y - 25}`}
                    fill="none"
                    stroke="#f97316"
                    strokeWidth="7"
                    strokeLinecap="round"
                  />
                  <path
                    d={`M ${coreWorld.x + 18} ${coreWorld.y + 18} L ${mdfWorld.x - 18} ${mdfWorld.y - 25}`}
                    fill="none"
                    stroke="#ffedd5"
                    strokeWidth="2.2"
                    strokeLinecap="round"
                  />
                  <path
                    d={`M ${coreWorld.x - 10} ${coreWorld.y + 32} L ${mdfWorld.x - 42} ${mdfWorld.y - 12}`}
                    fill="none"
                    stroke="#38bdf8"
                    strokeWidth="7"
                    strokeLinecap="round"
                  />
                  <path
                    d={`M ${coreWorld.x - 10} ${coreWorld.y + 32} L ${mdfWorld.x - 42} ${mdfWorld.y - 12}`}
                    fill="none"
                    stroke="#e0f2fe"
                    strokeWidth="2.2"
                    strokeLinecap="round"
                  />
                </g>

                {/* Inline Engineering Callout Badge for Dual 25G Fiber Uplinks */}
                <g transform={`translate(${fiberMidX + 110}, ${fiberMidY - 35})`}>
                  <rect
                    x="-135"
                    y="-22"
                    width="270"
                    height="42"
                    rx="6"
                    fill="#061024"
                    fillOpacity="0.95"
                    stroke="#fb923c"
                    strokeWidth="1.5"
                  />
                  <text
                    x="0"
                    y="-6"
                    textAnchor="middle"
                    fill="#fdba74"
                    fontSize="9.5"
                    fontWeight="800"
                    fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace"
                  >
                    DUAL 25 Gbps FIBER UPLINKS (SFP28)
                  </text>
                  <text
                    x="0"
                    y="7"
                    textAnchor="middle"
                    fill="#e0f2fe"
                    fontSize="9"
                    fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace"
                  >
                    #1: Tw2/2/0/35 ↔ Tw1/1/1 • #2: Tw1/2/0/35 ↔ Tw1/1/2
                  </text>
                  <text
                    x="0"
                    y="17"
                    textAnchor="middle"
                    fill="#34d399"
                    fontSize="8.2"
                    fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace"
                  >
                    802.1Q Allowed VLANs: 8,11,94-97,133,268,270,273,2012
                  </text>
                </g>

                {/* CONDUIT B: Bi-Directionally Verified 10G mGig Trunk between T-BAN-2FL-WL and T-BAN-2FL-WorkStudy-C9300 */}
                <g filter="url(#glowCyan)">
                  <path
                    d={`M ${mdfWorld.x - 20} ${mdfWorld.y + 10} L ${idfWorld.x + 15} ${idfWorld.y + 5}`}
                    fill="none"
                    stroke="#10b981"
                    strokeWidth="9"
                    strokeLinecap="round"
                  />
                  <path
                    d={`M ${mdfWorld.x - 20} ${mdfWorld.y + 10} L ${idfWorld.x + 15} ${idfWorld.y + 5}`}
                    fill="none"
                    stroke="#d1fae5"
                    strokeWidth="2.8"
                    strokeLinecap="round"
                  />
                </g>

                {/* Inline Callout Badge for Bi-Directionally Verified Switch-to-Switch Trunk */}
                <g transform={`translate(${trunkMidX + 85}, ${trunkMidY + 90})`}>
                  <rect
                    x="-138"
                    y="-22"
                    width="276"
                    height="42"
                    rx="6"
                    fill="#041f18"
                    fillOpacity="0.96"
                    stroke="#34d399"
                    strokeWidth="1.8"
                  />
                  <text
                    x="0"
                    y="-6"
                    textAnchor="middle"
                    fill="#6ee7b7"
                    fontSize="9.8"
                    fontWeight="800"
                    fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace"
                  >
                    ✓ BI-DIRECTIONAL 10G TRUNK: Te1/0/20 ↔ Te1/0/24
                  </text>
                  <text
                    x="0"
                    y="7"
                    textAnchor="middle"
                    fill="#ffffff"
                    fontSize="8.8"
                    fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace"
                  >
                    Native VLAN 133 • Mode: on (802.1q) • Speed: 10G Full
                  </text>
                  <text
                    x="0"
                    y="17"
                    textAnchor="middle"
                    fill="#a7f3d0"
                    fontSize="8.2"
                    fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace"
                  >
                    Verified on Both Polled C9300-24UX Switches in SQL DB
                  </text>
                </g>

                {/* CONDUIT C: Glowing Cyan PoE Conduit from T-BAN-2FL-WL across to Cyan Wi-Fi 6 AP Base */}
                <g filter="url(#glowCyan)">
                  <path
                    d={`M ${poeStartX} ${poeStartY} L ${poeTurnX} ${poeStartY} L ${poeTurnX} ${poeEndY} L ${poeEndX} ${poeEndY}`}
                    fill="none"
                    stroke="#06b6d4"
                    strokeWidth="7"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <path
                    d={`M ${poeStartX} ${poeStartY} L ${poeTurnX} ${poeStartY} L ${poeTurnX} ${poeEndY} L ${poeEndX} ${poeEndY}`}
                    fill="none"
                    stroke="#cffafe"
                    strokeWidth="2.2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </g>
                <g transform={`translate(${poeTurnX}, ${Math.round((poeStartY + poeEndY) / 2)})`}>
                  <rect
                    x="-92"
                    y="-15"
                    width="184"
                    height="30"
                    rx="5"
                    fill="#061024"
                    stroke="#22d3ee"
                    strokeWidth="1.4"
                  />
                  <text
                    x="0"
                    y="-2"
                    textAnchor="middle"
                    fill="#67e8f9"
                    fontSize="9"
                    fontWeight="800"
                    fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace"
                  >
                    7x mGIG UPOE LINKS (194.0W)
                  </text>
                  <text
                    x="0"
                    y="10"
                    textAnchor="middle"
                    fill="#e0f2fe"
                    fontSize="8.5"
                    fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace"
                  >
                    Ports Te1/0/1, 2, 4, 5, 6, 8, 14
                  </text>
                </g>

                {/* CONDUIT D: Glowing Purple Core-to-Colocation Conduit from tcore-9600 to Purplish Colo Base */}
                <g filter="url(#glowPurple)">
                  <path
                    d={`M ${coloStartX} ${coloStartY} L ${coloTurnX} ${coloStartY} L ${coloTurnX} ${coloEndY} L ${coloEndX} ${coloEndY}`}
                    fill="none"
                    stroke="#a855f7"
                    strokeWidth="7.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <path
                    d={`M ${coloStartX} ${coloStartY} L ${coloTurnX} ${coloStartY} L ${coloTurnX} ${coloEndY} L ${coloEndX} ${coloEndY}`}
                    fill="none"
                    stroke="#f3e8ff"
                    strokeWidth="2.2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </g>
                <g transform={`translate(${coloTurnX}, ${Math.round((coloStartY + coloEndY) / 2 + 35)})`}>
                  <rect
                    x="-105"
                    y="-15"
                    width="210"
                    height="30"
                    rx="5"
                    fill="#140929"
                    stroke="#c084fc"
                    strokeWidth="1.4"
                  />
                  <text
                    x="0"
                    y="-2"
                    textAnchor="middle"
                    fill="#e9d5ff"
                    fontSize="9"
                    fontWeight="800"
                    fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace"
                  >
                    DARK FIBER / COLO INTERCONNECT
                  </text>
                  <text
                    x="0"
                    y="10"
                    textAnchor="middle"
                    fill="#cbd5e1"
                    fontSize="8.5"
                    fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace"
                  >
                    Metro ↔ Halsey165 ↔ Florham / Hastings
                  </text>
                </g>

                {/* =========================================================
                    DRAGGABLE 3D ISOMETRIC HARDWARE NODES (CLAMPED TO THEIR SQUARE BASES)
                   ========================================================= */}

                {/* 1. Tier 1 Core Tower: tcore-9600.net.fdu.edu */}
                {renderIsometric3DCoreTower({
                  deviceId: 'coreNode',
                  hostname: coreNode.hostname,
                  model: coreNode.model || 'C9606R',
                  ip: coreNode.mgmtIp || '132.238.1.40',
                  statusLabel:
                    coreLinks.length > 0
                      ? `2x 25G Fiber Ports: Tw2/2/0/35 & Tw1/2/0/35`
                      : 'Discovered via CDP • Click to Poll SSH',
                  onClick: () => {
                    if (!coreNode.isPolled && onPollNeighbor && coreNode.mgmtIp !== '—') {
                      onPollNeighbor(coreNode.mgmtIp, coreNode.hostname);
                    }
                  }
                })}

                {/* 2. Tier 2 Polled Distribution Switch: T-BAN-2FL-WL */}
                {renderIsometric3DSwitch({
                  deviceId: 'mdfNode',
                  scale: 1.05,
                  title: mdfNode.hostname,
                  subtitle: mdfNode.iosVersion || '17.15.04',
                  ip: mdfNode.mgmtIp || '132.238.8.58',
                  serial: mdfNode.serialNumber || 'FOC2540Y44H',
                  model: mdfNode.model || 'C9300-24UX',
                  poeText: `⚡ ${(mdfNode.totalPoeWatts || 194.0).toFixed(1)}W PoE (7 APs)`,
                  portSummary: '2x25G Up + Te1/0/20 Down',
                  isActive3D: activeDeviceSerial === mdfNode.serialNumber,
                  isPolled: true,
                  accentColor: '#34d399',
                  onClick: () => {
                    if (onSelectSavedDevice && mdfNode.serialNumber) {
                      onSelectSavedDevice(mdfNode.serialNumber);
                    }
                  }
                })}

                {/* 3. Tier 3 Polled IDF Switch: T-BAN-2FL-WorkStudy-C9300 */}
                {renderIsometric3DSwitch({
                  deviceId: 'idfNode',
                  scale: 1.05,
                  title: idfNode.hostname,
                  subtitle: idfNode.iosVersion || '17.15.04',
                  ip: idfNode.mgmtIp || '132.238.8.250',
                  serial: idfNode.serialNumber || 'FCW2250D0KN',
                  model: idfNode.model || 'C9300-24UX',
                  poeText: 'Uplink: Te1/0/24 (10G Trunk)',
                  portSummary: 'VLANs: 12 Active',
                  isActive3D: activeDeviceSerial === idfNode.serialNumber,
                  isPolled: true,
                  accentColor: '#38bdf8',
                  onClick: () => {
                    if (onSelectSavedDevice && idfNode.serialNumber) {
                      onSelectSavedDevice(idfNode.serialNumber);
                    }
                  }
                })}

                {/* 4. 7 Connected Cisco Catalyst Wi-Fi 6 APs inside the Cyan Access Base */}
                {(attachedAps.length > 0
                  ? attachedAps
                  : [
                      { localPort: 'Te1/0/1', hostname: 'M-BAN-203-A', ip: '10.8.25.108', model: 'C9130AXI-B', poeWatts: 30 },
                      { localPort: 'Te1/0/2', hostname: 'M-BAN-205-A', ip: '10.8.25.101', model: 'C9130AXI-B', poeWatts: 30 },
                      { localPort: 'Te1/0/4', hostname: 'M-BAN-216-A', ip: '10.8.25.182', model: 'C9130AXI-B', poeWatts: 30 },
                      { localPort: 'Te1/0/5', hostname: 'M-BAN-218-A', ip: '10.8.25.104', model: 'C9130AXI-B', poeWatts: 30 },
                      { localPort: 'Te1/0/6', hostname: 'M-BAN-212-A', ip: '10.8.25.103', model: 'C9130AXI-B', poeWatts: 30 },
                      { localPort: 'Te1/0/8', hostname: 'M-BAN-228-A', ip: '10.8.25.177', model: 'C9130AXI-B', poeWatts: 30 },
                      { localPort: 'Te1/0/14', hostname: 'M-BAN-Sniffer', ip: '10.8.25.195', model: 'C9105AXW-B', poeWatts: 14 }
                    ]
                )
                  .slice(0, 7)
                  .map((ap, idx) =>
                    renderIsometric3DApNode({
                      deviceId: `ap-${idx}`,
                      hostname: ap.hostname,
                      ip: ap.ip,
                      model: ap.model,
                      localPort: ap.localPort,
                      poeWatts: ap.poeWatts
                    })
                  )}

                {/* 5. Draggable Colocation & ISP Handoff Nodes inside the Purplish Colo Base */}
                <g
                  transform={`translate(${halseyColoWorld.x}, ${halseyColoWorld.y})`}
                  onPointerDown={(e) =>
                    handleStartDeviceDrag(e, 'halseyColo', () => {
                      setSelectedNodeKey('Halsey165 Colo');
                      setHoveredDeviceInfo({
                        title: '🇺🇸 Halsey165 Colo',
                        model: '165 Halsey St (Newark, NJ)',
                        ip: 'Metro ↔ Halsey165 ↔ Florham',
                        serial: 'US Tier-1 ISP Transit',
                        subtitle: 'Colocation Core Hub'
                      });
                    })
                  }
                  style={{
                    cursor:
                      activeDrag?.kind === 'device' && activeDrag?.id === 'halseyColo'
                        ? 'grabbing'
                        : 'grab'
                  }}
                >
                  <rect
                    x="-65"
                    y="-26"
                    width="155"
                    height="56"
                    rx="8"
                    fill="#1e1b4b"
                    stroke={
                      activeDrag?.id === 'halseyColo' || selectedNodeKey === 'Halsey165 Colo'
                        ? '#ffffff'
                        : '#c084fc'
                    }
                    strokeWidth="1.8"
                  />
                  <text
                    x="12"
                    y="-7"
                    textAnchor="middle"
                    fill="#ffffff"
                    fontSize="10.5"
                    fontWeight="800"
                    fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace"
                  >
                    🇺🇸 Halsey165 Colo
                  </text>
                  <text
                    x="12"
                    y="7"
                    textAnchor="middle"
                    fill="#e9d5ff"
                    fontSize="8.8"
                    fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace"
                  >
                    Metro ↔ Halsey165 ↔ Florham
                  </text>
                  <text
                    x="12"
                    y="19"
                    textAnchor="middle"
                    fill="#fcd34d"
                    fontSize="8.5"
                    fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace"
                  >
                    + US Tier-1 ISP Transit
                  </text>
                </g>

                <g
                  transform={`translate(${hastingsColoWorld.x}, ${hastingsColoWorld.y})`}
                  onPointerDown={(e) =>
                    handleStartDeviceDrag(e, 'hastingsColo', () => {
                      setSelectedNodeKey('Hastings Colo');
                      setHoveredDeviceInfo({
                        title: '🇨🇦 Hastings Colo',
                        model: 'Harbour Centre (Vancouver, BC)',
                        ip: 'VancOakridge ↔ Hastings',
                        serial: 'Canada ISP & BCNET',
                        subtitle: 'Colocation Core Hub'
                      });
                    })
                  }
                  style={{
                    cursor:
                      activeDrag?.kind === 'device' && activeDrag?.id === 'hastingsColo'
                        ? 'grabbing'
                        : 'grab'
                  }}
                >
                  <rect
                    x="-65"
                    y="-26"
                    width="155"
                    height="56"
                    rx="8"
                    fill="#311042"
                    stroke={
                      activeDrag?.id === 'hastingsColo' || selectedNodeKey === 'Hastings Colo'
                        ? '#ffffff'
                        : '#f472b6'
                    }
                    strokeWidth="1.8"
                  />
                  <text
                    x="12"
                    y="-7"
                    textAnchor="middle"
                    fill="#ffffff"
                    fontSize="10.5"
                    fontWeight="800"
                    fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace"
                  >
                    🇨🇦 Hastings Colo
                  </text>
                  <text
                    x="12"
                    y="7"
                    textAnchor="middle"
                    fill="#fbcfe8"
                    fontSize="8.8"
                    fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace"
                  >
                    VancOakridge ↔ Hastings
                  </text>
                  <text
                    x="12"
                    y="19"
                    textAnchor="middle"
                    fill="#fcd34d"
                    fontSize="8.5"
                    fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace"
                  >
                    + Canada ISP &amp; BCNET
                  </text>
                </g>
              </>
            ) : (
              /* =========================================================
                 SCOPE 2: MULTI-COUNTRY US & CANADA ARCHITECTURE BLUEPRINT
                 ========================================================= */
              <>
                {/* Left Container: UNITED STATES (Metro, Florham, Halsey165 + US ISPs) */}
                <rect
                  x="38"
                  y="78"
                  width="760"
                  height="655"
                  rx="16"
                  fill="#0b1d3a"
                  stroke="#38bdf8"
                  strokeWidth="2.5"
                  strokeDasharray="8 5"
                />
                <rect
                  x="38"
                  y="78"
                  width="760"
                  height="655"
                  rx="16"
                  fill="url(#innerZoneGrid)"
                />
                <rect
                  x="38"
                  y="78"
                  width="420"
                  height="32"
                  rx="8"
                  fill="#12305e"
                  stroke="#38bdf8"
                  strokeWidth="1.5"
                />
                <text
                  x="54"
                  y="99"
                  fill="#7dd3fc"
                  fontSize="14"
                  fontWeight="800"
                  fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace"
                >
                  🇺🇸 UNITED STATES REGION (NJ CAMPUSES &amp; COLO)
                </text>

                {/* Right Container: CANADA (VancOakridge, Hastings + CA ISPs) */}
                <rect
                  x="825"
                  y="78"
                  width="577"
                  height="655"
                  rx="16"
                  fill="#0b1d3a"
                  stroke="#10b981"
                  strokeWidth="2.5"
                  strokeDasharray="8 5"
                />
                <rect
                  x="825"
                  y="78"
                  width="577"
                  height="655"
                  rx="16"
                  fill="url(#innerZoneGrid)"
                />
                <rect
                  x="825"
                  y="78"
                  width="420"
                  height="32"
                  rx="8"
                  fill="#0d333a"
                  stroke="#10b981"
                  strokeWidth="1.5"
                />
                <text
                  x="842"
                  y="99"
                  fill="#6ee7b7"
                  fontSize="14"
                  fontWeight="800"
                  fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace"
                >
                  🇨🇦 CANADA REGION (VANCOUVER CAMPUS &amp; COLO)
                </text>

                {/* Draggable Isometric Pads for Metro, Halsey165, Florham, Hastings, VancOakridge */}
                {renderIsometricZonePad({
                  padId: 'halseyPad',
                  fill: '#f97316',
                  stroke: '#fb923c',
                  glowId: 'glowOrange',
                  label: 'HALSEY165 COLOCATION (NEWARK, NJ)',
                  sublabel: 'US CORE HUB + US TIER-1 ISP BGP PEERING',
                  labelColor: '#fed7aa'
                })}

                {renderIsometricZonePad({
                  padId: 'metroPad',
                  fill: '#10b981',
                  stroke: '#34d399',
                  glowId: 'glowCyan',
                  label: 'METRO CAMPUS (~1,000 DEV)',
                  sublabel: '2 POLLED C9300-24UX + TCORE-9600',
                  labelColor: '#a7f3d0'
                })}

                {renderIsometricZonePad({
                  padId: 'florhamPad',
                  fill: '#38bdf8',
                  stroke: '#60a5fa',
                  glowId: 'glowCyan',
                  label: 'FLORHAM CAMPUS (~1,000 DEV)',
                  sublabel: 'MADISON, NJ CAMPUS FABRIC',
                  labelColor: '#bae6fd'
                })}

                {renderIsometricZonePad({
                  padId: 'hastingsPad',
                  fill: '#a855f7',
                  stroke: '#c084fc',
                  glowId: 'glowPurple',
                  label: 'HASTINGS COLOCATION (VANCOUVER)',
                  sublabel: 'CANADA CORE HUB + CA ISP & BCNET',
                  labelColor: '#f3e8ff'
                })}

                {renderIsometricZonePad({
                  padId: 'vancPad',
                  fill: '#10b981',
                  stroke: '#34d399',
                  glowId: 'glowCyan',
                  label: 'VANCOAKRIDGE CAMPUS (~1,000 DEV)',
                  sublabel: 'VANCOUVER OAKRIDGE SWITCH FABRIC',
                  labelColor: '#a7f3d0'
                })}

                {/* Dynamic Cross-Border Core Tunnel: Halsey165 <-> Hastings */}
                <g filter="url(#glowPurple)">
                  <line
                    x1={layout.pads.halseyPad.cx + 95}
                    y1={layout.pads.halseyPad.cy}
                    x2={layout.pads.hastingsPad.cx - 95}
                    y2={layout.pads.hastingsPad.cy}
                    stroke="#a855f7"
                    strokeWidth="9"
                  />
                  <line
                    x1={layout.pads.halseyPad.cx + 95}
                    y1={layout.pads.halseyPad.cy}
                    x2={layout.pads.hastingsPad.cx - 95}
                    y2={layout.pads.hastingsPad.cy}
                    stroke="#f3e8ff"
                    strokeWidth="2.5"
                  />
                </g>
                <g
                  transform={`translate(${Math.round(
                    (layout.pads.halseyPad.cx + layout.pads.hastingsPad.cx) / 2
                  )}, ${Math.round(
                    (layout.pads.halseyPad.cy + layout.pads.hastingsPad.cy) / 2
                  )})`}
                >
                  <rect
                    x="-125"
                    y="-16"
                    width="250"
                    height="32"
                    rx="6"
                    fill="#140929"
                    stroke="#c084fc"
                    strokeWidth="1.6"
                  />
                  <text
                    x="0"
                    y="-1"
                    textAnchor="middle"
                    fill="#f3e8ff"
                    fontSize="10"
                    fontWeight="800"
                    fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace"
                  >
                    CROSS-BORDER CORE WAN (HALSEY165 ↔ HASTINGS)
                  </text>
                  <text
                    x="0"
                    y="11"
                    textAnchor="middle"
                    fill="#fcd34d"
                    fontSize="8.5"
                    fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace"
                  >
                    10G Redundant Optical / MPLS / IPsec Backbone
                  </text>
                </g>

                {/* Dynamic Metro <-> Halsey165, Florham <-> Halsey165, and Hastings <-> VancOakridge Conduits */}
                <g filter="url(#glowCyan)">
                  <line
                    x1={layout.pads.halseyPad.cx - 40}
                    y1={layout.pads.halseyPad.cy + 35}
                    x2={layout.pads.metroPad.cx + 10}
                    y2={layout.pads.metroPad.cy - 45}
                    stroke="#10b981"
                    strokeWidth="7"
                  />
                  <line
                    x1={layout.pads.halseyPad.cx + 40}
                    y1={layout.pads.halseyPad.cy + 35}
                    x2={layout.pads.florhamPad.cx - 10}
                    y2={layout.pads.florhamPad.cy - 45}
                    stroke="#38bdf8"
                    strokeWidth="7"
                  />
                  <line
                    x1={layout.pads.hastingsPad.cx}
                    y1={layout.pads.hastingsPad.cy + 50}
                    x2={layout.pads.vancPad.cx}
                    y2={layout.pads.vancPad.cy - 50}
                    stroke="#10b981"
                    strokeWidth="7"
                  />
                </g>

                {/* Draggable 3D Nodes on Global Map */}
                {renderIsometric3DCoreTower({
                  deviceId: 'globalHalsey',
                  hostname: 'Halsey165 Core Hub',
                  model: '165 Halsey St (NJ)',
                  ip: 'Metro ↔ Florham Hub',
                  statusLabel: 'US Tier-1 ISP Peering + Cross-Border WAN',
                  onClick: () => setBlueprintScope('campus-detail')
                })}

                {renderIsometric3DCoreTower({
                  deviceId: 'globalHastings',
                  hostname: 'Hastings Core Hub',
                  model: 'W. Hastings St (BC)',
                  ip: 'VancOakridge Hub',
                  statusLabel: 'Canada ISP Peering + BCNET Transit',
                  onClick: () => {}
                })}

                {renderIsometric3DSwitch({
                  deviceId: 'globalMetro',
                  scale: 0.95,
                  title: 'Metro Campus (Bancroft)',
                  subtitle: '17.15.04',
                  ip: '132.238.8.58 / .250',
                  serial: '2 Polled + Core + 7 APs',
                  model: 'C9300-24UX & C9606R',
                  poeText: 'Click to Zoom Into Metro Switches',
                  isActive3D: true,
                  isPolled: true,
                  accentColor: '#34d399',
                  onClick: () => setBlueprintScope('campus-detail')
                })}

                {renderIsometric3DSwitch({
                  deviceId: 'globalFlorham',
                  scale: 0.95,
                  title: 'Florham Campus',
                  subtitle: 'IOS-XE',
                  ip: 'Madison, NJ',
                  serial: '~1,000 Target Devices',
                  model: 'Catalyst 9300 / 9500',
                  poeText: 'Connected via Halsey165',
                  isActive3D: false,
                  isPolled: false,
                  accentColor: '#38bdf8',
                  onClick: () => {}
                })}

                {renderIsometric3DSwitch({
                  deviceId: 'globalVanc',
                  scale: 0.95,
                  title: 'VancOakridge Campus',
                  subtitle: 'IOS-XE',
                  ip: 'Vancouver, BC',
                  serial: '~1,000 Target Devices',
                  model: 'Catalyst 9300 / 9500',
                  poeText: 'Connected via Hastings',
                  isActive3D: false,
                  isPolled: false,
                  accentColor: '#10b981',
                  onClick: () => {}
                })}
              </>
            )}

            {/* =========================================================
                BOTTOM TITLE STAMP & COLOR-CODED ARCHITECTURE LEGEND
               ========================================================= */}
            <text
              x="42"
              y="775"
              fill="#0f294a"
              fontSize="14"
              fontWeight="900"
              fontFamily="ui-sans-serif, system-ui, sans-serif"
            >
              FAIRLEIGH DICKINSON UNIVERSITY (FDU)
            </text>
            <text
              x="42"
              y="792"
              fill="#1e3a5f"
              fontSize="10"
              fontWeight="700"
              fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace"
            >
              LIVE IOS-XE SHOW COMMAND &amp; CDP TELEMETRY BLUEPRINT • DRAGGABLE BASES &amp; DEVICES (SAVED IN POSTGRESQL 16) •{' '}
              {switchNodes.filter((n) => n.isPolled).length} POLLED SWITCHES /{' '}
              {globalGraph?.links?.length || 10} ACTIVE LINKS
            </text>

            {/* Bottom-Right Legend Box */}
            <g transform="translate(1110, 740)">
              <rect
                x="0"
                y="0"
                width="292"
                height="58"
                rx="6"
                fill="#e2effd"
                stroke="#1e3a5f"
                strokeWidth="1.5"
              />
              <text
                x="10"
                y="14"
                fill="#0284c7"
                fontSize="9.5"
                fontWeight="800"
                fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace"
              >
                CYAN:   802.11AX WI-FI 6 UPOE &amp; 25G FIBER
              </text>
              <text
                x="10"
                y="26"
                fill="#059669"
                fontSize="9.5"
                fontWeight="800"
                fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace"
              >
                GREEN:  VERIFIED SWITCH-TO-SWITCH 802.1Q TRUNK
              </text>
              <text
                x="10"
                y="38"
                fill="#ea580c"
                fontSize="9.5"
                fontWeight="800"
                fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace"
              >
                ORANGE: CAMPUS CORE (C9606R) &amp; ISP TRANSIT
              </text>
              <text
                x="10"
                y="50"
                fill="#7e22ce"
                fontSize="9.5"
                fontWeight="800"
                fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace"
              >
                PURPLE: COLOCATION (HALSEY165 ↔ HASTINGS)
              </text>
            </g>
          </svg>
        </div>
      </div>

      {/* =========================================================
          COLLAPSIBLE BOTTOM CAPTURED DEVICE TELEMETRY DRAWER
          (Collapsed by default to maximize camera viewport height!)
         ========================================================= */}
      <div className="bg-slate-950 border-t border-slate-800 shrink-0">
        <button
          type="button"
          onClick={() => setIsBottomDrawerOpen(!isBottomDrawerOpen)}
          className="w-full px-4 py-2 flex flex-wrap items-center justify-between gap-2 hover:bg-slate-900/90 transition cursor-pointer"
        >
          <span className="text-xs font-mono font-bold uppercase tracking-wider text-sky-300 flex items-center gap-1.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            Captured Device Telemetry Drawer ({switchNodes.filter((n) => n.isPolled).length} Polled Switches • {switchNodes.filter((n) => !n.isPolled).length} Core • {attachedAps.length} Wi-Fi 6 APs)
          </span>
          <span className="text-[11px] font-mono text-emerald-300 flex items-center gap-1 bg-slate-900 px-2.5 py-0.5 rounded border border-slate-700">
            {isBottomDrawerOpen ? (
              <>
                <ChevronDown className="w-3.5 h-3.5" /> Collapse Drawer ▼
              </>
            ) : (
              <>
                <ChevronUp className="w-3.5 h-3.5" /> Expand Captured Device Cards ▲
              </>
            )}
          </span>
        </button>

        {isBottomDrawerOpen && (
          <div className="px-3.5 pb-3.5 pt-1 grid grid-cols-1 lg:grid-cols-3 gap-3 text-xs font-mono max-h-56 overflow-y-auto">
            {/* Card 1: Polled Switch #1 (T-BAN-2FL-WorkStudy-C9300) */}
            <div
              onClick={() =>
                onSelectSavedDevice &&
                idfNode.serialNumber &&
                onSelectSavedDevice(idfNode.serialNumber)
              }
              className={`p-3 rounded-xl border transition cursor-pointer ${
                activeDeviceSerial === idfNode.serialNumber
                  ? 'bg-sky-950/40 border-sky-400'
                  : 'bg-slate-900/80 border-slate-800 hover:border-sky-500/50'
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 text-[10px] font-bold">
                  POLLED SWITCH #1 • IDF
                </span>
                <span className="text-[10px] text-sky-300 flex items-center gap-1">
                  <Box className="w-3 h-3" /> {activeDeviceSerial === idfNode.serialNumber ? 'Active in 3D' : 'Load 3D'}
                </span>
              </div>
              <div className="text-sm font-bold text-white">{idfNode.hostname}</div>
              <div className="text-slate-300 mt-1 space-y-0.5 text-[11px]">
                <div>• Model: <strong className="text-sky-300">{idfNode.model}</strong> (24-Port mGig)</div>
                <div>• Serial #: <strong className="text-emerald-300">{idfNode.serialNumber}</strong> • IOS-XE: <strong>{idfNode.iosVersion}</strong></div>
                <div>• Mgmt IP: <strong className="text-emerald-300">{idfNode.mgmtIp}</strong> • Site: <strong>{idfNode.siteCode}</strong></div>
                <div>
                  • Trunk Link: <strong className="text-amber-300">Te1/0/24 ↔ {mdfNode.hostname} [Te1/0/20]</strong> (VLAN {mdfToIdfLink?.nativeVlan || 133})
                </div>
              </div>
            </div>

            {/* Card 2: Polled Switch #2 (T-BAN-2FL-WL) */}
            <div
              onClick={() =>
                onSelectSavedDevice &&
                mdfNode.serialNumber &&
                onSelectSavedDevice(mdfNode.serialNumber)
              }
              className={`p-3 rounded-xl border transition cursor-pointer ${
                activeDeviceSerial === mdfNode.serialNumber
                  ? 'bg-sky-950/40 border-sky-400'
                  : 'bg-slate-900/80 border-slate-800 hover:border-sky-500/50'
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 text-[10px] font-bold">
                  POLLED SWITCH #2 • MDF
                </span>
                <span className="text-[10px] text-sky-300 flex items-center gap-1">
                  <Box className="w-3 h-3" /> {activeDeviceSerial === mdfNode.serialNumber ? 'Active in 3D' : 'Load 3D'}
                </span>
              </div>
              <div className="text-sm font-bold text-white">{mdfNode.hostname}</div>
              <div className="text-slate-300 mt-1 space-y-0.5 text-[11px]">
                <div>• Model: <strong className="text-sky-300">{mdfNode.model}</strong> (24-Port mGig)</div>
                <div>• Serial #: <strong className="text-emerald-300">{mdfNode.serialNumber}</strong> • IOS-XE: <strong>{mdfNode.iosVersion}</strong></div>
                <div>• Mgmt IP: <strong className="text-emerald-300">{mdfNode.mgmtIp}</strong> • PoE Draw: <strong className="text-amber-300">{(mdfNode.totalPoeWatts || 194.0).toFixed(1)}W (7 APs)</strong></div>
                <div>
                  • Uplinks: <strong className="text-cyan-300">Tw1/1/1 &amp; Tw1/1/2 → {coreNode.hostname}</strong> • Downlink: <strong className="text-emerald-300">Te1/0/20</strong>
                </div>
              </div>
            </div>

            {/* Card 3: Discovered Upstream Core Switch (tcore-9600.net.fdu.edu) */}
            <div className="p-3 rounded-xl border border-orange-500/40 bg-slate-900/80 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="px-2 py-0.5 rounded bg-orange-500/20 text-orange-300 text-[10px] font-bold">
                    DISCOVERED TIER 1 CORE • CDP
                  </span>
                  {onPollNeighbor && (
                    <button
                      type="button"
                      onClick={() => onPollNeighbor(coreNode.mgmtIp, coreNode.hostname)}
                      className="px-2 py-0.5 rounded bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-[10px] flex items-center gap-1 cursor-pointer"
                    >
                      <Terminal className="w-2.5 h-2.5" /> Poll Core via SSH
                    </button>
                  )}
                </div>
                <div className="text-sm font-bold text-white">{coreNode.hostname}</div>
                <div className="text-slate-300 mt-1 space-y-0.5 text-[11px]">
                  <div>• Platform: <strong className="text-orange-300">Cisco {coreNode.model}</strong> (Modular Core Chassis)</div>
                  <div>• Mgmt IP: <strong className="text-emerald-300">{coreNode.mgmtIp}</strong> • IOS-XE: <strong>17.12.4</strong></div>
                  <div>• Fiber Port #1: <strong className="text-cyan-300">Tw2/2/0/35 ↔ {mdfNode.hostname} [Tw1/1/1]</strong></div>
                  <div>• Fiber Port #2: <strong className="text-cyan-300">Tw1/2/0/35 ↔ {mdfNode.hostname} [Tw1/1/2]</strong></div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
