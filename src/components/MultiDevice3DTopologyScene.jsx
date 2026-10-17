import React, { useRef, useState, useMemo } from 'react';
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
  Activity
} from 'lucide-react';
import {
  GLOBAL_SITES,
  ISP_PROVIDERS,
  buildGlobalAndSiteTopology
} from '../data/globalNetworkData';

/**
 * Smooth 3D Camera Controller for the Multi-Device 3D Network Topology Scene
 */
function TopologyCameraRig({ cameraPreset, focusTarget, controlsRef }) {
  const { camera } = useThree();
  const targetPos = useRef(new THREE.Vector3(0, 22, 28));
  const targetLookAt = useRef(new THREE.Vector3(0, 0, 0));
  const isTransitioning = useRef(false);
  const lastKey = useRef('');

  const presets = useMemo(
    () => ({
      'blueprint-iso': { pos: [-16, 21, 25], target: [0, 0.5, 0] },
      'metro-fabric': { pos: [-9, 13, 18], target: [-6.5, 1.0, 0.5] },
      'switch-trunks': { pos: [-6, 8.5, 13.5], target: [-6.5, 0.6, 3.2] },
      'wifi-fleet': { pos: [9, 12, 16], target: [6.5, 0.8, -1.5] },
      'top-blueprint': { pos: [0, 34, 0.01], target: [0, 0, 0] },
      'front-elevation': { pos: [0, 7, 29], target: [0, 1, 0] }
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
      targetPos.current.set(fx - 4.5, fy + 6.5, fz + 9.5);
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
 * Glowing 3D Isometric Zone Platform Pad (matches the reference blueprint pads in 3D space)
 */
function ZonePlatform3D({
  position,
  size = [12, 0.35, 14],
  baseColor = '#0c1938',
  rimColor = '#38bdf8',
  title,
  subtitle,
  showZoneTitles = false
}) {
  const [w, h, d] = size;
  return (
    <group position={position}>
      {/* Main 3D Architectural Slab */}
      <RoundedBox args={[w, h, d]} radius={0.14} smoothness={4} position={[0, -h / 2, 0]} receiveShadow>
        <meshStandardMaterial
          color={baseColor}
          metalness={0.45}
          roughness={0.35}
          transparent
          opacity={0.92}
        />
      </RoundedBox>

      {/* Glowing Neon Top Perimeter Frame */}
      <mesh position={[0, 0.01, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[Math.min(w, d) * 0.48, Math.min(w, d) * 0.495, 4]} />
        <meshBasicMaterial color={rimColor} transparent opacity={0.15} />
      </mesh>

      {/* 4 Glowing Perimeter Edge Bars */}
      <mesh position={[0, 0.02, d / 2 - 0.05]}>
        <boxGeometry args={[w - 0.1, 0.05, 0.08]} />
        <meshStandardMaterial color={rimColor} emissive={rimColor} emissiveIntensity={1.6} />
      </mesh>
      <mesh position={[0, 0.02, -d / 2 + 0.05]}>
        <boxGeometry args={[w - 0.1, 0.05, 0.08]} />
        <meshStandardMaterial color={rimColor} emissive={rimColor} emissiveIntensity={1.2} />
      </mesh>
      <mesh position={[-w / 2 + 0.05, 0.02, 0]}>
        <boxGeometry args={[0.08, 0.05, d - 0.1]} />
        <meshStandardMaterial color={rimColor} emissive={rimColor} emissiveIntensity={1.4} />
      </mesh>
      <mesh position={[w / 2 - 0.05, 0.02, 0]}>
        <boxGeometry args={[0.08, 0.05, d - 0.1]} />
        <meshStandardMaterial color={rimColor} emissive={rimColor} emissiveIntensity={1.4} />
      </mesh>

      {/* Optional Zone Title Pill */}
      {showZoneTitles && title && (
        <Html position={[-w / 2 + 0.6, 0.12, d / 2 + 0.55]} center={false} zIndexRange={[5, 0]}>
          <div className="pointer-events-none select-none whitespace-nowrap px-2 py-0.5 rounded bg-slate-950/85 border border-slate-700/80 shadow">
            <div
              className="text-[9px] font-mono font-bold tracking-wider uppercase"
              style={{ color: rimColor }}
            >
              {title}
            </div>
            {subtitle && (
              <div className="text-[8px] font-mono text-slate-400">{subtitle}</div>
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

  const curve = useMemo(() => {
    const p0 = new THREE.Vector3(...startPos);
    const p3 = new THREE.Vector3(...endPos);
    const dist = p0.distanceTo(p3);
    const arcHeight = Math.min(1.6, Math.max(0.35, dist * 0.12));
    const p1 = new THREE.Vector3(p0.x, Math.max(p0.y, p3.y) + arcHeight, (p0.z * 2 + p3.z) / 3);
    const p2 = new THREE.Vector3(p3.x, Math.max(p0.y, p3.y) + arcHeight, (p0.z + p3.z * 2) / 3);
    return new THREE.CubicBezierCurve3(p0, p1, p2, p3);
  }, [startPos, endPos]);

  const tubeGeom = useMemo(() => {
    return new THREE.TubeGeometry(curve, 36, isSelected || hovered ? radius * 1.35 : radius, 12, false);
  }, [curve, radius, isSelected, hovered]);

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
 * 3D Cisco Catalyst C9606R Modular Core Chassis Tower
 */
function CoreChassis9606R3D({
  node,
  position,
  isSelected,
  onSelect,
  labelMode
}) {
  const [hovered, setHovered] = useState(false);
  const shortIos = formatShortIosVersion(node.iosVersion);
  const shortName = (node.hostname || 'tcore-9600').replace(/\.net\.fdu\.edu$/i, '');

  const visible =
    hovered ||
    isSelected ||
    labelMode === 'switches' ||
    labelMode === 'compact' ||
    labelMode === 'all';
  const showFullDetails = hovered || isSelected || labelMode === 'all' || labelMode === 'switches';

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
      {/* Selection / Hover Ring on Pad */}
      {(isSelected || hovered) && (
        <mesh position={[0, 0.05, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[2.1, 2.38, 32]} />
          <meshBasicMaterial color={isSelected ? '#38bdf8' : '#fb923c'} />
        </mesh>
      )}

      {/* 6-Slot Modular Core Chassis Main Tower */}
      <RoundedBox args={[3.2, 2.7, 2.6]} radius={0.12} smoothness={4} position={[0, 1.35, 0]} castShadow>
        <meshStandardMaterial
          color={isSelected ? '#1e3a5f' : hovered ? '#263859' : '#17253b'}
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

      {/* Floating Compact 3D Badge */}
      {visible && (
        <Html position={[0, 3.35, 0]} center zIndexRange={[25, 0]}>
          <div
            onClick={(e) => {
              e.stopPropagation();
              onSelect({ type: 'device', data: node, id: node.id, pos: position });
            }}
            className={`cursor-pointer select-none whitespace-nowrap px-2.5 py-1 rounded-lg border shadow-xl transition ${
              isSelected
                ? 'bg-amber-950/95 border-amber-300 ring-1 ring-amber-400/50'
                : 'bg-slate-950/90 border-amber-500/60 hover:border-amber-300'
            }`}
          >
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
              <span className="text-[11px] font-mono font-bold text-white">{shortName}</span>
              <span className="px-1 py-0.2 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40 text-[8px] font-mono font-bold">
                CORE
              </span>
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

/**
 * 3D Cisco Catalyst C9300 Switch Chassis inside the Multi-Device Topology Scene
 */
function SwitchC9300Node3D({
  node,
  position,
  isSelected,
  isActiveChassis,
  onSelect,
  labelMode
}) {
  const [hovered, setHovered] = useState(false);
  const accentColor = node.role === 'MDF / Distribution' ? '#38bdf8' : '#10b981';

  const visible =
    hovered ||
    isSelected ||
    labelMode === 'switches' ||
    labelMode === 'compact' ||
    labelMode === 'all';
  const showFullDetails = hovered || isSelected || labelMode === 'all' || labelMode === 'switches';

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
      {/* Selection / Active Halo on Floor */}
      {(isSelected || hovered || isActiveChassis) && (
        <mesh position={[0, 0.04, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[2.1, 2.38, 32]} />
          <meshBasicMaterial color={isSelected ? '#ffffff' : accentColor} />
        </mesh>
      )}

      {/* 1RU Elevated Pedestal Base */}
      <mesh position={[0, 0.25, 0]}>
        <boxGeometry args={[3.4, 0.5, 2.1]} />
        <meshStandardMaterial color="#091326" metalness={0.4} roughness={0.6} />
      </mesh>

      {/* Authentic 1RU Cisco Catalyst 9300 Sheet-Metal Enclosure */}
      <RoundedBox args={[3.8, 0.68, 2.4]} radius={0.08} smoothness={3} position={[0, 0.84, 0]} castShadow>
        <meshStandardMaterial
          color={isSelected ? '#2563eb' : hovered ? '#334155' : '#1e293b'}
          metalness={0.62}
          roughness={0.3}
        />
      </RoundedBox>

      {/* Top 4-Way Switching Arrows Emblem */}
      <mesh position={[0, 1.19, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[2.6, 1.3]} />
        <meshBasicMaterial color="#0f172a" transparent opacity={0.65} />
      </mesh>
      <mesh position={[0, 1.2, 0]}>
        <boxGeometry args={[1.8, 0.02, 0.14]} />
        <meshBasicMaterial color={accentColor} />
      </mesh>
      <mesh position={[0, 1.2, 0]}>
        <boxGeometry args={[0.14, 0.02, 1.0]} />
        <meshBasicMaterial color={accentColor} />
      </mesh>

      {/* Front Faceplate Bezel */}
      <mesh position={[0, 0.84, 1.21]}>
        <boxGeometry args={[3.68, 0.56, 0.03]} />
        <meshStandardMaterial color="#0b1324" roughness={0.5} />
      </mesh>

      {/* Left Blue UID Beacon LED */}
      <mesh position={[-1.65, 0.92, 1.24]}>
        <sphereGeometry args={[0.06, 12, 12]} />
        <meshBasicMaterial color="#38bdf8" />
      </mesh>

      {/* 24-Port Odd-Over-Even RJ45 Matrix with Live Port LEDs */}
      {Array.from({ length: 12 }, (_, colIdx) => {
        const x = -1.25 + colIdx * 0.17;
        const oddPortNum = colIdx * 2 + 1;
        const evenPortNum = oddPortNum + 1;
        const isOddUp = node.hostname?.includes('WL') ? [1, 5].includes(oddPortNum) : false;
        const isEvenUp = node.hostname?.includes('WL')
          ? [2, 4, 6, 8, 14, 20].includes(evenPortNum)
          : evenPortNum === 24;

        return (
          <group key={colIdx}>
            <mesh position={[x, 0.94, 1.23]}>
              <boxGeometry args={[0.12, 0.13, 0.03]} />
              <meshBasicMaterial color={isOddUp ? '#10b981' : '#1e293b'} />
            </mesh>
            <mesh position={[x, 0.74, 1.23]}>
              <boxGeometry args={[0.12, 0.13, 0.03]} />
              <meshBasicMaterial
                color={
                  evenPortNum === 20 || evenPortNum === 24
                    ? '#34d399'
                    : isEvenUp
                    ? '#10b981'
                    : '#1e293b'
                }
              />
            </mesh>
          </group>
        );
      })}

      {/* Right C9300-NM-8X Modular Uplink Bay */}
      <mesh position={[1.25, 0.84, 1.23]}>
        <boxGeometry args={[0.85, 0.36, 0.03]} />
        <meshBasicMaterial color="#090d16" />
      </mesh>
      {[0, 1, 2, 3].map((uIdx) => {
        const isSfpActive = node.hostname?.includes('WL') && (uIdx === 0 || uIdx === 1);
        return (
          <mesh key={uIdx} position={[0.96 + uIdx * 0.19, 0.84, 1.25]}>
            <boxGeometry args={[0.13, 0.16, 0.03]} />
            <meshBasicMaterial color={isSfpActive ? '#f97316' : '#334155'} />
          </mesh>
        );
      })}

      {/* Compact Non-Overlapping Floating 3D Badge */}
      {visible && (
        <Html position={[0, 1.75, 0]} center zIndexRange={[25, 0]}>
          <div
            onClick={(e) => {
              e.stopPropagation();
              onSelect({ type: 'device', data: node, id: node.id, pos: position });
            }}
            className={`cursor-pointer select-none whitespace-nowrap px-2.5 py-1 rounded-lg border shadow-xl transition ${
              isSelected
                ? 'bg-sky-950/95 border-white ring-1 ring-sky-400/60'
                : 'bg-slate-950/90 border-sky-500/60 hover:border-sky-300'
            }`}
          >
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
 * 3D Cisco Catalyst 9130AXI / 9105AXW Wi-Fi 6 Access Point Node
 */
function WirelessApNode3D({
  ap,
  position,
  isSelected,
  onSelect,
  labelMode
}) {
  const [hovered, setHovered] = useState(false);

  const visible = hovered || isSelected || labelMode === 'compact' || labelMode === 'all';
  const showFullDetails = hovered || isSelected || labelMode === 'all';

  return (
    <group
      position={position}
      onClick={(e) => {
        e.stopPropagation();
        onSelect({ type: 'ap', data: ap, id: ap.hostname, pos: position });
      }}
      onPointerOver={(e) => {
        e.stopPropagation();
        setHovered(true);
      }}
      onPointerOut={() => setHovered(false)}
    >
      {(isSelected || hovered) && (
        <mesh position={[0, 0.03, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.9, 1.08, 24]} />
          <meshBasicMaterial color="#10b981" />
        </mesh>
      )}

      {/* Rounded Square Cisco Catalyst 9130AXI AP Enclosure */}
      <RoundedBox args={[1.45, 0.32, 1.45]} radius={0.18} smoothness={4} position={[0, 0.22, 0]} castShadow>
        <meshStandardMaterial
          color={isSelected ? '#0284c7' : hovered ? '#334155' : '#1e293b'}
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
              isSelected
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
 * 3D Colocation / Regional Campus Node (Halsey165, Hastings, Florham, VancOakridge)
 */
function ColocationHub3D({
  site,
  position,
  isSelected,
  onSelect,
  labelMode
}) {
  const [hovered, setHovered] = useState(false);
  const color = site.country === 'CA' ? '#f43f5e' : '#a855f7';

  const visible = hovered || isSelected || labelMode === 'compact' || labelMode === 'all';
  const showFullDetails = hovered || isSelected || labelMode === 'all';

  return (
    <group
      position={position}
      onClick={(e) => {
        e.stopPropagation();
        onSelect({ type: 'site', data: site, id: site.code, pos: position });
      }}
      onPointerOver={(e) => {
        e.stopPropagation();
        setHovered(true);
      }}
      onPointerOut={() => setHovered(false)}
    >
      <RoundedBox args={[2.3, 1.25, 1.7]} radius={0.1} smoothness={3} position={[0, 0.65, 0]} castShadow>
        <meshStandardMaterial
          color={isSelected ? '#581c87' : hovered ? '#3b0764' : '#1e1b4b'}
          metalness={0.55}
          roughness={0.35}
        />
      </RoundedBox>
      <mesh position={[0, 1.29, 0]}>
        <boxGeometry args={[1.9, 0.03, 1.3]} />
        <meshBasicMaterial color={color} />
      </mesh>

      {visible && (
        <Html position={[0, 1.65, 0]} center zIndexRange={[20, 0]}>
          <div
            onClick={(e) => {
              e.stopPropagation();
              onSelect({ type: 'site', data: site, id: site.code, pos: position });
            }}
            className={`cursor-pointer select-none whitespace-nowrap px-2 py-0.5 rounded-md border shadow-lg transition ${
              isSelected
                ? 'bg-purple-950 border-white text-white'
                : 'bg-slate-950/90 border-purple-500/50 text-slate-100 hover:border-purple-300'
            }`}
          >
            <div className="text-[9.5px] font-mono font-bold text-purple-300">
              {site.flag} {site.code} • {site.type === 'colocation' ? 'Colo Hub' : 'Campus'}
            </div>
            {showFullDetails && (
              <div className="text-[8.5px] font-mono text-slate-300">{site.location}</div>
            )}
          </div>
        </Html>
      )}
    </group>
  );
}

/**
 * Main Export: Multi-Device 3D Network Topology Camera View + Collapsible Click-to-Inspect Drawer
 */
export default function MultiDevice3DTopologyScene({
  parsedSwitchData,
  savedDevices = [],
  onSelectSavedDevice,
  onPollNeighbor,
  onSwitchToSingleChassis3D,
  backdropBrightness = 0.25
}) {
  const controlsRef = useRef();
  const [cameraPreset, setCameraPreset] = useState('blueprint-iso');
  const [focusTarget, setFocusTarget] = useState(null);
  // 4 Label Display Modes:
  // 'hover'    (Hover / Selected Only — 100% unobstructed 3D hardware & animated conduits!)
  // 'switches' (Core & Switches Only — default clean mode; APs & Colos appear on hover/click)
  // 'compact'  (Minimal 1-line Hostname tags on all devices)
  // 'all'      (All 2-line device details visible simultaneously)
  const [labelMode, setLabelMode] = useState('hover');
  const [showLinkBadges, setShowLinkBadges] = useState(false);
  const [showZoneTitles, setShowZoneTitles] = useState(false);
  const [isDrawerOpen, setIsDrawerOpen] = useState(true);
  const [drawerTab, setDrawerTab] = useState('interconnects'); // 'interconnects' | 'hardware' | 'clusters'
  const [searchFilter, setSearchFilter] = useState('');

  // Build unified multi-switch & multi-campus topology graph
  const globalGraph = useMemo(() => {
    return buildGlobalAndSiteTopology(savedDevices, parsedSwitchData);
  }, [savedDevices, parsedSwitchData]);

  // Identify live nodes
  const coreNode = useMemo(() => {
    return (
      globalGraph.switchNodes.find((n) => n.hierarchyTier === 1) || {
        id: 'tcore-9600',
        hostname: 'tcore-9600.net.fdu.edu',
        mgmtIp: '132.238.1.40',
        model: 'Cisco C9606R',
        iosVersion: '17.12.4',
        role: 'Campus Core Switch',
        siteCode: 'Metro',
        isPolled: false,
        hierarchyTier: 1,
        switchLinks: [
          {
            localPort: 'Tw2/2/0/35',
            remotePort: 'Tw1/1/1',
            remoteHostname: 'T-BAN-2FL-WL',
            remoteIp: '132.238.8.58',
            speed: '25G SFP28',
            isTrunk: true
          },
          {
            localPort: 'Tw1/2/0/35',
            remotePort: 'Tw1/1/2',
            remoteHostname: 'T-BAN-2FL-WL',
            remoteIp: '132.238.8.58',
            speed: '25G SFP28',
            isTrunk: true
          }
        ],
        attachedEndpoints: []
      }
    );
  }, [globalGraph]);

  const wlNode = useMemo(() => {
    return (
      globalGraph.switchNodes.find((n) => n.hostname.includes('T-BAN-2FL-WL')) ||
      globalGraph.switchNodes[0]
    );
  }, [globalGraph]);

  const workStudyNode = useMemo(() => {
    return (
      globalGraph.switchNodes.find((n) => n.hostname.includes('WorkStudy')) ||
      globalGraph.switchNodes[1]
    );
  }, [globalGraph]);

  // Any additional switches discovered beyond the initial 3 (for when tcore/mcore or more closets are polled)
  const additionalSwitches = useMemo(() => {
    const coreId = coreNode?.id;
    const wlId = wlNode?.id;
    const wsId = workStudyNode?.id;
    return globalGraph.switchNodes.filter(
      (n) => n.id !== coreId && n.id !== wlId && n.id !== wsId
    );
  }, [globalGraph.switchNodes, coreNode, wlNode, workStudyNode]);

  // Group all switches by building prefix (ready for tcore / mcore 300+ CDP neighbors)
  const buildingClusters = useMemo(() => {
    const map = {};
    for (const sw of globalGraph.switchNodes) {
      const parts = sw.hostname.split('-');
      const prefix = parts.length >= 2 ? `${parts[0]}-${parts[1]}` : parts[0];
      if (!map[prefix]) {
        map[prefix] = {
          prefix,
          switches: [],
          polledCount: 0,
          apCount: 0
        };
      }
      map[prefix].switches.push(sw);
      if (sw.isPolled) map[prefix].polledCount += 1;
      map[prefix].apCount += sw.attachedEndpoints?.length || 0;
    }
    return Object.values(map);
  }, [globalGraph.switchNodes]);

  const attachedAps = useMemo(() => {
    return wlNode?.attachedEndpoints || [];
  }, [wlNode]);

  // 3D Coordinates for Every Device in the Scene
  const positions = useMemo(() => {
    const corePos = [-6.8, 0.2, -5.2];
    const wlPos = [-4.2, 0.2, 1.4];
    const wsPos = [-8.6, 0.2, 5.4];

    // 7 Wi-Fi 6 APs arranged on the Right Access Zone Pad
    const apPositions = attachedAps.map((ap, idx) => {
      const col = idx % 2;
      const row = Math.floor(idx / 2);
      const x = 4.3 + col * 4.4;
      const z = -6.0 + row * 2.55;
      return {
        ap,
        pos: [x, 0.2, z]
      };
    });

    // Colocation & WAN Sites on the Bottom-Right Pad
    const coloSites = GLOBAL_SITES.filter((s) =>
      ['Halsey165', 'Hastings', 'Florham', 'VancOakridge'].includes(s.code)
    ).map((site, idx) => {
      const col = idx % 2;
      const row = Math.floor(idx / 2);
      return {
        site,
        pos: [4.3 + col * 4.4, 0.2, 4.2 + row * 2.7]
      };
    });

    return {
      corePos,
      wlPos,
      wsPos,
      apPositions,
      coloSites
    };
  }, [attachedAps]);

  // Build 3D Conduits Connecting Exact Port Positions
  const conduits3D = useMemo(() => {
    const list = [];

    // 1. Dual 25G Fiber Uplinks: T-BAN-2FL-WL (Tw1/1/1 & Tw1/1/2) <-> tcore-9600 (Tw2/2/0/35 & Tw1/2/0/35)
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
      startPos: [positions.wlPos[0] + 1.0, 1.05, positions.wlPos[2] - 0.8],
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
      startPos: [positions.wlPos[0] + 1.3, 1.05, positions.wlPos[2] - 0.8],
      endPos: [positions.corePos[0] + 0.9, 1.2, positions.corePos[2] + 1.2]
    });

    // 2. Bi-Directionally Verified 10G mGig Trunk: T-BAN-2FL-WL (Te1/0/20) <-> T-BAN-2FL-WorkStudy-C9300 (Te1/0/24)
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
      startPos: [positions.wlPos[0] - 0.4, 0.85, positions.wlPos[2] + 1.2],
      endPos: [positions.wsPos[0] + 0.6, 0.85, positions.wsPos[2] + 1.2]
    });

    // 3. 7 Wi-Fi 6 AP UPOE Conduits from T-BAN-2FL-WL
    positions.apPositions.forEach(({ ap, pos }, idx) => {
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
        startPos: [positions.wlPos[0] + 1.6, 0.8, positions.wlPos[2] + (idx - 3) * 0.18],
        endPos: [pos[0], 0.3, pos[2]]
      });
    });

    // 4. Core to Colocation Dark Fiber Conduit
    if (positions.coloSites.length > 0) {
      const halsey = positions.coloSites[0];
      list.push({
        id: 'wan-core-halsey165',
        isPrimaryTrunk: true,
        verified: false,
        color: '#a855f7',
        radius: 0.085,
        badgeTitle: 'DARK FIBER WAN: Metro Core ↔ Halsey165 Colo',
        badgeSubtitle: '40G/100G Metro ↔ Halsey165 ↔ Florham / Hastings',
        sourceHostname: 'tcore-9600.net.fdu.edu',
        sourcePort: 'Hu1/0/1',
        targetHostname: 'Halsey165 (165 Halsey St Newark)',
        targetPort: 'DWDM-1',
        speed: '40G / 100G Dark Fiber',
        nativeVlan: 'Routed BGP / MPLS',
        allowedVlans: 'All Enterprise VRFs',
        startPos: [positions.corePos[0] + 1.5, 0.9, positions.corePos[2]],
        endPos: [halsey.pos[0] - 1.0, 0.7, halsey.pos[2]]
      });
    }

    return list;
  }, [positions]);

  // Selected entity in the 3D scene (defaults to T-BAN-2FL-WL so the drawer immediately shows rich telemetry)
  const [selected3DEntity, setSelected3DEntity] = useState(null);

  const activeEntity = useMemo(() => {
    if (selected3DEntity) return selected3DEntity;
    if (wlNode) {
      return { type: 'device', data: wlNode, id: wlNode.id, pos: positions.wlPos };
    }
    return null;
  }, [selected3DEntity, wlNode, positions.wlPos]);

  const handleSelectEntity = (entity) => {
    setSelected3DEntity(entity);
    setFocusTarget({ id: entity.id, pos: entity.pos });
    setIsDrawerOpen(true);
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
          TOP COMPACT HUD BAR: 3D CAMERA PRESETS, LABEL TOGGLES & DRAWER TOGGLE
         =================================================================== */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-3.5 py-2 bg-slate-950/95 border-b border-slate-800/90 text-xs z-20 shrink-0">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="px-2 py-0.5 rounded bg-cyan-500/20 text-cyan-300 border border-cyan-400/40 font-mono text-[10px] font-bold flex items-center gap-1">
            <Sparkles className="w-3 h-3" /> 3D MULTI-DEVICE CAMERA
          </span>
          {[
            { id: 'blueprint-iso', label: 'Isometric Blueprint 3D' },
            { id: 'metro-fabric', label: 'Core + Switches' },
            { id: 'switch-trunks', label: 'Switch Trunks (A↔B)' },
            { id: 'wifi-fleet', label: 'Wi-Fi 6 AP Fleet (7)' },
            { id: 'top-blueprint', label: 'Top Plan (90°)' },
            { id: 'front-elevation', label: 'Front Elevation' }
          ].map((preset) => (
            <button
              key={preset.id}
              type="button"
              onClick={() => {
                setFocusTarget(null);
                setCameraPreset(preset.id);
              }}
              className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition cursor-pointer ${
                cameraPreset === preset.id && !focusTarget
                  ? 'bg-sky-600 text-white shadow'
                  : 'bg-slate-900 text-slate-300 hover:text-white border border-slate-800'
              }`}
            >
              {preset.label}
            </button>
          ))}
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
            title="Toggle Zone Floor Titles"
          >
            Zones: {showZoneTitles ? 'On' : 'Off'}
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
        <div className="relative flex-1 h-full min-w-0">
          <Canvas shadows dpr={[1, 2]}>
            <color attach="background" args={[bgColor]} />
            <fog attach="fog" args={[bgColor, 38, 72]} />

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
              minDistance={5}
              maxDistance={55}
            />

            {/* Studio Architectural Lighting */}
            <ambientLight intensity={0.95} />
            <directionalLight
              position={[16, 28, 18]}
              intensity={1.6}
              castShadow
              shadow-mapSize={[2048, 2048]}
            />
            <directionalLight position={[-18, 18, -14]} intensity={0.85} color="#38bdf8" />
            <pointLight position={[-6, 6, 2]} intensity={1.1} color="#10b981" distance={22} />
            <pointLight position={[6, 6, -2]} intensity={0.9} color="#38bdf8" distance={22} />

            {/* Blueprint Engineering Floor Grid */}
            <Grid
              position={[0, -0.18, 0]}
              args={[48, 48]}
              cellSize={1.5}
              cellThickness={0.6}
              cellColor="#1e3a5f"
              sectionSize={6}
              sectionThickness={1.2}
              sectionColor="#0284c7"
              fadeDistance={52}
              fadeStrength={1.2}
            />

            {/* ===============================================================
                ZONE PAD 1: TIER 1 CAMPUS CORE ZONE (tcore-9600.net.fdu.edu)
               =============================================================== */}
            <ZonePlatform3D
              position={[-6.8, 0, -5.2]}
              size={[8.2, 0.36, 5.2]}
              baseColor="#17162e"
              rimColor="#fb923c"
              title="ZONE 1 • TIER 1 CAMPUS CORE (METRO)"
              subtitle="Cisco C9606R Modular Core • Dual 25G SFP28 Fiber Trunks"
              showZoneTitles={showZoneTitles}
            />

            <CoreChassis9606R3D
              node={coreNode}
              position={positions.corePos}
              isSelected={activeEntity?.id === coreNode.id}
              onSelect={handleSelectEntity}
              labelMode={labelMode}
            />

            {/* ===============================================================
                ZONE PAD 2: BANCROFT HALL MDF / IDF SWITCH FABRIC ZONE
                (T-BAN-2FL-WL + T-BAN-2FL-WorkStudy-C9300)
               =============================================================== */}
            <ZonePlatform3D
              position={[-6.4, 0, 3.4]}
              size={[9.8, 0.36, 8.6]}
              baseColor="#091d34"
              rimColor="#10b981"
              title="ZONE 2 • BANCROFT HALL SWITCH FABRIC (2× POLLED C9300-24UX)"
              subtitle="Verified 10G Trunk: Te1/0/20 ↔ Te1/0/24 (VLAN 133 Native)"
              showZoneTitles={showZoneTitles}
            />

            {wlNode && (
              <SwitchC9300Node3D
                node={wlNode}
                position={positions.wlPos}
                isSelected={activeEntity?.id === wlNode.id}
                isActiveChassis={parsedSwitchData?.device?.hostname === wlNode.hostname}
                onSelect={handleSelectEntity}
                labelMode={labelMode}
              />
            )}

            {workStudyNode && (
              <SwitchC9300Node3D
                node={workStudyNode}
                position={positions.wsPos}
                isSelected={activeEntity?.id === workStudyNode.id}
                isActiveChassis={parsedSwitchData?.device?.hostname === workStudyNode.hostname}
                onSelect={handleSelectEntity}
                labelMode={labelMode}
              />
            )}

            {/* Any additional polled/discovered switches rendered automatically */}
            {additionalSwitches.slice(0, 12).map((sw, idx) => {
              const col = idx % 3;
              const row = Math.floor(idx / 3);
              const pos = [-13.5 - col * 4.2, 0.2, -3.5 + row * 3.4];
              return (
                <SwitchC9300Node3D
                  key={sw.id}
                  node={sw}
                  position={pos}
                  isSelected={activeEntity?.id === sw.id}
                  isActiveChassis={parsedSwitchData?.device?.hostname === sw.hostname}
                  onSelect={handleSelectEntity}
                  labelMode={labelMode}
                />
              );
            })}

            {/* ===============================================================
                ZONE PAD 3: WI-FI 6 UPOE ACCESS LAYER FLEET (7 APs • 194.0W)
               =============================================================== */}
            <ZonePlatform3D
              position={[6.5, 0, -2.2]}
              size={[9.6, 0.36, 9.8]}
              baseColor="#081c29"
              rimColor="#38bdf8"
              title="ZONE 3 • WI-FI 6 UPOE ACCESS FLEET (7× CATALYST APs • 194.0W)"
              subtitle="6× C9130AXI-B (30W) + 1× C9105AXW-B Sniffer (14W)"
              showZoneTitles={showZoneTitles}
            />

            {positions.apPositions.map(({ ap, pos }) => (
              <WirelessApNode3D
                key={ap.hostname}
                ap={ap}
                position={pos}
                isSelected={activeEntity?.id === ap.hostname}
                onSelect={handleSelectEntity}
                labelMode={labelMode}
              />
            ))}

            {/* ===============================================================
                ZONE PAD 4: COLOCATION HUBS & MULTI-CAMPUS WAN
                (Halsey165, Hastings, Florham, VancOakridge)
               =============================================================== */}
            <ZonePlatform3D
              position={[6.5, 0, 5.5]}
              size={[9.6, 0.36, 5.2]}
              baseColor="#19102c"
              rimColor="#a855f7"
              title="ZONE 4 • COLOCATIONS & MULTI-CAMPUS WAN (US & CANADA)"
              subtitle="Halsey165 (US) • Hastings (CA) • Florham • VancOakridge"
              showZoneTitles={showZoneTitles}
            />

            {positions.coloSites.map(({ site, pos }) => (
              <ColocationHub3D
                key={site.code}
                site={site}
                position={pos}
                isSelected={activeEntity?.id === site.code}
                onSelect={handleSelectEntity}
                labelMode={labelMode}
              />
            ))}

            {/* ===============================================================
                3D GLOWING FIBER, MGIG TRUNK & UPOE CONDUITS
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
            />
          </Canvas>

          {/* Bottom-Left Compact 3D Legend & Camera Instructions Pill */}
          <div className="absolute bottom-3 left-3 flex flex-wrap items-center gap-3 px-3 py-1.5 rounded-xl bg-slate-950/90 border border-slate-800/90 text-[11px] font-mono backdrop-blur-md pointer-events-none">
            <span className="text-sky-300 font-bold">
              3D Camera: Left-Drag Orbit • Right-Drag Pan • Scroll Zoom • Click Any 3D Device or Conduit
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
                Hardware & CLI
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
                          <CheckCircle2 className="w-3.5 h-3.5" /> Polled & Stored ({activeEntity.data.serialNumber})
                        </span>
                      ) : (
                        <span className="text-xs font-mono font-bold text-amber-300">
                          Discovered via CDP ({activeEntity.data.mgmtIp})
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5">
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
                          Open Single 3D Chassis
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
                            Connected Wi-Fi 6 APs & PoE Endpoints ({activeEntity.data.attachedEndpoints.length})
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
                            {activeEntity.data.iosVersion || '17.15.04'}
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
