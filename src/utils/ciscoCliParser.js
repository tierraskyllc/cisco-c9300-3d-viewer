// Comprehensive Cisco IOS-XE Show Command Parser & Correlator Engine
// Supports:
// 1. show version
// 2. show cdp neighbors detail
// 3. show interfaces trunk
// 4. show ip interface brief
// 5. show interfaces status
// 6. show running-config | section interface
// 7. show vlan (or show vlan brief)

export function normalizeInterfaceName(rawName = '') {
  const s = String(rawName).trim();
  if (!s) return '';
  return s
    .replace(/^TenGigabitEthernet/i, 'Te')
    .replace(/^TwentyFiveGigE/i, 'Tw')
    .replace(/^FortyGigabitEthernet/i, 'Fo')
    .replace(/^HundredGigE/i, 'Hu')
    .replace(/^TwoGigabitEthernet/i, 'Tw')
    .replace(/^FiveGigabitEthernet/i, 'Fi')
    .replace(/^AppGigabitEthernet/i, 'Ap')
    .replace(/^GigabitEthernet/i, 'Gi')
    .replace(/^FastEthernet/i, 'Fa')
    .replace(/^Port-channel/i, 'Po')
    .replace(/^Loopback/i, 'Lo');
}

export function extractDownlinkPortNumber(normName = '') {
  // Matches Gi1/0/1..48, Te1/0/1..48, Tw1/0/1..48, Fi1/0/1..48
  const m = normName.match(/^(?:Gi|Te|Tw|Fi)\d+\/0\/(\d+)$/i);
  if (!m) return null;
  const num = parseInt(m[1], 10);
  return num >= 1 && num <= 48 ? num : null;
}

export function extractUplinkPortNumber(normName = '') {
  // Matches Gi1/1/1..8, Te1/1/1..8, Tw1/1/1..8, Fo1/1/1..8
  const m = normName.match(/^(?:Gi|Te|Tw|Fo|Hu)\d+\/1\/(\d+)$/i);
  if (!m) return null;
  const num = parseInt(m[1], 10);
  return num >= 1 && num <= 8 ? num : null;
}

// 1. PARSE: show version
export function parseShowVersion(text = '') {
  if (!text.trim()) return null;

  const versionMatch =
    text.match(/Cisco IOS XE Software,\s*Version\s+([^\s,\r\n]+)/i) ||
    text.match(/Version\s+([0-9]+\.[0-9]+[^\s,\r\n]*)/i);

  const uptimeMatch = text.match(/^([A-Za-z0-9._-]+)\s+uptime is\s+([^\r\n]+)/m);

  const modelMatch =
    text.match(/Model [Nn]umber\s*:\s*([A-Za-z0-9-]+)/) ||
    text.match(/cisco\s+(C9300[A-Za-z0-9-]*)/i);

  const serialMatch =
    text.match(/System [Ss]erial [Nn]umber\s*:\s*([A-Za-z0-9]+)/) ||
    text.match(/Processor board ID\s+([A-Za-z0-9]+)/i);

  const macMatch = text.match(/Base ethernet MAC Address\s*:\s*([0-9A-Fa-f:.]+)/i);

  // Also capture multi-switch stack inventory from "Switch Ports Model" table if present
  const stackSwitches = [];
  const stackRegex = /^\*?\s*(\d+)\s+(\d+)\s+(C9300[^\s]+)\s+([^\s]+)\s+([^\s]+)/gm;
  let sm;
  while ((sm = stackRegex.exec(text)) !== null) {
    stackSwitches.push({
      switchNumber: parseInt(sm[1], 10),
      ports: parseInt(sm[2], 10),
      model: sm[3],
      swVersion: sm[4],
      swImage: sm[5]
    });
  }

  return {
    hostname: uptimeMatch ? uptimeMatch[1].trim() : null,
    uptime: uptimeMatch ? uptimeMatch[2].trim() : null,
    iosVersion: versionMatch ? versionMatch[1].trim() : null,
    model: modelMatch ? modelMatch[1].trim().toUpperCase() : null,
    serialNumber: serialMatch ? serialMatch[1].trim().toUpperCase() : null,
    baseMac: macMatch ? macMatch[1].trim() : null,
    stackSwitches
  };
}

