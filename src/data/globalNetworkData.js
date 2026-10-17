// Global Multi-Campus, Colocation (Halsey165 / Hastings), ISP & Switch-to-Switch Link Reconciler
// Supports ~3,000 devices across 3 Campuses (Metro, Florham, VancOakridge) and 2 Colocations (Halsey165, Hastings)

import { normalizeInterfaceName } from '../utils/ciscoCliParser.js';

export const GLOBAL_SITES = {
  Metro: {
    id: 'Metro',
    shortName: 'Metro',
    name: 'Metropolitan Campus',
    country: 'United States',
    flag: '🇺🇸',
    region: 'Teaneck / Hackensack, NJ',
    type: 'campus',
    colocationHub: 'Halsey165',
    targetDeviceCount: 1000,
    coordinates: { lat: 40.8923, lng: -74.0285 },
    description: 'Primary US Metropolitan Campus (~1,000 switches/routers/APs). Connects via redundant dark-fiber/Metro-E trunks to Halsey165 colocation.'
  },
  Florham: {
    id: 'Florham',
    shortName: 'Florham',
    name: 'Florham Campus',
    country: 'United States',
    flag: '🇺🇸',
    region: 'Madison / Florham Park, NJ',
    type: 'campus',
    colocationHub: 'Halsey165',
    targetDeviceCount: 1000,
    coordinates: { lat: 40.7751, lng: -74.4321 },
    description: 'US Florham Campus (~1,000 switches/routers/APs). Aggregates north-east into Halsey165 colocation.'
  },
  Halsey165: {
    id: 'Halsey165',
    shortName: 'Halsey165',
    name: '165 Halsey Colocation Hub',
    country: 'United States',
    flag: '🇺🇸',
    region: '165 Halsey St, Newark, NJ',
    type: 'colocation',
    connectedCampuses: ['Metro', 'Florham'],
    targetDeviceCount: 80,
    coordinates: { lat: 40.7372, lng: -74.1724 },
    description: 'US Carrier Hotel & Colocation Hub sitting between Metro and Florham campuses. Terminates campus fiber waves, US ISP BGP handoffs, and cross-border WAN to Hastings (Canada).'
  },
  VancOakridge: {
    id: 'VancOakridge',
    shortName: 'VancOakridge',
    name: 'Vancouver Oakridge Campus',
    country: 'Canada',
    flag: '🇨🇦',
    region: 'Vancouver, BC (Oakridge)',
    type: 'campus',
    colocationHub: 'Hastings',
    targetDeviceCount: 1000,
    coordinates: { lat: 49.2266, lng: -123.1162 },
    description: 'Canadian Campus at Oakridge (~1,000 target devices). Connects via high-speed metro fiber to Hastings colocation.'
  },
  Hastings: {
    id: 'Hastings',
    shortName: 'Hastings',
    name: 'Hastings Colocation Hub',
    country: 'Canada',
    flag: '🇨🇦',
    region: 'West Hastings St, Vancouver, BC',
    type: 'colocation',
    connectedCampuses: ['VancOakridge'],
    targetDeviceCount: 60,
    coordinates: { lat: 49.2846, lng: -123.1119 },
    description: 'Canadian Colocation & Carrier Hub in downtown Vancouver. Terminates VancOakridge campus fiber, Canadian ISP transit, and cross-border core tunnel to Halsey165.'
  }
};

