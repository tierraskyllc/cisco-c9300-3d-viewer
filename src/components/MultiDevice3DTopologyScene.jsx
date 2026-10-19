import React, { useRef, useState, useMemo, useEffect, useLayoutEffect, useCallback } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import {
  OrbitControls,
  PerspectiveCamera,
  Html,
  ContactShadows,
  RoundedBox,
  Grid
} from '@react-three/drei';
import * as THREE from 'three';
import {
  Box,
  Cpu,
  Wifi,
  Zap,
  Globe,
  GitCompareArrows,
  CheckCircle2,
  ExternalLink,
  Search,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Layers,
  Server,
  Eye,
  EyeOff,
  Maximize2,
  Sparkles,
  Activity,
  ArrowUpDown,
  RotateCcw,
  Save,
  PanelRightOpen,
  Building2
} from 'lucide-react';
import {
  GLOBAL_SITES,
  ISP_PROVIDERS,
  buildGlobalAndSiteTopology
} from '../data/globalNetworkData';
import { CiscoC9300ChassisAssembly } from './CiscoChassis3D';

const LAYOUT_3D_STORAGE_KEY = 'fdu_multi_device_3d_layout_v2';
const API_3D_LAYOUT_ENDPOINT = '/api/topology/layouts/multi_device_3d_v2';
const FLOOR_PLANE = new THREE.Plane(new THREE.Vector3(0, 1, 0), -0.2);
const MULTI_CHASSIS_SCALE = 0.225;
const MULTI_CHASSIS_Y = 0.56;

// Compute the exact 3D world coordinate of a specific RJ-45 downlink port (1..24 or 1..48) on a C9300 switch in the Multi-Device 3D scene
function getC9300PortWorldPos(swPos, portNum = 1, is24Port = true, scale = MULTI_CHASSIS_SCALE) {
  const idx = Math.max(0, (portNum || 1) - 1);
  const col = Math.floor(idx / 2);
  const bankIdx = Math.floor(col / 6);
  const isTopRow = idx % 2 === 0;
  const startX = is24Port ? -0.85 : -5.65;
  const localX = startX + col * 0.36 + bankIdx * 0.24;
  const localY = isTopRow ? 0.24 : -0.24;
  const localZ = 6.08;
  return [
    +(swPos[0] + localX * scale).toFixed(3),
    +(swPos[1] + MULTI_CHASSIS_Y + localY * scale).toFixed(3),
    +(swPos[2] + localZ * scale).toFixed(3)
  ];
}

// Compute the exact 3D world coordinate of an SFP28 uplink cage (0..7) in the right-hand C9300-NM-8X bay
function getC9300UplinkWorldPos(swPos, uplinkIdx = 0, scale = MULTI_CHASSIS_SCALE) {
  const col = Math.floor(uplinkIdx / 2);
  const isTop = uplinkIdx % 2 === 0;
  const localX = 6.25 + (-1.28 + col * 0.85);
  const localY = isTop ? 0.25 : -0.25;
  const localZ = 6.12;
  return [
    +(swPos[0] + localX * scale).toFixed(3),
    +(swPos[1] + MULTI_CHASSIS_Y + localY * scale).toFixed(3),
    +(swPos[2] + localZ * scale).toFixed(3)
  ];
}

// Extract or synthesize the 24/48-port status array for any C9300 switch in the Multi-Device 3D scene
function buildSwitchPortsFor3DNode(node, savedDevices = [], parsedSwitchData = null) {
  const totalPorts = node?.model?.includes('48') ? 48 : 24;

  // 1. Check if this node is the currently active parsed switch
  if (
    parsedSwitchData?.ports48?.length &&
    (parsedSwitchData?.device?.hostname === node?.hostname ||
      (node?.serialNumber && parsedSwitchData?.device?.serialNumber === node?.serialNumber))
  ) {
    return parsedSwitchData.ports48.slice(0, totalPorts);
  }

  // 2. Check if this node has a full parsed snapshot in PostgreSQL savedDevices
  const found = (savedDevices || []).find(
    (d) =>
      (node?.serialNumber && d.serial_number === node.serialNumber) ||
      d.hostname === node?.hostname
  );
  if (found?.parsed_snapshot?.ports48?.length) {
    return found.parsed_snapshot.ports48.slice(0, totalPorts);
  }

  // 3. Fallback: build a realistic port array from discovered links & attached APs
  const upPortMap = {};
  for (const ep of node?.attachedEndpoints || []) {
    const m = String(ep.localPort || '').match(/(\d+)$/);
    if (m) {
      upPortMap[Number(m[1])] = {
        status: 'up',
        endpointType: 'ap',
        poeWatts: ep.poeWatts || 30.0,
        speed: '2.5G',
        duplex: 'full',
        connectedDevice: ep.hostname
      };
    }
  }
  for (const lnk of node?.switchLinks || []) {
    if (String(lnk.localPort || '').startsWith('Tw')) continue; // Uplink module port
    const m = String(lnk.localPort || '').match(/(\d+)$/);
    if (m) {
      upPortMap[Number(m[1])] = {
        status: 'up',
        endpointType: 'switch',
        poeWatts: 0,
        speed: '10G',
        duplex: 'full',
        connectedDevice: lnk.remoteHostname
      };
    }
  }

  return Array.from({ length: totalPorts }, (_, i) => {
    const portNumber = i + 1;
    const hit = upPortMap[portNumber];
    return {
      portNumber,
      interfaceName: `Te1/0/${portNumber}`,
      status: hit ? hit.status : 'down',
      endpointType: hit ? hit.endpointType : 'none',
      poeWatts: hit ? hit.poeWatts : 0,
      speed: hit ? hit.speed : 'auto',
      duplex: hit ? hit.duplex : 'auto',
      connectedDevice: hit ? hit.connectedDevice : 'Not Connected'
    };
  });
}

/**
 * Default 3D coordinates for the 4 Square Zone Bases and relative (dx, dz) offsets for every 3D device.
 * Because devices store (dx, dz) relative to their parent 3D Square Zone Base:
 * 1) Dragging a 3D Square Zone Base moves the base AND all devices on it together.
 * 2) Dragging an individual 3D Device moves it smoothly while clamping it within/near its parent Square Base.
 */
const DEFAULT_3D_LAYOUT = {
  pads: {
    vancZone: { cx: -28.0, cz: -25.0, w: 14.0, d: 11.0 },
    coloZone: { cx: 4.0, cz: -25.0, w: 14.5, d: 13.0 },
    mcoreZone: { cx: -18.0, cz: -4.5, w: 12.5, d: 8.5 },
    coreZone: { cx: 24.0, cz: -4.5, w: 12.5, d: 8.5 },
    switchZone: { cx: 18.0, cz: 10.5, w: 10.2, d: 8.6 },
    apZone: { cx: 31.5, cz: 10.5, w: 9.6, d: 9.8 }
  },
  devices: {
    // Relative to coreZone (T-CORE Metro)
    coreNode: { dx: 0, dz: 0, padId: 'coreZone', maxDx: 4.4, maxDz: 3.2 },
    // Relative to mcoreZone (M-CORE Florham)
    mcoreNode: { dx: 0, dz: 0, padId: 'mcoreZone', maxDx: 4.4, maxDz: 3.2 },
    // Relative to switchZone (Bancroft Hall under T-CORE)
    wlNode: { dx: 2.2, dz: -2.0, padId: 'switchZone', maxDx: 4.2, maxDz: 3.8 },
    wsNode: { dx: -2.2, dz: 2.0, padId: 'switchZone', maxDx: 4.2, maxDz: 3.8 },
    // 7 Wi-Fi 6 APs relative to apZone
    'ap-0': { dx: -2.2, dz: -3.8, padId: 'apZone', maxDx: 4.3, maxDz: 4.5 },
    'ap-1': { dx: 2.2, dz: -3.8, padId: 'apZone', maxDx: 4.3, maxDz: 4.5 },
    'ap-2': { dx: -2.2, dz: -1.25, padId: 'apZone', maxDx: 4.3, maxDz: 4.5 },
    'ap-3': { dx: 2.2, dz: -1.25, padId: 'apZone', maxDx: 4.3, maxDz: 4.5 },
    'ap-4': { dx: -2.2, dz: 1.3, padId: 'apZone', maxDx: 4.3, maxDz: 4.5 },
    'ap-5': { dx: 2.2, dz: 1.3, padId: 'apZone', maxDx: 4.3, maxDz: 4.5 },
    'ap-6': { dx: -2.2, dz: 3.85, padId: 'apZone', maxDx: 4.3, maxDz: 4.5 },
    // 4 Colocation / Campus Sites relative to coloZone
    'colo-Halsey165': { dx: -2.2, dz: -1.3, padId: 'coloZone', maxDx: 4.2, maxDz: 2.3 },
    'colo-Hastings': { dx: 2.2, dz: -1.3, padId: 'coloZone', maxDx: 4.2, maxDz: 2.3 },
    'colo-Florham': { dx: -2.2, dz: 1.4, padId: 'coloZone', maxDx: 4.2, maxDz: 2.3 },
    'colo-VancOakridge': { dx: 2.2, dz: 1.4, padId: 'coloZone', maxDx: 4.2, maxDz: 2.3 }
  }
};

function mergeWithDefault3DLayout(saved) {
  if (!saved || typeof saved !== 'object') return structuredClone(DEFAULT_3D_LAYOUT);
  const merged = structuredClone(DEFAULT_3D_LAYOUT);
  if (saved.pads && typeof saved.pads === 'object') {
    for (const [k, v] of Object.entries(saved.pads)) {
      if (typeof v?.cx === 'number' && typeof v?.cz === 'number') {
        merged.pads[k] = { ...(merged.pads[k] || {}), cx: v.cx, cz: v.cz };
      }
    }
  }
  if (saved.devices && typeof saved.devices === 'object') {
    for (const [k, v] of Object.entries(saved.devices)) {
      if (typeof v?.dx === 'number' && typeof v?.dz === 'number') {
        merged.devices[k] = { ...(merged.devices[k] || {}), dx: v.dx, dz: v.dz };
      }
    }
  }
  return merged;
}

// Distinct Architectural Rim & Slab Colors for FDU Campus Building 3D Bases (Metro & Florham)
const BUILDING_BASE_THEME = {
  CORE: { baseColor: '#17162e', rimColor: '#fb923c' },
  BAN: { baseColor: '#091d34', rimColor: '#10b981' },
  DIC: { baseColor: '#081b33', rimColor: '#38bdf8' },
  ROB: { baseColor: '#0c1938', rimColor: '#60a5fa' },
  BEC: { baseColor: '#072227', rimColor: '#2dd4bf' },
  UCH: { baseColor: '#161332', rimColor: '#a78bfa' },
  LCH: { baseColor: '#07241e', rimColor: '#34d399' },
  ROT: { baseColor: '#261028', rimColor: '#f472b6' },
  GIO: { baseColor: '#241b0b', rimColor: '#fbbf24' },
  SUB: { baseColor: '#28111c', rimColor: '#fb7185' },
  KRN: { baseColor: '#131636', rimColor: '#818cf8' },
  NPT: { baseColor: '#08222c', rimColor: '#22d3ee' },
  WIL: { baseColor: '#1b1630', rimColor: '#c084fc' },
  MUS: { baseColor: '#0b211d', rimColor: '#4ade80' },
  UNI: { baseColor: '#231815', rimColor: '#fb923c' },
  ALU: { baseColor: '#0e2038', rimColor: '#7dd3fc' },
  WRG: { baseColor: '#1c1917', rimColor: '#facc15' },
  PSO: { baseColor: '#251218', rimColor: '#f87171' },
  TPL: { baseColor: '#0f1e2e', rimColor: '#38bdf8' },
  // Florham / Madison Buildings
  SOP: { baseColor: '#0a1f35', rimColor: '#38bdf8' },
  VIL: { baseColor: '#0b2228', rimColor: '#2dd4bf' },
  MON: { baseColor: '#171636', rimColor: '#818cf8' },
  PRK: { baseColor: '#09241e', rimColor: '#34d399' },
  HEN: { baseColor: '#26180c', rimColor: '#fbbf24' },
  RUT: { baseColor: '#23122b', rimColor: '#e879f9' },
  DRE: { baseColor: '#0c1d36', rimColor: '#60a5fa' },
  TWK: { baseColor: '#26121c', rimColor: '#fb7185' },
  ZEN: { baseColor: '#09222c', rimColor: '#22d3ee' },
  SCI: { baseColor: '#0d241b', rimColor: '#4ade80' },
  STU: { baseColor: '#241612', rimColor: '#fb923c' },
  REC: { baseColor: '#1b1532', rimColor: '#a78bfa' },
  BRN: { baseColor: '#221a0f', rimColor: '#facc15' }
};

function getBuildingBaseTheme(code) {
  return (
    BUILDING_BASE_THEME[code] || {
      baseColor: '#0b192e',
      rimColor: '#38bdf8'
    }
  );
}

function clamp(val, min, max) {
  return Math.max(min, Math.min(max, val));
}

/**
 * Smooth 3D Camera Controller for the Multi-Device 3D Network Topology Scene
 */
function TopologyCameraRig({ cameraPreset, focusTarget, controlsRef }) {
  const { camera } = useThree();
  const targetPos = useRef(new THREE.Vector3(2, 46, 58));
  const targetLookAt = useRef(new THREE.Vector3(2, 0, 4));
  const isTransitioning = useRef(false);
  const lastKey = useRef('');

  const presets = useMemo(
    () => ({
      'blueprint-iso': { pos: [2, 46, 58], target: [2, 0.5, 4] },
      'campus-wide': { pos: [2, 66, 78], target: [2, 0.5, 10] },
      'metro-fabric': { pos: [22, 24, 34], target: [22, 0.8, 4] },
      'switch-trunks': { pos: [18, 12, 22], target: [18, 0.6, 10.5] },
      'wifi-fleet': { pos: [34, 14, 24], target: [31.5, 0.8, 10.5] },
      'top-blueprint': { pos: [2, 88, 4.01], target: [2, 0, 4] },
      'front-elevation': { pos: [2, 16, 68], target: [2, 1, 4] }
    }),
    []
  );

  const currentKey = focusTarget
    ? `focus:${focusTarget.id}:${focusTarget.pos.join(',')}`
    : `preset:${cameraPreset}`;

  if (lastKey.current !== currentKey) {
    lastKey.current = currentKey;
    if (focusTarget && focusTarget.pos) {
      const [fx, fy, fz] = focusTarget.pos;
      const dist = focusTarget.distance || 9.5;
      targetPos.current.set(fx - dist * 0.45, fy + dist * 0.68, fz + dist);
      targetLookAt.current.set(fx, fy + 0.5, fz);
      isTransitioning.current = true;
    } else if (presets[cameraPreset]) {
      const p = presets[cameraPreset];
      targetPos.current.set(...p.pos);
      targetLookAt.current.set(...p.target);
      isTransitioning.current = true;
    }
  }

  useFrame((_, delta) => {
    if (!isTransitioning.current) return;
    const step = Math.min(1, delta * 5.0);
    camera.position.lerp(targetPos.current, step);
    if (controlsRef.current) {
      controlsRef.current.target.lerp(targetLookAt.current, step);
      controlsRef.current.update();
    }
    if (camera.position.distanceTo(targetPos.current) < 0.12) {
      isTransitioning.current = false;
    }
  });

  return null;
}

// Helper to shorten raw Cisco IOS-XE version strings (e.g. "Cisco IOS Software [Dublin]... Version 17.12.4, RELEASE..." -> "17.12.4")
function formatShortIosVersion(raw) {
  if (!raw) return '17.15.04';
  const str = String(raw);
  const m = str.match(/Version\s+([0-9A-Za-z.()]+)/i);
  if (m) return m[1].replace(/,$/, '');
  if (str.length > 16) return str.slice(0, 16);
  return str;
}

/**
 * Glowing 3D Isometric Zone / Campus Building Platform Pad (Draggable across the 3D floor grid)
 */