// 2. PARSE: show cdp neighbors detail
export function parseShowCdpNeighborsDetail(text = '') {
  if (!text.trim()) return [];
  const neighbors = [];
  const blocks = text.split(/-------------------------+/);

  for (const block of blocks) {
    const devMatch = block.match(/Device ID:\s*([^\r\n]+)/i);
    if (!devMatch) continue;

    const deviceId = devMatch[1].trim();
    const ipMatches = [...block.matchAll(/IP(?:v4)?\s+address:\s*([0-9]{1,3}(?:\.[0-9]{1,3}){3})/gi)];
    const primaryIp = ipMatches.length > 0 ? ipMatches[0][1] : null;
    const allIps = [...new Set(ipMatches.map((m) => m[1]))];

    const platMatch = block.match(/Platform:\s*([^,\r\n]+)(?:,\s*Capabilities:\s*([^\r\n]+))?/i);
    const intfMatch = block.match(
      /Interface:\s*([^,\r\n]+),\s*Port ID \(outgoing port\):\s*([^\r\n]+)/i
    );
    const verMatch = block.match(/Version\s*:\s*\r?\n([^\r\n]+)/i);
    const nativeVlanMatch = block.match(/Native VLAN:\s*(\d+)/i);
    const duplexMatch = block.match(/Duplex:\s*([^\r\n]+)/i);
    const powerDrawnMatch = block.match(/Power drawn:\s*([0-9.]+)\s*Watts/i);

    const localInterface = intfMatch ? normalizeInterfaceName(intfMatch[1]) : '';
    const remotePort = intfMatch ? normalizeInterfaceName(intfMatch[2]) : '';

    neighbors.push({
      deviceId,
      neighborIp: primaryIp || '—',
      allIps,
      platform: platMatch ? platMatch[1].trim() : 'Unknown Platform',
      capabilities: platMatch && platMatch[2] ? platMatch[2].trim() : '',
      localInterface,
      remotePort,
      softwareVersion: verMatch ? verMatch[1].trim() : '',
      nativeVlan: nativeVlanMatch ? parseInt(nativeVlanMatch[1], 10) : null,
      duplex: duplexMatch ? duplexMatch[1].trim() : null,
      powerWatts: powerDrawnMatch ? parseFloat(powerDrawnMatch[1]) : null
    });
  }

  return neighbors;
}

// 3. PARSE: show interfaces trunk
export function parseShowInterfacesTrunk(text = '') {
  if (!text.trim()) return {};
  const trunks = {};
  const lines = text.split(/\r?\n/);
  let currentSection = null;

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;

    if (/^Port\s+Mode\s+Encapsulation\s+Status\s+Native vlan/i.test(line)) {
      currentSection = 'MODE';
      continue;
    }
    if (/^Port\s+Vlans allowed on trunk/i.test(line)) {
      currentSection = 'ALLOWED';
      continue;
    }
    if (/^Port\s+Vlans allowed and active in management domain/i.test(line)) {
      currentSection = 'ACTIVE';
      continue;
    }
    if (/^Port\s+Vlans in spanning tree forwarding state/i.test(line)) {
      currentSection = 'FORWARDING';
      continue;
    }

    const portTokenMatch = line.match(
      /^((?:Gi|Te|Tw|Fo|Hu|Fi|Ap|Po|GigabitEthernet|TenGigabitEthernet|Port-channel)[A-Za-z0-9/.-]+)\s+(.+)$/i
    );
    if (!portTokenMatch) continue;

    const port = normalizeInterfaceName(portTokenMatch[1]);
    const rest = portTokenMatch[2].trim();
    if (!trunks[port]) {
      trunks[port] = {
        interfaceName: port,
        mode: 'on',
        encapsulation: '802.1q',
        status: 'trunking',
        nativeVlan: 1,
        allowedVlans: 'ALL',
        activeVlans: ''
      };
    }

    if (currentSection === 'MODE') {
      const parts = rest.split(/\s+/);
      if (parts.length >= 4) {
        trunks[port].mode = parts[0];
        trunks[port].encapsulation = parts[1];
        trunks[port].status = parts[2];
        trunks[port].nativeVlan = parseInt(parts[3], 10) || 1;
      }
    } else if (currentSection === 'ALLOWED') {
      trunks[port].allowedVlans = rest;
    } else if (currentSection === 'ACTIVE') {
      trunks[port].activeVlans = rest;
    }
  }

  return trunks;
}

// 4. PARSE: show ip interface brief
export function parseShowIpInterfaceBrief(text = '') {
  if (!text.trim()) return [];
  const results = [];
  const lines = text.split(/\r?\n/);

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || /^Interface\s+IP-Address/i.test(line) || line.includes('#')) continue;

    // Example: Vlan10                 10.10.1.2       YES NVRAM  up                    up
    const m = line.match(
      /^([A-Za-z0-9/.-]+)\s+([0-9]{1,3}(?:\.[0-9]{1,3}){3}|unassigned)\s+(YES|NO)\s+(\S+)\s+(administratively down|up|down|deleted)\s+(up|down)$/i
    );
    if (m) {
      results.push({
        interfaceName: normalizeInterfaceName(m[1]),
        ipAddress: m[2],
        ok: m[3],
        method: m[4],
        status: m[5].toLowerCase(),
        protocol: m[6].toLowerCase()
      });
    }
  }

  return results;
}

// 5. PARSE: show interfaces status
export function parseShowInterfacesStatus(text = '') {
  if (!text.trim()) return [];
  const results = [];
  const lines = text.split(/\r?\n/);

  const statusTokens = [
    'connected',
    'notconnect',
    'disabled',
    'err-disabled',
    'monitoring',
    'inactive',
    'sfpAbsent'
  ];
  const statusRegex = new RegExp(
    `^((?:Gi|Te|Tw|Fo|Hu|Fi|Ap|Fa|Po)[A-Za-z0-9/.-]+)\\s+(.*?)\\b(${statusTokens.join(
      '|'
    )})\\s+(\\S+)\\s+(\\S+)\\s+(\\S+)(?:\\s+(.*))?$`,
    'i'
  );

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || /^Port\s+Name\s+Status/i.test(line) || line.includes('#')) continue;

    const m = line.match(statusRegex);
    if (!m) continue;

    const interfaceName = normalizeInterfaceName(m[1]);
    const description = m[2].trim();
    const operStatus = m[3].toLowerCase();
    const vlan = m[4].trim();
    const duplex = m[5].trim();
    const rawSpeed = m[6].trim();
    const mediaType = (m[7] || '').trim();

    // Distinguish negotiated running speed vs set speed (e.g., a-1000 vs 1000 vs auto)
    const isAutoSpeed = /^a-/i.test(rawSpeed) || /^auto$/i.test(rawSpeed);
    const cleanRunningSpeed = rawSpeed.replace(/^a-/i, '');
    const configuredSpeed = /^a-/i.test(rawSpeed)
      ? 'auto'
      : /^auto$/i.test(rawSpeed)
      ? 'auto'
      : rawSpeed;

    results.push({
      interfaceName,
      description,
      operStatus, // 'connected' | 'notconnect' | 'disabled' | 'err-disabled'
      vlan,
      duplex,
      rawSpeed,
      runningSpeed: cleanRunningSpeed,
      configuredSpeed,
      isAutoSpeed,
      mediaType
    });
  }

  return results;
}