export const ISP_PROVIDERS = [
  {
    id: 'ISP-US-PRIMARY',
    name: 'US Primary ISP / Tier-1 Transit',
    country: 'United States',
    flag: '🇺🇸',
    terminatesAt: 'Halsey165',
    handoffType: '100G / 40G Single-Mode Fiber (LR4)',
    protocol: 'eBGP Full/Default Table + DDoS Scrubbing',
    status: 'up'
  },
  {
    id: 'ISP-US-RESEARCH',
    name: 'US Secondary ISP / R&E Transit',
    country: 'United States',
    flag: '🇺🇸',
    terminatesAt: 'Halsey165',
    handoffType: '40G / 10G Fiber Handoff',
    protocol: 'eBGP Redundant Peering',
    status: 'up'
  },
  {
    id: 'ISP-CA-PRIMARY',
    name: 'Canada Primary ISP / Vancouver Transit',
    country: 'Canada',
    flag: '🇨🇦',
    terminatesAt: 'Hastings',
    handoffType: '40G / 10G Single-Mode Fiber (LR)',
    protocol: 'eBGP Canadian Edge Transit',
    status: 'up'
  },
  {
    id: 'ISP-CA-SECONDARY',
    name: 'Canada Secondary ISP / BCNET Peering',
    country: 'Canada',
    flag: '🇨🇦',
    terminatesAt: 'Hastings',
    handoffType: '10G Fiber Handoff',
    protocol: 'eBGP Backup & Regional Peering',
    status: 'up'
  }
];

export const BACKBONE_CIRCUITS = [
  {
    id: 'CKT-METRO-HALSEY',
    fromSite: 'Metro',
    toSite: 'Halsey165',
    media: 'Dark Fiber / DWDM Wave',
    speed: '40G / 100G',
    role: 'Metro ↔ Halsey165 Core Interconnect'
  },
  {
    id: 'CKT-FLORHAM-HALSEY',
    fromSite: 'Florham',
    toSite: 'Halsey165',
    media: 'Dark Fiber / Metro Optical',
    speed: '40G / 100G',
    role: 'Florham ↔ Halsey165 Core Interconnect'
  },
  {
    id: 'CKT-VANC-HASTINGS',
    fromSite: 'VancOakridge',
    toSite: 'Hastings',
    media: 'Metro Single-Mode Fiber',
    speed: '10G / 40G',
    role: 'VancOakridge ↔ Hastings Core Interconnect'
  },
  {
    id: 'CKT-HALSEY-HASTINGS',
    fromSite: 'Halsey165',
    toSite: 'Hastings',
    media: 'Cross-Border WAN / MPLS / IPsec',
    speed: '10G Redundant',
    role: 'US (Halsey165) ↔ Canada (Hastings) Inter-Colocation Backbone'
  }
];

// Infer site code (Metro, Florham, Halsey165, VancOakridge, Hastings) from switch hostname or saved site_name
export function inferSiteCode(hostname = '', rawSiteName = '') {
  const s = String(rawSiteName).trim();
  if (GLOBAL_SITES[s]) return s;
  const sUpper = s.toUpperCase();
  if (sUpper.includes('HALSEY')) return 'Halsey165';
  if (sUpper.includes('FLORHAM')) return 'Florham';
  if (sUpper.includes('HASTINGS')) return 'Hastings';
  if (sUpper.includes('VANC') || sUpper.includes('OAKRIDGE')) return 'VancOakridge';
  if (sUpper.includes('METRO')) return 'Metro';

  const h = String(hostname).trim().toUpperCase();
  if (h.startsWith('T-') || h.includes('-BAN-') || h.includes('METRO')) return 'Metro';
  if (h.startsWith('F-') || h.startsWith('M-') || h.includes('FLOR')) return 'Florham';
  if (h.includes('HALSEY') || h.startsWith('H165')) return 'Halsey165';
  if (h.startsWith('V-') || h.includes('VANC') || h.includes('OAK')) return 'VancOakridge';
  if (h.includes('HAST')) return 'Hastings';

  return 'Metro';
}

// Strip domain suffix (e.g. "T-BAN-1FL-108B-MDF-C9300X.fdu.edu" -> "T-BAN-1FL-108B-MDF-C9300X")
export function normalizeHostname(name = '') {
  return String(name)
    .trim()
    .replace(/\.[a-zA-Z0-9.-]+$/, '')
    .toUpperCase();
}