function ZonePlatform3D({
  padId,
  position,
  size = [12, 0.35, 14],
  baseColor = '#0c1938',
  rimColor = '#38bdf8',
  title,
  subtitle,
  showZoneTitles = true,
  isDraggingThisPad = false,
  isParentOfDraggedDevice = false,
  onStartPadDrag,
  onFocusPad,
  onClickTitle
}) {
  const [hovered, setHovered] = useState(false);
  const [w, h, d] = size;
  const activeHighlight = isDraggingThisPad || isParentOfDraggedDevice;
  const handlePlaqueClick = onClickTitle || onFocusPad;

  return (
    <group
      position={position}
      onPointerDown={(e) => {
        if (onStartPadDrag) onStartPadDrag(e, padId, position[0], position[2]);
      }}
      onPointerOver={(e) => {
        e.stopPropagation();
        setHovered(true);
      }}
      onPointerOut={() => setHovered(false)}
    >
      {/* Main 3D Architectural Slab */}
      <RoundedBox
        args={[w, h, d]}
        radius={0.14}
        smoothness={4}
        position={[0, -h / 2, 0]}
        receiveShadow
      >
        <meshStandardMaterial
          color={baseColor}
          metalness={0.45}
          roughness={0.35}
          transparent
          opacity={activeHighlight ? 0.98 : 0.92}
        />
      </RoundedBox>

      {/* Glowing Neon Top Perimeter Frame */}
      <mesh position={[0, 0.01, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[Math.min(w, d) * 0.48, Math.min(w, d) * 0.495, 4]} />
        <meshBasicMaterial
          color={activeHighlight ? '#ffffff' : rimColor}
          transparent
          opacity={activeHighlight ? 0.4 : 0.15}
        />
      </mesh>

      {/* 4 Glowing Perimeter Edge Bars */}
      <mesh position={[0, 0.02, d / 2 - 0.05]}>
        <boxGeometry args={[w - 0.1, 0.05, 0.08]} />
        <meshStandardMaterial
          color={activeHighlight ? '#ffffff' : rimColor}
          emissive={activeHighlight ? '#ffffff' : rimColor}
          emissiveIntensity={activeHighlight || hovered ? 2.4 : 1.6}
        />
      </mesh>
      <mesh position={[0, 0.02, -d / 2 + 0.05]}>
        <boxGeometry args={[w - 0.1, 0.05, 0.08]} />
        <meshStandardMaterial
          color={activeHighlight ? '#ffffff' : rimColor}
          emissive={activeHighlight ? '#ffffff' : rimColor}
          emissiveIntensity={activeHighlight || hovered ? 2.2 : 1.2}
        />
      </mesh>
      <mesh position={[-w / 2 + 0.05, 0.02, 0]}>
        <boxGeometry args={[0.08, 0.05, d - 0.1]} />
        <meshStandardMaterial
          color={activeHighlight ? '#ffffff' : rimColor}
          emissive={activeHighlight ? '#ffffff' : rimColor}
          emissiveIntensity={activeHighlight || hovered ? 2.2 : 1.4}
        />
      </mesh>
      <mesh position={[w / 2 - 0.05, 0.02, 0]}>
        <boxGeometry args={[0.08, 0.05, d - 0.1]} />
        <meshStandardMaterial
          color={activeHighlight ? '#ffffff' : rimColor}
          emissive={activeHighlight ? '#ffffff' : rimColor}
          emissiveIntensity={activeHighlight || hovered ? 2.2 : 1.4}
        />
      </mesh>

      {/* Building / Zone Name Plaque on Front Edge of Base */}
      {(showZoneTitles || hovered || activeHighlight) && title && (
        <Html position={[0, 0.18, d / 2 + 0.42]} center zIndexRange={[12, 0]}>
          <div
            onClick={(e) => {
              if (handlePlaqueClick) {
                e.stopPropagation();
                handlePlaqueClick();
              }
            }}
            className={`${
              handlePlaqueClick ? 'cursor-pointer hover:border-white ' : 'pointer-events-none '
            }select-none whitespace-nowrap px-2.5 py-0.5 rounded-md bg-slate-950/92 border border-slate-700/90 shadow-lg transition`}
          >
            <div
              className="text-[9.5px] font-mono font-bold tracking-wider uppercase flex items-center gap-1"
              style={{ color: rimColor }}
            >
              <span>✥ {title}</span>
            </div>
            {(hovered || activeHighlight) && subtitle && (
              <div className="text-[8px] font-mono text-slate-300">{subtitle}</div>
            )}
          </div>
        </Html>
      )}
    </group>
  );
}

/**
 * 3D Glowing Conduit Tube + Animated Traffic Packets Between Two 3D Coordinates
 */
function ConduitLink3D({
  link,
  startPos,
  endPos,
  color = '#10b981',
  radius = 0.085,
  isSelected,
  onSelect,
  showLinkBadges
}) {
  const packet1Ref = useRef();
  const packet2Ref = useRef();
  const [hovered, setHovered] = useState(false);

  const [sx, sy, sz] = startPos;
  const [ex, ey, ez] = endPos;

  const curve = useMemo(() => {
    const p0 = new THREE.Vector3(sx, sy, sz);
    const p3 = new THREE.Vector3(ex, ey, ez);
    const dist = p0.distanceTo(p3);
    const arcHeight = Math.min(1.6, Math.max(0.35, dist * 0.12));
    const p1 = new THREE.Vector3(p0.x, Math.max(p0.y, p3.y) + arcHeight, (p0.z * 2 + p3.z) / 3);
    const p2 = new THREE.Vector3(p3.x, Math.max(p0.y, p3.y) + arcHeight, (p0.z + p3.z * 2) / 3);
    return new THREE.CubicBezierCurve3(p0, p1, p2, p3);
  }, [sx, sy, sz, ex, ey, ez]);

  const tubeGeom = useMemo(() => {
    return new THREE.TubeGeometry(curve, 28, radius, 10, false);
  }, [curve, radius]);

  useEffect(() => {
    return () => {
      tubeGeom.dispose();
    };
  }, [tubeGeom]);

  const midPoint = useMemo(() => curve.getPoint(0.5), [curve]);

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    if (packet1Ref.current) {
      const u1 = (t * 0.38) % 1;
      const pt1 = curve.getPoint(u1);
      packet1Ref.current.position.copy(pt1);
    }
    if (packet2Ref.current) {
      const u2 = (1 - ((t * 0.38 + 0.5) % 1)) % 1;
      const pt2 = curve.getPoint(u2);
      packet2Ref.current.position.copy(pt2);
    }
  });

  const shouldShowLinkBadge =
    hovered || isSelected || (showLinkBadges && link.isPrimaryTrunk);

  return (
    <group>
      {/* Glowing 3D Conduit Tube */}
      <mesh
        geometry={tubeGeom}
        onClick={(e) => {
          e.stopPropagation();
          onSelect({ type: 'link', data: link, id: link.id, pos: [midPoint.x, midPoint.y, midPoint.z] });
        }}
        onPointerOver={(e) => {
          e.stopPropagation();
          setHovered(true);
        }}
        onPointerOut={() => setHovered(false)}
      >
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={isSelected || hovered ? 2.4 : 1.3}
          roughness={0.2}
          metalness={0.3}
          transparent
          opacity={isSelected || hovered ? 1.0 : 0.88}
        />
      </mesh>

      {/* Bi-directional Animated Light Packets */}
      <mesh ref={packet1Ref}>
        <sphereGeometry args={[radius * 1.85, 12, 12]} />
        <meshBasicMaterial color="#ffffff" />
      </mesh>
      <mesh ref={packet2Ref}>
        <sphereGeometry args={[radius * 1.55, 12, 12]} />
        <meshBasicMaterial color={color} />
      </mesh>

      {/* Midpoint Link Badge (Shown when hovered/selected or when Trunk Callouts toggle is ON) */}
      {shouldShowLinkBadge && (
        <Html position={[midPoint.x, midPoint.y + 0.55, midPoint.z]} center zIndexRange={[30, 0]}>
          <div
            onClick={(e) => {
              e.stopPropagation();
              onSelect({
                type: 'link',
                data: link,
                id: link.id,
                pos: [midPoint.x, midPoint.y, midPoint.z]
              });
            }}
            className={`cursor-pointer select-none whitespace-nowrap px-2 py-0.5 rounded-md border shadow-xl transition ${
              isSelected
                ? 'bg-slate-900 border-white text-white'
                : 'bg-slate-950/90 border-slate-700/90 text-slate-100 hover:border-sky-400'
            }`}
          >
            <div className="flex items-center gap-1 text-[10px] font-mono font-bold" style={{ color }}>
              <span>{link.badgeTitle}</span>
              {link.verified && (
                <span className="px-1 py-0.2 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-[8px]">
                  ✓ 2-WAY
                </span>
              )}
            </div>
            {(hovered || isSelected) && (
              <div className="text-[9px] font-mono text-slate-300">{link.badgeSubtitle}</div>
            )}
          </div>
        </Html>
      )}
    </group>
  );
}

/**
 * 3D Cisco Catalyst C9606R Modular Core Chassis Tower (Draggable within/near its Square Base)
 */
function CoreChassis9606R3D({
  deviceId,
  node,
  position,
  isSelected,
  isDragging,
  onSelect,
  onStartDeviceDrag,
  onOpenHwDrawer,
  labelMode
}) {
  const [hovered, setHovered] = useState(false);
  const shortIos = formatShortIosVersion(node.iosVersion);
  const shortName = (node.hostname || 'tcore-9600').replace(/\.net\.fdu\.edu$/i, '');

  const visible =
    hovered ||
    isSelected ||
    isDragging ||
    labelMode === 'switches' ||
    labelMode === 'compact' ||
    labelMode === 'all';
  const showFullDetails =
    hovered || isSelected || isDragging || labelMode === 'all' || labelMode === 'switches';

  return (
    <group
      position={position}
      onPointerDown={(e) => {
        if (onStartDeviceDrag) {
          onStartDeviceDrag(e, deviceId, () =>
            onSelect({ type: 'device', data: node, id: node.id, pos: position })
          );
        }
      }}
      onPointerOver={(e) => {
        e.stopPropagation();
        setHovered(true);
      }}
      onPointerOut={() => setHovered(false)}
    >
      {/* Selection / Hover / Drag Ring on Pad */}
      {(isSelected || hovered || isDragging) && (
        <mesh position={[0, 0.05, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[2.1, 2.42, 32]} />
          <meshBasicMaterial color={isDragging ? '#ffffff' : isSelected ? '#38bdf8' : '#fb923c'} />
        </mesh>
      )}

      {/* 6-Slot Modular Core Chassis Main Tower */}
      <RoundedBox args={[3.2, 2.7, 2.6]} radius={0.12} smoothness={4} position={[0, 1.35, 0]} castShadow>
        <meshStandardMaterial
          color={isDragging ? '#3b82f6' : isSelected ? '#1e3a5f' : hovered ? '#263859' : '#17253b'}
          metalness={0.65}
          roughness={0.28}
        />
      </RoundedBox>

      {/* Top Glowing Core Emblem Ring */}
      <mesh position={[0, 2.72, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.65, 0.85, 24]} />
        <meshBasicMaterial color="#fb923c" />
      </mesh>

      {/* 6 Front Modular Linecard / Supervisor Slots */}
      {[0, 1, 2, 3, 4, 5].map((slotIdx) => {
        const y = 0.35 + slotIdx * 0.38;
        const isSup = slotIdx === 2 || slotIdx === 3;
        return (
          <group key={slotIdx} position={[0, y, 1.31]}>
            <mesh>
              <boxGeometry args={[2.9, 0.3, 0.04]} />
              <meshStandardMaterial
                color={isSup ? '#1e293b' : '#0f172a'}
                metalness={0.5}
                roughness={0.4}
              />
            </mesh>
            {[-1.1, -0.75, -0.4, -0.05, 0.3, 0.65, 1.0].map((lx, lIdx) => (
              <mesh key={lIdx} position={[lx, 0, 0.03]}>
                <boxGeometry args={[0.16, 0.1, 0.02]} />
                <meshBasicMaterial
                  color={
                    isSup
                      ? '#f59e0b'
                      : (slotIdx === 1 || slotIdx === 4) && lIdx > 4
                      ? '#38bdf8'
                      : '#10b981'
                  }
                />
              </mesh>
            ))}
          </group>
        );
      })}

      {/* Floating Compact 3D Badge (Moves with Device in Real Time + Direct [HW] Drawer Button) */}
      {visible && (
        <Html position={[0, 3.35, 0]} center zIndexRange={[25, 0]}>
          <div
            onClick={(e) => {
              e.stopPropagation();
              onSelect({ type: 'device', data: node, id: node.id, pos: position });
            }}
            className={`cursor-pointer select-none whitespace-nowrap px-2.5 py-1 rounded-lg border shadow-xl transition ${
              isSelected || isDragging
                ? 'bg-amber-950/95 border-amber-300 ring-1 ring-amber-400/50'
                : 'bg-slate-950/90 border-amber-500/60 hover:border-amber-300'
            }`}
          >
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                <span className="text-[11px] font-mono font-bold text-white">{shortName}</span>
                <span className="px-1 py-0.2 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40 text-[8px] font-mono font-bold">
                  CORE
                </span>
              </div>
              {onOpenHwDrawer && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelect({ type: 'device', data: node, id: node.id, pos: position });
                    onOpenHwDrawer(node.serialNumber);
                  }}
                  className="px-1.5 py-0.5 rounded bg-sky-500/25 hover:bg-sky-500 text-sky-200 hover:text-slate-950 border border-sky-400/50 text-[8.5px] font-mono font-bold flex items-center gap-0.5 cursor-pointer transition"
                  title="Open Hardware & Port Inspector Drawer"
                >
                  <PanelRightOpen className="w-2.5 h-2.5" /> HW
                </button>
              )}
            </div>
            {showFullDetails && (
              <div className="text-[9px] font-mono text-slate-300 mt-0.5">
                {node.model || 'C9606R'} • <span className="text-emerald-300">{node.mgmtIp}</span> • IOS-XE {shortIos}
              </div>
            )}
          </div>
        </Html>
      )}
    </group>
  );
}

// Shared 3D Geometries for the 300-Switch Multi-Device Campus Scene (prevents VRAM exhaustion & WebGL context loss)
const SHARED_PEDESTAL_GEOM = new THREE.BoxGeometry(3.75, 0.32, 2.55);
const SHARED_COMPACT_CHASSIS_GEOM = new THREE.BoxGeometry(3.48, 0.44, 2.28);
const SHARED_FACEPLATE_STRIP_GEOM = new THREE.BoxGeometry(2.35, 0.28, 0.04);
const SHARED_UPLINK_BAY_GEOM = new THREE.BoxGeometry(0.68, 0.28, 0.04);
const SHARED_TOP_BAR_GEOM = new THREE.BoxGeometry(3.1, 0.02, 1.8);
const SHARED_SWITCH_HALO_GEOM = new THREE.RingGeometry(2.35, 2.65, 32);

/**
 * Realistic 3D Cisco Catalyst C9300 Switch Chassis inside the Multi-Device Topology Scene
 * Uses the exact same 3D hardware assembly for polled/active switches and a fast GPU-shared 1RU rack chassis for unpolled CDP neighbors!
 */
function SwitchC9300Node3D({
  deviceId,
  node,
  portsData = [],
  position,
  isSelected,
  isDragging,
  isActiveChassis,
  onSelect,
  onStartDeviceDrag,
  onOpenHwDrawer,
  labelMode,
  xrayMode = false,
  explodeFactor = 0,
  showPatchCables = true,
  useCompactMesh = false
}) {
  const [hovered, setHovered] = useState(false);
  const isMeraki = /MS350|MERAKI/i.test(`${node.model} ${node.hostname}`);
  const isCorePeer = node.hierarchyTier === 1 || /C9500|C9600|N77/i.test(node.model || '');
  const accentColor = isCorePeer
    ? '#f59e0b'
    : isMeraki
    ? '#06b6d4'
    : node.isPolled
    ? '#10b981'
    : '#38bdf8';

  const visible =
    hovered ||
    isSelected ||
    isDragging ||
    labelMode === 'switches' ||
    labelMode === 'compact' ||
    labelMode === 'all';
  const showFullDetails =
    hovered || isSelected || isDragging || labelMode === 'all' || labelMode === 'switches';

  // Never swap mesh geometry on hover/select when 300+ switches are in the scene — prevents WebGL shader compilation stalls & black screen flashes!
  const renderFullChassis = !useCompactMesh || isActiveChassis || node.isPolled;

  return (
    <group
      position={position}
      onPointerDown={(e) => {
        if (onStartDeviceDrag && deviceId) {
          onStartDeviceDrag(e, deviceId, () =>
            onSelect({ type: 'device', data: node, id: node.id, pos: position })
          );
        } else {
          e.stopPropagation();
          onSelect({ type: 'device', data: node, id: node.id, pos: position });
        }
      }}
      onPointerOver={(e) => {
        e.stopPropagation();
        setHovered(true);
      }}
      onPointerOut={() => setHovered(false)}
    >
      {/* Selection / Active / Drag Halo on Floor */}
      {(isSelected || hovered || isActiveChassis || isDragging) && (
        <mesh
          geometry={SHARED_SWITCH_HALO_GEOM}
          position={[0, 0.04, 0]}
          rotation={[-Math.PI / 2, 0, 0]}
        >
          <meshBasicMaterial color={isDragging || isSelected ? '#ffffff' : accentColor} />
        </mesh>
      )}

      {/* Sleek Rack Pedestal Under the Real 3D C9300 Chassis */}
      <mesh geometry={SHARED_PEDESTAL_GEOM} position={[0, 0.16, 0]}>
        <meshStandardMaterial color="#091326" metalness={0.45} roughness={0.55} />
      </mesh>

      {renderFullChassis ? (
        /* Authentic High-Detail 3D Cisco Catalyst 9300 Chassis Assembly (Exact Model from Single 3D Chassis View) */
        <group position={[0, MULTI_CHASSIS_Y, 0]}>
          <CiscoC9300ChassisAssembly
            portsData={portsData}
            selectedItem={
              isSelected || isDragging ? { type: 'component', id: 'chassis-main' } : null
            }
            ledMode="STAT"
            beaconActive={isSelected || hovered || isActiveChassis}
            switchModelId={node.model || 'C9300-24UX'}
            networkModuleId="C9300-NM-8X"
            explodeFactor={explodeFactor}
            xrayMode={xrayMode}
            showLabels={false}
            showPatchCables={showPatchCables}
            psuStates={{ psu1: 'ok', psu2: 'ok' }}
            fanFaults={{ fan1: false, fan2: false, fan3: false }}
            psuModel="PWR-C1-1100WAC-P"
            chassisScale={MULTI_CHASSIS_SCALE}
            disablePartClick={true}
          />
        </group>
      ) : (
        /* High-Speed Shared-Geometry 3D 1RU Rack Switch Enclosure for 300-Switch Campus View */
        <group position={[0, 0.56, 0]}>
          <mesh geometry={SHARED_COMPACT_CHASSIS_GEOM}>
            <meshStandardMaterial
              color={
                isSelected || hovered
                  ? '#3b82f6'
                  : isMeraki
                  ? '#1e293b'
                  : '#334155'
              }
              metalness={0.68}
              roughness={0.32}
            />
          </mesh>
          {/* Front Metallic Port Faceplate Strip */}
          <mesh geometry={SHARED_FACEPLATE_STRIP_GEOM} position={[-0.35, 0, 1.15]}>
            <meshStandardMaterial color="#0f172a" metalness={0.5} roughness={0.4} />
          </mesh>
          {/* Uplink SFP28 Bay Accent */}
          <mesh geometry={SHARED_UPLINK_BAY_GEOM} position={[1.22, 0, 1.15]}>
            <meshBasicMaterial color={accentColor} />
          </mesh>
          {/* Top Building Color Identification Bar */}
          <mesh geometry={SHARED_TOP_BAR_GEOM} position={[0, 0.23, 0]}>
            <meshBasicMaterial color={accentColor} />
          </mesh>
        </group>
      )}

      {/* Compact Non-Overlapping Floating 3D Badge (Moves with Switch in Real Time + Direct [HW] Drawer Button) */}
      {visible && (
        <Html position={[0, 1.35 + explodeFactor * 0.9, 0]} center zIndexRange={[25, 0]}>
          <div
            onClick={(e) => {
              e.stopPropagation();
              onSelect({ type: 'device', data: node, id: node.id, pos: position });
            }}
            className={`cursor-pointer select-none whitespace-nowrap px-2.5 py-1 rounded-lg border shadow-xl transition ${
              isSelected || isDragging
                ? 'bg-sky-950/95 border-white ring-1 ring-sky-400/60'
                : 'bg-slate-950/90 border-sky-500/60 hover:border-sky-300'
            }`}
          >
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5">
                <span
                  className="w-2 h-2 rounded-full"
                  style={{ backgroundColor: accentColor }}
                />
                <span className="text-[11px] font-mono font-bold text-white">{node.hostname}</span>
                <span className="px-1 py-0.2 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-[8px] font-mono font-bold">
                  {node.isPolled ? 'SQL' : 'CDP'}
                </span>
              </div>
              {onOpenHwDrawer && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelect({ type: 'device', data: node, id: node.id, pos: position });
                    onOpenHwDrawer(node.serialNumber);
                  }}
                  className="px-1.5 py-0.5 rounded bg-sky-500/25 hover:bg-sky-500 text-sky-200 hover:text-slate-950 border border-sky-400/50 text-[8.5px] font-mono font-bold flex items-center gap-0.5 cursor-pointer transition"
                  title={`Open Hardware & Port Drawer for ${node.hostname}`}
                >
                  <PanelRightOpen className="w-2.5 h-2.5" /> HW
                </button>
              )}
            </div>
            {showFullDetails && (
              <div className="text-[9px] font-mono text-slate-300 mt-0.5">
                {node.model} • <span className="text-sky-300">{node.mgmtIp}</span>
                {node.totalPoeWatts > 0 ? (
                  <span className="text-amber-300"> • ⚡ {node.totalPoeWatts.toFixed(1)}W</span>
                ) : (
                  <span className="text-emerald-300"> • {node.connectedPorts || 1}/{node.totalPorts || 24} Up</span>
                )}
              </div>
            )}
          </div>
        </Html>
      )}
    </group>
  );
}

/**
 * 3D Cisco Catalyst 9130AXI / 9105AXW Wi-Fi 6 Access Point Node (Draggable within/near its Square Base)
 */