// 6. PARSE: show running-config | section interface
export function parseShowRunInterfaces(text = '') {
  if (!text.trim()) return {};
  const configs = {};
  const lines = text.split(/\r?\n/);
  let currentIntf = null;
  let currentLines = [];

  const flushCurrent = () => {
    if (!currentIntf) return;
    const block = currentLines.join('\n');
    const descMatch = block.match(/^\s*description\s+([^\r\n]+)/m);
    const modeMatch = block.match(/^\s*switchport mode\s+([^\r\n]+)/m);
    const accessVlanMatch = block.match(/^\s*switchport access vlan\s+(\d+)/m);
    const voiceVlanMatch = block.match(/^\s*switchport voice vlan\s+(\d+)/m);
    const nativeVlanMatch = block.match(/^\s*switchport trunk native vlan\s+(\d+)/m);
    const allowedVlanMatch = block.match(/^\s*switchport trunk allowed vlan\s+([^\r\n]+)/m);
    const speedMatch = block.match(/^\s*speed\s+([^\r\n]+)/m);
    const duplexMatch = block.match(/^\s*duplex\s+([^\r\n]+)/m);
    const ipMatch = block.match(
      /^\s*ip address\s+([0-9]{1,3}(?:\.[0-9]{1,3}){3})\s+([0-9]{1,3}(?:\.[0-9]{1,3}){3})/m
    );
    const channelGroupMatch = block.match(/^\s*channel-group\s+(\d+)\s+mode\s+(\S+)/m);
    const isShutdown = /^\s*shutdown\b/m.test(block);
    const poeMatch = block.match(/^\s*power inline\s+([^\r\n]+)/m);

    configs[currentIntf] = {
      interfaceName: currentIntf,
      rawConfig: block,
      description: descMatch ? descMatch[1].trim() : null,
      switchportMode: modeMatch ? modeMatch[1].trim() : null,
      accessVlan: accessVlanMatch ? parseInt(accessVlanMatch[1], 10) : null,
      voiceVlan: voiceVlanMatch ? parseInt(voiceVlanMatch[1], 10) : null,
      nativeVlan: nativeVlanMatch ? parseInt(nativeVlanMatch[1], 10) : null,
      allowedVlans: allowedVlanMatch ? allowedVlanMatch[1].trim() : null,
      configuredSpeed: speedMatch ? speedMatch[1].trim() : 'auto',
      configuredDuplex: duplexMatch ? duplexMatch[1].trim() : 'auto',
      ipAddress: ipMatch ? `${ipMatch[1]} ${ipMatch[2]}` : null,
      ipOnly: ipMatch ? ipMatch[1] : null,
      channelGroup: channelGroupMatch
        ? { id: parseInt(channelGroupMatch[1], 10), mode: channelGroupMatch[2] }
        : null,
      adminShutdown: isShutdown,
      poeSetting: poeMatch ? poeMatch[1].trim() : null
    };
  };

  for (const rawLine of lines) {
    const intfHeader = rawLine.match(/^interface\s+([A-Za-z0-9/.-]+)/i);
    if (intfHeader) {
      flushCurrent();
      currentIntf = normalizeInterfaceName(intfHeader[1]);
      currentLines = [rawLine.trim()];
    } else if (currentIntf) {
      if (/^!/.test(rawLine.trim())) {
        flushCurrent();
        currentIntf = null;
        currentLines = [];
      } else if (/^\s+/.test(rawLine) || rawLine.trim().startsWith('switchport') || rawLine.trim().startsWith('description') || rawLine.trim().startsWith('ip ') || rawLine.trim().startsWith('spanning-tree') || rawLine.trim().startsWith('speed') || rawLine.trim().startsWith('duplex') || rawLine.trim().startsWith('power ') || rawLine.trim().startsWith('channel-group') || rawLine.trim().startsWith('shutdown') || rawLine.trim().startsWith('no ')) {
        currentLines.push(' ' + rawLine.trim());
      }
    }
  }
  flushCurrent();

  return configs;
}

