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

// Smooth camera controller that animates to preset viewpoints (framed closer so the switch fills the viewport)
function CameraRig({ cameraPreset, controlsRef }) {
  const { camera } = useThree();
  const targetPos = useRef(new THREE.Vector3(8.5, 4.8, 10.8));
  const targetLookAt = useRef(new THREE.Vector3(0, 0, 0));
  const isTransitioning = useRef(false);
  const lastPreset = useRef(cameraPreset);

  const presets = useMemo(
    () => ({
      isometric: { pos: [8.8, 4.8, 11.2], target: [0, 0, 0] },
      front: { pos: [0, 0.4, 10.6], target: [0, 0, 3.8] },
      rear: { pos: [0, 0.5, -11.2], target: [0, 0, -3.8] },
      left: { pos: [-12.8, 1.6, 0], target: [-3, 0, 0] },
      right: { pos: [12.8, 1.6, 0], target: [3, 0, 0] },
      top: { pos: [0, 13.2, 0.01], target: [0, 0, 0] },
      uplink: { pos: [5.6, 0.35, 8.4], target: [5.6, 0, 5.5] },
      ports: { pos: [-1.2, 0.25, 8.6], target: [-1.2, 0, 5.5] }
    }),
    []
  );

  if (lastPreset.current !== cameraPreset && presets[cameraPreset]) {
    lastPreset.current = cameraPreset;
    const p = presets[cameraPreset];
    targetPos.current.set(...p.pos);
    targetLookAt.current.set(...p.target);
    isTransitioning.current = true;
  }

  useFrame((_, delta) => {
    if (!isTransitioning.current) return;
    const step = Math.min(1, delta * 5.5);
    camera.position.lerp(targetPos.current, step);
    if (controlsRef.current) {
      controlsRef.current.target.lerp(targetLookAt.current, step);
      controlsRef.current.update();
    }
    if (camera.position.distanceTo(targetPos.current) < 0.08) {
      isTransitioning.current = false;
    }
  });

  return null;
}

// Animated Front/Side-to-Rear Thermal Airflow Streamlines
function AirflowParticles({ visible, fanFaults }) {
  const groupRef = useRef();
  const streamCount = 36;

  const streams = useMemo(() => {
    return Array.from({ length: streamCount }, (_, idx) => {
      const lane = (idx % 12) - 5.5;
      const x = lane * 1.15;
      const y = ((idx % 3) - 1) * 0.25;
      const speed = 4.2 + (idx % 5) * 0.65;
      const offset = (idx / streamCount) * 14;
      const fromSide = idx % 6 === 0;
      return { x, y, speed, offset, fromSide };
    });
  }, []);

  useFrame((state) => {
    if (!visible || !groupRef.current) return;
    const t = state.clock.elapsedTime;
    const activeFans = 3 - Object.values(fanFaults).filter(Boolean).length;
    const speedFactor = activeFans === 0 ? 0.05 : activeFans / 3;

    groupRef.current.children.forEach((mesh, idx) => {
      const s = streams[idx];
      const progress = ((t * s.speed * speedFactor + s.offset) % 16) / 16;
      const z = 7.2 - progress * 15.7;
      mesh.position.z = z;
      mesh.position.x = s.fromSide
        ? THREE.MathUtils.lerp(s.x > 0 ? 8.2 : -8.2, s.x * 0.7, Math.min(1, progress * 2.2))
        : s.x;
      mesh.position.y = s.y;

      const color = new THREE.Color().lerpColors(
        new THREE.Color('#38bdf8'),
        new THREE.Color('#f97316'),
        progress
      );
      mesh.material.color.copy(color);
      mesh.material.emissive.copy(color);
    });
  });

  if (!visible) return null;

  return (
    <group ref={groupRef}>
      {streams.map((_, i) => (
        <mesh key={i} rotation={[Math.PI / 2, 0, 0]}>
          <capsuleGeometry args={[0.045, 0.45, 4, 8]} />
          <meshStandardMaterial
            color="#38bdf8"
            emissive="#38bdf8"
            emissiveIntensity={1.6}
            transparent
            opacity={0.82}
          />
        </mesh>
      ))}
    </group>
  );
}

// Individual Hot-Swappable Fan Module (FAN-T2=)
function FanModule3D({
  id,
  index,
  position,
  explodeFactor,
  isFaulty,
  selectedId,
  onSelect,
  onHover,
  showLabels
}) {
  const bladesRef = useRef();
  const [hovered, setHovered] = useState(false);
  const isSelected = selectedId === id;

  useFrame((_, delta) => {
    if (bladesRef.current && !isFaulty) {
      bladesRef.current.rotation.z -= delta * 18;
    }
  });

  const zOffset = -explodeFactor * (2.6 + index * 0.35);

  return (
    <group
      position={[position[0], position[1], position[2] + zOffset]}
      onClick={(e) => {
        e.stopPropagation();
        onSelect({ type: 'component', id });
      }}
      onPointerOver={(e) => {
        e.stopPropagation();
        setHovered(true);
        onHover(`Fan Module ${index + 1} (FAN-T2=)`);
      }}
      onPointerOut={() => {
        setHovered(false);
        onHover(null);
      }}
    >
      {/* Fan Module Cartridge Body */}
      <RoundedBox args={[1.45, 1.38, 1.25]} radius={0.05} smoothness={3} position={[0, 0, 0.52]}>
        <meshStandardMaterial
          color={isSelected ? '#3b82f6' : hovered ? '#475569' : '#334155'}
          metalness={0.5}
          roughness={0.35}
        />
      </RoundedBox>

      {/* Rear Faceplate Bezel */}
      <mesh position={[0, 0, -0.12]}>
        <boxGeometry args={[1.48, 1.4, 0.08]} />
        <meshStandardMaterial
          color={isSelected ? '#3b82f6' : hovered ? '#64748b' : '#475569'}
          metalness={0.5}
          roughness={0.35}
        />
      </mesh>

      {/* Circular Fan Vent Cutout Shroud */}
      <mesh position={[0, -0.04, -0.16]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.52, 0.52, 0.06, 24]} />
        <meshStandardMaterial color="#0f172a" roughness={0.75} />
      </mesh>

      {/* Spinning Fan Rotor & 6 Blades */}
      <group ref={bladesRef} position={[0, -0.04, -0.18]}>
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.16, 0.16, 0.08, 16]} />
          <meshStandardMaterial color="#64748b" metalness={0.6} roughness={0.25} />
        </mesh>
        {[0, 1, 2, 3, 4, 5].map((b) => {
          const angle = (b / 6) * Math.PI * 2;
          return (
            <mesh
              key={b}
              position={[Math.cos(angle) * 0.28, Math.sin(angle) * 0.28, 0]}
              rotation={[0.35, 0.2, angle]}
            >
              <boxGeometry args={[0.34, 0.11, 0.02]} />
              <meshStandardMaterial
                color={isFaulty ? '#ef4444' : '#94a3b8'}
                emissive={isFaulty ? '#7f1d1d' : '#1e293b'}
                emissiveIntensity={0.6}
              />
            </mesh>
          );
        })}
      </group>

      {/* Top-Left Fan Status LED (Per Cisco HIG: Green = Normal, Amber = Tachometer Fault) */}
      <mesh position={[-0.54, 0.52, -0.17]}>
        <sphereGeometry args={[0.055, 12, 12]} />
        <meshStandardMaterial
          color={isFaulty ? '#f59e0b' : '#10b981'}
          emissive={isFaulty ? '#f59e0b' : '#10b981'}
          emissiveIntensity={2.5}
        />
      </mesh>

      {/* Pinch Extraction Tabs (Top & Bottom) */}
      <mesh position={[0.48, 0.48, -0.22]}>
        <boxGeometry args={[0.22, 0.12, 0.16]} />
        <meshStandardMaterial color="#0ea5e9" roughness={0.35} />
      </mesh>
      <mesh position={[0.48, -0.48, -0.22]}>
        <boxGeometry args={[0.22, 0.12, 0.16]} />
        <meshStandardMaterial color="#0ea5e9" roughness={0.35} />
      </mesh>

      {showLabels && index === 1 && (
        <Html position={[0, 1.05, -0.2]} center distanceFactor={13}>
          <div className="px-2 py-0.5 rounded bg-slate-900/90 border border-cyan-500/40 text-[10px] font-mono text-cyan-300 whitespace-nowrap shadow-lg pointer-events-none">
            #6 3× Hot-Swap Fans (FAN-T2=)
          </div>
        </Html>
      )}
    </group>
  );
}