function WirelessApNode3D({
  deviceId,
  ap,
  position,
  isSelected,
  isDragging,
  onSelect,
  onStartDeviceDrag,
  labelMode
}) {
  const [hovered, setHovered] = useState(false);

  const visible =
    hovered || isSelected || isDragging || labelMode === 'compact' || labelMode === 'all';
  const showFullDetails = hovered || isSelected || isDragging || labelMode === 'all';

  return (
    <group
      position={position}
      onPointerDown={(e) => {
        if (onStartDeviceDrag && deviceId) {
          onStartDeviceDrag(e, deviceId, () =>
            onSelect({ type: 'ap', data: ap, id: ap.hostname, pos: position })
          );
        } else {
          e.stopPropagation();
          onSelect({ type: 'ap', data: ap, id: ap.hostname, pos: position });
        }
      }}
      onPointerOver={(e) => {
        e.stopPropagation();
        setHovered(true);
      }}
      onPointerOut={() => setHovered(false)}
    >
      {(isSelected || hovered || isDragging) && (
        <mesh position={[0, 0.03, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.9, 1.12, 24]} />
          <meshBasicMaterial color={isDragging ? '#ffffff' : '#10b981'} />
        </mesh>
      )}

      {/* Rounded Square Cisco Catalyst 9130AXI AP Enclosure */}
      <RoundedBox args={[1.45, 0.32, 1.45]} radius={0.18} smoothness={4} position={[0, 0.22, 0]} castShadow>
        <meshStandardMaterial
          color={isDragging ? '#10b981' : isSelected ? '#0284c7' : hovered ? '#334155' : '#1e293b'}
          metalness={0.35}
          roughness={0.4}
        />
      </RoundedBox>

      {/* Center Glowing Wi-Fi 6 Status LED Ring */}
      <mesh position={[0, 0.39, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.22, 0.34, 24]} />
        <meshBasicMaterial color="#10b981" />
      </mesh>

      {/* Compact Floating AP Tag */}
      {visible && (
        <Html position={[0, 0.78, 0]} center zIndexRange={[20, 0]}>
          <div
            onClick={(e) => {
              e.stopPropagation();
              onSelect({ type: 'ap', data: ap, id: ap.hostname, pos: position });
            }}
            className={`cursor-pointer select-none whitespace-nowrap px-2 py-0.5 rounded-md border shadow-lg transition ${
              isSelected || isDragging
                ? 'bg-emerald-950 border-emerald-300 text-white'
                : 'bg-slate-950/90 border-emerald-500/45 text-slate-100 hover:border-emerald-300'
            }`}
          >
            <div className="text-[9.5px] font-mono font-bold text-emerald-300">
              [{ap.localPort}] {ap.hostname}
            </div>
            {showFullDetails && (
              <div className="text-[8.5px] font-mono text-slate-300">
                {ap.ip} • {ap.model} • <span className="text-amber-300">{ap.poeWatts}W</span>
              </div>
            )}
          </div>
        </Html>
      )}
    </group>
  );
}

/**
 * 3D Optical / Firewall / Router / ISP Cloud Appliance Node
 * Renders FDU-CAMPUSES.drawio infrastructure:
 * - 'adva': Adva FSP 3000 DWDM Optical Transport Shelf (VLAN 120 / VLAN 123)
 * - 'firewall': FortiGate HA Firewall (FG-1/2, M-FG-1/2, T-FG-1/2, V-FG1/2, Fort D-1/2)
 * - 'router': NCS-5504, NCS, ASA ASR
 * - 'isp': US / Canadian ISP Cloud
 */