// 7. PARSE: show vlan (or show vlan brief)
export function parseShowVlan(text = '') {
  if (!text.trim()) return [];
  const vlans = [];
  const lines = text.split(/\r?\n/);
  let lastVlan = null;

  for (const rawLine of lines) {
    const line = rawLine.trimEnd();
    if (!line.trim()) continue;
    if (
      /^VLAN\s+Name\s+Status\s+Ports/i.test(line.trim()) ||
      /^----/.test(line.trim()) ||
      /^VLAN\s+Type\s+SAID/i.test(line.trim())
    ) {
      if (/^VLAN\s+Type\s+SAID/i.test(line.trim())) break; // End of primary VLAN table
      continue;
    }

    const m = line.match(
      /^\s*(\d{1,4})\s+(.+?)\s+(active|act\/unsup|suspended|act\/lshut)(?:\s+(.*))?$/i
    );
    if (m) {
      const vlanId = parseInt(m[1], 10);
      const name = m[2].trim();
      const status = m[3].toLowerCase();
      const portsRaw = m[4] || '';
      const ports = portsRaw
        .split(',')
        .map((p) => normalizeInterfaceName(p))
        .filter(Boolean);

      lastVlan = { vlanId, name, status, ports };
      vlans.push(lastVlan);
    } else if (lastVlan && /^\s{20,}([A-Za-z0-9/.,\s-]+)$/.test(rawLine)) {
      // Continuation line of ports for previous VLAN
      const extraPorts = rawLine
        .trim()
        .split(',')
        .map((p) => normalizeInterfaceName(p))
        .filter(Boolean);
      lastVlan.ports.push(...extraPorts);
    }
  }

  return vlans;
}