// Hot-Swappable Power Supply Module (PS1 & PS2)
function PowerSupplyModule3D({
  id,
  slotLabel,
  position,
  explodeFactor,
  psuState,
  psuModel,
  selectedId,
  onSelect,
  onHover,
  showLabels
}) {
  const [hovered, setHovered] = useState(false);
  const isSelected = selectedId === id;
  const zOffset = -explodeFactor * 3.8;

  const isBlank = psuState === 'blank';
  const isFault = psuState === 'fault';

  return (
    <group
      position={[position[0], position[1], position[2] + zOffset]}
      onClick={(e) => {
        e.stopPropagation();
        onSelect({ type: 'component', id });
      }}
      onPointerOver={(e) => {
        e.stopPropagation();
        setHovered(true);
        onHover(`${slotLabel} (${isBlank ? 'PWR-C1-BLANK' : psuModel})`);
      }}
      onPointerOut={() => {
        setHovered(false);
        onHover(null);
      }}
    >
      {/* Deep Internal PSU Brick Enclosure */}
      <RoundedBox
        args={[3.1, 1.42, isBlank ? 0.35 : 5.2]}
        radius={0.05}
        smoothness={3}
        position={[0, 0, isBlank ? 0.1 : 2.45]}
      >
        <meshStandardMaterial
          color={isSelected ? '#2563eb' : hovered ? '#475569' : '#334155'}
          metalness={0.55}
          roughness={0.32}
        />
      </RoundedBox>

      {/* Rear PSU Faceplate */}
      <mesh position={[0, 0, -0.14]}>
        <boxGeometry args={[3.14, 1.44, 0.08]} />
        <meshStandardMaterial
          color={isSelected ? '#3b82f6' : hovered ? '#64748b' : '#475569'}
          metalness={0.5}
          roughness={0.35}
        />
      </mesh>

      {!isBlank && (
        <>
          {/* IEC C14/C16 3-Prong AC Power Receptacle */}
          <group position={[-0.78, -0.05, -0.19]}>
            <mesh>
              <boxGeometry args={[0.82, 0.62, 0.1]} />
              <meshStandardMaterial color="#0f172a" roughness={0.85} />
            </mesh>
            {/* 3 Brass Prongs */}
            <mesh position={[0, 0.12, -0.02]}>
              <boxGeometry args={[0.07, 0.16, 0.06]} />
              <meshStandardMaterial color="#eab308" metalness={0.9} roughness={0.2} />
            </mesh>
            <mesh position={[-0.2, -0.1, -0.02]}>
              <boxGeometry args={[0.07, 0.16, 0.06]} />
              <meshStandardMaterial color="#eab308" metalness={0.9} roughness={0.2} />
            </mesh>
            <mesh position={[0.2, -0.1, -0.02]}>
              <boxGeometry args={[0.07, 0.16, 0.06]} />
              <meshStandardMaterial color="#eab308" metalness={0.9} roughness={0.2} />
            </mesh>
          </group>

          {/* PSU Internal Cooling Fan Exhaust Grille */}
          <mesh position={[0.25, -0.04, -0.18]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.42, 0.42, 0.05, 20]} />
            <meshStandardMaterial color="#1e293b" roughness={0.65} />
          </mesh>

          {/* PSU Extraction Pull Handle */}
          <mesh position={[1.05, 0, -0.35]}>
            <boxGeometry args={[0.16, 0.92, 0.35]} />
            <meshStandardMaterial color="#94a3b8" metalness={0.65} roughness={0.25} />
          </mesh>

          {/* Color-Coded Release Latch Tab */}
          <mesh position={[1.32, -0.18, -0.25]}>
            <boxGeometry args={[0.22, 0.45, 0.2]} />
            <meshStandardMaterial color="#f59e0b" roughness={0.35} />
          </mesh>

          {/* AC OK LED (#8) & PS OK LED (#9) */}
          <mesh position={[-1.32, 0.44, -0.19]}>
            <sphereGeometry args={[0.055, 12, 12]} />
            <meshStandardMaterial
              color={isFault ? '#475569' : '#10b981'}
              emissive={isFault ? '#000000' : '#10b981'}
              emissiveIntensity={2.2}
            />
          </mesh>
          <mesh position={[-1.08, 0.44, -0.19]}>
            <sphereGeometry args={[0.055, 12, 12]} />
            <meshStandardMaterial
              color={isFault ? '#ef4444' : '#10b981'}
              emissive={isFault ? '#ef4444' : '#10b981'}
              emissiveIntensity={2.4}
            />
          </mesh>
        </>
      )}

      {showLabels && id === 'psu-1' && (
        <Html position={[1.6, 1.05, -0.2]} center distanceFactor={13}>
          <div className="px-2 py-0.5 rounded bg-slate-900/90 border border-emerald-500/40 text-[10px] font-mono text-emerald-300 whitespace-nowrap shadow-lg pointer-events-none">
            #11 Dual Hot-Swap PSU Bays (PS1 / PS2)
          </div>
        </Html>
      )}
    </group>
  );
}