// Determine if an interface/media type is Fiber Optic vs Copper Ethernet
export function classifyLinkMedia(localPort = '', remotePort = '', mediaType = '', platform = '') {
  const m = `${mediaType} ${localPort} ${remotePort}`.toUpperCase();
  if (
    m.includes('BASETX') ||
    m.includes('BASE-T') ||
    m.includes('RJ45') ||
    m.includes('10/100/1000')
  ) {
    return {
      category: 'copper',
      label: 'Copper Ethernet (Cat6/Cat6A)',
      shortLabel: 'Copper RJ-45'
    };
  }
  if (
    m.includes('SFP') ||
    m.includes('QSFP') ||
    m.includes('-SR') ||
    m.includes('-LR') ||
    m.includes('-ER') ||
    m.includes('FO1/') ||
    m.includes('TW1/') ||
    m.includes('HU1/') ||
    /^(?:TE|FO|TW|HU)\d+\/1\//.test(localPort.toUpperCase()) ||
    /^(?:TE|FO|TW|HU)\d+\/1\//.test(remotePort.toUpperCase())
  ) {
    return {
      category: 'fiber',
      label: 'Fiber Optic Trunk (SFP+/QSFP+)',
      shortLabel: 'Fiber Optic'
    };
  }
  if (String(platform).toUpperCase().includes('AIR-') || String(platform).toUpperCase().includes('C91')) {
    return {
      category: 'copper-poe',
      label: 'Copper PoE/UPOE Access Cable',
      shortLabel: 'Copper PoE'
    };
  }
  return {
    category: 'copper',
    label: 'Physical Switch Interconnect',
    shortLabel: 'Copper / Trunk'
  };
}

/**
 * Reconciles all polled switches in PostgreSQL + their CDP neighbors into:
 * - nodes: Polled switches + Unpolled CDP neighbor switches/routers/APs
 * - links: Point-A [Port A] <---> [Port B] Point-B physical connections (deduplicated & bi-directionally verified when both ends are polled)
 * - siteStats: Per-site counts for Metro, Florham, Halsey165, VancOakridge, Hastings
 */