// MASTER CORRELATOR: Combines all 7 show commands into a complete switch & 48-port + uplink state
export function correlateSwitchShowData(rawInputs = {}) {
  const combined = [
    rawInputs.combinedText || '',
    rawInputs.showVersion || '',
    rawInputs.showCdpNeighborDetail || '',
    rawInputs.showIntTrunk || '',
    rawInputs.showIpIntBrief || '',
    rawInputs.showIntStatus || '',
    rawInputs.showRunInterface || '',
    rawInputs.showVlan || ''
  ].join('\n');

  const versionInfo =
    parseShowVersion(rawInputs.showVersion || combined) || {};
  const cdpNeighbors = parseShowCdpNeighborsDetail(
    rawInputs.showCdpNeighborDetail || combined
  );
  const trunksMap = parseShowInterfacesTrunk(
    rawInputs.showIntTrunk || combined
  );
  const ipBriefList = parseShowIpInterfaceBrief(
    rawInputs.showIpIntBrief || combined
  );
  const statusList = parseShowInterfacesStatus(
    rawInputs.showIntStatus || combined
  );
  const runConfigsMap = parseShowRunInterfaces(
    rawInputs.showRunInterface || combined
  );
  const vlansList = parseShowVlan(rawInputs.showVlan || combined);

  // Build quick lookup maps
  const vlanNameById = {};
  for (const v of vlansList) {
    vlanNameById[v.vlanId] = v.name;
  }

  const cdpByLocalIntf = {};
  for (const n of cdpNeighbors) {
    if (n.localInterface) {
      cdpByLocalIntf[n.localInterface] = n;
    }
  }

  const ipByIntf = {};
  for (const item of ipBriefList) {
    ipByIntf[item.interfaceName] = item;
  }

  const statusByIntf = {};
  for (const st of statusList) {
    statusByIntf[st.interfaceName] = st;
  }

  // Determine switch model SKU (default to C9300-48U if not explicitly matched)
  const detectedModel =
    versionInfo.model && /^C9300-48/.test(versionInfo.model)
      ? versionInfo.model
      : 'C9300-48U';
  const isMgig = detectedModel === 'C9300-48UXM';

  // Build normalized 48 Downlink Ports array for 3D Chassis & Topology Viewer
  const ports48 = [];
  for (let i = 1; i <= 48; i++) {
    const giName = `Gi1/0/${i}`;
    const teName = `Te1/0/${i}`;
    const intfName =
      statusByIntf[teName] || runConfigsMap[teName] || cdpByLocalIntf[teName]
        ? teName
        : isMgig
        ? teName
        : giName;

    const st = statusByIntf[intfName] || statusByIntf[giName] || statusByIntf[teName] || null;
    const cfg = runConfigsMap[intfName] || runConfigsMap[giName] || runConfigsMap[teName] || null;
    const cdp = cdpByLocalIntf[intfName] || cdpByLocalIntf[giName] || cdpByLocalIntf[teName] || null;
    const trk = trunksMap[intfName] || trunksMap[giName] || trunksMap[teName] || null;
    const ipInfo = ipByIntf[intfName] || ipByIntf[giName] || ipByIntf[teName] || null;

    // Determine operational status
    let status = 'down';
    if (st) {
      if (st.operStatus === 'connected') status = 'up';
      else if (st.operStatus === 'err-disabled') status = 'poe-fault';
      else status = 'down';
    } else if (ipInfo && ipInfo.protocol === 'up') {
      status = 'up';
    } else if (cdp) {
      status = 'up';
    }

    // Determine VLAN ID & Name
    let vlan = 1;
    let isTrunk = Boolean(trk) || st?.vlan === 'trunk' || cfg?.switchportMode === 'trunk';
    if (isTrunk) {
      vlan = trk?.nativeVlan || cfg?.nativeVlan || 'TRUNK';
    } else if (st?.vlan && !isNaN(parseInt(st.vlan, 10))) {
      vlan = parseInt(st.vlan, 10);
    } else if (cfg?.accessVlan) {
      vlan = cfg.accessVlan;
    }

    const vlanName = isTrunk
      ? `802.1Q Trunk (${trk?.allowedVlans || cfg?.allowedVlans || 'ALL'})`
      : vlanNameById[vlan] || `VLAN-${vlan}`;

    // Determine Interface Description
    const description =
      cfg?.description || st?.description || '';

    // Determine Running Speed & Configured Speed
    const runningSpeed = st?.runningSpeed || (status === 'up' ? '1000' : 'auto');
    const configuredSpeed =
      cfg?.configuredSpeed && cfg.configuredSpeed !== 'auto'
        ? cfg.configuredSpeed
        : st?.configuredSpeed || 'auto';

    // Determine Endpoint Type from CDP or Description
    const combinedHint = `${cdp?.platform || ''} ${cdp?.capabilities || ''} ${description}`.toLowerCase();
    let endpointType = 'workstation';
    if (status === 'down') endpointType = 'none';
    else if (combinedHint.includes('ap') || combinedHint.includes('air') || combinedHint.includes('cw91') || combinedHint.includes('c91')) endpointType = 'ap';
    else if (combinedHint.includes('phone') || combinedHint.includes('sep') || combinedHint.includes('88')) endpointType = 'phone';
    else if (combinedHint.includes('cam') || combinedHint.includes('axis') || combinedHint.includes('ptz')) endpointType = 'camera';
    else if (combinedHint.includes('print') || combinedHint.includes('mfp')) endpointType = 'printer';
    else if (combinedHint.includes('iot') || combinedHint.includes('hvac') || combinedHint.includes('bms') || combinedHint.includes('sensor')) endpointType = 'iot';
    else if (isTrunk || combinedHint.includes('c9300') || combinedHint.includes('c9500') || combinedHint.includes('switch')) endpointType = 'switch';

    const poeWatts =
      cdp?.powerWatts ||
      (status === 'up'
        ? endpointType === 'ap'
          ? 38.4
          : endpointType === 'phone'
          ? 12.8
          : endpointType === 'camera'
          ? 28.5
          : endpointType === 'iot'
          ? 11.2
          : 0
        : 0);

    const row = i % 2 === 1 ? 'Top Row (Odd)' : 'Bottom Row (Even)';
    const bank = Math.ceil(i / 12);

    ports48.push({
      portNumber: i,
      interfaceName: intfName,
      row,
      bank,
      status,
      operStatusRaw: st?.operStatus || (status === 'up' ? 'connected' : 'notconnect'),
      description: description || (status === 'up' ? 'Connected Interface' : 'No Description Set'),
      speed: runningSpeed,
      configuredSpeed,
      duplex: st?.duplex || cfg?.configuredDuplex || (status === 'up' ? 'a-full' : 'auto'),
      mediaType: st?.mediaType || '10/100/1000BaseTX',
      vlan,
      vlanName,
      voiceVlan: cfg?.voiceVlan || null,
      isTrunk,
      trunkDetails: trk || null,
      poeClass: poeWatts > 30 ? 'Class 6 (UPOE)' : poeWatts > 0 ? 'Class 4 (PoE+)' : 'Off',
      poeWatts,
      endpointType,
      connectedDevice: cdp
        ? `${cdp.deviceId} (${cdp.platform})`
        : description
        ? description
        : status === 'up'
        ? `Active Endpoint on ${intfName}`
        : 'Not Connected (RJ-45 Open)',
      cdpNeighbor: cdp || null,
      hostname: cdp?.deviceId || description || '—',
      ipAddress: cdp?.neighborIp || cfg?.ipOnly || ipInfo?.ipAddress || '—',
      macAddress: `00:50:56:${(10 + bank).toString(16)}:${(20 + i).toString(16).padStart(2, '0')}:${(40 + i).toString(16).padStart(2, '0')}`,
      cableLengthMeters: status === 'down' ? 0 : 15 + ((i * 5) % 65),
      cableCategory: 'Cat6 UTP',
      runningConfig:
        cfg?.rawConfig ||
        `interface ${intfName}\n${description ? ` description ${description}\n` : ''}${
          isTrunk
            ? ` switchport mode trunk\n switchport trunk allowed vlan ${trk?.allowedVlans || 'all'}`
            : ` switchport access vlan ${vlan}\n switchport mode access`
        }`
    });
  }

  // Also collect Uplink Ports (Te1/1/1..8, Gi1/1/1..4, Fo1/1/1..2, etc.)
  const uplinkInterfaces = [];
  const allSeenIntfs = new Set([
    ...Object.keys(statusByIntf),
    ...Object.keys(trunksMap),
    ...Object.keys(runConfigsMap),
    ...Object.keys(cdpByLocalIntf)
  ]);

  for (const intfName of allSeenIntfs) {
    const upNum = extractUplinkPortNumber(intfName);
    if (upNum !== null) {
      uplinkInterfaces.push({
        portNumber: upNum,
        interfaceName: intfName,
        status: statusByIntf[intfName]?.operStatus || (trunksMap[intfName] ? 'connected' : 'notconnect'),
        description: runConfigsMap[intfName]?.description || statusByIntf[intfName]?.description || '',
        runningSpeed: statusByIntf[intfName]?.runningSpeed || '10G',
        configuredSpeed: runConfigsMap[intfName]?.configuredSpeed || statusByIntf[intfName]?.configuredSpeed || 'auto',
        mediaType: statusByIntf[intfName]?.mediaType || 'SFP-10GBase-SR',
        isTrunk: Boolean(trunksMap[intfName]) || runConfigsMap[intfName]?.switchportMode === 'trunk',
        trunkDetails: trunksMap[intfName] || null,
        cdpNeighbor: cdpByLocalIntf[intfName] || null,
        runningConfig: runConfigsMap[intfName]?.rawConfig || ''
      });
    }
  }
  uplinkInterfaces.sort((a, b) => a.portNumber - b.portNumber);

  // Determine management IP (from Gi0/0 or first up SVI)
  const mgmtEntry =
    ipBriefList.find((x) => x.interfaceName === 'Gi0/0' && x.ipAddress !== 'unassigned') ||
    ipBriefList.find((x) => x.ipAddress !== 'unassigned');

  return {
    device: {
      hostname: versionInfo.hostname || 'C9300-CAMPUS-SW01',
      model: detectedModel,
      serialNumber: versionInfo.serialNumber || 'FOC2619Y4L2',
      iosVersion: versionInfo.iosVersion || '17.12.04',
      uptime: versionInfo.uptime || '48 days, 14 hours, 22 minutes',
      baseMac: versionInfo.baseMac || '00:a7:42:8c:19:00',
      mgmtIp: mgmtEntry ? mgmtEntry.ipAddress : '10.254.0.10',
      stackSwitches: versionInfo.stackSwitches || []
    },
    vlans: vlansList,
    ipInterfaces: ipBriefList,
    trunks: Object.values(trunksMap),
    cdpNeighbors,
    ports48,
    uplinkInterfaces,
    interfaceConfigs: runConfigsMap
  };
}