// Main 3D Switch Assembly
function SwitchScene({
  portsData,
  selectedItem,
  onSelect,
  ledMode,
  onCycleLedMode,
  beaconActive,
  onToggleBeacon,
  networkModuleId,
  explodeFactor,
  xrayMode,
  showAirflow,
  showLabels,
  showPatchCables,
  psuStates,
  fanFaults,
  psuModel,
  cameraPreset,
  chassisScale = 1.15,
  backdropBrightness = 0.65,
  showStudioGrid = true
}) {
  const controlsRef = useRef();
  const [hoveredLabel, setHoveredLabel] = useState(null);
  const [hoveredPortNum, setHoveredPortNum] = useState(null);
  const pulseRef = useRef(0);

  useFrame((state) => {
    pulseRef.current = Math.sin(state.clock.elapsedTime * 6);
  });

  // Compute LED color for each of the 48 downlink ports based on active Cisco Mode Button state
  const getPortLedColor = (port) => {
    switch (ledMode) {
      case 'STAT':
        if (port.status === 'up') return '#10b981';
        if (port.status === 'stp-blocking') return '#f59e0b';
        if (port.status === 'poe-fault') return '#ef4444';
        return '#334155';
      case 'SPEED':
        if (port.status === 'down') return '#334155';
        if (port.speed === '5000' || port.speed === '10000') return '#38bdf8';
        if (port.speed === '1000') return '#10b981';
        if (port.speed === '100') return '#84cc16';
        return '#334155';
      case 'DUPLX':
        return port.status !== 'down' && port.duplex === 'full' ? '#10b981' : '#334155';
      case 'ACTV':
        return '#10b981';
      case 'STACK':
        if (port.portNumber === 1) return '#38bdf8';
        if (port.portNumber === 2 || port.portNumber === 3) return '#10b981';
        return '#334155';
      case 'PoE':
        if (port.status === 'poe-fault') return '#ef4444';
        if (port.poeWatts > 0) return '#10b981';
        return '#334155';
      case 'S-PWR':
        if (port.portNumber <= 4) return '#10b981';
        return '#334155';
      case 'XPS':
        return '#334155';
      default:
        return port.status === 'up' ? '#10b981' : '#334155';
    }
  };

  // Compute physical 3D coordinates for the 48 RJ-45 ports (arranged in 4 banks of 12 ports = 2 rows × 6 cols per bank)
  const portMeshesData = useMemo(() => {
    return portsData.map((port) => {
      const idx = port.portNumber - 1;
      const col = Math.floor(idx / 2);
      const bankIdx = Math.floor(col / 6);
      const isTopRow = idx % 2 === 0;
      const x = -5.65 + col * 0.36 + bankIdx * 0.24;
      const y = isTopRow ? 0.24 : -0.24;
      return {
        ...port,
        isTopRow,
        position: [x, y, 6.02]
      };
    });
  }, [portsData]);

  const hasHardwareFault =
    Object.values(fanFaults).some(Boolean) || psuStates.psu1 === 'fault' || psuStates.psu2 === 'fault';

  const isSelectedComponent = (id) =>
    selectedItem?.type === 'component' && selectedItem?.id === id;

  // Dynamic lighting multiplier based on backdrop brightness slider
  const lightBoost = 0.85 + backdropBrightness * 0.85;

  return (
    <>
      <PerspectiveCamera makeDefault position={[8.8, 4.8, 11.2]} fov={34} />
      <OrbitControls
        ref={controlsRef}
        enableDamping
        dampingFactor={0.06}
        minDistance={2.8}
        maxDistance={28}
        maxPolarAngle={Math.PI * 0.92}
      />
      <CameraRig cameraPreset={cameraPreset} controlsRef={controlsRef} />

      {/* 360° Studio Multi-Point & Rim Lighting Setup (Illuminates Front Faceplate, Sides, Top & Rear) */}
      <ambientLight intensity={1.25 * lightBoost} />
      <hemisphereLight
        skyColor="#f8fafc"
        groundColor="#475569"
        intensity={1.1 * lightBoost}
      />
      {/* Key Overhead & Front-Right Light */}
      <directionalLight position={[12, 18, 16]} intensity={1.85 * lightBoost} castShadow />
      {/* Dedicated Front Faceplate Fill Light (makes all 48 RJ-45 ports & Uplink bay pop clearly) */}
      <directionalLight position={[0, 2.5, 18]} intensity={1.65 * lightBoost} color="#f1f5f9" />
      {/* Dedicated Right & Left Chassis Profile Rim Lights */}
      <directionalLight position={[18, 4, 4]} intensity={1.25 * lightBoost} color="#e2e8f0" />
      <directionalLight position={[-18, 4, 4]} intensity={1.25 * lightBoost} color="#e2e8f0" />
      {/* Dedicated Rear Bulkhead Fill Light */}
      <directionalLight position={[0, 5, -18]} intensity={1.35 * lightBoost} color="#e2e8f0" />

      {/* 3D Studio CAD Reference Floor Grid */}
      {showStudioGrid && (
        <Grid
          position={[0, -2.05, 0]}
          args={[38, 38]}
          cellSize={1}
          cellThickness={0.6}
          cellColor={backdropBrightness > 0.7 ? '#64748b' : '#334155'}
          sectionSize={5}
          sectionThickness={1.1}
          sectionColor={backdropBrightness > 0.7 ? '#3b82f6' : '#38bdf8'}
          fadeDistance={30}
          fadeStrength={1.2}
          infiniteGrid
        />
      )}

      {/* Thermal Airflow Streamlines */}
      <AirflowParticles visible={showAirflow} fanFaults={fanFaults} />

      <group name="Cisco_C9300_48_Assembly" scale={chassisScale}>
        {/* =========================================================
            1. CHASSIS BASE TRAY & SIDE VENTILATION WALLS
            (Authentic Cisco Catalyst Powder-Coated Gunmetal/Silver-Gray)
           ========================================================= */}
        <group
          onClick={(e) => {
            e.stopPropagation();
            onSelect({ type: 'component', id: 'chassis-main' });
          }}
          onPointerOver={(e) => {
            e.stopPropagation();
            setHoveredLabel('1RU Galvanized Steel Chassis (17.5" × 1.73" × 17.5")');
          }}
          onPointerOut={() => setHoveredLabel(null)}
        >
          {/* Bottom Steel Pan */}
          <mesh position={[0, -0.82, 0]} receiveShadow>
            <boxGeometry args={[17.5, 0.1, 12.0]} />
            <meshStandardMaterial
              color={isSelectedComponent('chassis-main') ? '#3b82f6' : '#3b495e'}
              metalness={0.48}
              roughness={0.38}
            />
          </mesh>

          {/* Left & Right Side Chassis Walls with Stamped Hexagonal Intake Vents */}
          {[-8.7, 8.7].map((xSide, sIdx) => (
            <group key={sIdx} position={[xSide, 0, 0]}>
              <mesh>
                <boxGeometry args={[0.1, 1.65, 12.0]} />
                <meshStandardMaterial
                  color="#475569"
                  metalness={0.48}
                  roughness={0.36}
                  transparent={xrayMode}
                  opacity={xrayMode ? 0.35 : 1}
                />
              </mesh>
              {/* Side Intake Ventilation Grille Cutout Visuals */}
              {[-3.2, -1.6, 0, 1.6, 3.2].map((zVent, vIdx) => (
                <mesh key={vIdx} position={[xSide > 0 ? 0.06 : -0.06, 0, zVent]}>
                  <boxGeometry args={[0.02, 0.95, 1.1]} />
                  <meshStandardMaterial color="#0f172a" roughness={0.85} />
                </mesh>
              ))}
            </group>
          ))}

          {/* Front Contrast Bezel Plate (Medium-Dark Slate so Port Cages & Edge Seams Pop) */}
          <mesh position={[0, 0, 5.96]}>
            <boxGeometry args={[17.48, 1.68, 0.1]} />
            <meshStandardMaterial color="#1e293b" metalness={0.42} roughness={0.42} />
          </mesh>

          {/* Top & Bottom Front Bezel Silver Trim Rails */}
          <mesh position={[0, 0.82, 6.01]}>
            <boxGeometry args={[17.48, 0.05, 0.06]} />
            <meshStandardMaterial color="#64748b" metalness={0.6} roughness={0.3} />
          </mesh>
          <mesh position={[0, -0.82, 6.01]}>
            <boxGeometry args={[17.48, 0.05, 0.06]} />
            <meshStandardMaterial color="#64748b" metalness={0.6} roughness={0.3} />
          </mesh>

          {/* Rear Steel Bulkhead Plate */}
          <mesh position={[0, 0, -5.96]}>
            <boxGeometry args={[17.48, 1.68, 0.1]} />
            <meshStandardMaterial color="#3b495e" metalness={0.5} roughness={0.35} />
          </mesh>
        </group>

        {/* =========================================================
            2. REMOVABLE / EXPLODABLE TOP CHASSIS LID
           ========================================================= */}
        <group
          position={[0, 0.82 + explodeFactor * 4.2, 0]}
          onClick={(e) => {
            e.stopPropagation();
            onSelect({ type: 'component', id: 'chassis-main' });
          }}
        >
          <mesh castShadow>
            <boxGeometry args={[17.5, 0.08, 12.0]} />
            <meshStandardMaterial
              color="#475569"
              metalness={0.5}
              roughness={0.35}
              transparent={xrayMode || explodeFactor > 0.05}
              opacity={xrayMode ? 0.18 : explodeFactor > 0.05 ? 0.85 : 1}
            />
          </mesh>
          {/* Top Lid Stamped Cisco Decal Strip */}
          {!xrayMode && (
            <mesh position={[-6.5, 0.05, 4.8]} rotation={[-Math.PI / 2, 0, 0]}>
              <planeGeometry args={[3.4, 0.8]} />
              <meshStandardMaterial color="#0ea5e9" emissive="#0284c7" emissiveIntensity={0.3} />
            </mesh>
          )}
        </group>

        {/* =========================================================
            3. INTERNAL ARCHITECTURE (MOTHERBOARD, UADP 2.0 ASIC, CPU, POE)
           ========================================================= */}
        <group position={[0, -0.68, 0]}>
          {/* Main Multilayer Enterprise Green/Teal PCB Motherboard */}
          <mesh position={[0, 0, 0]}>
            <boxGeometry args={[16.8, 0.08, 11.4]} />
            <meshStandardMaterial color="#059669" metalness={0.3} roughness={0.5} />
          </mesh>

          {/* Cisco UADP 2.0 Programmable ASIC + Copper Skived Heatsink */}
          <group
            position={[1.8, 0.35 + explodeFactor * 1.4, -0.4]}
            onClick={(e) => {
              e.stopPropagation();
              onSelect({ type: 'component', id: 'internal-uadp-asic' });
            }}
            onPointerOver={(e) => {
              e.stopPropagation();
              setHoveredLabel('Cisco UADP 2.0 ASIC (256 Gbps Programmable Silicon + Heatsink)');
            }}
            onPointerOut={() => setHoveredLabel(null)}
          >
            <mesh position={[0, -0.18, 0]}>
              <boxGeometry args={[3.2, 0.12, 3.2]} />
              <meshStandardMaterial
                color={isSelectedComponent('internal-uadp-asic') ? '#3b82f6' : '#1e293b'}
                metalness={0.6}
                roughness={0.28}
              />
            </mesh>
            <mesh position={[0, 0.02, 0]}>
              <boxGeometry args={[2.8, 0.28, 2.8]} />
              <meshStandardMaterial
                color={isSelectedComponent('internal-uadp-asic') ? '#60a5fa' : '#d97706'}
                metalness={0.8}
                roughness={0.25}
              />
            </mesh>
            {[-1.1, -0.75, -0.4, -0.05, 0.3, 0.65, 1.0].map((fx, fIdx) => (
              <mesh key={fIdx} position={[fx, 0.26, 0]}>
                <boxGeometry args={[0.08, 0.32, 2.75]} />
                <meshStandardMaterial color="#f59e0b" metalness={0.85} roughness={0.22} />
              </mesh>
            ))}
            {(explodeFactor > 0.2 || xrayMode) && (
              <Html position={[0, 0.85, 0]} center distanceFactor={13}>
                <div className="px-2 py-0.5 rounded bg-amber-950/90 border border-amber-500/50 text-[10px] font-mono text-amber-300 whitespace-nowrap shadow-lg pointer-events-none">
                  Cisco UADP 2.0 ASIC (46°C)
                </div>
              </Html>
            )}
          </group>

          {/* x86 Multi-Core Control Plane CPU + DDR4 DRAM + Bootflash */}
          <group
            position={[-2.8, 0.3 + explodeFactor * 1.1, -0.8]}
            onClick={(e) => {
              e.stopPropagation();
              onSelect({ type: 'component', id: 'internal-x86-cpu' });
            }}
            onPointerOver={(e) => {
              e.stopPropagation();
              setHoveredLabel('x86-64 Control Plane CPU Complex + 8GB DDR4 + Trust Anchor');
            }}
            onPointerOut={() => setHoveredLabel(null)}
          >
            <mesh>
              <boxGeometry args={[2.4, 0.36, 2.4]} />
              <meshStandardMaterial
                color={isSelectedComponent('internal-x86-cpu') ? '#3b82f6' : '#cbd5e1'}
                metalness={0.7}
                roughness={0.25}
              />
            </mesh>
            {[-0.6, -0.2, 0.2, 0.6].map((dz, dIdx) => (
              <mesh key={dIdx} position={[-1.7, 0.1, dz]}>
                <boxGeometry args={[0.12, 0.42, 1.8]} />
                <meshStandardMaterial color="#10b981" metalness={0.4} roughness={0.3} />
              </mesh>
            ))}
            {(explodeFactor > 0.2 || xrayMode) && (
              <Html position={[0, 0.75, 0]} center distanceFactor={13}>
                <div className="px-2 py-0.5 rounded bg-blue-950/90 border border-blue-500/50 text-[10px] font-mono text-blue-200 whitespace-nowrap shadow-lg pointer-events-none">
                  x86 CPU + 8GB DRAM (IOS-XE / IOx)
                </div>
              </Html>
            )}
          </group>

          {/* PoE+ / UPOE+ Controller Daughterboard & 48-Port Isolation Magnetics */}
          <group
            position={[-1.1, 0.28 + explodeFactor * 0.85, 3.8]}
            onClick={(e) => {
              e.stopPropagation();
              onSelect({ type: 'component', id: 'internal-poe-board' });
            }}
            onPointerOver={(e) => {
              e.stopPropagation();
              setHoveredLabel('PoE+ / UPOE+ 48-Channel PSE Controller Daughterboard & Magnetics');
            }}
            onPointerOut={() => setHoveredLabel(null)}
          >
            <mesh>
              <boxGeometry args={[9.4, 0.22, 2.1]} />
              <meshStandardMaterial
                color={isSelectedComponent('internal-poe-board') ? '#2563eb' : '#0d9488'}
                metalness={0.4}
                roughness={0.4}
              />
            </mesh>
            {Array.from({ length: 12 }, (_, mIdx) => (
              <mesh key={mIdx} position={[-4.1 + mIdx * 0.74, 0.2, 0.3]}>
                <boxGeometry args={[0.52, 0.24, 0.85]} />
                <meshStandardMaterial color="#1e293b" roughness={0.4} />
              </mesh>
            ))}
            {(explodeFactor > 0.2 || xrayMode) && (
              <Html position={[0, 0.65, 0]} center distanceFactor={13}>
                <div className="px-2 py-0.5 rounded bg-teal-950/90 border border-teal-500/50 text-[10px] font-mono text-teal-200 whitespace-nowrap shadow-lg pointer-events-none">
                  UPOE+ PSE Daughterboard & Magnetics
                </div>
              </Html>
            )}
          </group>
        </group>

        {/* =========================================================
            4. 19-INCH RACK MOUNT EARS / BRACKETS (LEFT & RIGHT)
           ========================================================= */}
        {[-1, 1].map((dir) => (
          <group
            key={dir}
            position={[dir * (9.15 + explodeFactor * 2.2), 0, 5.2]}
            onClick={(e) => {
              e.stopPropagation();
              onSelect({ type: 'component', id: 'rack-brackets' });
            }}
            onPointerOver={(e) => {
              e.stopPropagation();
              setHoveredLabel('19-Inch EIA Rack-Mounting Bracket (RCKMNT-1RU-2KX=)');
            }}
            onPointerOut={() => setHoveredLabel(null)}
          >
            <mesh position={[dir * 0.22, 0, 0.68]}>
              <boxGeometry args={[0.75, 1.68, 0.12]} />
              <meshStandardMaterial
                color={isSelectedComponent('rack-brackets') ? '#3b82f6' : '#94a3b8'}
                metalness={0.6}
                roughness={0.3}
              />
            </mesh>
            <mesh position={[-dir * 0.12, 0, -0.2]}>
              <boxGeometry args={[0.1, 1.62, 1.85]} />
              <meshStandardMaterial
                color={isSelectedComponent('rack-brackets') ? '#3b82f6' : '#94a3b8'}
                metalness={0.6}
                roughness={0.3}
              />
            </mesh>
          </group>
        ))}

        {/* =========================================================
            5. FRONT PANEL LEFT DIAGNOSTIC & MANAGEMENT HUB
           ========================================================= */}
        {/* #1 Blue Beacon UID Button */}
        <group
          position={[-8.15, 0.52, 6.03]}
          onClick={(e) => {
            e.stopPropagation();
            onToggleBeacon();
            onSelect({ type: 'component', id: 'beacon-uid' });
          }}
          onPointerOver={(e) => {
            e.stopPropagation();
            setHoveredLabel('#1 Blue Beacon LED / UID Button (Click to Toggle Locator)');
          }}
          onPointerOut={() => setHoveredLabel(null)}
        >
          <mesh>
            <cylinderGeometry args={[0.13, 0.13, 0.08, 20]} rotation={[Math.PI / 2, 0, 0]} />
            <meshStandardMaterial
              color={beaconActive ? '#38bdf8' : '#0ea5e9'}
              emissive="#0ea5e9"
              emissiveIntensity={beaconActive ? 3.5 : 0.8}
            />
          </mesh>
          {showLabels && (
            <Html position={[-0.3, 0.65, 0]} center distanceFactor={13}>
              <div className="px-2 py-0.5 rounded bg-slate-900/90 border border-sky-500/40 text-[10px] font-mono text-sky-300 whitespace-nowrap shadow-lg pointer-events-none">
                #1 UID Beacon
              </div>
            </Html>
          )}
        </group>

        {/* #2 Physical Mode Button */}
        <group
          position={[-8.15, 0.14, 6.04]}
          onClick={(e) => {
            e.stopPropagation();
            onCycleLedMode();
            onSelect({ type: 'component', id: 'mode-button' });
          }}
          onPointerOver={(e) => {
            e.stopPropagation();
            setHoveredLabel(`#2 Mode Button — Active: ${ledMode} (Click to Cycle LED Mode)`);
          }}
          onPointerOut={() => setHoveredLabel(null)}
        >
          <RoundedBox args={[0.28, 0.24, 0.12]} radius={0.04}>
            <meshStandardMaterial
              color={isSelectedComponent('mode-button') ? '#38bdf8' : '#0284c7'}
              metalness={0.4}
              roughness={0.3}
            />
          </RoundedBox>
        </group>

        {/* #3 Status LEDs Cluster */}
        <group
          position={[-7.55, 0.18, 6.03]}
          onClick={(e) => {
            e.stopPropagation();
            onSelect({ type: 'component', id: 'status-leds' });
          }}
          onPointerOver={(e) => {
            e.stopPropagation();
            setHoveredLabel('#3 System & Mode Status LEDs (SYST, ACTV, STAT, SPEED, DUPLX, STACK, PoE, S-PWR)');
          }}
          onPointerOut={() => setHoveredLabel(null)}
        >
          {[
            { id: 'SYST', pos: [-0.18, 0.36], active: true, fault: hasHardwareFault },
            { id: 'ACTV', pos: [0.18, 0.36], active: true, fault: false },
            { id: 'STAT', pos: [-0.18, 0.16], active: ledMode === 'STAT', fault: false },
            { id: 'SPEED', pos: [0.18, 0.16], active: ledMode === 'SPEED', fault: false },
            { id: 'DUPLX', pos: [-0.18, -0.04], active: ledMode === 'DUPLX', fault: false },
            { id: 'STACK', pos: [0.18, -0.04], active: ledMode === 'STACK', fault: false },
            { id: 'PoE', pos: [-0.18, -0.24], active: ledMode === 'PoE', fault: false },
            { id: 'S-PWR', pos: [0.18, -0.24], active: ledMode === 'S-PWR' || true, fault: false }
          ].map((led) => (
            <mesh key={led.id} position={[led.pos[0], led.pos[1], 0]}>
              <sphereGeometry args={[0.045, 10, 10]} />
              <meshStandardMaterial
                color={led.fault ? '#f59e0b' : led.active ? '#10b981' : '#475569'}
                emissive={led.fault ? '#f59e0b' : led.active ? '#10b981' : '#000000'}
                emissiveIntensity={led.active || led.fault ? 2.4 : 0}
              />
            </mesh>
          ))}
        </group>

        {/* #4 USB Mini-Type B Console Port */}
        <group
          position={[-6.88, -0.32, 6.03]}
          onClick={(e) => {
            e.stopPropagation();
            onSelect({ type: 'component', id: 'usb-mini-console' });
          }}
          onPointerOver={(e) => {
            e.stopPropagation();
            setHoveredLabel('#4 USB Mini-Type B 5-Pin Console Port');
          }}
          onPointerOut={() => setHoveredLabel(null)}
        >
          <mesh>
            <boxGeometry args={[0.3, 0.22, 0.08]} />
            <meshStandardMaterial
              color={isSelectedComponent('usb-mini-console') ? '#3b82f6' : '#64748b'}
              metalness={0.6}
              roughness={0.3}
            />
          </mesh>
          <mesh position={[0, 0.18, 0]}>
            <sphereGeometry args={[0.032, 8, 8]} />
            <meshStandardMaterial color="#10b981" emissive="#10b981" emissiveIntensity={1.6} />
          </mesh>
        </group>

        {/* #5 USB 3.0 Type-A Storage Port */}
        <group
          position={[-7.85, -0.45, 6.03]}
          onClick={(e) => {
            e.stopPropagation();
            onSelect({ type: 'component', id: 'usb-type-a' });
          }}
          onPointerOver={(e) => {
            e.stopPropagation();
            setHoveredLabel('#5 USB 3.0 Type-A Storage Port (usbflash0:)');
          }}
          onPointerOut={() => setHoveredLabel(null)}
        >
          <mesh>
            <boxGeometry args={[0.52, 0.26, 0.09]} />
            <meshStandardMaterial
              color={isSelectedComponent('usb-type-a') ? '#3b82f6' : '#cbd5e1'}
              metalness={0.7}
              roughness={0.25}
            />
          </mesh>
          <mesh position={[0, 0.03, 0.02]}>
            <boxGeometry args={[0.42, 0.07, 0.08]} />
            <meshStandardMaterial color="#0284c7" />
          </mesh>
        </group>

        {/* =========================================================
            6. CENTER 48-PORT RJ-45 DOWNLINK MATRIX (4 BANKS × 12 PORTS)
           ========================================================= */}
        <group name="Front_48_Port_Matrix">
          {/* PoE / UPOE Color Accent Bars Above & Below the 4 Port Banks */}
          {[0, 1, 2, 3].map((bankIdx) => {
            const bankCenterX = -4.75 + bankIdx * 2.4;
            return (
              <group key={bankIdx}>
                <mesh position={[bankCenterX, 0.56, 6.01]}>
                  <boxGeometry args={[2.18, 0.04, 0.04]} />
                  <meshStandardMaterial color="#eab308" emissive="#ca8a04" emissiveIntensity={0.6} />
                </mesh>
                <mesh position={[bankCenterX, -0.56, 6.01]}>
                  <boxGeometry args={[2.18, 0.04, 0.04]} />
                  <meshStandardMaterial color="#eab308" emissive="#ca8a04" emissiveIntensity={0.6} />
                </mesh>
              </group>
            );
          })}

          {portMeshesData.map((port) => {
            const isSelected =
              selectedItem?.type === 'port' && selectedItem?.portNumber === port.portNumber;
            const isHovered = hoveredPortNum === port.portNumber;
            const ledColor = getPortLedColor(port);

            return (
              <group
                key={port.portNumber}
                position={port.position}
                onClick={(e) => {
                  e.stopPropagation();
                  onSelect({ type: 'port', portNumber: port.portNumber });
                }}
                onPointerOver={(e) => {
                  e.stopPropagation();
                  setHoveredPortNum(port.portNumber);
                  setHoveredLabel(
                    `${port.interfaceName} (Port ${port.portNumber}) — ${port.connectedDevice}`
                  );
                }}
                onPointerOut={() => {
                  setHoveredPortNum(null);
                  setHoveredLabel(null);
                }}
              >
                {/* Metallic RJ-45 Shield Cage (Brighter brushed nickel/steel so every port stands out!) */}
                <mesh>
                  <boxGeometry args={[0.31, 0.34, 0.12]} />
                  <meshStandardMaterial
                    color={
                      isSelected
                        ? '#38bdf8'
                        : isHovered
                        ? '#60a5fa'
                        : port.status === 'up'
                        ? '#94a3b8'
                        : '#64748b'
                    }
                    emissive={isSelected ? '#0284c7' : isHovered ? '#1d4ed8' : '#000000'}
                    emissiveIntensity={isSelected ? 1.4 : isHovered ? 0.9 : 0}
                    metalness={0.55}
                    roughness={0.3}
                  />
                </mesh>

                {/* Inner Dark RJ-45 Jack Cavity */}
                <mesh position={[0, 0, 0.03]}>
                  <boxGeometry args={[0.22, 0.23, 0.08]} />
                  <meshStandardMaterial color="#0f172a" roughness={0.85} />
                </mesh>

                {/* Optional Plugged-In Ethernet Patch Boot */}
                {showPatchCables && port.status !== 'down' && (
                  <group position={[0, 0, 0.22]}>
                    <RoundedBox args={[0.24, 0.24, 0.36]} radius={0.04}>
                      <meshStandardMaterial
                        color={
                          port.endpointType === 'ap'
                            ? '#0ea5e9'
                            : port.endpointType === 'phone'
                            ? '#8b5cf6'
                            : port.endpointType === 'camera'
                            ? '#f59e0b'
                            : '#10b981'
                        }
                        roughness={0.4}
                      />
                    </RoundedBox>
                  </group>
                )}

                {/* Individual Port Status/Mode LED */}
                <mesh position={[0, port.isTopRow ? 0.22 : -0.22, 0.04]}>
                  <sphereGeometry args={[0.035, 8, 8]} />
                  <meshStandardMaterial
                    color={ledColor}
                    emissive={ledColor}
                    emissiveIntensity={ledColor === '#334155' ? 0 : 2.5}
                  />
                </mesh>
              </group>
            );
          })}

          {showLabels && (
            <Html position={[-1.2, 1.05, 6.05]} center distanceFactor={13}>
              <div className="px-2 py-0.5 rounded bg-slate-900/90 border border-blue-500/40 text-[10px] font-mono text-blue-300 whitespace-nowrap shadow-lg pointer-events-none">
                #5 48× RJ-45 Downlink Ports (Gi1/0/1–48)
              </div>
            </Html>
          )}
        </group>

        {/* =========================================================
            7. MODULAR HOT-SWAPPABLE NETWORK UPLINK MODULE (FRONT RIGHT)
           ========================================================= */}
        <group
          position={[6.25, 0, 6.02 + explodeFactor * 3.5]}
          onClick={(e) => {
            e.stopPropagation();
            onSelect({ type: 'component', id: 'uplink-module' });
          }}
          onPointerOver={(e) => {
            e.stopPropagation();
            setHoveredLabel(`#6 Hot-Swap Uplink Bay (${networkModuleId})`);
          }}
          onPointerOut={() => setHoveredLabel(null)}
        >
          {/* Internal Network Module PCB Card */}
          <mesh position={[0, -0.1, -1.55]}>
            <boxGeometry args={[4.1, 0.1, 3.0]} />
            <meshStandardMaterial color="#059669" metalness={0.35} roughness={0.5} />
          </mesh>

          {/* Uplink Module Front Faceplate */}
          <RoundedBox args={[4.35, 1.42, 0.16]} radius={0.04} smoothness={2}>
            <meshStandardMaterial
              color={isSelectedComponent('uplink-module') ? '#2563eb' : '#475569'}
              metalness={0.55}
              roughness={0.3}
            />
          </RoundedBox>

          {/* Left & Right Captive Knurled Thumbscrews */}
          {[-1.98, 1.98].map((tx, idx) => (
            <mesh key={idx} position={[tx, 0, 0.14]} rotation={[Math.PI / 2, 0, 0]}>
              <cylinderGeometry args={[0.1, 0.1, 0.16, 16]} />
              <meshStandardMaterial color="#cbd5e1" metalness={0.8} roughness={0.2} />
            </mesh>
          ))}

          {/* Dynamic SFP+ / QSFP+ / SFP28 Cage Geometry */}
          {networkModuleId === 'C9300-NM-8X' &&
            Array.from({ length: 8 }, (_, idx) => {
              const col = Math.floor(idx / 2);
              const isTop = idx % 2 === 0;
              const x = -1.28 + col * 0.85;
              const y = isTop ? 0.25 : -0.25;
              return (
                <group key={idx} position={[x, y, 0.06]}>
                  <mesh>
                    <boxGeometry args={[0.64, 0.38, 0.12]} />
                    <meshStandardMaterial color="#94a3b8" metalness={0.6} roughness={0.3} />
                  </mesh>
                  <mesh position={[0, 0, 0.03]}>
                    <boxGeometry args={[0.52, 0.26, 0.08]} />
                    <meshStandardMaterial color="#0f172a" roughness={0.85} />
                  </mesh>
                  <mesh position={[0, isTop ? 0.23 : -0.23, 0.02]}>
                    <sphereGeometry args={[0.034, 8, 8]} />
                    <meshStandardMaterial
                      color={idx < 4 ? '#10b981' : '#334155'}
                      emissive={idx < 4 ? '#10b981' : '#000000'}
                      emissiveIntensity={idx < 4 ? 2.2 : 0}
                    />
                  </mesh>
                </group>
              );
            })}

          {(networkModuleId === 'C9300-NM-4G' || networkModuleId === 'C9300-NM-4M') &&
            [-1.25, -0.42, 0.42, 1.25].map((x, idx) => (
              <group key={idx} position={[x, 0, 0.06]}>
                <mesh>
                  <boxGeometry args={[0.65, 0.45, 0.12]} />
                  <meshStandardMaterial color="#94a3b8" metalness={0.6} roughness={0.3} />
                </mesh>
                <mesh position={[0, 0.32, 0.02]}>
                  <sphereGeometry args={[0.038, 8, 8]} />
                  <meshStandardMaterial color="#10b981" emissive="#10b981" emissiveIntensity={2.2} />
                </mesh>
              </group>
            ))}

          {(networkModuleId === 'C9300-NM-2Q' || networkModuleId === 'C9300-NM-2Y') &&
            [-0.85, 0.85].map((x, idx) => (
              <group key={idx} position={[x, 0, 0.06]}>
                <mesh>
                  <boxGeometry args={[1.15, 0.56, 0.14]} />
                  <meshStandardMaterial color="#94a3b8" metalness={0.6} roughness={0.3} />
                </mesh>
                <mesh position={[0, 0.38, 0.02]}>
                  <sphereGeometry args={[0.042, 8, 8]} />
                  <meshStandardMaterial color="#38bdf8" emissive="#38bdf8" emissiveIntensity={2.4} />
                </mesh>
              </group>
            ))}

          {showLabels && (
            <Html position={[0, 1.05, 0.1]} center distanceFactor={13}>
              <div className="px-2 py-0.5 rounded bg-slate-900/90 border border-indigo-500/40 text-[10px] font-mono text-indigo-300 whitespace-nowrap shadow-lg pointer-events-none">
                #6 Modular Uplink ({networkModuleId})
              </div>
            </Html>
          )}
        </group>

        {/* =========================================================
            8. REAR PANEL: DUAL POWER SUPPLY MODULES (PS1 & PS2)
           ========================================================= */}
        <PowerSupplyModule3D
          id="psu-1"
          slotLabel="Power Supply 1 (PS1)"
          position={[-6.7, 0, -5.98]}
          explodeFactor={explodeFactor}
          psuState={psuStates.psu1}
          psuModel={psuModel}
          selectedId={selectedItem?.id}
          onSelect={onSelect}
          onHover={setHoveredLabel}
          showLabels={showLabels}
        />
        <PowerSupplyModule3D
          id="psu-2"
          slotLabel="Power Supply 2 (PS2)"
          position={[-3.35, 0, -5.98]}
          explodeFactor={explodeFactor}
          psuState={psuStates.psu2}
          psuModel={psuModel}
          selectedId={selectedItem?.id}
          onSelect={onSelect}
          onHover={setHoveredLabel}
          showLabels={false}
        />

        {/* =========================================================
            9. REAR PANEL: STACKWISE-480 (#10) & STACKPOWER (#7) PORTS
           ========================================================= */}
        <group
          position={[-0.75, 0.26, -6.04]}
          onClick={(e) => {
            e.stopPropagation();
            onSelect({ type: 'component', id: 'stackwise-ports' });
          }}
          onPointerOver={(e) => {
            e.stopPropagation();
            setHoveredLabel('#10 Dual StackWise-480 Data Stacking Connectors (480 Gbps Ring)');
          }}
          onPointerOut={() => setHoveredLabel(null)}
        >
          {[-0.68, 0.68].map((sx, idx) => (
            <group key={idx} position={[sx, 0, 0]}>
              <RoundedBox args={[1.15, 0.42, 0.18]} radius={0.04}>
                <meshStandardMaterial
                  color={isSelectedComponent('stackwise-ports') ? '#3b82f6' : '#cbd5e1'}
                  metalness={0.7}
                  roughness={0.25}
                />
              </RoundedBox>
              <mesh position={[0, 0, -0.06]}>
                <boxGeometry args={[0.76, 0.22, 0.1]} />
                <meshStandardMaterial color="#0f172a" />
              </mesh>
              {[-0.46, 0.46].map((boltX, bIdx) => (
                <mesh key={bIdx} position={[boltX, 0, -0.08]} rotation={[Math.PI / 2, 0, 0]}>
                  <cylinderGeometry args={[0.06, 0.06, 0.12, 12]} />
                  <meshStandardMaterial color="#e2e8f0" metalness={0.85} roughness={0.18} />
                </mesh>
              ))}
            </group>
          ))}
          {showLabels && (
            <Html position={[0, 0.9, -0.1]} center distanceFactor={13}>
              <div className="px-2 py-0.5 rounded bg-slate-900/90 border border-purple-500/40 text-[10px] font-mono text-purple-300 whitespace-nowrap shadow-lg pointer-events-none">
                #10 StackWise-480 & #7 StackPower
              </div>
            </Html>
          )}
        </group>

        {/* Cisco StackPower Connectors (#7) */}
        <group
          position={[-0.75, -0.34, -6.04]}
          onClick={(e) => {
            e.stopPropagation();
            onSelect({ type: 'component', id: 'stackpower-ports' });
          }}
          onPointerOver={(e) => {
            e.stopPropagation();
            setHoveredLabel('#7 Cisco StackPower Keyed Connectors (CAB-SPWR-30CM/150CM)');
          }}
          onPointerOut={() => setHoveredLabel(null)}
        >
          {[-0.68, 0.68].map((px, idx) => (
            <group key={idx} position={[px, 0, 0]}>
              <RoundedBox args={[0.98, 0.42, 0.18]} radius={0.04}>
                <meshStandardMaterial
                  color={
                    isSelectedComponent('stackpower-ports')
                      ? '#3b82f6'
                      : idx === 0
                      ? '#10b981'
                      : '#eab308'
                  }
                  metalness={0.45}
                  roughness={0.35}
                />
              </RoundedBox>
              <mesh position={[0, 0, -0.06]}>
                <boxGeometry args={[0.72, 0.24, 0.1]} />
                <meshStandardMaterial color="#0f172a" />
              </mesh>
            </group>
          ))}
        </group>

        {/* =========================================================
            10. REAR PANEL: 3× HOT-SWAPPABLE COOLING FANS (FAN-T2=)
           ========================================================= */}
        <FanModule3D
          id="fan-1"
          index={0}
          position={[1.7, 0, -5.98]}
          explodeFactor={explodeFactor}
          isFaulty={fanFaults.fan1}
          selectedId={selectedItem?.id}
          onSelect={onSelect}
          onHover={setHoveredLabel}
          showLabels={false}
        />
        <FanModule3D
          id="fan-2"
          index={1}
          position={[3.25, 0, -5.98]}
          explodeFactor={explodeFactor}
          isFaulty={fanFaults.fan2}
          selectedId={selectedItem?.id}
          onSelect={onSelect}
          onHover={setHoveredLabel}
          showLabels={showLabels}
        />
        <FanModule3D
          id="fan-3"
          index={2}
          position={[4.8, 0, -5.98]}
          explodeFactor={explodeFactor}
          isFaulty={fanFaults.fan3}
          selectedId={selectedItem?.id}
          onSelect={onSelect}
          onHover={setHoveredLabel}
          showLabels={false}
        />

        {/* =========================================================
            11. REAR MANAGEMENT, CONSOLE, USB 3.0 SSD, BEACON & GROUND
           ========================================================= */}
        <group
          position={[7.05, 0, -6.04]}
          onClick={(e) => {
            e.stopPropagation();
            onSelect({ type: 'component', id: 'rear-mgmt-block' });
          }}
          onPointerOver={(e) => {
            e.stopPropagation();
            setHoveredLabel('#1–5 Rear Console, Gi0/0 Out-of-Band Mgmt, USB 3.0 SSD, Beacon & Ground');
          }}
          onPointerOut={() => setHoveredLabel(null)}
        >
          <RoundedBox args={[0.92, 0.52, 0.22]} radius={0.03} position={[-0.78, 0.26, 0]}>
            <meshStandardMaterial
              color={isSelectedComponent('rear-mgmt-block') ? '#3b82f6' : '#64748b'}
              metalness={0.55}
              roughness={0.3}
            />
          </RoundedBox>

          <mesh position={[0.15, 0.28, 0]}>
            <boxGeometry args={[0.46, 0.38, 0.14]} />
            <meshStandardMaterial color="#0284c7" metalness={0.5} roughness={0.3} />
          </mesh>
          <mesh position={[0.15, -0.26, 0]}>
            <boxGeometry args={[0.46, 0.38, 0.14]} />
            <meshStandardMaterial color="#eab308" metalness={0.5} roughness={0.3} />
          </mesh>

          <mesh position={[-0.78, -0.32, -0.05]}>
            <sphereGeometry args={[0.065, 12, 12]} />
            <meshStandardMaterial
              color={beaconActive ? '#38bdf8' : '#1e3a8a'}
              emissive="#0ea5e9"
              emissiveIntensity={beaconActive ? 3.5 : 0.4}
            />
          </mesh>

          <mesh position={[0.95, -0.25, 0]}>
            <boxGeometry args={[0.62, 0.32, 0.12]} />
            <meshStandardMaterial color="#d97706" metalness={0.85} roughness={0.2} />
          </mesh>

          {showLabels && (
            <Html position={[0, 1.05, -0.1]} center distanceFactor={13}>
              <div className="px-2 py-0.5 rounded bg-slate-900/90 border border-amber-500/40 text-[10px] font-mono text-amber-300 whitespace-nowrap shadow-lg pointer-events-none">
                #1–5 Console, Gi0/0 Mgmt & 240G SSD
              </div>
            </Html>
          )}
        </group>
      </group>

      <ContactShadows position={[0, -2.02, 0]} opacity={0.5} scale={32} blur={2.4} far={6} />

      {/* Live 3D Hover Tooltip Banner */}
      {hoveredLabel && (
        <Html position={[0, 2.8 + explodeFactor * 3.0, 0]} center>
          <div className="px-3 py-1.5 rounded-lg bg-slate-950/95 border border-blue-500/60 text-xs font-medium text-blue-100 shadow-2xl whitespace-nowrap pointer-events-none">
            {hoveredLabel}
          </div>
        </Html>
      )}
    </>
  );
}