export function buildGlobalAndSiteTopology(savedDevices = [], activeParsedSwitch = null) {
  const allDevices = [...savedDevices];

  // Ensure activeParsedSwitch is represented even if running in offline preview mode
  if (activeParsedSwitch?.device?.serialNumber) {
    const exists = allDevices.some(
      (d) => d.serial_number === activeParsedSwitch.device.serialNumber
    );
    if (!exists) {
      allDevices.unshift({
        id: 'active-preview',
        hostname: activeParsedSwitch.device.hostname,
        model: activeParsedSwitch.device.model,
        serial_number: activeParsedSwitch.device.serialNumber,
        ios_version: activeParsedSwitch.device.iosVersion,
        mgmt_ip: activeParsedSwitch.device.mgmtIp,
        site_name: inferSiteCode(activeParsedSwitch.device.hostname),
        building_name: 'IDF Closet',
        parsed_snapshot: activeParsedSwitch
      });
    }
  }

  const nodesByKey = new Map();
  const polledByNormHost = new Map();
  const polledByIp = new Map();

  // Step 1: Register all Polled Switch Nodes from PostgreSQL
  for (const dev of allDevices) {
    const snap = dev.parsed_snapshot || {};
    const hostname = snap.device?.hostname || dev.hostname || 'Unknown-Switch';
    const normHost = normalizeHostname(hostname);
    const model = snap.device?.model || dev.model || 'C9300';
    const mgmtIp = snap.device?.mgmtIp || dev.mgmt_ip || '—';
    const siteCode = inferSiteCode(hostname, dev.site_name);
    const ports = snap.ports48 || [];
    const connectedPorts = ports.filter((p) => p.status === 'up').length;

    const node = {
      key: normHost,
      hostname,
      normHost,
      model,
      portCount: model.includes('-24') ? 24 : 48,
      serialNumber: dev.serial_number,
      iosVersion: snap.device?.iosVersion || dev.ios_version || '17.x',
      mgmtIp,
      siteCode,
      buildingName: dev.building_name || 'Campus MDF/IDF',
      isPolled: true,
      nodeRole:
        siteCode === 'Halsey165' || siteCode === 'Hastings'
          ? 'colocation-switch'
          : hostname.toUpperCase().includes('MDF') || hostname.toUpperCase().includes('CORE')
          ? 'core-mdf-switch'
          : 'access-idf-switch',
      connectedPorts,
      totalPorts: ports.length || (model.includes('-24') ? 24 : 48),
      cdpCount: (snap.cdpNeighbors || []).length,
      trunkCount: (snap.trunks || []).length,
      vlanCount: (snap.vlans || []).length,
      rawDeviceRecord: dev
    };

    nodesByKey.set(normHost, node);
    polledByNormHost.set(normHost, node);
    if (mgmtIp && mgmtIp !== '—') {
      polledByIp.set(mgmtIp, node);
    }
  }

  // Step 2: Build Point-A [Port] <-> [Port] Point-B Physical Links from CDP + Trunks
  const linksByCanonicalKey = new Map();

  for (const dev of allDevices) {
    const snap = dev.parsed_snapshot || {};
    const sourceHost = snap.device?.hostname || dev.hostname;
    const sourceNorm = normalizeHostname(sourceHost);
    const sourceNode = nodesByKey.get(sourceNorm);
    if (!sourceNode) continue;

    const portsByIntf = {};
    for (const p of snap.ports48 || []) {
      portsByIntf[normalizeInterfaceName(p.interfaceName)] = p;
    }
    for (const u of snap.uplinkInterfaces || []) {
      portsByIntf[normalizeInterfaceName(u.interfaceName)] = u;
    }
    const trunksByIntf = {};
    for (const t of snap.trunks || []) {
      trunksByIntf[normalizeInterfaceName(t.interfaceName)] = t;
    }

    for (const cdp of snap.cdpNeighbors || []) {
      const localPort = normalizeInterfaceName(cdp.localInterface || '');
      const remotePort = normalizeInterfaceName(cdp.remotePort || '');
      const targetRawHost = cdp.deviceId || 'Unknown-Neighbor';
      const targetNorm = normalizeHostname(targetRawHost);

      // Check if target is already a Polled Switch in PostgreSQL (by hostname or IP)
      let targetNode =
        polledByNormHost.get(targetNorm) ||
        (cdp.neighborIp && cdp.neighborIp !== '—' ? polledByIp.get(cdp.neighborIp) : null);

      const isSwitchOrRouter =
        /switch|router|c9300|c9500|c9200|c9400|c9600|nexus|isr|asr|cat9k/i.test(
          `${cdp.platform || ''} ${cdp.capabilities || ''} ${targetRawHost}`
        ) && !/air-|c9120|c9130|cw916/i.test(cdp.platform || '');

      if (!targetNode) {
        const inferredSite = inferSiteCode(targetRawHost, sourceNode.siteCode);
        targetNode = nodesByKey.get(targetNorm);
        if (!targetNode) {
          targetNode = {
            key: targetNorm,
            hostname: targetRawHost,
            normHost: targetNorm,
            model: cdp.platform ? cdp.platform.replace(/^cisco\s+/i, '') : 'CDP Neighbor',
            portCount: cdp.platform?.includes('-24') ? 24 : 48,
            serialNumber: null,
            iosVersion: cdp.softwareVersion || 'Discovered via CDP',
            mgmtIp: cdp.neighborIp || '—',
            siteCode: inferredSite,
            buildingName: `Connected via ${sourceHost} (${localPort})`,
            isPolled: false,
            nodeRole: isSwitchOrRouter ? 'unpolled-switch' : 'endpoint-device',
            connectedPorts: 1,
            totalPorts: cdp.platform?.includes('-24') ? 24 : 48,
            cdpCount: 0,
            trunkCount: 0,
            vlanCount: 0
          };
          nodesByKey.set(targetNorm, targetNode);
        }
      }

      const localPortObj = portsByIntf[localPort] || null;
      const trunkObj = trunksByIntf[localPort] || localPortObj?.trunkDetails || null;
      const mediaInfo = classifyLinkMedia(
        localPort,
        remotePort,
        localPortObj?.mediaType || '',
        cdp.platform || ''
      );

      // Canonical key so SwitchA(Te1/0/24)<->SwitchB(Te1/0/7) and SwitchB(Te1/0/7)<->SwitchA(Te1/0/24) merge!
      const endpointA = `${sourceNode.key}:${localPort}`;
      const endpointB = `${targetNode.key}:${remotePort}`;
      const canonicalKey =
        endpointA < endpointB ? `${endpointA}<-->${endpointB}` : `${endpointB}<-->${endpointA}`;

      const existingLink = linksByCanonicalKey.get(canonicalKey);
      if (existingLink) {
        existingLink.bidirectionalVerified = true;
      } else {
        linksByCanonicalKey.set(canonicalKey, {
          id: canonicalKey,
          siteCode: sourceNode.siteCode,
          sourceKey: sourceNode.key,
          sourceHostname: sourceNode.hostname,
          sourceModel: sourceNode.model,
          sourceIp: sourceNode.mgmtIp,
          sourcePort: localPort || '—',
          sourceIsPolled: sourceNode.isPolled,
          targetKey: targetNode.key,
          targetHostname: targetNode.hostname,
          targetModel: targetNode.model,
          targetIp: targetNode.mgmtIp !== '—' ? targetNode.mgmtIp : cdp.neighborIp || '—',
          targetPort: remotePort || '—',
          targetIsPolled: targetNode.isPolled,
          targetRole: targetNode.nodeRole,
          targetSerial: targetNode.serialNumber,
          mediaCategory: mediaInfo.category,
          mediaLabel: mediaInfo.label,
          mediaShortLabel: mediaInfo.shortLabel,
          speed: localPortObj?.speed || localPortObj?.runningSpeed || '10G / Auto',
          isTrunk: Boolean(trunkObj) || Boolean(localPortObj?.isTrunk),
          nativeVlan: trunkObj?.nativeVlan || cdp.nativeVlan || localPortObj?.vlan || 1,
          allowedVlans: trunkObj?.allowedVlans || 'ALL',
          poeWatts: cdp.powerWatts || localPortObj?.poeWatts || 0,
          bidirectionalVerified: sourceNode.isPolled && targetNode.isPolled
        });
      }
    }
  }

  const allNodes = Array.from(nodesByKey.values());
  const allLinks = Array.from(linksByCanonicalKey.values());

  // Step 3: Compute Per-Site Summary Rollups for Metro, Florham, Halsey165, VancOakridge, Hastings
  const siteStats = {};
  for (const siteKey of Object.keys(GLOBAL_SITES)) {
    const siteNodes = allNodes.filter((n) => n.siteCode === siteKey);
    const polledSwitches = siteNodes.filter((n) => n.isPolled);
    const unpolledSwitches = siteNodes.filter(
      (n) => !n.isPolled && n.nodeRole === 'unpolled-switch'
    );
    const endpoints = siteNodes.filter(
      (n) => !n.isPolled && n.nodeRole === 'endpoint-device'
    );
    const siteLinks = allLinks.filter((l) => l.siteCode === siteKey);

    siteStats[siteKey] = {
      polledSwitchCount: polledSwitches.length,
      unpolledSwitchCount: unpolledSwitches.length,
      endpointCount: endpoints.length,
      totalDiscoveredNodes: siteNodes.length,
      interconnectLinkCount: siteLinks.length,
      polledSwitches,
      unpolledSwitches,
      siteLinks
    };
  }

  return {
    nodes: allNodes,
    links: allLinks,
    siteStats
  };
}