// Authentic Campus Cisco Catalyst 9300-48U Show Command Outputs for One-Click Demo & Testing
export const SAMPLE_CAMPUS_SHOW_OUTPUTS = {
  showVersion: `CAMPUS-BLDG4-IDF2-SW01# show version
Cisco IOS XE Software, Version 17.12.04
Cisco IOS Software [Dublin], Catalyst L3 Switch Software (CAT9K_IOSXE), Version 17.12.4, RELEASE SOFTWARE (fc2)
CAMPUS-BLDG4-IDF2-SW01 uptime is 114 days, 6 hours, 41 minutes
cisco C9300-48U (X86) processor with 1412961K/6147K bytes of memory.
Processor board ID FOC2534L9K1
Base ethernet MAC Address          : 70:ea:1a:94:22:80
Model Number                       : C9300-48U
System Serial Number               : FOC2534L9K1

Switch Ports Model              SW Version        SW Image              Mode
------ ----- -----              ----------        ----------            ----
*    1 56    C9300-48U          17.12.04          CAT9K_IOSXE           INSTALL
     2 56    C9300-48U          17.12.04          CAT9K_IOSXE           INSTALL`,

  showVlan: `CAMPUS-BLDG4-IDF2-SW01# show vlan brief

VLAN Name                             Status    Ports
---- -------------------------------- --------- -------------------------------
1    default                          active    Gi1/0/7, Gi1/0/15, Gi1/0/23
10   CORP-ENG-WORKSTATIONS            active    Gi1/0/9, Gi1/0/11, Gi1/0/13, Gi1/0/17, Gi1/0/21
20   CAMPUS-WIFI6E-AP-MGMT            active    Gi1/0/1, Gi1/0/2, Gi1/0/3, Gi1/0/4, Gi1/0/5, Gi1/0/6, Gi1/0/8
30   ENTERPRISE-PRINTERS              active    Gi1/0/37, Gi1/0/39, Gi1/0/41
40   PHYSICAL-SECURITY-CCTV           active    Gi1/0/25, Gi1/0/26, Gi1/0/27, Gi1/0/28
50   SMART-BLDG-BACNET-UPOE           active    Gi1/0/29, Gi1/0/30, Gi1/0/32, Gi1/0/34, Gi1/0/36
110  CISCO-UNIFIED-VOICE              active    Gi1/0/10, Gi1/0/12, Gi1/0/14, Gi1/0/16, Gi1/0/18, Gi1/0/20, Gi1/0/22, Gi1/0/24
999  BLACKHOLE-UNUSED                 active    Gi1/0/31, Gi1/0/35, Gi1/0/43, Gi1/0/44, Gi1/0/45, Gi1/0/46`,

  showIpIntBrief: `CAMPUS-BLDG4-IDF2-SW01# show ip interface brief
Interface              IP-Address      OK? Method Status                Protocol
GigabitEthernet0/0     10.254.4.22     YES NVRAM  up                    up
Vlan1                  unassigned      YES NVRAM  administratively down down
Vlan10                 10.4.10.2       YES NVRAM  up                    up
Vlan20                 10.4.20.2       YES NVRAM  up                    up
Vlan40                 10.4.40.2       YES NVRAM  up                    up
Vlan50                 10.4.50.2       YES NVRAM  up                    up
Vlan110                10.4.110.2      YES NVRAM  up                    up
GigabitEthernet1/0/1   unassigned      YES unset  up                    up
GigabitEthernet1/0/2   unassigned      YES unset  up                    up
TenGigabitEthernet1/1/1 unassigned     YES unset  up                    up
TenGigabitEthernet1/1/2 unassigned     YES unset  up                    up`,

  showIntTrunk: `CAMPUS-BLDG4-IDF2-SW01# show int trunk

Port        Mode             Encapsulation  Status        Native vlan
Gi1/0/47    on               802.1q         trunking      20
Gi1/0/48    on               802.1q         trunking      1
Te1/1/1     desirable        802.1q         trunking      1
Te1/1/2     desirable        802.1q         trunking      1
Po1         on               802.1q         trunking      1

Port        Vlans allowed on trunk
Gi1/0/47    10,20,110
Gi1/0/48    10,20,30,40,50,110
Te1/1/1     10,20,30,40,50,110
Te1/1/2     10,20,30,40,50,110
Po1         10,20,30,40,50,110

Port        Vlans allowed and active in management domain
Gi1/0/47    10,20,110
Gi1/0/48    10,20,30,40,50,110
Te1/1/1     10,20,30,40,50,110
Te1/1/2     10,20,30,40,50,110
Po1         10,20,30,40,50,110`,

  showIntStatus: `CAMPUS-BLDG4-IDF2-SW01# show interface status

Port      Name               Status       Vlan       Duplex  Speed Type
Gi1/0/1   AP-BLDG4-301-EAST  connected    20         a-full  a-1000 10/100/1000BaseTX
Gi1/0/2   AP-BLDG4-302-WEST  connected    20         a-full  a-1000 10/100/1000BaseTX
Gi1/0/3   AP-BLDG4-303-AUD   connected    20         a-full  a-1000 10/100/1000BaseTX
Gi1/0/4   AP-BLDG4-304-LAB   connected    20         a-full  a-1000 10/100/1000BaseTX
Gi1/0/5   AP-BLDG4-305-LOBBY connected    20         a-full  a-1000 10/100/1000BaseTX
Gi1/0/6   AP-BLDG4-306-CAFE  connected    20         a-full  a-1000 10/100/1000BaseTX
Gi1/0/7                      notconnect   1            auto    auto 10/100/1000BaseTX
Gi1/0/8   AP-BLDG4-308-PATIO connected    20         a-full  a-1000 10/100/1000BaseTX
Gi1/0/9   ENG-CAD-WS-01      connected    10         a-full  a-1000 10/100/1000BaseTX
Gi1/0/10  IPPHONE-RM310      connected    110        a-full  a-1000 10/100/1000BaseTX
Gi1/0/11  ENG-CAD-WS-02      connected    10         a-full  a-1000 10/100/1000BaseTX
Gi1/0/12  IPPHONE-RM312      connected    110        a-full  a-1000 10/100/1000BaseTX
Gi1/0/13  ENG-SIM-SERVER     connected    10           full    1000 10/100/1000BaseTX
Gi1/0/14  IPPHONE-DEAN-OFF   connected    110        a-full  a-1000 10/100/1000BaseTX
Gi1/0/15                     notconnect   1            auto    auto 10/100/1000BaseTX
Gi1/0/16  IPPHONE-CONF-3A    connected    110        a-full  a-1000 10/100/1000BaseTX
Gi1/0/17  LAB-INSTRUMENT-PC  connected    10         a-full   a-100 10/100/1000BaseTX
Gi1/0/18  IPPHONE-CONF-3B    connected    110        a-full  a-1000 10/100/1000BaseTX
Gi1/0/19  REDUNDANT-LINK     connected    10         a-full  a-1000 10/100/1000BaseTX
Gi1/0/20  IPPHONE-RECEPTION  connected    110        a-full  a-1000 10/100/1000BaseTX
Gi1/0/25  CCTV-PTZ-NORTH-ENT connected    40         a-full  a-1000 10/100/1000BaseTX
Gi1/0/26  CCTV-PTZ-SOUTH-LOT connected    40         a-full  a-1000 10/100/1000BaseTX
Gi1/0/27  CCTV-DOME-STAIR-A  connected    40         a-full   a-100 10/100/1000BaseTX
Gi1/0/28  CCTV-DOME-ELEVATOR connected    40         a-full   a-100 10/100/1000BaseTX
Gi1/0/29  BACNET-AHU4-CTRL   connected    50           full     100 10/100/1000BaseTX
Gi1/0/30  UPOE-LED-GRID-301  connected    50         a-full   a-100 10/100/1000BaseTX
Gi1/0/31  UNUSED-PORT        disabled     999          auto    auto 10/100/1000BaseTX
Gi1/0/33  BAD-PATCH-CABLE    err-disabled 10           auto    auto 10/100/1000BaseTX
Gi1/0/37  XEROX-MFP-3FL-COPY connected    30         a-full  a-1000 10/100/1000BaseTX
Gi1/0/47  FLEX-AP-TRUNK-309  connected    trunk      a-full  a-1000 10/100/1000BaseTX
Gi1/0/48  DOWNLINK-COMPACT-SW connected   trunk        full    1000 10/100/1000BaseTX
Te1/1/1   UPLINK-CORE-9500-A connected    trunk        full     10G SFP-10GBase-SR
Te1/1/2   UPLINK-CORE-9500-B connected    trunk        full     10G SFP-10GBase-SR`,

  showCdpNeighborDetail: `CAMPUS-BLDG4-IDF2-SW01# show cdp neighbors detail
-------------------------
Device ID: AP-BLDG4-301-EAST.fdu.edu
Entry address(es): 
  IP address: 10.4.20.101
Platform: Cisco Catalyst CW9166I-B,  Capabilities: Router Trans-Bridge 
Interface: GigabitEthernet1/0/1,  Port ID (outgoing port): GigabitEthernet0
Version :
Cisco AP Software, (ap1g6a), Version: 17.12.4.0
Power drawn: 38.400 Watts
-------------------------
Device ID: AP-BLDG4-302-WEST.fdu.edu
Entry address(es): 
  IP address: 10.4.20.102
Platform: Cisco Catalyst CW9166I-B,  Capabilities: Router Trans-Bridge 
Interface: GigabitEthernet1/0/2,  Port ID (outgoing port): GigabitEthernet0
Power drawn: 38.400 Watts
-------------------------
Device ID: SEP0050569A310A
Entry address(es): 
  IP address: 10.4.110.45
Platform: Cisco IP Phone 8865,  Capabilities: Host Phone Two-Port Mac Relay 
Interface: GigabitEthernet1/0/10,  Port ID (outgoing port): Port 1
Power drawn: 14.200 Watts
-------------------------
Device ID: SEP0050569A312B
Entry address(es): 
  IP address: 10.4.110.48
Platform: Cisco IP Phone 8865,  Capabilities: Host Phone Two-Port Mac Relay 
Interface: GigabitEthernet1/0/12,  Port ID (outgoing port): Port 1
Power drawn: 14.200 Watts
-------------------------
Device ID: BLDG4-LAB-C2960CX.fdu.edu
Entry address(es): 
  IP address: 10.4.10.250
Platform: cisco WS-C2960CX-8PC-L,  Capabilities: Switch IGMP 
Interface: GigabitEthernet1/0/48,  Port ID (outgoing port): GigabitEthernet0/11
-------------------------
Device ID: CAMPUS-CORE-C9500-01.fdu.edu
Entry address(es): 
  IP address: 10.254.0.1
Platform: cisco C9500-48Y4C,  Capabilities: Router Switch IGMP 
Interface: TenGigabitEthernet1/1/1,  Port ID (outgoing port): TwentyFiveGigE1/0/24
-------------------------
Device ID: CAMPUS-CORE-C9500-02.fdu.edu
Entry address(es): 
  IP address: 10.254.0.2
Platform: cisco C9500-48Y4C,  Capabilities: Router Switch IGMP 
Interface: TenGigabitEthernet1/1/2,  Port ID (outgoing port): TwentyFiveGigE1/0/24`,

  showRunInterface: `CAMPUS-BLDG4-IDF2-SW01# show run | section interface
interface GigabitEthernet0/0
 vrf forwarding Mgmt-vrf
 description OOB-CAMPUS-MGMT-NETWORK
 ip address 10.254.4.22 255.255.255.0
 negotiation auto
!
interface GigabitEthernet1/0/1
 description AP-BLDG4-301-EAST (Wi-Fi 6E CW9166I)
 switchport access vlan 20
 switchport mode access
 power inline four-pair forced
 spanning-tree portfast
!
interface GigabitEthernet1/0/2
 description AP-BLDG4-302-WEST (Wi-Fi 6E CW9166I)
 switchport access vlan 20
 switchport mode access
 power inline four-pair forced
 spanning-tree portfast
!
interface GigabitEthernet1/0/9
 description ENG-CAD-WS-01 (Room 309)
 switchport access vlan 10
 switchport mode access
 spanning-tree portfast
!
interface GigabitEthernet1/0/10
 description IPPHONE-RM310 + WORKSTATION
 switchport access vlan 10
 switchport mode access
 switchport voice vlan 110
 spanning-tree portfast
!
interface GigabitEthernet1/0/13
 description ENG-SIM-SERVER (Static 1000/Full)
 switchport access vlan 10
 switchport mode access
 speed 1000
 duplex full
 spanning-tree portfast
!
interface GigabitEthernet1/0/25
 description CCTV-PTZ-NORTH-ENT (Axis Q6135 UPOE)
 switchport access vlan 40
 switchport mode access
 power inline max 60000
 spanning-tree portfast
!
interface GigabitEthernet1/0/29
 description BACNET-AHU4-CTRL (Static 100/Full)
 switchport access vlan 50
 switchport mode access
 speed 100
 duplex full
!
interface GigabitEthernet1/0/31
 description UNUSED-PARKING-SHUTDOWN
 switchport access vlan 999
 switchport mode access
 shutdown
!
interface GigabitEthernet1/0/47
 description FLEXCONNECT-AP-TRUNK-309
 switchport trunk native vlan 20
 switchport trunk allowed vlan 10,20,110
 switchport mode trunk
 spanning-tree portfast trunk
!
interface GigabitEthernet1/0/48
 description DOWNLINK-COMPACT-SW (BLDG4-LAB-C2960CX)
 switchport trunk allowed vlan 10,20,30,40,50,110
 switchport mode trunk
 speed 1000
 duplex full
!
interface TenGigabitEthernet1/1/1
 description UPLINK-CAMPUS-CORE-C9500-01 (Te1/1/1 -> Tw1/0/24)
 switchport trunk allowed vlan 10,20,30,40,50,110
 switchport mode trunk
 channel-group 1 mode active
!
interface TenGigabitEthernet1/1/2
 description UPLINK-CAMPUS-CORE-C9500-02 (Te1/1/2 -> Tw1/0/24)
 switchport trunk allowed vlan 10,20,30,40,50,110
 switchport mode trunk
 channel-group 1 mode active`
};
