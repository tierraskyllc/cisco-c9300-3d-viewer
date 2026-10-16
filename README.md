# Cisco Catalyst 9300 (48-Port) — Interactive 3D Hardware & Topology Explorer

An interactive 3D hardware breakdown and linked network topology visualizer for the **Cisco Catalyst 9300 Series 48-Port Switch**, built with **React 18**, **Three.js**, **React Three Fiber (`@react-three/fiber`)**, **Drei (`@react-three/drei`)**, and **Tailwind CSS**.

## Features

- **360° Interactive 3D Chassis (`CiscoChassis3D.jsx`)**:
  - Real-time orbit, pan, zoom, and smooth camera angle presets (`Front 0°`, `Rear 180°`, `Left 270°`, `Right 90°`, `Top / Internal PCB`, `48 Ports`, `Uplink Bay`).
  - **Exploded Disassembly View (`0%–100%`) & Internal X-Ray Mode**: Inspect the internal **Cisco UADP 2.0 ASIC + Copper Skived Heatsink**, **x86-64 CPU Complex & DDR4 DRAM**, and **PoE+/UPOE+ Isolation Magnetics Daughterboard**.
  - **Thermal Airflow Simulation**: Animated front/side-to-rear cooling streamlines through the 3 spinning `FAN-T2=` fan modules.
- **Complete Front & Rear Panel Drill-Down (`c9300HardwareData.js`)**:
  - Interactive **Mode Button** cycling port LEDs across `STAT`, `SPEED`, `DUPLX`, `ACTV`, `STACK`, `PoE`, `S-PWR`, and `XPS`.
  - Interactive **Blue UID Beacon LED** (synchronized front UID button & rear BEACON indicator).
  - Hot-swappable **Network Uplink Modules** (`C9300-NM-8X`, `C9300-NM-4G`, `C9300-NM-4M`, `C9300-NM-2Q`, `C9300-NM-2Y`, `C9300-NM-BLANK`).
  - Dual redundant hot-swap **Power Supply Bays (`PS1` & `PS2`)**, **StackWise-480**, **Cisco StackPower**, **3× Fan Modules (`FAN-T2=`)**, and rear **Console / Gi0/0 Mgmt / 240GB USB 3.0 SSD**.
- **Bi-Directionally Linked Network Topology Viewer (`TopologyViewer.jsx` & `ControlPanel.jsx`)**:
  - Click any port on the 3D switch or faceplate map to highlight the connected endpoint in the topology graph, inspect T568B/UPOE 4-pair pinouts, simulate STP blocking or PoE faults, and copy IOS-XE CLI verification commands.

## Getting Started

```bash
npm install
npm run dev
```