export default function CiscoChassis3D(props) {
  const brightness = props.backdropBrightness ?? 0.65;

  // Compute dynamic radial studio gradient based on user's Backdrop Brightness slider (0.0 = Deep Dark, 0.65 = Studio Slate, 1.0 = Light Showroom)
  const backdropStyle = useMemo(() => {
    const centerColor = new THREE.Color().lerpColors(
      new THREE.Color('#0f172a'),
      new THREE.Color('#cbd5e1'),
      brightness
    );
    const midColor = new THREE.Color().lerpColors(
      new THREE.Color('#090d18'),
      new THREE.Color('#94a3b8'),
      brightness
    );
    const edgeColor = new THREE.Color().lerpColors(
      new THREE.Color('#050811'),
      new THREE.Color('#475569'),
      brightness
    );
    return {
      background: `radial-gradient(ellipse at 50% 45%, #${centerColor.getHexString()} 0%, #${midColor.getHexString()} 55%, #${edgeColor.getHexString()} 100%)`
    };
  }, [brightness]);

  return (
    <div
      className="w-full h-full relative rounded-xl overflow-hidden border border-slate-700/80 shadow-2xl transition-colors duration-200"
      style={backdropStyle}
    >
      {/* Subtle Studio Dot Matrix Pattern */}
      <div
        className="absolute inset-0 opacity-20 pointer-events-none"
        style={{
          backgroundImage:
            'radial-gradient(circle at 1px 1px, rgba(148, 163, 184, 0.45) 1px, transparent 0)',
          backgroundSize: '22px 22px'
        }}
      />

      <Canvas shadows dpr={[1, 2]}>
        <SwitchScene {...props} />
      </Canvas>

      {/* Bottom-Left Interactive Legend & Controls Hint */}
      <div className="absolute bottom-3 left-3 flex flex-wrap items-center gap-2 pointer-events-none">
        <div className="px-2.5 py-1 rounded-md bg-slate-950/85 border border-slate-800 text-[11px] text-slate-300 backdrop-blur-md">
          <span className="text-sky-400 font-semibold">360° Orbit:</span> Left-Drag Spin • Right-Drag Pan • Scroll Zoom • Click Any Part/Port
        </div>
        <div className="px-2.5 py-1 rounded-md bg-slate-950/85 border border-slate-800 text-[11px] text-slate-300 backdrop-blur-md flex items-center gap-2">
          <span className="inline-block w-2 h-2 rounded-full bg-emerald-400" /> Link/OK
          <span className="inline-block w-2 h-2 rounded-full bg-amber-400 ml-1" /> STP/Warn
          <span className="inline-block w-2 h-2 rounded-full bg-rose-500 ml-1" /> Fault
          <span className="inline-block w-2 h-2 rounded-full bg-sky-400 ml-1" /> UID Beacon
        </div>
      </div>
    </div>
  );
}