function InfraApplianceNode3D({
  node,
  position,
  isSelected,
  onSelect,
  labelMode
}) {
  const [hovered, setHovered] = useState(false);
  const color = node.color || '#a855f7';
  const kind = node.kind || 'appliance';

  const visible =
    hovered ||
    isSelected ||
    labelMode === 'switches' ||
    labelMode === 'compact' ||
    labelMode === 'all' ||
    kind === 'adva' ||
    kind === 'firewall';
  const showFullDetails = hovered || isSelected || labelMode === 'all';

  return (
    <group
      position={position}
      onClick={(e) => {
        e.stopPropagation();
        onSelect({ type: 'device', data: node, id: node.id, pos: position });
      }}
      onPointerOver={(e) => {
        e.stopPropagation();
        setHovered(true);
      }}
      onPointerOut={() => setHovered(false)}
    >
      {(isSelected || hovered) && (
        <mesh position={[0, 0.03, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[1.3, 1.55, 28]} />
          <meshBasicMaterial color={isSelected ? '#ffffff' : color} />
        </mesh>
      )}

      {kind === 'adva' ? (
        /* Adva FSP 3000 Optical DWDM Transport Shelf */
        <group position={[0, 0.55, 0]}>
          <RoundedBox args={[2.35, 0.85, 1.55]} radius={0.08} smoothness={3} castShadow>
            <meshStandardMaterial color="#0f172a" metalness={0.65} roughness={0.28} />
          </RoundedBox>
          {/* Optical Transponder Linecards */}
          {[-0.75, -0.25, 0.25, 0.75].map((lx, idx) => (
            <mesh key={idx} position={[lx, 0, 0.78]}>
              <boxGeometry args={[0.38, 0.62, 0.04]} />
              <meshBasicMaterial color={idx % 2 === 0 ? '#facc15' : '#38bdf8'} />
            </mesh>
          ))}
          <mesh position={[0, 0.44, 0]}>
            <boxGeometry args={[2.05, 0.03, 1.25]} />
            <meshBasicMaterial color="#facc15" />
          </mesh>
        </group>
      ) : kind === 'firewall' ? (
        /* FortiGate Next-Gen HA Firewall Appliance */
        <group position={[0, 0.48, 0]}>
          <RoundedBox args={[2.25, 0.68, 1.65]} radius={0.07} smoothness={3} castShadow>
            <meshStandardMaterial color="#27121b" metalness={0.6} roughness={0.32} />
          </RoundedBox>
          <mesh position={[0, 0, 0.83]}>
            <boxGeometry args={[1.95, 0.36, 0.04]} />
            <meshBasicMaterial color={color} />
          </mesh>
          <mesh position={[0, 0.35, 0]}>
            <boxGeometry args={[1.95, 0.03, 1.3]} />
            <meshBasicMaterial color={color} />
          </mesh>
        </group>
      ) : (
        /* NCS-5504 / ASA ASR / ISP Node */
        <group position={[0, 0.58, 0]}>
          <RoundedBox args={[2.35, 0.95, 1.68]} radius={0.1} smoothness={3} castShadow>
            <meshStandardMaterial color="#172036" metalness={0.6} roughness={0.32} />
          </RoundedBox>
          <mesh position={[0, 0.49, 0]}>
            <boxGeometry args={[2.0, 0.03, 1.35]} />
            <meshBasicMaterial color={color} />
          </mesh>
        </group>
      )}

      {visible && (
        <Html position={[0, 1.45, 0]} center zIndexRange={[22, 0]}>
          <div
            onClick={(e) => {
              e.stopPropagation();
              onSelect({ type: 'device', data: node, id: node.id, pos: position });
            }}
            className={`cursor-pointer select-none whitespace-nowrap px-2 py-0.5 rounded-md border shadow-lg transition ${
              isSelected
                ? 'bg-slate-900 border-white text-white ring-1 ring-sky-400'
                : 'bg-slate-950/92 border-slate-700/90 text-slate-100 hover:border-white'
            }`}
          >
            <div className="flex items-center gap-1 text-[9.5px] font-mono font-bold" style={{ color }}>
              <span>{node.hostname}</span>
              <span className="px-1 py-0.2 rounded bg-slate-900 text-[7.5px] text-slate-200 border border-slate-700">
                {node.badge || node.role}
              </span>
            </div>
            {showFullDetails && (
              <div className="text-[8.5px] font-mono text-slate-300">
                {node.model} • <span className="text-emerald-300">{node.mgmtIp}</span>
              </div>
            )}
          </div>
        </Html>
      )}
    </group>
  );
}

/**
 * Main Export: Multi-Device 3D Network Topology Camera View + Collapsible Click-to-Inspect Drawer
 * - Supports dragging & saving both 3D Square Zone Bases and individual 3D Devices (clamped near their Square Base)
 */
export default function MultiDevice3DTopologyScene({
  parsedSwitchData,
  savedDevices = [],
  onSelectSavedDevice,
  onPollNeighbor,
  onSwitchToSingleChassis3D,
  onOpenHwDrawer,
  onSelectInventoryEntity,
  backdropBrightness = 0.25,
  selectedBuildingFilter = 'ALL',
  onSelectBuildingFilter,
  showUnpolledCdpNeighbors = false,
  hiddenDeviceKeys = []
}) {
  const controlsRef = useRef();
  const [cameraPreset, setCameraPreset] = useState('blueprint-iso');
  const [focusTarget, setFocusTarget] = useState(null);
  // 4 Label Display Modes:
  // 'hover'    (Hover / Click Only — 100% unobstructed 3D hardware & animated conduits!)
  // 'switches' (Core & Switches Only — APs & Colos appear on hover/click)
  // 'compact'  (Minimal 1-line Hostname tags on all devices)
  // 'all'      (All 2-line device details visible simultaneously)
  const [labelMode, setLabelMode] = useState('hover');
  const [showLinkBadges, setShowLinkBadges] = useState(false);
  const [showZoneTitles, setShowZoneTitles] = useState(true);
  const [multiXrayMode, setMultiXrayMode] = useState(false);
  const [multiExplode, setMultiExplode] = useState(0);
  const [isDrawerOpen, setIsDrawerOpen] = useState(true);
  const [drawerTab, setDrawerTab] = useState('interconnects'); // 'interconnects' | 'hardware' | 'clusters'
  const [searchFilter, setSearchFilter] = useState('');

  // 3D Layout State (persisted to localStorage + PostgreSQL)
  const [layout3D, setLayout3D] = useState(() => {
    try {
      const raw = localStorage.getItem(LAYOUT_3D_STORAGE_KEY);
      if (raw) return mergeWithDefault3DLayout(JSON.parse(raw));
    } catch {
      // ignore
    }
    return structuredClone(DEFAULT_3D_LAYOUT);
  });

  const [saveStatus, setSaveStatus] = useState('Saved');
  const [active3DDrag, setActive3DDrag] = useState(null);
  const drag3DRef = useRef(null);
  const padGroupRefs = useRef({});
  const deviceGroupRefs = useRef({});

  // Register a Three.js Group ref for any draggable 3D Square Base (moves Base + all switches on it at 60fps with 0 React re-renders!)
  const registerPadGroupRef = useCallback((padId) => (el) => {
    if (el) {
      padGroupRefs.current[padId] = el;
    } else {
      delete padGroupRefs.current[padId];
    }
  }, []);

  // Register a Three.js Group ref for any individually draggable 3D Device
  const registerDeviceGroupRef = useCallback((deviceId) => (el) => {
    if (el) {
      deviceGroupRefs.current[deviceId] = el;
    } else {
      delete deviceGroupRefs.current[deviceId];
    }
  }, []);

  // Fetch saved 3D layout from PostgreSQL on mount
  useEffect(() => {
    let cancelled = false;
    fetch(API_3D_LAYOUT_ENDPOINT)
      .then((r) => (r.ok ? r.json() : null))
      .then((res) => {
        if (!cancelled && res?.layoutData && Object.keys(res.layoutData).length > 0) {
          const merged = mergeWithDefault3DLayout(res.layoutData);
          setLayout3D(merged);
          try {
            localStorage.setItem(LAYOUT_3D_STORAGE_KEY, JSON.stringify(merged));
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

  // Save 3D layout to localStorage + PostgreSQL
  const persist3DLayout = useCallback((nextLayout) => {
    setSaveStatus('Saving...');
    try {
      localStorage.setItem(LAYOUT_3D_STORAGE_KEY, JSON.stringify(nextLayout));
    } catch {
      // ignore
    }
    fetch(API_3D_LAYOUT_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ layoutData: nextLayout })
    })
      .then(() => setSaveStatus('Saved in SQL ✓'))
      .catch(() => setSaveStatus('Saved Locally ✓'));
  }, []);

  // Start dragging a 3D Square Zone Base (supports both static pads and dynamic bldg-<CODE> bases)
  const handleStartPadDrag3D = useCallback((e, padId, fallbackCx = 0, fallbackCz = 0) => {
    e.stopPropagation();
    const hit = new THREE.Vector3();
    if (!e.ray.intersectPlane(FLOOR_PLANE, hit)) return;
    if (controlsRef.current) controlsRef.current.enabled = false;

    setLayout3D((curr) => {
      const pad = curr.pads[padId] || DEFAULT_3D_LAYOUT.pads[padId] || {
        cx: fallbackCx,
        cz: fallbackCz
      };
      const origX = typeof pad.cx === 'number' ? pad.cx : fallbackCx;
      const origZ = typeof pad.cz === 'number' ? pad.cz : fallbackCz;
      const info = {
        kind: 'pad',
        id: padId,
        startX: hit.x,
        startZ: hit.z,
        origX,
        origZ,
        liveX: origX,
        liveZ: origZ,
        moved: false
      };
      drag3DRef.current = info;
      setActive3DDrag(info);
      return curr;
    });
  }, []);

  // Start dragging an individual 3D Device (clamped near its Square Base)
  const handleStartDeviceDrag3D = useCallback((e, deviceId, onClickCallback) => {
    e.stopPropagation();
    const hit = new THREE.Vector3();
    if (!e.ray.intersectPlane(FLOOR_PLANE, hit)) return;
    if (controlsRef.current) controlsRef.current.enabled = false;

    setLayout3D((curr) => {
      const dev = curr.devices[deviceId] || DEFAULT_3D_LAYOUT.devices[deviceId];
      if (!dev) return curr;
      const info = {
        kind: 'device',
        id: deviceId,
        padId: dev.padId,
        startX: hit.x,
        startZ: hit.z,
        origX: dev.dx,
        origZ: dev.dz,
        liveX: dev.dx,
        liveZ: dev.dz,
        moved: false,
        onClickCallback
      };
      drag3DRef.current = info;
      setActive3DDrag(info);
      return curr;
    });
  }, []);

  // Move handler on the 3D Floor Capture Plane while dragging
  // Direct GPU Group transform (ZERO React state updates while moving -> eliminates WebGL frame buffer blinking!)
  const handleFloorPointerMove3D = useCallback((e) => {
    const current = drag3DRef.current;
    if (!current) return;
    e.stopPropagation();

    const hit = e.point;
    const deltaX = hit.x - current.startX;
    const deltaZ = hit.z - current.startZ;

    if (Math.hypot(deltaX, deltaZ) > 0.16) {
      current.moved = true;
    }

    if (current.kind === 'pad') {
      const nextCx = +clamp(current.origX + deltaX, -95, 65).toFixed(2);
      const nextCz = +clamp(current.origZ + deltaZ, -75, 75).toFixed(2);
      current.liveX = nextCx;
      current.liveZ = nextCz;
      const grp = padGroupRefs.current[current.id];
      if (grp) {
        grp.position.set(nextCx - current.origX, 0, nextCz - current.origZ);
      }
    } else if (current.kind === 'device') {
      const spec = DEFAULT_3D_LAYOUT.devices[current.id] || {
        maxDx: 4.0,
        maxDz: 4.0
      };
      const nextDx = +clamp(current.origX + deltaX, -spec.maxDx, spec.maxDx).toFixed(2);
      const nextDz = +clamp(current.origZ + deltaZ, -spec.maxDz, spec.maxDz).toFixed(2);
      current.liveX = nextDx;
      current.liveZ = nextDz;
      const grp = deviceGroupRefs.current[current.id];
      if (grp) {
        grp.position.set(nextDx - current.origX, 0, nextDz - current.origZ);
      }
    }
  }, []);

  // Synchronously zero out temporary GPU group offsets at the exact moment React commits the updated layout3D coordinates
  useLayoutEffect(() => {
    for (const grp of Object.values(padGroupRefs.current)) {
      if (grp) grp.position.set(0, 0, 0);
    }
    for (const grp of Object.values(deviceGroupRefs.current)) {
      if (grp) grp.position.set(0, 0, 0);
    }
  }, [layout3D]);

  // Finalize 3D drag on pointerup anywhere: commit once to React state + SQL
  useEffect(() => {
    if (!active3DDrag) return;
    const handleWindowPointerUp = () => {
      if (controlsRef.current) controlsRef.current.enabled = true;
      const current = drag3DRef.current;
      drag3DRef.current = null;
      setActive3DDrag(null);
      if (!current) return;

      if (!current.moved) {
        if (current.kind === 'pad') {
          const grp = padGroupRefs.current[current.id];
          if (grp) grp.position.set(0, 0, 0);
        } else if (current.kind === 'device') {
          const grp = deviceGroupRefs.current[current.id];
          if (grp) grp.position.set(0, 0, 0);
          if (current.onClickCallback) current.onClickCallback();
        }
      } else {
        setLayout3D((prev) => {
          const nextLayout =
            current.kind === 'pad'
              ? {
                  ...prev,
                  pads: {
                    ...prev.pads,
                    [current.id]: {
                      ...(prev.pads[current.id] || {}),
                      cx: current.liveX,
                      cz: current.liveZ
                    }
                  }
                }
              : {
                  ...prev,
                  devices: {
                    ...prev.devices,
                    [current.id]: {
                      ...prev.devices[current.id],
                      dx: current.liveX,
                      dz: current.liveZ
                    }
                  }
                };
          persist3DLayout(nextLayout);
          return nextLayout;
        });
      }
    };
    window.addEventListener('pointerup', handleWindowPointerUp);
    return () => window.removeEventListener('pointerup', handleWindowPointerUp);
  }, [active3DDrag, persist3DLayout]);

  // 1-Click Swap Purplish Colocation Base & Cyan AP Base in 3D
  const handleSwapColoAndAp3D = () => {
    setLayout3D((prev) => {
      const isDefault = prev.pads.apZone.cz < prev.pads.coloZone.cz;
      const nextLayout = {
        ...prev,
        pads: {
          ...prev.pads,
          coloZone: {
            ...prev.pads.coloZone,
            cz: isDefault ? -5.0 : 5.5
          },
          apZone: {
            ...prev.pads.apZone,
            cz: isDefault ? 2.8 : -2.2
          }
        }
      };
      persist3DLayout(nextLayout);
      return nextLayout;
    });
  };

  // Reset 3D Layout to Default
  const handleReset3DLayout = () => {
    const fresh = structuredClone(DEFAULT_3D_LAYOUT);
    setLayout3D(fresh);
    try {
      localStorage.removeItem(LAYOUT_3D_STORAGE_KEY);
    } catch {
      // ignore
    }
    fetch(API_3D_LAYOUT_ENDPOINT, { method: 'DELETE' })
      .then(() => setSaveStatus('Reset ✓'))
      .catch(() => setSaveStatus('Reset ✓'));
  };

  // Build unified multi-switch & multi-campus topology graph
  const globalGraph = useMemo(() => {
    return buildGlobalAndSiteTopology(savedDevices, parsedSwitchData);
  }, [savedDevices, parsedSwitchData]);

  const hiddenSet = useMemo(() => new Set(hiddenDeviceKeys), [hiddenDeviceKeys]);

  // Helper to check if a switch node passes the Building & Device Visibility filters
  const isSwitchVisibleIn3D = useCallback(
    (node) => {
      if (!node) return false;
      if (hiddenSet.has(node.key) || hiddenSet.has(node.id)) return false;
      // Keep primary tcore-9600, mcore-9600, and hcore core anchors visible unless explicitly hidden
      if (/^(tcore-9600|mcore-9600|hcore)/i.test(node.hostname || '')) {
        return true;
      }
      if (selectedBuildingFilter && selectedBuildingFilter !== 'ALL') {
        if (node.buildingCode !== selectedBuildingFilter) return false;
      }
      // If unpolled CDP switch, show when showUnpolledCdpNeighbors is on OR user specifically filtered to an unpolled building
      if (!node.isPolled) {
        const isSpecificUnpolledBuilding =
          selectedBuildingFilter &&
          selectedBuildingFilter !== 'ALL' &&
          selectedBuildingFilter !== 'BAN';
        if (!showUnpolledCdpNeighbors && !isSpecificUnpolledBuilding) {
          return false;
        }
      }
      return true;
    },
    [hiddenSet, selectedBuildingFilter, showUnpolledCdpNeighbors]
  );

  // Identify live nodes: T-CORE (Metro), M-CORE (Florham), H-CORE (US Colocation)
  const rawCoreNode = useMemo(() => {
    return (
      globalGraph.switchNodes.find((n) => /^tcore-9600/i.test(n.hostname || '')) || {
        id: 'TCORE-9600',
        key: 'TCORE-9600',
        hostname: 'tcore-9600.net.fdu.edu',
        mgmtIp: '132.238.1.40',
        model: 'Cisco C9606R',
        iosVersion: '17.12.4',
        role: 'Campus Core Switch',
        siteCode: 'Metro',
        buildingCode: 'CORE',
        isPolled: false,
        hierarchyTier: 1,
        switchLinks: [],
        attachedEndpoints: []
      }
    );
  }, [globalGraph]);

  const coreNode = useMemo(() => {
    return isSwitchVisibleIn3D(rawCoreNode) ? rawCoreNode : null;
  }, [rawCoreNode, isSwitchVisibleIn3D]);

  const rawMcoreNode = useMemo(() => {
    return (
      globalGraph.switchNodes.find((n) => /^mcore-9600/i.test(n.hostname || '')) || {
        id: 'MCORE-9600',
        key: 'MCORE-9600',
        hostname: 'mcore-9600.net.fdu.edu',
        mgmtIp: '132.238.129.40',
        model: 'Cisco C9606R',
        iosVersion: '17.12.4',
        role: 'Campus Core Switch',
        siteCode: 'Florham',
        buildingCode: 'CORE',
        isPolled: false,
        hierarchyTier: 1,
        switchLinks: [],
        attachedEndpoints: []
      }
    );
  }, [globalGraph]);

  const mcoreNode = useMemo(() => {
    return isSwitchVisibleIn3D(rawMcoreNode) ? rawMcoreNode : null;
  }, [rawMcoreNode, isSwitchVisibleIn3D]);

  const rawHcoreNode = useMemo(() => {
    return (
      globalGraph.switchNodes.find((n) => /^hcore/i.test(n.hostname || '')) || {
        id: 'HCORE-7706',
        key: 'HCORE-7706',
        hostname: 'hcore(FXS1836Q2KE)',
        mgmtIp: '132.238.10.29',
        model: 'N77-C7706',
        iosVersion: 'NX-OS 8.4',
        role: 'US Colocation Core',
        siteCode: 'Halsey165',
        buildingCode: 'CORE',
        isPolled: false,
        hierarchyTier: 1,
        switchLinks: [],
        attachedEndpoints: []
      }
    );
  }, [globalGraph]);

  const hcoreNode = useMemo(() => {
    return isSwitchVisibleIn3D(rawHcoreNode) ? rawHcoreNode : null;
  }, [rawHcoreNode, isSwitchVisibleIn3D]);

  const rawWlNode = useMemo(() => {
    return (
      globalGraph.switchNodes.find((n) => n.hostname.includes('T-BAN-2FL-WL')) ||
      globalGraph.switchNodes.find((n) => n.hierarchyTier !== 1)
    );
  }, [globalGraph]);

  const wlNode = useMemo(() => {
    return isSwitchVisibleIn3D(rawWlNode) ? rawWlNode : null;
  }, [rawWlNode, isSwitchVisibleIn3D]);

  const rawWorkStudyNode = useMemo(() => {
    return globalGraph.switchNodes.find((n) => n.hostname.includes('WorkStudy'));
  }, [globalGraph]);

  const workStudyNode = useMemo(() => {
    return isSwitchVisibleIn3D(rawWorkStudyNode) ? rawWorkStudyNode : null;
  }, [rawWorkStudyNode, isSwitchVisibleIn3D]);

  // Any additional switches discovered beyond the Core Trio & Bancroft 2FL pair (filtered by Building & Polled/CDP Scope, sorted by Building!)
  const additionalSwitches = useMemo(() => {
    const coreId = rawCoreNode?.id;
    const mcoreId = rawMcoreNode?.id;
    const hcoreId = rawHcoreNode?.id;
    const wlId = rawWlNode?.id;
    const wsId = rawWorkStudyNode?.id;
    return globalGraph.switchNodes
      .filter(
        (n) =>
          n.id !== coreId &&
          n.id !== mcoreId &&
          n.id !== hcoreId &&
          n.id !== wlId &&
          n.id !== wsId &&
          isSwitchVisibleIn3D(n)
      )
      .sort((a, b) => {
        if (a.buildingCode !== b.buildingCode) {
          return (a.buildingCode || '').localeCompare(b.buildingCode || '');
        }
        return (a.hostname || '').localeCompare(b.hostname || '');
      });
  }, [
    globalGraph.switchNodes,
    rawCoreNode,
    rawMcoreNode,
    rawHcoreNode,
    rawWlNode,
    rawWorkStudyNode,
    isSwitchVisibleIn3D
  ]);

  // Group all switches by building code (ready for tcore / mcore 300+ CDP neighbors)
  const buildingClusters = useMemo(() => {
    const map = {};
    for (const sw of globalGraph.switchNodes) {
      const prefix = sw.buildingCode || 'OTHER';
      if (!map[prefix]) {
        map[prefix] = {
          prefix,
          label: sw.buildingLabel || prefix,
          switches: [],
          polledCount: 0,
          apCount: 0
        };
      }
      map[prefix].switches.push(sw);
      if (sw.isPolled) map[prefix].polledCount += 1;
      map[prefix].apCount += sw.attachedEndpoints?.length || 0;
    }
    return Object.values(map).sort((a, b) => b.switches.length - a.switches.length);
  }, [globalGraph.switchNodes]);

  const attachedAps = useMemo(() => {
    if (!wlNode) return [];
    return wlNode.attachedEndpoints || [];
  }, [wlNode]);

  // Compute live 3D Coordinates matching the FDU-CAMPUSES.drawio Spatial Layout:
  // - Top-Left: V-CORE (Vancouver Canada) + V-FG1/2 + ASA ASR + 2x NCS + 2x CA ISP
  // - Top-Right: H-CORE (165 Halsey US Colo) + FG-1/2 + NCS-5504 + Fort D-1/2 + 2x US ISP
  // - Middle-Left: M-CORE (mcore-9600 Florham) + M-FG-1/2 + DC2 Core Peers + Florham Building Bases below
  // - Middle-Right: T-CORE (tcore-9600 Metro) + T-FG-1/2 + DC1 Core Peers + Bancroft & Metro Building Bases below
  // - US Core Triangle Optical Legs: 3x Adva FSP 3000 DWDM Shelves (H-CORE<->M-CORE, H-CORE<->T-CORE, M-CORE<->T-CORE)
  const positions = useMemo(() => {
    const getPos = (deviceId) => {
      const dev = layout3D.devices[deviceId] || DEFAULT_3D_LAYOUT.devices[deviceId];
      const pad = layout3D.pads[dev.padId] || DEFAULT_3D_LAYOUT.pads[dev.padId];
      return [+(pad.cx + dev.dx).toFixed(2), 0.2, +(pad.cz + dev.dz).toFixed(2)];
    };

    const corePos = getPos('coreNode');
    const mcorePos = getPos('mcoreNode');
    const wlPos = getPos('wlNode');
    const wsPos = getPos('wsNode');

    const vancPadCfg = layout3D.pads.vancZone || DEFAULT_3D_LAYOUT.pads.vancZone;
    const coloPadCfg = layout3D.pads.coloZone || DEFAULT_3D_LAYOUT.pads.coloZone;
    const mcorePadCfg = layout3D.pads.mcoreZone || DEFAULT_3D_LAYOUT.pads.mcoreZone;
    const corePadCfg = layout3D.pads.coreZone || DEFAULT_3D_LAYOUT.pads.coreZone;
    const banPadCfg = layout3D.pads.switchZone || DEFAULT_3D_LAYOUT.pads.switchZone;

    const hcorePos = [coloPadCfg.cx, 0.2, +(coloPadCfg.cz + 3.2).toFixed(2)];
    const vcorePos = [vancPadCfg.cx, 0.2, +(vancPadCfg.cz + 2.8).toFixed(2)];

    // 7 Wi-Fi 6 APs arranged on the Right Access Zone Pad
    const apPositions = attachedAps.slice(0, 7).map((ap, idx) => {
      const deviceId = `ap-${idx}`;
      return {
        deviceId,
        ap,
        pos: getPos(deviceId)
      };
    });

    // 1. Separate additionalSwitches into:
    //    - florhamCorePeers (buildingCode === 'CORE' && siteCode === 'Florham' -> placed onto mcoreZone)
    //    - metroCorePeers   (buildingCode === 'CORE' && siteCode !== 'Florham' -> placed onto coreZone)
    //    - banExtraSwitches (buildingCode === 'BAN' -> placed onto Bancroft Hall switchZone)
    //    - florhamBuildingMap (siteCode === 'Florham' -> placed in 3-column grid south of mcoreZone)
    //    - metroBuildingMap   (siteCode !== 'Florham' -> placed in 3-column grid south of coreZone/switchZone)
    const florhamCorePeers = [];
    const metroCorePeers = [];
    const banExtraSwitches = [];
    const florhamBuildingMap = new Map();
    const metroBuildingMap = new Map();

    for (const sw of additionalSwitches) {
      const bCode = sw.buildingCode || 'OTHER';
      const isFlorham = sw.siteCode === 'Florham';
      if (bCode === 'CORE') {
        if (isFlorham) {
          florhamCorePeers.push(sw);
        } else {
          metroCorePeers.push(sw);
        }
      } else if (bCode === 'BAN') {
        banExtraSwitches.push(sw);
      } else {
        const targetMap = isFlorham ? florhamBuildingMap : metroBuildingMap;
        const groupKey = `${isFlorham ? 'FLO' : 'MET'}-${bCode}`;
        if (!targetMap.has(groupKey)) {
          targetMap.set(groupKey, {
            code: bCode,
            siteCode: isFlorham ? 'Florham' : 'Metro',
            label: sw.buildingLabel || bCode,
            switches: []
          });
        }
        targetMap.get(groupKey).switches.push(sw);
      }
    }

    // 2a. Place Metro Core Peers (DC1-9500, DC1-9300-NET, Metro-WLC-1/2, etc.) on T-CORE Base (coreZone)
    const coreCols = 3;
    const coreRows = Math.ceil(metroCorePeers.length / coreCols);
    const coreColSpacing = 4.05;
    const coreRowSpacing = 2.85;
    const expandedCoreW = Math.max(corePadCfg.w, +(coreCols * coreColSpacing + 3.6).toFixed(2));
    const expandedCoreD =
      metroCorePeers.length > 0
        ? Math.max(corePadCfg.d, +((coreRows + 1) * coreRowSpacing + 4.2).toFixed(2))
        : corePadCfg.d;
    const expandedCoreCz =
      metroCorePeers.length > 0
        ? +(corePadCfg.cz - (expandedCoreD - corePadCfg.d) / 2).toFixed(2)
        : corePadCfg.cz;

    const corePeerPositions = metroCorePeers.map((sw, idx) => {
      const col = idx % coreCols;
      const row = Math.floor(idx / coreCols);
      const startX = corePadCfg.cx - ((coreCols - 1) * coreColSpacing) / 2;
      const startZ = corePadCfg.cz - 3.4 - row * coreRowSpacing;
      return {
        sw,
        pos: [+(startX + col * coreColSpacing).toFixed(2), 0.2, +startZ.toFixed(2)]
      };
    });

    const coreZoneBox = {
      cx: corePadCfg.cx,
      cz: expandedCoreCz,
      w: expandedCoreW,
      d: expandedCoreD
    };

    // 2b. Place Florham Core Peers (DC2-9500, Flo-WLC-1/2, F-WLC-1/2, datacenter-ise, etc.) on M-CORE Base (mcoreZone)
    const mcoreCols = 3;
    const mcoreRows = Math.ceil(florhamCorePeers.length / mcoreCols);
    const expandedMcoreW = Math.max(mcorePadCfg.w, +(mcoreCols * coreColSpacing + 3.6).toFixed(2));
    const expandedMcoreD =
      florhamCorePeers.length > 0
        ? Math.max(mcorePadCfg.d, +((mcoreRows + 1) * coreRowSpacing + 4.2).toFixed(2))
        : mcorePadCfg.d;
    const expandedMcoreCz =
      florhamCorePeers.length > 0
        ? +(mcorePadCfg.cz - (expandedMcoreD - mcorePadCfg.d) / 2).toFixed(2)
        : mcorePadCfg.cz;

    const mcorePeerPositions = florhamCorePeers.map((sw, idx) => {
      const col = idx % mcoreCols;
      const row = Math.floor(idx / mcoreCols);
      const startX = mcorePadCfg.cx - ((mcoreCols - 1) * coreColSpacing) / 2;
      const startZ = mcorePadCfg.cz - 3.4 - row * coreRowSpacing;
      return {
        sw,
        pos: [+(startX + col * coreColSpacing).toFixed(2), 0.2, +startZ.toFixed(2)]
      };
    });

    const mcoreZoneBox = {
      cx: mcorePadCfg.cx,
      cz: expandedMcoreCz,
      w: expandedMcoreW,
      d: expandedMcoreD
    };

    // 3. Place additional Bancroft Hall switches on the Bancroft Base (switchZone)
    const banCols = 2;
    const banRows = Math.ceil(banExtraSwitches.length / banCols);
    const banColSpacing = 4.1;
    const banRowSpacing = 2.95;
    const expandedBanW = banPadCfg.w;
    const expandedBanD =
      banExtraSwitches.length > 0
        ? Math.max(banPadCfg.d, +(banPadCfg.d + banRows * banRowSpacing + 0.8).toFixed(2))
        : banPadCfg.d;
    const expandedBanCz =
      banExtraSwitches.length > 0
        ? +(banPadCfg.cz + (expandedBanD - banPadCfg.d) / 2).toFixed(2)
        : banPadCfg.cz;

    const banExtraPositions = banExtraSwitches.map((sw, idx) => {
      const col = idx % banCols;
      const row = Math.floor(idx / banCols);
      const startX = banPadCfg.cx - ((banCols - 1) * banColSpacing) / 2;
      const startZ = banPadCfg.cz + 3.6 + row * banRowSpacing;
      return {
        sw,
        pos: [+(startX + col * banColSpacing).toFixed(2), 0.2, +startZ.toFixed(2)]
      };
    });

    const switchZoneBox = {
      cx: banPadCfg.cx,
      cz: expandedBanCz,
      w: expandedBanW,
      d: expandedBanD
    };

    // Helper to size and arrange a campus's Building Bases into a clean 3-column grid south of its Campus Core!
    const layoutCampusBuildingGrid = (buildingGroups, anchorCenterX, startTopZ, campusTag) => {
      const sorted = Array.from(buildingGroups.values()).sort(
        (a, b) => b.switches.length - a.switches.length
      );
      const sized = sorted.map((grp) => {
        const cnt = grp.switches.length;
        const cols = cnt <= 2 ? cnt : cnt <= 6 ? 2 : cnt <= 12 ? 3 : cnt <= 20 ? 4 : 6;
        const rows = Math.max(1, Math.ceil(cnt / cols));
        const colSpacing = 4.1;
        const rowSpacing = 2.9;
        const w = Math.max(6.4, +(cols * colSpacing + 2.3).toFixed(2));
        const d = Math.max(4.4, +(rows * rowSpacing + 2.3).toFixed(2));
        return { ...grp, cols, rows, colSpacing, rowSpacing, w, d };
      });

      const gridCols = 3;
      const colBuckets = [[], [], []];
      const colDepths = [0, 0, 0];

      sized.forEach((grp) => {
        let bestCol = 0;
        for (let c = 1; c < gridCols; c += 1) {
          if (colDepths[c] < colDepths[bestCol]) bestCol = c;
        }
        colBuckets[bestCol].push(grp);
        colDepths[bestCol] += grp.d + 3.2;
      });

      const maxW0 = Math.max(10, ...colBuckets[0].map((g) => g.w));
      const maxW1 = Math.max(10, ...colBuckets[1].map((g) => g.w));
      const maxW2 = Math.max(10, ...colBuckets[2].map((g) => g.w));

      const colCentersX = [
        +(anchorCenterX - (maxW1 / 2 + maxW0 / 2 + 3.2)).toFixed(2),
        +anchorCenterX.toFixed(2),
        +(anchorCenterX + (maxW1 / 2 + maxW2 / 2 + 3.2)).toFixed(2)
      ];

      const bases = [];
      const switchItems = [];

      colBuckets.forEach((bucket, colIdx) => {
        let cursorTopZ = startTopZ;
        const defaultCx = colCentersX[colIdx];

        bucket.forEach((grp) => {
          const padId = `bldg-${campusTag}-${grp.code}`;
          const defaultCz = +(cursorTopZ + grp.d / 2).toFixed(2);
          cursorTopZ += grp.d + 3.2;

          const savedPad = layout3D.pads[padId];
          const cx = typeof savedPad?.cx === 'number' ? savedPad.cx : defaultCx;
          const cz = typeof savedPad?.cz === 'number' ? savedPad.cz : defaultCz;
          const theme = getBuildingBaseTheme(grp.code);

          const startLocalX = -((grp.cols - 1) * grp.colSpacing) / 2;
          const startLocalZ = -((grp.rows - 1) * grp.rowSpacing) / 2;

          const switchPositions = grp.switches.map((sw, idx) => {
            const col = idx % grp.cols;
            const row = Math.floor(idx / grp.cols);
            const pos = [
              +(cx + startLocalX + col * grp.colSpacing).toFixed(2),
              0.2,
              +(cz + startLocalZ + row * grp.rowSpacing).toFixed(2)
            ];
            const item = { sw, pos, buildingCode: grp.code, siteCode: grp.siteCode };
            switchItems.push(item);
            return item;
          });

          bases.push({
            padId,
            code: grp.code,
            siteCode: grp.siteCode,
            label: grp.label,
            cx,
            cz,
            w: grp.w,
            d: grp.d,
            theme,
            switches: grp.switches,
            switchPositions
          });
        });
      });

      return { bases, switchItems };
    };

    // 4a. Florham Campus Building Bases (South-West, directly below M-CORE)
    const florhamGrid = layoutCampusBuildingGrid(
      florhamBuildingMap,
      mcorePadCfg.cx - 6.0,
      mcorePadCfg.cz + 8.5,
      'FLO'
    );

    // 4b. Metropolitan Campus Building Bases (South-East, directly below T-CORE & Bancroft Hall)
    const metroGrid = layoutCampusBuildingGrid(
      metroBuildingMap,
      corePadCfg.cx + 2.0,
      Math.max(expandedBanCz + expandedBanD / 2 + 4.2, corePadCfg.cz + 22.0),
      'MET'
    );

    const buildingBases = [...florhamGrid.bases, ...metroGrid.bases];
    const allAdditionalSwitchPositions = [
      ...corePeerPositions,
      ...mcorePeerPositions,
      ...banExtraPositions,
      ...florhamGrid.switchItems,
      ...metroGrid.switchItems
    ];

    // 5. FDU-CAMPUSES.drawio Optical (Adva DWDM), Firewall (FortiGate HA), and WAN Edge Nodes
    const advaHmPos = [
      +((hcorePos[0] + mcorePos[0]) / 2).toFixed(2),
      0.2,
      +((hcorePos[2] + mcorePos[2]) / 2).toFixed(2)
    ];
    const advaHtPos = [
      +((hcorePos[0] + corePos[0]) / 2).toFixed(2),
      0.2,
      +((hcorePos[2] + corePos[2]) / 2).toFixed(2)
    ];
    const advaMtPos = [
      +((mcorePos[0] + corePos[0]) / 2).toFixed(2),
      0.2,
      +((mcorePos[2] + corePos[2]) / 2 + 1.2).toFixed(2)
    ];

    const infraNodes = [
      // 3x Adva FSP 3000 Optical DWDM Transport Shelves on the US Core Triangle Legs (VLAN 120 / VLAN 123)
      {
        id: 'ADVA-HM-DWDM',
        hostname: 'Adva-DWDM-HM',
        model: 'Adva FSP 3000 Optical',
        mgmtIp: 'VLAN 120 (Po120)',
        role: 'Optical DWDM',
        badge: 'OPTICAL',
        siteCode: 'Halsey165',
        kind: 'adva',
        color: '#facc15',
        pos: advaHmPos
      },
      {
        id: 'ADVA-HT-DWDM',
        hostname: 'Adva-DWDM-HT',
        model: 'Adva FSP 3000 Optical',
        mgmtIp: 'VLAN 120 (Po126)',
        role: 'Optical DWDM',
        badge: 'OPTICAL',
        siteCode: 'Halsey165',
        kind: 'adva',
        color: '#facc15',
        pos: advaHtPos
      },
      {
        id: 'ADVA-MT-DWDM',
        hostname: 'Adva-DWDM-MT',
        model: 'Adva FSP 3000 Optical',
        mgmtIp: 'VLAN 120/123 (Po124)',
        role: 'Optical DWDM',
        badge: 'OPTICAL',
        siteCode: 'Metro',
        kind: 'adva',
        color: '#facc15',
        pos: advaMtPos
      },
      // Florham M-CORE FortiGate HA Pair (Po122 / Po123 / Vlan445 / Vlan446)
      {
        id: 'M-FG-1',
        hostname: 'M-FG-1',
        model: 'FortiGate 100G HA',
        mgmtIp: 'Po122 • VLAN 445',
        role: 'Florham Firewall',
        badge: 'FORTIGATE',
        siteCode: 'Florham',
        kind: 'firewall',
        color: '#f43f5e',
        pos: [+(mcorePos[0] - 3.8).toFixed(2), 0.2, +(mcorePos[2] + 2.2).toFixed(2)]
      },
      {
        id: 'M-FG-2',
        hostname: 'M-FG-2',
        model: 'FortiGate 100G HA',
        mgmtIp: 'Po123 • VLAN 446',
        role: 'Florham Firewall',
        badge: 'FORTIGATE',
        siteCode: 'Florham',
        kind: 'firewall',
        color: '#f43f5e',
        pos: [+(mcorePos[0] + 3.8).toFixed(2), 0.2, +(mcorePos[2] + 2.2).toFixed(2)]
      },
      // Metro T-CORE FortiGate HA Pair (Po38 / Po117 / Vlan448 / Vlan449)
      {
        id: 'T-FG-1',
        hostname: 'T-FG-1',
        model: 'FortiGate 100G HA',
        mgmtIp: 'Po38 • VLAN 448',
        role: 'Metro Firewall',
        badge: 'FORTIGATE',
        siteCode: 'Metro',
        kind: 'firewall',
        color: '#f43f5e',
        pos: [+(corePos[0] - 3.8).toFixed(2), 0.2, +(corePos[2] + 2.2).toFixed(2)]
      },
      {
        id: 'T-FG-2',
        hostname: 'T-FG-2',
        model: 'FortiGate 100G HA',
        mgmtIp: 'Po117 • VLAN 449',
        role: 'Metro Firewall',
        badge: 'FORTIGATE',
        siteCode: 'Metro',
        kind: 'firewall',
        color: '#f43f5e',
        pos: [+(corePos[0] + 3.8).toFixed(2), 0.2, +(corePos[2] + 2.2).toFixed(2)]
      },
      // US Colocation (165 Halsey) Tier: FG-1/2, NCS-5504, Fort D-1/2
      {
        id: 'COLO-FG-1',
        hostname: 'FG-1 (Halsey)',
        model: 'FortiGate HA Primary',
        mgmtIp: '165 Halsey Colo',
        role: 'Colo Firewall',
        badge: 'FORTIGATE',
        siteCode: 'Halsey165',
        kind: 'firewall',
        color: '#fb7185',
        pos: [+(coloPadCfg.cx - 3.2).toFixed(2), 0.2, +(coloPadCfg.cz + 0.2).toFixed(2)]
      },
      {
        id: 'COLO-FG-2',
        hostname: 'FG-2 (Halsey)',
        model: 'FortiGate HA Secondary',
        mgmtIp: '165 Halsey Colo',
        role: 'Colo Firewall',
        badge: 'FORTIGATE',
        siteCode: 'Halsey165',
        kind: 'firewall',
        color: '#fb7185',
        pos: [+(coloPadCfg.cx + 3.2).toFixed(2), 0.2, +(coloPadCfg.cz + 0.2).toFixed(2)]
      },
      {
        id: 'COLO-NCS-5504',
        hostname: 'NCS-5504',
        model: 'Cisco NCS-5504 Modular',
        mgmtIp: '165 Halsey WAN Core',
        role: 'WAN Aggregation',
        badge: 'NCS-5504',
        siteCode: 'Halsey165',
        kind: 'router',
        color: '#a855f7',
        pos: [coloPadCfg.cx, 0.2, +(coloPadCfg.cz - 2.3).toFixed(2)]
      },
      {
        id: 'COLO-FORT-D1',
        hostname: 'Fort D-1',
        model: 'FortiGate / FortiDDoS Edge 1',
        mgmtIp: 'US ISP Edge 1',
        role: 'ISP Edge Security',
        badge: 'FORT-D1',
        siteCode: 'Halsey165',
        kind: 'firewall',
        color: '#c084fc',
        pos: [+(coloPadCfg.cx - 3.2).toFixed(2), 0.2, +(coloPadCfg.cz - 4.7).toFixed(2)]
      },
      {
        id: 'COLO-FORT-D2',
        hostname: 'Fort D-2',
        model: 'FortiGate / FortiDDoS Edge 2',
        mgmtIp: 'US ISP Edge 2',
        role: 'ISP Edge Security',
        badge: 'FORT-D2',
        siteCode: 'Halsey165',
        kind: 'firewall',
        color: '#c084fc',
        pos: [+(coloPadCfg.cx + 3.2).toFixed(2), 0.2, +(coloPadCfg.cz - 4.7).toFixed(2)]
      },
      // Vancouver Campus (Top-Left Canada) Tier: V-CORE, V-FG1/2, ASA ASR, 2x NCS
      {
        id: 'V-CORE',
        hostname: 'V-CORE',
        model: 'Vancouver Campus Core',
        mgmtIp: 'Vancouver BC Canada',
        role: 'Canada Core',
        badge: 'V-CORE',
        siteCode: 'VancOakridge',
        kind: 'router',
        color: '#38bdf8',
        pos: vcorePos
      },
      {
        id: 'V-FG1',
        hostname: 'V-FG1',
        model: 'FortiGate HA 1 (CA)',
        mgmtIp: 'Vancouver Firewall 1',
        role: 'CA Firewall',
        badge: 'FORTIGATE',
        siteCode: 'VancOakridge',
        kind: 'firewall',
        color: '#f43f5e',
        pos: [+(vancPadCfg.cx - 3.0).toFixed(2), 0.2, +(vancPadCfg.cz + 0.1).toFixed(2)]
      },
      {
        id: 'V-FG2',
        hostname: 'V-FG2',
        model: 'FortiGate HA 2 (CA)',
        mgmtIp: 'Vancouver Firewall 2',
        role: 'CA Firewall',
        badge: 'FORTIGATE',
        siteCode: 'VancOakridge',
        kind: 'firewall',
        color: '#f43f5e',
        pos: [+(vancPadCfg.cx + 3.0).toFixed(2), 0.2, +(vancPadCfg.cz + 0.1).toFixed(2)]
      },
      {
        id: 'V-ASA-ASR',
        hostname: 'ASA / ASR',
        model: 'Cisco ASA / ASR Edge',
        mgmtIp: 'Vancouver WAN Edge',
        role: 'CA WAN Router',
        badge: 'ASA/ASR',
        siteCode: 'VancOakridge',
        kind: 'router',
        color: '#fb923c',
        pos: [vancPadCfg.cx, 0.2, +(vancPadCfg.cz - 2.3).toFixed(2)]
      },
      {
        id: 'V-NCS-1',
        hostname: 'NCS-CA-1',
        model: 'Cisco NCS Carrier Edge 1',
        mgmtIp: 'Canada ISP 1',
        role: 'CA ISP Edge',
        badge: 'NCS',
        siteCode: 'VancOakridge',
        kind: 'router',
        color: '#38bdf8',
        pos: [+(vancPadCfg.cx - 3.0).toFixed(2), 0.2, +(vancPadCfg.cz - 4.5).toFixed(2)]
      },
      {
        id: 'V-NCS-2',
        hostname: 'NCS-CA-2',
        model: 'Cisco NCS Carrier Edge 2',
        mgmtIp: 'Canada ISP 2',
        role: 'CA ISP Edge',
        badge: 'NCS',
        siteCode: 'VancOakridge',
        kind: 'router',
        color: '#38bdf8',
        pos: [+(vancPadCfg.cx + 3.0).toFixed(2), 0.2, +(vancPadCfg.cz - 4.5).toFixed(2)]
      }
    ];

    return {
      corePos,
      mcorePos,
      hcorePos,
      vcorePos,
      advaHmPos,
      advaHtPos,
      advaMtPos,
      wlPos,
      wsPos,
      vancPadCfg,
      coloPadCfg,
      coreZoneBox,
      mcoreZoneBox,
      switchZoneBox,
      corePeerPositions,
      mcorePeerPositions,
      banExtraPositions,
      buildingBases,
      apPositions,
      infraNodes,
      additionalSwitchPositions: allAdditionalSwitchPositions
    };
  }, [attachedAps, layout3D, additionalSwitches]);

  // Selected entity in the 3D scene (defaults to T-BAN-2FL-WL so the drawer immediately shows rich telemetry)
  const [selected3DEntity, setSelected3DEntity] = useState(null);

  const activeEntity = useMemo(() => {
    if (selected3DEntity) return selected3DEntity;
    if (wlNode) {
      return { type: 'device', data: wlNode, id: wlNode.id, pos: positions.wlPos };
    }
    return null;
  }, [selected3DEntity, wlNode, positions.wlPos]);

  // Build 3D Conduits Connecting the US Core Triangle, Adva DWDM Shelves, FortiGates, and Campus Building Bases
  const conduits3D = useMemo(() => {
    const list = [];

    // 0a. Cross-Border WAN Link: V-CORE (Vancouver Canada) <-> H-CORE (165 Halsey US Colo)
    list.push({
      id: 'wan-vcore-hcore',
      isPrimaryTrunk: true,
      verified: true,
      color: '#22d3ee',
      radius: 0.085,
      badgeTitle: 'CROSS-BORDER WAN: V-CORE (Canada) ┈┈┈ H-CORE (165 Halsey US)',
      badgeSubtitle: 'Encrypted Cross-Border Inter-Campus Tunnel • Vancouver BC ↔ Newark NJ',
      sourceHostname: 'V-CORE (Vancouver)',
      sourcePort: 'WAN-1',
      targetHostname: hcoreNode?.hostname || 'hcore(FXS1836Q2KE)',
      targetPort: 'Eth1/1',
      speed: '10G Cross-Border WAN',
      nativeVlan: 'Routed BGP',
      allowedVlans: 'All Enterprise VRFs',
      startPos: [positions.vcorePos[0] + 1.2, 0.8, positions.vcorePos[2]],
      endPos: [positions.hcorePos[0] - 1.5, 1.1, positions.hcorePos[2]]
    });

    // 0b. US Core Triangle Leg 1: H-CORE <-> Adva-DWDM-HM <-> M-CORE (Po120 / Hu1/1/0/25, Hu2/1/0/25, Hu1/1/0/31, Hu2/1/0/31)
    if (hcoreNode && mcoreNode) {
      list.push({
        id: 'dwdm-hcore-adva-hm',
        isPrimaryTrunk: true,
        verified: true,
        color: '#facc15',
        radius: 0.095,
        badgeTitle: '100G DWDM LEG 1A: H-CORE ↔ Adva-DWDM-HM (Po120)',
        badgeSubtitle: 'Halsey165 Nexus 7706 (Eth1/9-10, Eth2/9-10) ↔ Adva Optical Shelf (VLAN 120)',
        sourceHostname: hcoreNode.hostname,
        sourcePort: 'Eth1/9-10, Eth2/9-10',
        targetHostname: 'Adva-DWDM-HM',
        targetPort: 'DWDM-LINE-1',
        speed: '4× 100G QSFP28 Optical (Po120)',
        nativeVlan: '120',
        allowedVlans: 'L3/L2 Core Interconnect',
        startPos: [positions.hcorePos[0] - 1.2, 1.2, positions.hcorePos[2] + 0.8],
        endPos: [positions.advaHmPos[0], 0.75, positions.advaHmPos[2]]
      });
      list.push({
        id: 'dwdm-adva-hm-mcore',
        isPrimaryTrunk: true,
        verified: true,
        color: '#facc15',
        radius: 0.095,
        badgeTitle: '100G DWDM LEG 1B: Adva-DWDM-HM ↔ mcore-9600 (Po120)',
        badgeSubtitle: 'mcore-9600 (Hu1/1/0/25, Hu2/1/0/25, Hu1/1/0/31, Hu2/1/0/31) ↔ H-CORE',
        sourceHostname: 'Adva-DWDM-HM',
        sourcePort: 'DWDM-CLIENT-1',
        targetHostname: mcoreNode.hostname,
        targetPort: 'Po120 (Hu1/1/0/25,31 & Hu2/1/0/25,31)',
        speed: '4× 100G QSFP28 Optical (Po120)',
        nativeVlan: '120',
        allowedVlans: 'L3/L2 Core Interconnect',
        startPos: [positions.advaHmPos[0], 0.75, positions.advaHmPos[2]],
        endPos: [positions.mcorePos[0] + 0.8, 1.5, positions.mcorePos[2] - 1.0]
      });
    }

    // 0c. US Core Triangle Leg 2: H-CORE <-> Adva-DWDM-HT <-> T-CORE (Po126 / Hu1/1/0/25, Hu2/1/0/25, Hu1/1/0/31, Hu2/1/0/31)
    if (hcoreNode && coreNode) {
      list.push({
        id: 'dwdm-hcore-adva-ht',
        isPrimaryTrunk: true,
        verified: true,
        color: '#facc15',
        radius: 0.095,
        badgeTitle: '100G DWDM LEG 2A: H-CORE ↔ Adva-DWDM-HT (Po126)',
        badgeSubtitle: 'Halsey165 Nexus 7706 (Eth1/5-6, Eth2/5-6) ↔ Adva Optical Shelf (VLAN 120)',
        sourceHostname: hcoreNode.hostname,
        sourcePort: 'Eth1/5-6, Eth2/5-6',
        targetHostname: 'Adva-DWDM-HT',
        targetPort: 'DWDM-LINE-2',
        speed: '4× 100G QSFP28 Optical (Po126)',
        nativeVlan: '120',
        allowedVlans: 'EIGRP Core Interconnect',
        startPos: [positions.hcorePos[0] + 1.2, 1.2, positions.hcorePos[2] + 0.8],
        endPos: [positions.advaHtPos[0], 0.75, positions.advaHtPos[2]]
      });
      list.push({
        id: 'dwdm-adva-ht-tcore',
        isPrimaryTrunk: true,
        verified: true,
        color: '#facc15',
        radius: 0.095,
        badgeTitle: '100G DWDM LEG 2B: Adva-DWDM-HT ↔ tcore-9600 (Po126)',
        badgeSubtitle: 'tcore-9600 (Hu1/1/0/25, Hu2/1/0/25, Hu1/1/0/31, Hu2/1/0/31) ↔ H-CORE',
        sourceHostname: 'Adva-DWDM-HT',
        sourcePort: 'DWDM-CLIENT-2',
        targetHostname: coreNode.hostname,
        targetPort: 'Po126 (Hu1/1/0/25,31 & Hu2/1/0/25,31)',
        speed: '4× 100G QSFP28 Optical (Po126)',
        nativeVlan: '120',
        allowedVlans: 'EIGRP Core Interconnect',
        startPos: [positions.advaHtPos[0], 0.75, positions.advaHtPos[2]],
        endPos: [positions.corePos[0] - 0.8, 1.5, positions.corePos[2] - 1.0]
      });
    }

    // 0d. US Core Triangle Leg 3 (Horizontal Inter-Campus Core): M-CORE <-> Adva-DWDM-MT <-> T-CORE (Po124 / Hu1/1/0/27 & Hu2/1/0/27)
    if (mcoreNode && coreNode) {
      list.push({
        id: 'dwdm-mcore-adva-mt',
        isPrimaryTrunk: true,
        verified: true,
        color: '#38bdf8',
        radius: 0.105,
        badgeTitle: '200G INTER-CAMPUS TRUNK: mcore-9600 ↔ Adva-DWDM-MT (Po124)',
        badgeSubtitle: 'Florham M-CORE (Hu1/1/0/27 & Hu2/1/0/27) ↔ Adva Optical Transport (VLAN 120/123)',
        sourceHostname: mcoreNode.hostname,
        sourcePort: 'Po124 (Hu1/1/0/27, Hu2/1/0/27)',
        targetHostname: 'Adva-DWDM-MT',
        targetPort: 'DWDM-WEST',
        speed: '2× 100G QSFP28 Trunk (Po124)',
        nativeVlan: '1',
        allowedVlans: 'Inter-Campus Core VLANs',
        startPos: [positions.mcorePos[0] + 1.5, 1.4, positions.mcorePos[2]],
        endPos: [positions.advaMtPos[0] - 1.0, 0.75, positions.advaMtPos[2]]
      });
      list.push({
        id: 'dwdm-adva-mt-tcore',
        isPrimaryTrunk: true,
        verified: true,
        color: '#38bdf8',
        radius: 0.105,
        badgeTitle: '200G INTER-CAMPUS TRUNK: Adva-DWDM-MT ↔ tcore-9600 (Po124)',
        badgeSubtitle: 'Adva Optical Transport ↔ Metro T-CORE (Hu1/1/0/27 & Hu2/1/0/27)',
        sourceHostname: 'Adva-DWDM-MT',
        sourcePort: 'DWDM-EAST',
        targetHostname: coreNode.hostname,
        targetPort: 'Po124 (Hu1/1/0/27, Hu2/1/0/27)',
        speed: '2× 100G QSFP28 Trunk (Po124)',
        nativeVlan: '1',
        allowedVlans: 'Inter-Campus Core VLANs',
        startPos: [positions.advaMtPos[0] + 1.0, 0.75, positions.advaMtPos[2]],
        endPos: [positions.corePos[0] - 1.5, 1.4, positions.corePos[2]]
      });
    }

    // 1. Dual 25G Fiber Uplinks: T-BAN-2FL-WL (Tw1/1/1 & Tw1/1/2 in C9300-NM-8X bay) <-> tcore-9600 (Tw2/2/0/35 & Tw1/2/0/35)
    if (wlNode && coreNode) {
      list.push({
        id: 'fiber-uplink-1',
        isPrimaryTrunk: true,
        verified: true,
        color: '#f97316',
        radius: 0.095,
        badgeTitle: '25G FIBER #1: Tw1/1/1 ↔ Tw2/2/0/35',
        badgeSubtitle: 'T-BAN-2FL-WL ↔ tcore-9600 • VLANs 8,11,94-97,133,268,270,273,2012',
        sourceHostname: 'T-BAN-2FL-WL',
        sourcePort: 'Tw1/1/1',
        targetHostname: 'tcore-9600.net.fdu.edu',
        targetPort: 'Tw2/2/0/35',
        speed: '25G SFP28 Fiber',
        nativeVlan: '1',
        allowedVlans: '8,11,94-97,133,268,270,273,2012',
        startPos: getC9300UplinkWorldPos(positions.wlPos, 0),
        endPos: [positions.corePos[0] + 0.5, 1.5, positions.corePos[2] + 1.2]
      });

      list.push({
        id: 'fiber-uplink-2',
        isPrimaryTrunk: false,
        verified: true,
        color: '#fb923c',
        radius: 0.085,
        badgeTitle: '25G FIBER #2: Tw1/1/2 ↔ Tw1/2/0/35',
        badgeSubtitle: 'Redundant Core Uplink • 802.1Q Trunk',
        sourceHostname: 'T-BAN-2FL-WL',
        sourcePort: 'Tw1/1/2',
        targetHostname: 'tcore-9600.net.fdu.edu',
        targetPort: 'Tw1/2/0/35',
        speed: '25G SFP28 Fiber',
        nativeVlan: '1',
        allowedVlans: '8,11,94-97,133,268,270,273,2012',
        startPos: getC9300UplinkWorldPos(positions.wlPos, 1),
        endPos: [positions.corePos[0] + 0.9, 1.2, positions.corePos[2] + 1.2]
      });
    }

    // 2. Bi-Directionally Verified 10G mGig Trunk: T-BAN-2FL-WL (Te1/0/20) <-> T-BAN-2FL-WorkStudy-C9300 (Te1/0/24)
    if (wlNode && workStudyNode) {
      list.push({
        id: 'switch-trunk-20-24',
        isPrimaryTrunk: true,
        verified: true,
        color: '#10b981',
        radius: 0.105,
        badgeTitle: '10G TRUNK: Te1/0/20 ↔ Te1/0/24',
        badgeSubtitle: 'Native VLAN 133 • Allowed: 8,11,94-97,133,268,270,273,2012',
        sourceHostname: 'T-BAN-2FL-WL',
        sourcePort: 'Te1/0/20',
        targetHostname: 'T-BAN-2FL-WorkStudy-C9300',
        targetPort: 'Te1/0/24',
        speed: '10G mGig Trunk (1000Mbps)',
        nativeVlan: '133',
        allowedVlans: '8,11,94-97,133,268,270,273,2012',
        startPos: getC9300PortWorldPos(positions.wlPos, 20, true),
        endPos: getC9300PortWorldPos(positions.wsPos, 24, true)
      });
    }

    // 2b. Campus Building Fiber Trunk Conduits:
    //     - Florham Building Bases connect to M-CORE (mcore-9600)
    //     - Metro Building Bases connect to T-CORE (tcore-9600)
    if (positions.buildingBases.length > 0) {
      positions.buildingBases.forEach((bldg, bIdx) => {
        const isFlorhamBldg = bldg.siteCode === 'Florham';
        const parentCore = isFlorhamBldg ? mcoreNode : coreNode;
        const parentCorePos = isFlorhamBldg ? positions.mcorePos : positions.corePos;
        if (!parentCore) return;

        list.push({
          id: `bldg-trunk-${bldg.padId}`,
          isPrimaryTrunk: false,
          verified: true,
          color: bldg.theme.rimColor,
          radius: 0.08,
          badgeTitle: `BUILDING FIBER TRUNK: ${parentCore.hostname.replace(/\.net\.fdu\.edu$/i, '')} ↔ ${bldg.label.toUpperCase()} (${bldg.switches.length} SWITCHES)`,
          badgeSubtitle: `${isFlorhamBldg ? 'Florham' : 'Metropolitan'} Campus 25G/100G Single-Mode Fiber • Click Plaque to Filter ${bldg.code}`,
          sourceHostname: parentCore.hostname,
          sourcePort: `Campus Fiber Bundle (${bldg.code})`,
          targetHostname: `${bldg.label} (${bldg.code})`,
          targetPort: `${bldg.switches.length} IDF/MDF Switches`,
          speed: '25G / 100G Campus Fiber Trunk',
          nativeVlan: '1',
          allowedVlans: 'All Building VLANs',
          startPos: [
            parentCorePos[0] + (((bIdx % 5) - 2) * 0.35),
            1.25 + ((bIdx % 4) * 0.12),
            parentCorePos[2] + 1.25
          ],
          endPos: [bldg.cx, 0.35, bldg.cz - bldg.d / 2 + 0.4]
        });
      });
    }

    // 2c. Switch-Level 25G/100G Fiber Uplinks (connects Florham switches to mcore-9600 and Metro switches to tcore-9600)
    if (positions.additionalSwitchPositions.length > 0) {
      const linksByTargetKey = new Map();
      for (const lnk of globalGraph.switchLinks || []) {
        if (!linksByTargetKey.has(lnk.targetKey)) linksByTargetKey.set(lnk.targetKey, []);
        linksByTargetKey.get(lnk.targetKey).push(lnk);
        if (!linksByTargetKey.has(lnk.sourceKey)) linksByTargetKey.set(lnk.sourceKey, []);
        linksByTargetKey.get(lnk.sourceKey).push({
          ...lnk,
          sourceHostname: lnk.targetHostname,
          sourcePort: lnk.targetPort,
          targetHostname: lnk.sourceHostname,
          targetPort: lnk.sourcePort
        });
      }

      const showAllSwitchConduits =
        positions.additionalSwitchPositions.length <= 24 || showLinkBadges;

      positions.additionalSwitchPositions.forEach(({ sw, pos }, idx) => {
        const isSelectedSwitch = activeEntity?.id === sw.id;
        const isCoreOrBan = sw.buildingCode === 'CORE' || sw.buildingCode === 'BAN';
        if (!showAllSwitchConduits && !isSelectedSwitch && !isCoreOrBan && !sw.isPolled) {
          return;
        }

        const isFlorham = sw.siteCode === 'Florham';
        const parentCore = isFlorham ? mcoreNode : coreNode;
        const parentCorePos = isFlorham ? positions.mcorePos : positions.corePos;
        if (!parentCore) return;

        const matchedLinks = linksByTargetKey.get(sw.key) || [];
        const primary = matchedLinks[0];
        const isMeraki = /MS350|MERAKI/i.test(`${sw.model} ${sw.hostname}`);
        const isCorePeer = sw.hierarchyTier === 1 || /C9500|C9600|N77/i.test(sw.model || '');
        const linkColor = isCorePeer ? '#a855f7' : isMeraki ? '#06b6d4' : '#f97316';
        const srcPort = primary?.sourcePort || 'Tw1/2/0/x';
        const dstPort = primary?.targetPort || 'Tw1/1/1';
        const dualSuffix =
          matchedLinks.length > 1 ? ` (+${matchedLinks.length - 1} Redundant Trunk)` : '';

        list.push({
          id: `core-to-${sw.id}`,
          isPrimaryTrunk: isSelectedSwitch,
          verified: sw.isPolled,
          color: linkColor,
          radius: isSelectedSwitch ? 0.095 : 0.06,
          badgeTitle: `[${sw.buildingCode}] ${srcPort} ↔ ${dstPort}${dualSuffix}`,
          badgeSubtitle: `${parentCore.hostname} ↔ ${sw.hostname} (${sw.model})`,
          sourceHostname: parentCore.hostname,
          sourcePort: srcPort,
          targetHostname: sw.hostname,
          targetPort: dstPort,
          speed: /^Hu/i.test(srcPort) ? '100G QSFP28 Fiber' : '25G SFP28 Fiber',
          nativeVlan: primary?.nativeVlan || '1',
          allowedVlans: primary?.allowedVlans || 'All Campus VLANs',
          startPos: [
            parentCorePos[0] + (((idx % 7) - 3) * 0.25),
            1.15 + ((idx % 5) * 0.14),
            parentCorePos[2] + 1.1
          ],
          endPos: [pos[0] + 1.15, 0.56, pos[2] + 0.9]
        });
      });
    }

    // 3. 7 Wi-Fi 6 AP UPOE Conduits from T-BAN-2FL-WL exact front-panel RJ-45 ports
    if (wlNode) {
      positions.apPositions.forEach(({ ap, pos }, idx) => {
        const m = String(ap.localPort || '').match(/\/(\d+)$/);
        const portNum = m ? parseInt(m[1], 10) : idx + 1;
        list.push({
          id: `ap-link-${ap.localPort}`,
          isPrimaryTrunk: false,
          verified: false,
          color: '#38bdf8',
          radius: 0.055,
          badgeTitle: `${ap.localPort} → ${ap.hostname}`,
          badgeSubtitle: `${ap.model} • ${ap.ip} • ${ap.poeWatts}W UPOE`,
          sourceHostname: 'T-BAN-2FL-WL',
          sourcePort: ap.localPort,
          targetHostname: ap.hostname,
          targetPort: 'GigabitEthernet0',
          speed: 'mGig UPOE (802.3bt)',
          nativeVlan: '25',
          allowedVlans: 'Access / Capwap',
          startPos: getC9300PortWorldPos(positions.wlPos, portNum, true),
          endPos: [pos[0], 0.3, pos[2]]
        });
      });
    }

    return list;
  }, [
    positions,
    wlNode,
    workStudyNode,
    coreNode,
    mcoreNode,
    hcoreNode,
    globalGraph.switchLinks,
    showLinkBadges,
    activeEntity
  ]);

  const handleSelectEntity = (entity) => {
    setSelected3DEntity(entity);
    setFocusTarget({ id: entity.id, pos: entity.pos });
    setIsDrawerOpen(true);
    if (onSelectInventoryEntity) {
      onSelectInventoryEntity(entity);
    }
    if (entity.type === 'device' && entity.data?.isPolled && entity.data?.serialNumber && onSelectSavedDevice) {
      onSelectSavedDevice(entity.data.serialNumber);
    }
  };

  // Background color from brightness slider
  const bgColor = useMemo(() => {
    const c = new THREE.Color().lerpColors(
      new THREE.Color('#050b18'),
      new THREE.Color('#1e293b'),
      backdropBrightness * 0.65
    );
    return `#${c.getHexString()}`;
  }, [backdropBrightness]);

  return (
    <div className="relative w-full h-full flex flex-col bg-[#050b18] rounded-xl border border-slate-800/90 overflow-hidden shadow-2xl">
      {/* ===================================================================
          TOP COMPACT HUD BAR: 3D CAMERA PRESETS, DRAG & SAVE, LABEL TOGGLES
         =================================================================== */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-3.5 py-2 bg-slate-950/95 border-b border-slate-800/90 text-xs z-20 shrink-0">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="px-2 py-0.5 rounded bg-cyan-500/20 text-cyan-300 border border-cyan-400/40 font-mono text-[10px] font-bold flex items-center gap-1">
            <Sparkles className="w-3 h-3" /> 3D MULTI-DEVICE CAMERA
          </span>
          {[
            { id: 'blueprint-iso', label: 'Isometric 3D' },
            { id: 'campus-wide', label: `Campus Fabric (${globalGraph.switchNodes.length})` },
            { id: 'metro-fabric', label: 'Core + Bancroft' },
            { id: 'switch-trunks', label: 'Trunks (A↔B)' },
            { id: 'wifi-fleet', label: 'Wi-Fi 6 APs (7)' },
            { id: 'top-blueprint', label: 'Top Plan (90°)' },
            { id: 'front-elevation', label: 'Front' }
          ].map((preset) => (
            <button
              key={preset.id}
              type="button"
              onClick={() => {
                setFocusTarget(null);
                setCameraPreset(preset.id);
              }}
              className={`px-2 py-1 rounded-md text-[11px] font-semibold transition cursor-pointer ${
                cameraPreset === preset.id && !focusTarget
                  ? 'bg-sky-600 text-white shadow'
                  : 'bg-slate-900 text-slate-300 hover:text-white border border-slate-800'
              }`}
            >
              {preset.label}
            </button>
          ))}

          {/* 3D Drag & Save Controls */}
          <button
            type="button"
            onClick={handleSwapColoAndAp3D}
            className="px-2 py-1 rounded-md bg-purple-500/20 hover:bg-purple-500/30 text-purple-200 border border-purple-500/50 font-mono font-bold text-[10px] flex items-center gap-1 cursor-pointer transition"
            title="Swap the Purplish Colocation Base and Cyan Access Point Base in 3D space"
          >
            <ArrowUpDown className="w-3 h-3 text-purple-300" />
            Swap Colo ▲ / AP ▼
          </button>

          <button
            type="button"
            onClick={handleReset3DLayout}
            className="px-2 py-1 rounded-md bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-700 font-mono text-[10px] flex items-center gap-1 cursor-pointer transition"
            title="Reset all dragged 3D bases and devices back to default coordinates"
          >
            <RotateCcw className="w-3 h-3" />
            Reset 3D
          </button>

          {/* Quick Building Filter in 3D HUD Bar */}
          {onSelectBuildingFilter && (
            <div className="flex items-center gap-1 bg-slate-900 border border-cyan-500/40 rounded-md px-2 py-0.5">
              <Building2 className="w-3 h-3 text-cyan-400 shrink-0" />
              <select
                value={selectedBuildingFilter}
                onChange={(e) => onSelectBuildingFilter(e.target.value)}
                className="bg-transparent text-[10px] font-mono font-bold text-cyan-300 focus:outline-none cursor-pointer"
                title="Filter 3D scene by Campus Building"
              >
                <option value="ALL" className="bg-slate-950 text-slate-100">
                  All Buildings ({(globalGraph.buildings || []).length})
                </option>
                {(globalGraph.buildings || []).map((b) => (
                  <option key={b.code} value={b.code} className="bg-slate-950 text-slate-100">
                    {b.label} ({b.switchCount})
                  </option>
                ))}
              </select>
            </div>
          )}

          <span className="px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 font-mono text-[10px] flex items-center gap-1">
            <Save className="w-3 h-3" />
            {saveStatus}
          </span>
        </div>

        {/* Right Controls: 4-Mode Label Display Selector + Trunk/Zone Toggles + Drawer Toggle */}
        <div className="flex flex-wrap items-center gap-1.5">
          {/* 4-Mode Label Display Selector */}
          <div className="flex items-center bg-slate-900 p-0.5 rounded-lg border border-slate-800">
            <span className="text-[10px] font-mono text-slate-400 px-2 flex items-center gap-1">
              <Eye className="w-3 h-3 text-emerald-400" /> Labels:
            </span>
            {[
              { id: 'hover', label: 'Hover / Click Only' },
              { id: 'switches', label: 'Switches Only' },
              { id: 'compact', label: 'Compact Names' },
              { id: 'all', label: 'All Details' }
            ].map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => setLabelMode(m.id)}
                className={`px-2 py-0.5 rounded-md text-[10px] font-mono font-semibold cursor-pointer transition ${
                  labelMode === m.id
                    ? 'bg-emerald-500 text-slate-950 font-bold shadow'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={() => setShowLinkBadges(!showLinkBadges)}
            className={`px-2 py-1 rounded-md text-[10px] font-mono border cursor-pointer transition ${
              showLinkBadges
                ? 'bg-sky-500/20 text-sky-300 border-sky-500/40 font-bold'
                : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-white'
            }`}
            title="Toggle Trunk Link Callouts (Hover always shows link details)"
          >
            Trunks: {showLinkBadges ? 'On' : 'Hover'}
          </button>

          <button
            type="button"
            onClick={() => setShowZoneTitles(!showZoneTitles)}
            className={`px-2 py-1 rounded-md text-[10px] font-mono border cursor-pointer transition ${
              showZoneTitles
                ? 'bg-purple-500/20 text-purple-300 border-purple-500/40 font-bold'
                : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-white'
            }`}
            title="Toggle Building Base Plaques & Zone Titles"
          >
            Building Plaques: {showZoneTitles ? 'On' : 'Off'}
          </button>

          {/* 3D Hardware Chassis X-Ray & Explode Controls for All Switches in Scene */}
          <button
            type="button"
            onClick={() => setMultiXrayMode(!multiXrayMode)}
            className={`px-2 py-1 rounded-md text-[10px] font-mono border cursor-pointer transition ${
              multiXrayMode
                ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 font-bold'
                : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-white'
            }`}
            title="Toggle PCB X-Ray mode across all realistic 3D C9300 switches in the scene"
          >
            PCB X-Ray: {multiXrayMode ? 'On' : 'Off'}
          </button>

          <button
            type="button"
            onClick={() => setMultiExplode((prev) => (prev === 0 ? 0.65 : 0))}
            className={`px-2 py-1 rounded-md text-[10px] font-mono border cursor-pointer transition ${
              multiExplode > 0
                ? 'bg-amber-500/20 text-amber-300 border-amber-500/40 font-bold'
                : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-white'
            }`}
            title="Explode top lid on all realistic 3D C9300 switches to inspect internal UADP ASIC, heatpipes & fans"
          >
            Explode Lid: {multiExplode > 0 ? 'Open' : 'Closed'}
          </button>

          {onSwitchToSingleChassis3D && (
            <button
              type="button"
              onClick={onSwitchToSingleChassis3D}
              className="px-2.5 py-1 rounded-md bg-slate-800 hover:bg-slate-700 text-sky-300 border border-sky-500/40 text-[11px] font-semibold flex items-center gap-1 cursor-pointer transition"
              title="Inspect the active switch's internal PCB, fans, PSUs & 24/48-port close-up"
            >
              <Box className="w-3.5 h-3.5" />
              Single Chassis 3D
            </button>
          )}

          <button
            type="button"
            onClick={() => setIsDrawerOpen(!isDrawerOpen)}
            className={`px-2.5 py-1 rounded-md text-[11px] font-semibold border flex items-center gap-1 cursor-pointer transition ${
              isDrawerOpen
                ? 'bg-amber-500/20 text-amber-200 border-amber-400/50'
                : 'bg-slate-900 text-slate-300 border-slate-700 hover:text-white'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            {isDrawerOpen ? 'Hide Drawer ▶' : '◀ Inspector'}
          </button>
        </div>
      </div>

      {/* ===================================================================
          MAIN 3D WEBGL CAMERA CANVAS + COLLAPSIBLE SLIDE-OVER DRAWER
         =================================================================== */}
      <div className="relative flex-1 min-h-0 flex overflow-hidden">
        {/* 3D WebGL Viewport (Expands to 100% width when drawer is collapsed) */}
        <div
          className="relative flex-1 h-full min-w-0"
          style={{ cursor: active3DDrag ? 'grabbing' : 'default' }}
        >
          <Canvas shadows dpr={[1, 2]}>
            <color attach="background" args={[bgColor]} />
            <fog attach="fog" args={[bgColor, 75, 220]} />

            <PerspectiveCamera makeDefault position={[-16, 21, 25]} fov={38} />
            <TopologyCameraRig
              cameraPreset={cameraPreset}
              focusTarget={focusTarget}
              controlsRef={controlsRef}
            />
            <OrbitControls
              ref={controlsRef}
              enableDamping
              dampingFactor={0.07}
              maxPolarAngle={Math.PI / 2 - 0.03}
              minDistance={4}
              maxDistance={175}
            />

            {/* Studio Architectural & Hardware Faceplate Lighting */}
            <ambientLight intensity={1.1} />
            <hemisphereLight args={['#e2e8f0', '#0f172a', 0.9]} />
            <directionalLight
              position={[16, 28, 18]}
              intensity={1.7}
              castShadow
              shadow-mapSize={[2048, 2048]}
            />
            {/* Front faceplate key light so metallic RJ-45 cages, port numbers, and C9300-NM-8X pop cleanly */}
            <directionalLight position={[0, 10, 26]} intensity={1.35} color="#f8fafc" />
            <directionalLight position={[-18, 18, -14]} intensity={0.85} color="#38bdf8" />
            <pointLight position={[-6, 6, 4]} intensity={1.2} color="#10b981" distance={24} />
            <pointLight position={[6, 6, -2]} intensity={0.95} color="#38bdf8" distance={24} />

            {/* Invisible Full-Floor Raycast Plane Active During 3D Base/Device Drag */}
            {active3DDrag && (
              <mesh
                position={[0, 0.2, 0]}
                rotation={[-Math.PI / 2, 0, 0]}
                onPointerMove={handleFloorPointerMove3D}
              >
                <planeGeometry args={[260, 260]} />
                <meshBasicMaterial transparent opacity={0} depthWrite={false} />
              </mesh>
            )}

            {/* Blueprint Engineering Floor Grid */}
            <Grid
              position={[0, -0.18, 12]}
              args={[220, 220]}
              cellSize={1.5}
              cellThickness={0.6}
              cellColor="#1e3a5f"
              sectionSize={6}
              sectionThickness={1.2}
              sectionColor="#0284c7"
              fadeDistance={210}
              fadeStrength={1.2}
            />

            {/* ===============================================================
                TOP-LEFT BASE: VANCOUVER CAMPUS (CANADA)
                (V-CORE + V-FG1 & V-FG2 + ASA/ASR + 2x NCS)
               =============================================================== */}
            <group ref={registerPadGroupRef('vancZone')}>
              <ZonePlatform3D
                padId="vancZone"
                position={[positions.vancPadCfg.cx, 0, positions.vancPadCfg.cz]}
                size={[positions.vancPadCfg.w, 0.36, positions.vancPadCfg.d]}
                baseColor="#1a1228"
                rimColor="#38bdf8"
                title="VANCOUVER CAMPUS (CANADA) • V-CORE & FORTIGATE HA"
                subtitle="V-CORE • V-FG1 & V-FG2 • ASA/ASR • 2× NCS Carrier Edge"
                showZoneTitles={showZoneTitles}
                isDraggingThisPad={active3DDrag?.kind === 'pad' && active3DDrag?.id === 'vancZone'}
                isParentOfDraggedDevice={false}
                onStartPadDrag={handleStartPadDrag3D}
              />
              {positions.infraNodes
                .filter((infra) => infra.siteCode === 'VancOakridge')
                .map((infra) => (
                  <InfraApplianceNode3D
                    key={infra.id}
                    node={infra}
                    position={infra.pos}
                    isSelected={activeEntity?.id === infra.id}
                    onSelect={handleSelectEntity}
                    labelMode={labelMode}
                  />
                ))}
            </group>

            {/* ===============================================================
                TOP-RIGHT BASE: US COLOCATION (165 HALSEY ST NEWARK)
                (H-CORE Nexus 7706 + FG-1 & FG-2 + NCS-5504 + Fort D-1 & D-2)
               =============================================================== */}
            <group ref={registerPadGroupRef('coloZone')}>
              <ZonePlatform3D
                padId="coloZone"
                position={[positions.coloPadCfg.cx, 0, positions.coloPadCfg.cz]}
                size={[positions.coloPadCfg.w, 0.36, positions.coloPadCfg.d]}
                baseColor="#19102c"
                rimColor="#a855f7"
                title="165 HALSEY US COLOCATION • H-CORE (TOP APEX OF US TRIANGLE)"
                subtitle="hcore(FXS1836Q2KE) Nexus 7706 • FG-1 & FG-2 • NCS-5504 • Fort D-1 & D-2"
                showZoneTitles={showZoneTitles}
                isDraggingThisPad={active3DDrag?.kind === 'pad' && active3DDrag?.id === 'coloZone'}
                isParentOfDraggedDevice={
                  active3DDrag?.kind === 'device' && active3DDrag?.padId === 'coloZone'
                }
                onStartPadDrag={handleStartPadDrag3D}
              />

              {hcoreNode && (
                <CoreChassis9606R3D
                  deviceId="hcoreNode"
                  node={hcoreNode}
                  position={positions.hcorePos}
                  isSelected={activeEntity?.id === hcoreNode.id}
                  isDragging={false}
                  onSelect={handleSelectEntity}
                  onOpenHwDrawer={onOpenHwDrawer}
                  labelMode={labelMode}
                />
              )}

              {positions.infraNodes
                .filter((infra) => infra.siteCode === 'Halsey165' && infra.kind !== 'adva')
                .map((infra) => (
                  <InfraApplianceNode3D
                    key={infra.id}
                    node={infra}
                    position={infra.pos}
                    isSelected={activeEntity?.id === infra.id}
                    onSelect={handleSelectEntity}
                    labelMode={labelMode}
                  />
                ))}
            </group>

            {/* ===============================================================
                MIDDLE-LEFT BASE: FLORHAM CAMPUS CORE & DATA CENTER 2 (M-CORE)
                (mcore-9600 + M-FG-1 & M-FG-2 + DC2-9500 + Flo-WLC-1/2 + ISE)
               =============================================================== */}
            <group ref={registerPadGroupRef('mcoreZone')}>
              <ZonePlatform3D
                padId="mcoreZone"
                position={[positions.mcoreZoneBox.cx, 0, positions.mcoreZoneBox.cz]}
                size={[positions.mcoreZoneBox.w, 0.36, positions.mcoreZoneBox.d]}
                baseColor="#17162e"
                rimColor="#38bdf8"
                title={`M-CORE • FLORHAM CAMPUS CORE & DC2 (${(mcoreNode ? 1 : 0) + positions.mcorePeerPositions.length} SWITCHES)`}
                subtitle="mcore-9600 (132.238.129.40) + M-FG-1/2 + DC2-9500 + WLCs • Florham Buildings Below"
                showZoneTitles={showZoneTitles}
                isDraggingThisPad={active3DDrag?.kind === 'pad' && active3DDrag?.id === 'mcoreZone'}
                isParentOfDraggedDevice={
                  active3DDrag?.kind === 'device' && active3DDrag?.padId === 'mcoreZone'
                }
                onStartPadDrag={handleStartPadDrag3D}
                onClickTitle={
                  onSelectBuildingFilter
                    ? () =>
                        onSelectBuildingFilter(
                          selectedBuildingFilter === 'CORE' ? 'ALL' : 'CORE'
                        )
                    : undefined
                }
              />

              {mcoreNode && (
                <group ref={registerDeviceGroupRef('mcoreNode')}>
                  <CoreChassis9606R3D
                    deviceId="mcoreNode"
                    node={mcoreNode}
                    position={positions.mcorePos}
                    isSelected={activeEntity?.id === mcoreNode.id}
                    isDragging={active3DDrag?.kind === 'device' && active3DDrag?.id === 'mcoreNode'}
                    onSelect={handleSelectEntity}
                    onStartDeviceDrag={handleStartDeviceDrag3D}
                    onOpenHwDrawer={onOpenHwDrawer}
                    labelMode={labelMode}
                  />
                </group>
              )}

              {positions.infraNodes
                .filter((infra) => infra.siteCode === 'Florham')
                .map((infra) => (
                  <InfraApplianceNode3D
                    key={infra.id}
                    node={infra}
                    position={infra.pos}
                    isSelected={activeEntity?.id === infra.id}
                    onSelect={handleSelectEntity}
                    labelMode={labelMode}
                  />
                ))}

              {positions.mcorePeerPositions.map(({ sw, pos }) => {
                const useCompact = positions.additionalSwitchPositions.length > 18;
                return (
                  <SwitchC9300Node3D
                    key={sw.id}
                    node={sw}
                    position={pos}
                    portsData={
                      useCompact
                        ? []
                        : buildSwitchPortsFor3DNode(sw, savedDevices, parsedSwitchData)
                    }
                    isSelected={activeEntity?.id === sw.id}
                    isActiveChassis={parsedSwitchData?.device?.hostname === sw.hostname}
                    onSelect={handleSelectEntity}
                    onOpenHwDrawer={onOpenHwDrawer}
                    labelMode={labelMode}
                    xrayMode={multiXrayMode}
                    explodeFactor={multiExplode}
                    useCompactMesh={useCompact}
                  />
                );
              })}
            </group>

            {/* ===============================================================
                MIDDLE-RIGHT BASE: METROPOLITAN CAMPUS CORE & DATA CENTER 1 (T-CORE)
                (tcore-9600 + T-FG-1 & T-FG-2 + DC1-9500 + DC1-9300-NET + WLCs)
               =============================================================== */}
            <group ref={registerPadGroupRef('coreZone')}>
              <ZonePlatform3D
                padId="coreZone"
                position={[positions.coreZoneBox.cx, 0, positions.coreZoneBox.cz]}
                size={[positions.coreZoneBox.w, 0.36, positions.coreZoneBox.d]}
                baseColor="#17162e"
                rimColor="#fb923c"
                title={`T-CORE • METROPOLITAN CAMPUS CORE & DC1 (${(coreNode ? 1 : 0) + positions.corePeerPositions.length} SWITCHES)`}
                subtitle="tcore-9600 (132.238.1.40) + T-FG-1/2 + DC1-9500/9300 + WLCs • Metro Buildings Below"
                showZoneTitles={showZoneTitles}
                isDraggingThisPad={active3DDrag?.kind === 'pad' && active3DDrag?.id === 'coreZone'}
                isParentOfDraggedDevice={
                  active3DDrag?.kind === 'device' && active3DDrag?.padId === 'coreZone'
                }
                onStartPadDrag={handleStartPadDrag3D}
                onClickTitle={
                  onSelectBuildingFilter
                    ? () =>
                        onSelectBuildingFilter(
                          selectedBuildingFilter === 'CORE' ? 'ALL' : 'CORE'
                        )
                    : undefined
                }
              />

              {coreNode && (
                <group ref={registerDeviceGroupRef('coreNode')}>
                  <CoreChassis9606R3D
                    deviceId="coreNode"
                    node={coreNode}
                    position={positions.corePos}
                    isSelected={activeEntity?.id === coreNode.id}
                    isDragging={active3DDrag?.kind === 'device' && active3DDrag?.id === 'coreNode'}
                    onSelect={handleSelectEntity}
                    onStartDeviceDrag={handleStartDeviceDrag3D}
                    onOpenHwDrawer={onOpenHwDrawer}
                    labelMode={labelMode}
                  />
                </group>
              )}

              {positions.infraNodes
                .filter((infra) => infra.siteCode === 'Metro' && infra.kind !== 'adva')
                .map((infra) => (
                  <InfraApplianceNode3D
                    key={infra.id}
                    node={infra}
                    position={infra.pos}
                    isSelected={activeEntity?.id === infra.id}
                    onSelect={handleSelectEntity}
                    labelMode={labelMode}
                  />
                ))}

              {positions.corePeerPositions.map(({ sw, pos }) => {
                const useCompact = positions.additionalSwitchPositions.length > 18;
                return (
                  <SwitchC9300Node3D
                    key={sw.id}
                    node={sw}
                    position={pos}
                    portsData={
                      useCompact
                        ? []
                        : buildSwitchPortsFor3DNode(sw, savedDevices, parsedSwitchData)
                    }
                    isSelected={activeEntity?.id === sw.id}
                    isActiveChassis={parsedSwitchData?.device?.hostname === sw.hostname}
                    onSelect={handleSelectEntity}
                    onOpenHwDrawer={onOpenHwDrawer}
                    labelMode={labelMode}
                    xrayMode={multiXrayMode}
                    explodeFactor={multiExplode}
                    useCompactMesh={useCompact}
                  />
                );
              })}
            </group>

            {/* ===============================================================
                ADVA FSP 3000 OPTICAL DWDM SHELVES ON THE 3 US CORE TRIANGLE LEGS
               =============================================================== */}
            {positions.infraNodes
              .filter((infra) => infra.kind === 'adva')
              .map((infra) => (
                <InfraApplianceNode3D
                  key={infra.id}
                  node={infra}
                  position={infra.pos}
                  isSelected={activeEntity?.id === infra.id}
                  onSelect={handleSelectEntity}
                  labelMode={labelMode}
                />
              ))}

            {/* ===============================================================
                METRO BUILDING BASE: BANCROFT HALL (BAN)
                (T-BAN-2FL-WL + WorkStudy + T-BAN-3FL-WL + T-BAN-DC-WL + Merakis)
               =============================================================== */}
            <group ref={registerPadGroupRef('switchZone')}>
              <ZonePlatform3D
                padId="switchZone"
                position={[positions.switchZoneBox.cx, 0, positions.switchZoneBox.cz]}
                size={[positions.switchZoneBox.w, 0.36, positions.switchZoneBox.d]}
                baseColor="#091d34"
                rimColor="#10b981"
                title={`BAN • BANCROFT HALL (${(wlNode ? 1 : 0) + (workStudyNode ? 1 : 0) + positions.banExtraPositions.length} SWITCHES)`}
                subtitle="2 Polled C9300-24UX + 4 Discovered Bancroft Switches • Click Plaque to Filter BAN"
                showZoneTitles={showZoneTitles}
                isDraggingThisPad={
                  active3DDrag?.kind === 'pad' && active3DDrag?.id === 'switchZone'
                }
                isParentOfDraggedDevice={
                  active3DDrag?.kind === 'device' && active3DDrag?.padId === 'switchZone'
                }
                onStartPadDrag={handleStartPadDrag3D}
                onClickTitle={
                  onSelectBuildingFilter
                    ? () =>
                        onSelectBuildingFilter(
                          selectedBuildingFilter === 'BAN' ? 'ALL' : 'BAN'
                        )
                    : undefined
                }
              />

              {wlNode && (
                <group ref={registerDeviceGroupRef('wlNode')}>
                  <SwitchC9300Node3D
                    deviceId="wlNode"
                    node={wlNode}
                    position={positions.wlPos}
                    portsData={buildSwitchPortsFor3DNode(wlNode, savedDevices, parsedSwitchData)}
                    isSelected={activeEntity?.id === wlNode.id}
                    isDragging={active3DDrag?.kind === 'device' && active3DDrag?.id === 'wlNode'}
                    isActiveChassis={parsedSwitchData?.device?.hostname === wlNode.hostname}
                    onSelect={handleSelectEntity}
                    onStartDeviceDrag={handleStartDeviceDrag3D}
                    onOpenHwDrawer={onOpenHwDrawer}
                    labelMode={labelMode}
                    xrayMode={multiXrayMode}
                    explodeFactor={multiExplode}
                  />
                </group>
              )}

              {workStudyNode && (
                <group ref={registerDeviceGroupRef('wsNode')}>
                  <SwitchC9300Node3D
                    deviceId="wsNode"
                    node={workStudyNode}
                    position={positions.wsPos}
                    portsData={buildSwitchPortsFor3DNode(workStudyNode, savedDevices, parsedSwitchData)}
                    isSelected={activeEntity?.id === workStudyNode.id}
                    isDragging={active3DDrag?.kind === 'device' && active3DDrag?.id === 'wsNode'}
                    isActiveChassis={parsedSwitchData?.device?.hostname === workStudyNode.hostname}
                    onSelect={handleSelectEntity}
                    onStartDeviceDrag={handleStartDeviceDrag3D}
                    onOpenHwDrawer={onOpenHwDrawer}
                    labelMode={labelMode}
                    xrayMode={multiXrayMode}
                    explodeFactor={multiExplode}
                  />
                </group>
              )}

              {positions.banExtraPositions.map(({ sw, pos }) => {
                const useCompact = positions.additionalSwitchPositions.length > 18;
                return (
                  <SwitchC9300Node3D
                    key={sw.id}
                    node={sw}
                    position={pos}
                    portsData={
                      useCompact
                        ? []
                        : buildSwitchPortsFor3DNode(sw, savedDevices, parsedSwitchData)
                    }
                    isSelected={activeEntity?.id === sw.id}
                    isActiveChassis={parsedSwitchData?.device?.hostname === sw.hostname}
                    onSelect={handleSelectEntity}
                    onOpenHwDrawer={onOpenHwDrawer}
                    labelMode={labelMode}
                    xrayMode={multiXrayMode}
                    explodeFactor={multiExplode}
                    useCompactMesh={useCompact}
                  />
                );
              })}
            </group>

            {/* ===============================================================
                FLORHAM CAMPUS (SOUTH-WEST UNDER M-CORE) & METRO CAMPUS (SOUTH-EAST UNDER T-CORE)
                INDIVIDUAL CAMPUS BUILDING BASES
               =============================================================== */}
            {positions.buildingBases.map((bldg) => {
              const useCompact = positions.additionalSwitchPositions.length > 18;
              const campusTag = bldg.siteCode === 'Florham' ? 'FLORHAM' : 'METRO';
              return (
                <group key={bldg.padId} ref={registerPadGroupRef(bldg.padId)}>
                  <ZonePlatform3D
                    padId={bldg.padId}
                    position={[bldg.cx, 0, bldg.cz]}
                    size={[bldg.w, 0.36, bldg.d]}
                    baseColor={bldg.theme.baseColor}
                    rimColor={bldg.theme.rimColor}
                    title={`[${campusTag}] ${bldg.code} • ${bldg.label.toUpperCase()} (${bldg.switches.length} SWITCH${bldg.switches.length === 1 ? '' : 'ES'})`}
                    subtitle={`Connected to ${bldg.siteCode === 'Florham' ? 'mcore-9600 (Florham)' : 'tcore-9600 (Metro)'} • Click Plaque to Filter ${bldg.code}`}
                    showZoneTitles={showZoneTitles}
                    isDraggingThisPad={
                      active3DDrag?.kind === 'pad' && active3DDrag?.id === bldg.padId
                    }
                    isParentOfDraggedDevice={false}
                    onStartPadDrag={handleStartPadDrag3D}
                    onClickTitle={
                      onSelectBuildingFilter
                        ? () =>
                            onSelectBuildingFilter(
                              selectedBuildingFilter === bldg.code ? 'ALL' : bldg.code
                            )
                        : undefined
                    }
                  />

                  {bldg.switchPositions.map(({ sw, pos }) => (
                    <SwitchC9300Node3D
                      key={sw.id}
                      node={sw}
                      position={pos}
                      portsData={
                        useCompact
                          ? []
                          : buildSwitchPortsFor3DNode(sw, savedDevices, parsedSwitchData)
                      }
                      isSelected={activeEntity?.id === sw.id}
                      isActiveChassis={parsedSwitchData?.device?.hostname === sw.hostname}
                      onSelect={handleSelectEntity}
                      onOpenHwDrawer={onOpenHwDrawer}
                      labelMode={labelMode}
                      xrayMode={multiXrayMode}
                      explodeFactor={multiExplode}
                      useCompactMesh={useCompact}
                    />
                  ))}
                </group>
              );
            })}

            {/* ===============================================================
                ZONE PAD 3: WI-FI 6 UPOE ACCESS LAYER FLEET (7 APs • 194.0W)
               =============================================================== */}
            <group ref={registerPadGroupRef('apZone')}>
              <ZonePlatform3D
                padId="apZone"
                position={[layout3D.pads.apZone.cx, 0, layout3D.pads.apZone.cz]}
                size={[layout3D.pads.apZone.w, 0.36, layout3D.pads.apZone.d]}
                baseColor="#081c29"
                rimColor="#38bdf8"
                title="BANCROFT WI-FI 6 UPOE ACCESS FLEET (7× CATALYST APs • 194.0W)"
                subtitle="6× C9130AXI-B (30W) + 1× C9105AXW-B Sniffer (14W)"
                showZoneTitles={showZoneTitles}
                isDraggingThisPad={active3DDrag?.kind === 'pad' && active3DDrag?.id === 'apZone'}
                isParentOfDraggedDevice={
                  active3DDrag?.kind === 'device' && active3DDrag?.padId === 'apZone'
                }
                onStartPadDrag={handleStartPadDrag3D}
              />

              {positions.apPositions.map(({ deviceId, ap, pos }) => (
                <group key={ap.hostname} ref={registerDeviceGroupRef(deviceId)}>
                  <WirelessApNode3D
                    deviceId={deviceId}
                    ap={ap}
                    position={pos}
                    isSelected={activeEntity?.id === ap.hostname}
                    isDragging={active3DDrag?.kind === 'device' && active3DDrag?.id === deviceId}
                    onSelect={handleSelectEntity}
                    onStartDeviceDrag={handleStartDeviceDrag3D}
                    labelMode={labelMode}
                  />
                </group>
              ))}
            </group>

            {/* ===============================================================
                3D GLOWING FIBER, ADVA DWDM, MGIG TRUNK & UPOE CONDUITS
               =============================================================== */}
            {conduits3D.map((lnk) => (
              <ConduitLink3D
                key={lnk.id}
                link={lnk}
                startPos={lnk.startPos}
                endPos={lnk.endPos}
                color={lnk.color}
                radius={lnk.radius}
                isSelected={activeEntity?.id === lnk.id}
                onSelect={handleSelectEntity}
                showLinkBadges={showLinkBadges}
              />
            ))}

            <ContactShadows
              position={[0, -0.15, 0]}
              opacity={0.55}
              scale={44}
              blur={2.2}
              far={12}
              frames={1}
            />
          </Canvas>

          {/* Bottom-Left Compact 3D Legend & Drag Instructions Pill */}
          <div className="absolute bottom-3 left-3 flex flex-wrap items-center gap-3 px-3 py-1.5 rounded-xl bg-slate-950/90 border border-slate-800/90 text-[11px] font-mono backdrop-blur-md pointer-events-none">
            <span className="text-sky-300 font-bold">
              ✥ Drag Any 3D Square Base or Device (Auto-Saves to SQL) • Click Device to Hover Info • Drag Empty Space to Orbit
            </span>
            <span className="flex items-center gap-1 text-amber-300">
              <span className="w-2.5 h-1.5 rounded bg-orange-500 inline-block" /> 25G Fiber Core Uplinks
            </span>
            <span className="flex items-center gap-1 text-emerald-300">
              <span className="w-2.5 h-1.5 rounded bg-emerald-500 inline-block" /> Verified 10G Switch Trunk
            </span>
            <span className="flex items-center gap-1 text-sky-300">
              <span className="w-2.5 h-1.5 rounded bg-sky-400 inline-block" /> mGig UPOE (7 APs)
            </span>
          </div>
        </div>

        {/* ===================================================================
             COLLAPSIBLE CLICK-TO-INSPECT DEVICE & INTERCONNECT DRAWER
            (Displays Physical Interconnects, Hardware Specs, or 300-Neighbor Building Clusters)
           =================================================================== */}
        {isDrawerOpen && (
          <aside className="w-full sm:w-[390px] xl:w-[420px] h-full bg-slate-950/95 border-l border-slate-800 flex flex-col overflow-hidden shrink-0 z-20 shadow-2xl">
            {/* Drawer Header */}
            <div className="p-3 bg-slate-900/90 border-b border-slate-800 flex items-center justify-between gap-2">
              <div className="min-w-0">
                <div className="text-[10px] font-mono uppercase tracking-wider text-cyan-400 font-bold">
                  3D Topology Selection Inspector
                </div>
                <h3 className="text-sm font-bold text-white truncate font-mono">
                  {activeEntity?.type === 'device'
                    ? activeEntity.data.hostname
                    : activeEntity?.type === 'ap'
                    ? activeEntity.data.hostname
                    : activeEntity?.type === 'link'
                    ? activeEntity.data.badgeTitle
                    : activeEntity?.type === 'site'
                    ? `${activeEntity.data.flag} ${activeEntity.data.name}`
                    : 'Select any 3D Device or Link'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsDrawerOpen(false)}
                className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-mono cursor-pointer shrink-0"
                title="Collapse drawer to maximize 3D camera real estate"
              >
                Collapse ▶
              </button>
            </div>

            {/* 3-Tab Switcher inside Drawer: Interconnects | Hardware Info | Building Clusters (300+ CDP Ready) */}
            <div className="grid grid-cols-3 gap-1 p-2 bg-slate-950 border-b border-slate-800 text-[11px] font-mono">
              <button
                type="button"
                onClick={() => setDrawerTab('interconnects')}
                className={`py-1.5 px-2 rounded font-semibold cursor-pointer transition ${
                  drawerTab === 'interconnects'
                    ? 'bg-emerald-600 text-white'
                    : 'bg-slate-900 text-slate-400 hover:text-white'
                }`}
              >
                Interconnects
              </button>
              <button
                type="button"
                onClick={() => setDrawerTab('hardware')}
                className={`py-1.5 px-2 rounded font-semibold cursor-pointer transition ${
                  drawerTab === 'hardware'
                    ? 'bg-sky-600 text-white'
                    : 'bg-slate-900 text-slate-400 hover:text-white'
                }`}
              >
                Hardware &amp; CLI
              </button>
              <button
                type="button"
                onClick={() => setDrawerTab('clusters')}
                className={`py-1.5 px-2 rounded font-semibold cursor-pointer transition ${
                  drawerTab === 'clusters'
                    ? 'bg-purple-600 text-white'
                    : 'bg-slate-900 text-slate-400 hover:text-white'
                }`}
              >
                Pods ({globalGraph.nodes.length})
              </button>
            </div>

            {/* Drawer Body */}
            <div className="flex-1 overflow-y-auto p-3.5 space-y-3 text-xs">
              {/* =============================================================
                  ENTITY TYPE: SWITCH OR CORE DEVICE SELECTED IN 3D
                 ============================================================= */}
              {activeEntity?.type === 'device' && (
                <>
                  {/* Quick Action Bar for Selected Switch */}
                  <div className="flex flex-wrap items-center justify-between gap-2 p-2.5 rounded-xl bg-slate-900/90 border border-slate-800">
                    <div>
                      <span className="text-[10px] font-mono uppercase text-slate-400 block">
                        Status in PostgreSQL
                      </span>
                      {activeEntity.data.isPolled ? (
                        <span className="text-xs font-mono font-bold text-emerald-400 flex items-center gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5" /> Polled &amp; Stored ({activeEntity.data.serialNumber})
                        </span>
                      ) : (
                        <span className="text-xs font-mono font-bold text-amber-300">
                          Discovered via CDP ({activeEntity.data.mgmtIp})
                        </span>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-1.5">
                      {onOpenHwDrawer && (
                        <button
                          type="button"
                          onClick={() => onOpenHwDrawer(activeEntity.data.serialNumber)}
                          className="px-2 py-1.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/35 text-amber-200 border border-amber-400/50 font-mono text-[11px] font-bold flex items-center gap-1 cursor-pointer transition"
                          title="Open Hardware & Port Inspector Drawer for this device"
                        >
                          <PanelRightOpen className="w-3.5 h-3.5" />
                          HW Drawer
                        </button>
                      )}
                      {activeEntity.data.isPolled && activeEntity.data.serialNumber && (
                        <button
                          type="button"
                          onClick={() => {
                            if (onSelectSavedDevice) {
                              onSelectSavedDevice(activeEntity.data.serialNumber);
                            }
                            if (onSwitchToSingleChassis3D) {
                              onSwitchToSingleChassis3D();
                            }
                          }}
                          className="px-2.5 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-500 text-white font-mono text-[11px] font-bold cursor-pointer transition"
                        >
                          Single 3D
                        </button>
                      )}
                      {onPollNeighbor && activeEntity.data.mgmtIp && (
                        <button
                          type="button"
                          onClick={() =>
                            onPollNeighbor(
                              activeEntity.data.mgmtIp,
                              activeEntity.data.hostname
                            )
                          }
                          className="px-2.5 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-mono text-[11px] font-bold cursor-pointer transition"
                        >
                          {activeEntity.data.isPolled ? 'Re-Poll SSH' : 'Poll via SSH'}
                        </button>
                      )}
                    </div>
                  </div>

                  {drawerTab === 'interconnects' && (
                    <div className="space-y-3">
                      {/* Switch-to-Switch Trunks & Uplinks */}
                      <div>
                        <div className="text-[10px] font-mono uppercase tracking-wider text-emerald-400 font-bold mb-1.5">
                          Switch-to-Switch Physical Interconnects ({activeEntity.data.switchLinks?.length || 0})
                        </div>
                        <div className="space-y-2">
                          {(activeEntity.data.switchLinks || []).map((lnk, idx) => (
                            <div
                              key={idx}
                              className="p-2.5 rounded-lg bg-slate-900/90 border border-emerald-500/35 space-y-1 font-mono"
                            >
                              <div className="flex items-center justify-between text-[11px]">
                                <span className="text-emerald-300 font-bold">
                                  {lnk.localPort} ↔ {lnk.remotePort}
                                </span>
                                <span className="px-1.5 py-0.5 rounded bg-slate-950 text-sky-300 text-[10px]">
                                  {lnk.speed || '10G/25G Trunk'}
                                </span>
                              </div>
                              <div className="text-xs font-bold text-white">
                                → {lnk.remoteHostname} ({lnk.remoteIp || 'CDP'})
                              </div>
                              {lnk.allowedVlans && (
                                <div className="text-[10px] text-purple-300">
                                  Native VLAN {lnk.nativeVlan || 1} • Allowed: {lnk.allowedVlans}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Connected Wi-Fi 6 APs / PoE Endpoints */}
                      {activeEntity.data.attachedEndpoints?.length > 0 && (
                        <div>
                          <div className="text-[10px] font-mono uppercase tracking-wider text-sky-400 font-bold mb-1.5">
                            Connected Wi-Fi 6 APs &amp; PoE Endpoints ({activeEntity.data.attachedEndpoints.length})
                          </div>
                          <div className="space-y-1.5">
                            {activeEntity.data.attachedEndpoints.map((ep, idx) => (
                              <div
                                key={idx}
                                onClick={() => {
                                  const foundAp = positions.apPositions.find(
                                    (a) => a.ap.hostname === ep.hostname
                                  );
                                  if (foundAp) {
                                    handleSelectEntity({
                                      type: 'ap',
                                      data: ep,
                                      id: ep.hostname,
                                      pos: foundAp.pos
                                    });
                                  }
                                }}
                                className="p-2 rounded-lg bg-slate-900/75 hover:bg-slate-800 border border-slate-800 flex items-center justify-between font-mono text-[11px] cursor-pointer transition"
                              >
                                <div>
                                  <span className="text-sky-400 font-bold">{ep.localPort}</span> →{' '}
                                  <span className="text-white font-semibold">{ep.hostname}</span>
                                  <div className="text-[10px] text-slate-400">
                                    {ep.model} • {ep.ip}
                                  </div>
                                </div>
                                <span className="px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30 text-[10px]">
                                  ⚡ {ep.poeWatts}W
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {drawerTab === 'hardware' && (
                    <div className="space-y-2.5 font-mono">
                      <div className="grid grid-cols-2 gap-2">
                        <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800">
                          <span className="text-[10px] text-slate-400 block">Hardware Model</span>
                          <span className="text-xs font-bold text-sky-300">
                            {activeEntity.data.model}
                          </span>
                        </div>
                        <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800">
                          <span className="text-[10px] text-slate-400 block">Serial Number</span>
                          <span className="text-xs font-bold text-emerald-300">
                            {activeEntity.data.serialNumber || 'CDP Neighbor'}
                          </span>
                        </div>
                        <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800">
                          <span className="text-[10px] text-slate-400 block">Management IPv4</span>
                          <span className="text-xs font-bold text-white">
                            {activeEntity.data.mgmtIp}
                          </span>
                        </div>
                        <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800">
                          <span className="text-[10px] text-slate-400 block">IOS-XE Version</span>
                          <span className="text-xs font-bold text-amber-300">
                            {formatShortIosVersion(activeEntity.data.iosVersion)}
                          </span>
                        </div>
                        <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800">
                          <span className="text-[10px] text-slate-400 block">Active PoE Draw</span>
                          <span className="text-xs font-bold text-amber-300">
                            {activeEntity.data.totalPoeWatts
                              ? `${activeEntity.data.totalPoeWatts.toFixed(1)} W`
                              : '0.0 W'}
                          </span>
                        </div>
                        <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800">
                          <span className="text-[10px] text-slate-400 block">Campus / Site</span>
                          <span className="text-xs font-bold text-purple-300">
                            {activeEntity.data.siteCode} ({activeEntity.data.role})
                          </span>
                        </div>
                      </div>

                      {activeEntity.data.uptime && (
                        <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800">
                          <span className="text-[10px] text-slate-400 block">System Uptime</span>
                          <span className="text-[11px] text-slate-200">
                            {activeEntity.data.uptime}
                          </span>
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}

              {/* =============================================================
                  ENTITY TYPE: 3D CONDUIT LINK SELECTED
                 ============================================================= */}
              {activeEntity?.type === 'link' && (
                <div className="space-y-2.5 font-mono">
                  <div className="p-3 rounded-xl bg-slate-900 border border-emerald-500/40 space-y-2">
                    <div className="text-xs font-bold text-emerald-300">
                      {activeEntity.data.badgeTitle}
                    </div>
                    <div className="text-[11px] text-slate-300">
                      {activeEntity.data.badgeSubtitle}
                    </div>
                    <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-800">
                      <div>
                        <span className="text-[10px] text-slate-400 block">Point A (Source)</span>
                        <span className="text-xs font-bold text-white">
                          {activeEntity.data.sourceHostname}
                        </span>
                        <span className="text-[11px] text-sky-300 block">
                          Port: {activeEntity.data.sourcePort}
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-400 block">Point B (Target)</span>
                        <span className="text-xs font-bold text-white">
                          {activeEntity.data.targetHostname}
                        </span>
                        <span className="text-[11px] text-emerald-300 block">
                          Port: {activeEntity.data.targetPort}
                        </span>
                      </div>
                    </div>
                    <div className="pt-2 border-t border-slate-800 flex items-center justify-between text-[11px]">
                      <span className="text-amber-300">Media: {activeEntity.data.speed}</span>
                      <span className="text-purple-300">Native VLAN: {activeEntity.data.nativeVlan}</span>
                    </div>
                    <div className="text-[10px] text-slate-300">
                      Allowed VLANs: <span className="text-emerald-300">{activeEntity.data.allowedVlans}</span>
                    </div>
                  </div>
                </div>
              )}

              {/* =============================================================
                  ENTITY TYPE: WI-FI 6 AP SELECTED IN 3D
                 ============================================================= */}
              {activeEntity?.type === 'ap' && (
                <div className="space-y-2.5 font-mono">
                  <div className="p-3 rounded-xl bg-slate-900 border border-sky-500/40 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 text-[10px] font-bold">
                        WI-FI 6 UPOE ACCESS POINT
                      </span>
                      <span className="text-amber-300 font-bold">⚡ {activeEntity.data.poeWatts}W</span>
                    </div>
                    <div className="text-sm font-bold text-white">{activeEntity.data.hostname}</div>
                    <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-800 text-[11px]">
                      <div>
                        <span className="text-[10px] text-slate-400 block">AP Model</span>
                        <span className="text-sky-300 font-bold">{activeEntity.data.model}</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-400 block">IPv4 Address</span>
                        <span className="text-emerald-300 font-bold">{activeEntity.data.ip}</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-400 block">Upstream Switch</span>
                        <span className="text-white font-bold">T-BAN-2FL-WL</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-400 block">Switch Port</span>
                        <span className="text-amber-300 font-bold">{activeEntity.data.localPort}</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* =============================================================
                  ENTITY TYPE: COLOCATION / CAMPUS SITE SELECTED IN 3D
                 ============================================================= */}
              {activeEntity?.type === 'site' && (
                <div className="space-y-2.5 font-mono">
                  <div className="p-3 rounded-xl bg-slate-900 border border-purple-500/40 space-y-2">
                    <div className="text-xs font-bold text-purple-300">
                      {activeEntity.data.flag} {activeEntity.data.name} ({activeEntity.data.code})
                    </div>
                    <div className="text-[11px] text-slate-300">
                      {activeEntity.data.description}
                    </div>
                    <div className="text-[10px] text-emerald-300">
                      Location: {activeEntity.data.location} • Target Scale: ~{activeEntity.data.targetDevices} Devices
                    </div>
                  </div>
                </div>
              )}

              {/* =============================================================
                  TAB 3: BUILDING / PREFIX CLUSTERS (READY FOR tcore / mcore 300+ NEIGHBORS)
                 ============================================================= */}
              {drawerTab === 'clusters' && (
                <div className="space-y-2.5">
                  <div className="p-2.5 rounded-lg bg-purple-950/30 border border-purple-500/30 text-[11px] text-purple-200">
                    <span className="font-bold block text-purple-300">
                      Scalable 300+ Neighbor Building Pod Architecture
                    </span>
                    As <code className="text-amber-300">tcore-9600</code> and <code className="text-amber-300">mcore</code> are polled (~300 CDP neighbors each), switches are automatically grouped by building prefix below so you can focus the 3D camera on any building pod.
                  </div>

                  <div className="flex items-center gap-1.5 bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5">
                    <Search className="w-3.5 h-3.5 text-slate-400" />
                    <input
                      type="text"
                      value={searchFilter}
                      onChange={(e) => setSearchFilter(e.target.value)}
                      placeholder="Filter building pod or switch..."
                      className="bg-transparent text-xs font-mono text-white focus:outline-none w-full"
                    />
                  </div>

                  <div className="space-y-2">
                    {buildingClusters
                      .filter(
                        (c) =>
                          !searchFilter ||
                          c.prefix.toLowerCase().includes(searchFilter.toLowerCase()) ||
                          c.switches.some((s) =>
                            s.hostname.toLowerCase().includes(searchFilter.toLowerCase())
                          )
                      )
                      .map((cluster) => (
                        <div
                          key={cluster.prefix}
                          className="p-2.5 rounded-xl bg-slate-900/90 border border-slate-800 space-y-1.5 font-mono"
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-white">
                              Building Pod: {cluster.prefix}
                            </span>
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300">
                              {cluster.switches.length} Switches • {cluster.apCount} APs
                            </span>
                          </div>
                          <div className="space-y-1">
                            {cluster.switches.map((sw) => (
                              <button
                                key={sw.id}
                                type="button"
                                onClick={() => {
                                  const targetPos = sw.hostname.includes('tcore')
                                    ? positions.corePos
                                    : sw.hostname.includes('WL')
                                    ? positions.wlPos
                                    : positions.wsPos;
                                  handleSelectEntity({
                                    type: 'device',
                                    data: sw,
                                    id: sw.id,
                                    pos: targetPos
                                  });
                                  setDrawerTab('interconnects');
                                }}
                                className="w-full text-left px-2 py-1 rounded bg-slate-950 hover:bg-slate-800 border border-slate-800/90 flex items-center justify-between text-[11px] cursor-pointer transition"
                              >
                                <span className="text-sky-300 font-semibold truncate">
                                  {sw.hostname}
                                </span>
                                <span className="text-[10px] text-slate-400 shrink-0 ml-2">
                                  {sw.mgmtIp}
                                </span>
                              </button>
                            ))}
                          </div>
                        </div>
                      ))}
                  </div>
                </div>
              )}
            </div>
          </aside>
        )}
      </div>
    </div>
  );
}
