// Global Multi-Campus, Colocation (Halsey165 / Hastings), ISP & Switch-to-Switch Link Reconciler
// Supports ~3,000 devices across 3 Campuses (Metro, Florham, VancOakridge) and 2 Colocations (Halsey165, Hastings)

import {
  normalizeInterfaceName,
  correlateSwitchShowData
} from '../utils/ciscoCliParser.js';

export const GLOBAL_SITES = [
  {
    id: 'Metro',
    code: 'Metro',
    shortName: 'Metro',
    name: 'Metropolitan Campus',
    country: 'United States',
    countryCode: 'US',
    flag: '🇺🇸',
    location: 'Teaneck / Hackensack, NJ',
    region: 'Teaneck / Hackensack, NJ',
    type: 'campus',
    role: 'US Campus (~1,000 Devices)',
    colocationHub: 'Halsey165',
    targetDevices: 1000,
    targetDeviceCount: 1000,
    coordinates: { lat: 40.8923, lng: -74.0285 },
    description:
      'Primary US Metropolitan Campus (~1,000 switches/routers/APs). Connects via redundant dark-fiber/Metro-E trunks to Halsey165 colocation.'
  },
  {
    id: 'Florham',
    code: 'Florham',
    shortName: 'Florham',
    name: 'Florham Campus',
    country: 'United States',
    countryCode: 'US',
    flag: '🇺🇸',
    location: 'Madison / Florham Park, NJ',
    region: 'Madison / Florham Park, NJ',
    type: 'campus',
    role: 'US Campus (~1,000 Devices)',
    colocationHub: 'Halsey165',
    targetDevices: 1000,
    targetDeviceCount: 1000,
    coordinates: { lat: 40.7751, lng: -74.4321 },
    description:
      'US Florham Campus (~1,000 switches/routers/APs). Aggregates north-east into Halsey165 colocation.'
  },
  {
    id: 'Halsey165',
    code: 'Halsey165',
    shortName: 'Halsey165',
    name: '165 Halsey Colocation Hub',
    country: 'United States',
    countryCode: 'US',
    flag: '🇺🇸',
    location: '165 Halsey St, Newark, NJ',
    region: '165 Halsey St, Newark, NJ',
    type: 'colocation',
    role: 'US Core Colocation Hub',
    connectedCampuses: ['Metro', 'Florham'],
    targetDevices: 80,
    targetDeviceCount: 80,
    coordinates: { lat: 40.7372, lng: -74.1724 },
    description:
      'US Carrier Hotel & Colocation Hub sitting between Metro and Florham campuses. Terminates campus fiber waves, US ISP BGP handoffs, and cross-border WAN to Hastings (Canada).'
  },
  {
    id: 'VancOakridge',
    code: 'VancOakridge',
    shortName: 'VancOakridge',
    name: 'Vancouver Oakridge Campus',
    country: 'Canada',
    countryCode: 'CA',
    flag: '🇨🇦',
    location: 'Vancouver, BC (Oakridge)',
    region: 'Vancouver, BC (Oakridge)',
    type: 'campus',
    role: 'Canada Campus (~1,000 Devices)',
    colocationHub: 'Hastings',
    targetDevices: 1000,
    targetDeviceCount: 1000,
    coordinates: { lat: 49.2266, lng: -123.1162 },
    description:
      'Canadian Campus at Oakridge (~1,000 target devices). Connects via high-speed metro fiber to Hastings colocation.'
  },
  {
    id: 'Hastings',
    code: 'Hastings',
    shortName: 'Hastings',
    name: 'Hastings Colocation Hub',
    country: 'Canada',
    countryCode: 'CA',
    flag: '🇨🇦',
    location: 'West Hastings St, Vancouver, BC',
    region: 'West Hastings St, Vancouver, BC',
    type: 'colocation',
    role: 'Canada Core Colocation Hub',
    connectedCampuses: ['VancOakridge'],
    targetDevices: 60,
    targetDeviceCount: 60,
    coordinates: { lat: 49.2846, lng: -123.1119 },
    description:
      'Canadian Colocation & Carrier Hub in downtown Vancouver. Terminates VancOakridge campus fiber, Canadian ISP transit, and cross-border core tunnel to Halsey165.'
  }
];

export const GLOBAL_SITES_BY_CODE = Object.fromEntries(
  GLOBAL_SITES.map((s) => [s.code, s])
);

export const ISP_PROVIDERS = [
  {
    id: 'ISP-US-PRIMARY',
    name: 'US Primary ISP / Tier-1 Transit',
    country: 'US',
    flag: '🇺🇸',
    asn: 'eBGP Primary',
    role: 'Primary US Dedicated Internet & Optical Transport',
    handoff: '100G / 40G LR4 Fiber',
    peeringSite: 'Halsey165',
    terminatesAt: 'Halsey165',
    status: 'up'
  },
  {
    id: 'ISP-US-SECONDARY',
    name: 'US Secondary ISP / Carrier DIA',
    country: 'US',
    flag: '🇺🇸',
    asn: 'eBGP Secondary',
    role: 'Redundant US Internet & DDoS Scrubbing',
    handoff: '40G / 10G Fiber',
    peeringSite: 'Halsey165',
    terminatesAt: 'Halsey165',
    status: 'up'
  },
  {
    id: 'ISP-US-RE',
    name: 'US R&E / Internet2 Peering',
    country: 'US',
    flag: '🇺🇸',
    asn: 'R&E Transit',
    role: 'Higher-Ed Research & Peering Exchange',
    handoff: '10G / 40G Optical',
    peeringSite: 'Halsey165',
    terminatesAt: 'Halsey165',
    status: 'up'
  },
  {
    id: 'ISP-CA-PRIMARY',
    name: 'Canada Primary ISP / Transit',
    country: 'CA',
    flag: '🇨🇦',
    asn: 'eBGP Primary',
    role: 'Primary Canadian DIA & Metro Optical',
    handoff: '10G / 40G SMF Fiber',
    peeringSite: 'Hastings',
    terminatesAt: 'Hastings',
    status: 'up'
  },
  {
    id: 'ISP-CA-SECONDARY',
    name: 'Canada Secondary ISP / Failover',
    country: 'CA',
    flag: '🇨🇦',
    asn: 'eBGP Backup',
    role: 'Secondary Canadian BGP Diversity',
    handoff: '10G SFP+ LR',
    peeringSite: 'Hastings',
    terminatesAt: 'Hastings',
    status: 'up'
  },
  {
    id: 'ISP-CA-BCNET',
    name: 'BCNET / CANARIE R&E Peering',
    country: 'CA',
    flag: '🇨🇦',
    asn: 'BCNET R&E',
    role: 'Canadian Higher-Education Peering Fabric',
    handoff: '10G Optical',
    peeringSite: 'Hastings',
    terminatesAt: 'Hastings',
    status: 'up'
  }
];

export const BACKBONE_CIRCUITS = [
  {
    id: 'CKT-METRO-HALSEY',
    from: 'Metro',
    to: 'Halsey165',
    fromSite: 'Metro',
    toSite: 'Halsey165',
    type: 'Dark Fiber / DWDM Wave',
    media: 'Dark Fiber / DWDM Wave',
    bandwidth: '40G / 100G',
    speed: '40G / 100G',
    role: 'Metro ↔ Halsey165 Core Interconnect'
  },
  {
    id: 'CKT-FLORHAM-HALSEY',
    from: 'Florham',
    to: 'Halsey165',
    fromSite: 'Florham',
    toSite: 'Halsey165',
    type: 'Dark Fiber / Metro Optical',
    media: 'Dark Fiber / Metro Optical',
    bandwidth: '40G / 100G',
    speed: '40G / 100G',
    role: 'Florham ↔ Halsey165 Core Interconnect'
  },
  {
    id: 'CKT-VANC-HASTINGS',
    from: 'VancOakridge',
    to: 'Hastings',
    fromSite: 'VancOakridge',
    toSite: 'Hastings',
    type: 'Metro Single-Mode Fiber',
    media: 'Metro Single-Mode Fiber',
    bandwidth: '10G / 40G',
    speed: '10G / 40G',
    role: 'VancOakridge ↔ Hastings Core Interconnect'
  },
  {
    id: 'CKT-HALSEY-HASTINGS',
    from: 'Halsey165',
    to: 'Hastings',
    fromSite: 'Halsey165',
    toSite: 'Hastings',
    type: 'Cross-Border Core WAN',
    media: 'Cross-Border WAN / MPLS / IPsec',
    bandwidth: '10G Redundant',
    speed: '10G Redundant',
    role: 'US (Halsey165) ↔ Canada (Hastings) Inter-Colocation Backbone'
  }
];

// Infer site code (Metro, Florham, Halsey165, VancOakridge, Hastings) from either an object or (hostname, rawSiteName)
export function inferSiteCode(hostnameOrObj = '', rawSiteName = '') {
  let hostname = '';
  let siteHint = rawSiteName;
  let mgmtIp = '';

  if (hostnameOrObj && typeof hostnameOrObj === 'object') {
    hostname = hostnameOrObj.hostname || '';
    siteHint = hostnameOrObj.siteName || rawSiteName || '';
    mgmtIp = hostnameOrObj.mgmtIp || '';
  } else {
    hostname = String(hostnameOrObj || '');
  }

  const h = String(hostname).trim().toUpperCase();
  if (h.includes('HALSEY') || h.startsWith('H165') || h.startsWith('HCORE')) {
    return 'Halsey165';
  }
  if (h.startsWith('V-') || h.startsWith('VCORE') || h.includes('VANC') || h.includes('OAK')) {
    return 'VancOakridge';
  }
  if (h.includes('HAST')) {
    return 'Hastings';
  }
  if (
    h.startsWith('M-') ||
    h.startsWith('MCORE') ||
    h.startsWith('F-') ||
    h.startsWith('FCORE') ||
    h.startsWith('DC2-') ||
    h.startsWith('FLO-') ||
    h.includes('FLOR') ||
    h.includes('MADISON') ||
    /\b129\.\d+\b/.test(h) ||
    String(mgmtIp).startsWith('132.238.129.')
  ) {
    return 'Florham';
  }
  if (
    h.startsWith('T-') ||
    h.startsWith('TCORE') ||
    h.startsWith('DC1-') ||
    h.includes('-BAN-') ||
    h.includes('METRO')
  ) {
    return 'Metro';
  }

  const s = String(siteHint || '').trim();
  if (GLOBAL_SITES_BY_CODE[s]) return s;
  const sUpper = s.toUpperCase();
  if (sUpper.includes('HALSEY')) return 'Halsey165';
  if (sUpper.includes('FLORHAM')) return 'Florham';
  if (sUpper.includes('HASTINGS')) return 'Hastings';
  if (sUpper.includes('VANC') || sUpper.includes('OAKRIDGE')) return 'VancOakridge';
  if (sUpper.includes('METRO')) return 'Metro';

  if (String(mgmtIp).startsWith('132.238.')) return 'Metro';

  return 'Metro';
}

// Strip domain suffix (e.g. "T-BAN-1FL-108B-MDF-C9300X.fdu.edu" or "T-BAN-2FL-WL.net.fdu.edu" -> "T-BAN-2FL-WL")
export function normalizeHostname(name = '') {
  return String(name)
    .trim()
    .replace(/\.(?:net\.fdu\.edu|fdu\.edu|local|lan|corp|[a-zA-Z0-9.-]+)$/i, '')
    .toUpperCase();
}

// Known FDU Building Codes & Friendly Names (Metro + Florham/Madison Campuses, supplemented by any <CAMPUS>-<CODE>-* prefix discovered via CDP)
export const FDU_BUILDING_DIRECTORY = {
  CORE: 'Campus Core & Data Center (CORE)',
  BAN: 'Bancroft Hall (BAN)',
  DIC: 'Dickinson Hall (DIC)',
  DICK: 'Dickinson Hall (DIC)',
  UCH: 'University Court (UCH)',
  LCH: 'Linden Court Halls (LCH)',
  ROB: 'Robison Hall & Annex (ROB)',
  BEC: 'Becton Hall & Labs (BEC)',
  ROT: 'Rothman Center & Fieldhouse (ROT)',
  GIO: 'Giovatto Library (GIO)',
  LIB: 'Campus Library (LIB)',
  SUB: 'Student Union Building (SUB)',
  SUB7: 'Student Union SUB7 (SUB)',
  NPT: 'Northpointe Hall (NPT)',
  KRN: 'Kron Administration (KRN)',
  WIL: 'Williams Hall (WIL)',
  ALU: 'Alumni Hall (ALU)',
  MUS: 'Muscarelle Center (MUS)',
  TPL: 'Temple Ave Building (TPL)',
  UNI: 'University Hall / USAS (UNI)',
  PSO: 'Public Safety (PSO)',
  WRG: '10 Woodridge Ave (WRG)',
  FIT: 'Fitness Center (FIT)',
  FDH: 'Fordmansion / FDH (FDH)',
  INT: 'International House (INT)',
  BBF: 'Baseball Field (BBF)',
  BOGOTA: 'Bogota / Rothman SB (ROT)',
  // Florham / Madison Campus Buildings (mcore-9600)
  HEN: 'Hennessy Hall / Mansion (HEN)',
  MAN: 'Hennessy Hall / Mansion (HEN)',
  MON: 'Monninger Center & Library (MON)',
  SCI: 'Science Building (SCI)',
  ZEN: 'Stadler / Zenner Hoffmann Hall (ZEN)',
  DRE: 'Dreyfuss Building (DRE)',
  TWK: 'Twombly / Florence / Hamilton Halls (TWK)',
  TWM: 'Twombly / Florence / Hamilton Halls (TWK)',
  TWO: 'Twombly / Florence / Hamilton Halls (TWK)',
  VIL: 'The Village Residence Halls (VIL)',
  PRK: 'Park Avenue Residence Halls (PRK)',
  PARK: 'Park Avenue Residence Halls (PRK)',
  STU: 'Florham Student Center (STU)',
  FSC: 'Florham Student Center (STU)',
  REC: 'Ferguson Recreation Center (REC)',
  FER: 'Ferguson Recreation Center (REC)',
  RUT: 'Rutherford Hall (RUT)',
  RUTH: 'Rutherford Hall (RUT)',
  SOP: 'School of Pharmacy & Health Sciences (SOP)',
  WEL: 'Wellness Center (WEL)',
  COT: 'Campus Cottages (COT)',
  CHA: 'Chapel & Chiller Plant (CHA)',
  DAN: 'Danforth Hall (DAN)',
  LWN: 'The Lawn Residence Halls (LWN)',
  RIC: 'Rice Hall (RIC)',
  GAT: 'Gatehouse & Public Safety (GAT)',
  BRN: 'Barn Theater & Fine Arts (BRN)',
  CHL: 'Chiller / Central Plant (CHL)',
  STAD: 'Robert Shields Stadium (STAD)',
  FFB: 'Florham Football / Athletics (FFB)',
  BFB: 'Florham Baseball / Field (BFB)'
};

export function inferBuildingInfo(hostname = '', rawBuildingName = '', nodeRole = '') {
  const norm = normalizeHostname(hostname);
  const bldgHint = String(rawBuildingName || '').trim();
  const combined = `${norm} ${bldgHint}`.toUpperCase();

  if (
    nodeRole === 'core-switch' ||
    /^TCORE|^MCORE|^HCORE|^FCORE|CORE-9600|C9606|\bDC1-|\bDC-1-|\bDC2-|DATACENTER|\bWLC\b|PRODUCTION-RACK|LABRACK/i.test(
      combined
    )
  ) {
    return {
      buildingCode: 'CORE',
      buildingLabel: FDU_BUILDING_DIRECTORY.CORE
    };
  }

  // Match FDU hostname pattern across Metro (T-), Florham/Madison (M- or F-), Vancouver (V-), Halsey (H-):
  // e.g. T-BAN-2FL-WL, M-SCI-1FL, M-VIL1-1FL, T-BBF
  const prefixMatch = norm.match(/^[TFMVH]-([A-Z0-9]{2,8})(?:-|$)/i);
  if (prefixMatch) {
    let code = prefixMatch[1].toUpperCase();
    if (code === 'DICK') code = 'DIC';
    if (code === 'LIB' && norm.startsWith('T-')) code = 'GIO';
    if (code === 'LIB' && (norm.startsWith('M-') || norm.startsWith('F-'))) code = 'MON';
    if (code === 'SUB7') code = 'SUB';
    if (code === 'BOGOTA') code = 'ROT';
    if (code === 'MAN') code = 'HEN';
    if (code === 'TWO' || code === 'TWM') code = 'TWK';
    if (code === 'FSC') code = 'STU';
    if (code === 'FER') code = 'REC';
    if (code === 'RUTH') code = 'RUT';
    if (code === 'PARK') code = 'PRK';
    if (/^VIL\d+$/i.test(code)) code = 'VIL';
    return {
      buildingCode: code,
      buildingLabel: FDU_BUILDING_DIRECTORY[code] || `${code} Building (${code})`
    };
  }

  // Match real FDU Meraki & Catalyst interface descriptions on tcore-9600 (Metro) and mcore-9600 (Florham)
  if (/SCHOOL-PHAR|\bSOP\d*|\bPHRMCY/i.test(combined)) {
    return { buildingCode: 'SOP', buildingLabel: FDU_BUILDING_DIRECTORY.SOP };
  }
  if (/VILLAGE|\bVIL\d/i.test(combined)) {
    return { buildingCode: 'VIL', buildingLabel: FDU_BUILDING_DIRECTORY.VIL };
  }
  if (/DREYFUSS|\bDREY/i.test(combined)) {
    return { buildingCode: 'DRE', buildingLabel: FDU_BUILDING_DIRECTORY.DRE };
  }
  if (/MANSION|HENNESSY|\bHEN\b/i.test(combined)) {
    return { buildingCode: 'HEN', buildingLabel: FDU_BUILDING_DIRECTORY.HEN };
  }
  if (/MONNINGER|LIBBOILER|LEARNING-CENTER|\bEOF-F|\bMON\b/i.test(combined)) {
    return { buildingCode: 'MON', buildingLabel: FDU_BUILDING_DIRECTORY.MON };
  }
  if (/PARKAVE|\bPARK\b|\bPR-1FL|\bPRK\b/i.test(combined)) {
    return { buildingCode: 'PRK', buildingLabel: FDU_BUILDING_DIRECTORY.PRK };
  }
  if (/RUTHERFORD|RUTHDORM|\bRUTH\b|\bRUT\b/i.test(combined)) {
    return { buildingCode: 'RUT', buildingLabel: FDU_BUILDING_DIRECTORY.RUT };
  }
  if (/STADLER|ZENNER|\bZEN\b/i.test(combined)) {
    return { buildingCode: 'ZEN', buildingLabel: FDU_BUILDING_DIRECTORY.ZEN };
  }
  if (/TWOMBLY|FLORENCE|HAMILTON|\bTWM\b|\bTWK\b/i.test(combined)) {
    return { buildingCode: 'TWK', buildingLabel: FDU_BUILDING_DIRECTORY.TWK };
  }
  if (/SCIENCE|\bSCI\b/i.test(combined)) {
    return { buildingCode: 'SCI', buildingLabel: FDU_BUILDING_DIRECTORY.SCI };
  }
  if (/WELLNESS|\bWEL\b/i.test(combined)) {
    return { buildingCode: 'WEL', buildingLabel: FDU_BUILDING_DIRECTORY.WEL };
  }
  if (/\bCOT-EAST|\bCOT-WEST|\bCOT\b/i.test(combined)) {
    return { buildingCode: 'COT', buildingLabel: FDU_BUILDING_DIRECTORY.COT };
  }
  if (/\bCHA-1FL|\bCHA\b/i.test(combined)) {
    return { buildingCode: 'CHA', buildingLabel: FDU_BUILDING_DIRECTORY.CHA };
  }
  if (/FERGUSON|\bFER\b|\bREC\b/i.test(combined)) {
    return { buildingCode: 'REC', buildingLabel: FDU_BUILDING_DIRECTORY.REC };
  }
  if (/BANCROFT|\bBAN\b|\bMIS-MERAKI/i.test(combined)) {
    return { buildingCode: 'BAN', buildingLabel: FDU_BUILDING_DIRECTORY.BAN };
  }
  if (/DHALL|DICKINSON|\bDIC-|\bDIC\b/i.test(combined)) {
    return { buildingCode: 'DIC', buildingLabel: FDU_BUILDING_DIRECTORY.DIC };
  }
  if (/BECTON|\bBEC-|CRIMELAB/i.test(combined)) {
    return { buildingCode: 'BEC', buildingLabel: FDU_BUILDING_DIRECTORY.BEC };
  }
  if (/LINDEN|\bLCH\b/i.test(combined)) {
    return { buildingCode: 'LCH', buildingLabel: FDU_BUILDING_DIRECTORY.LCH };
  }
  if (/UHALL|UCRT|\bUCH\b/i.test(combined)) {
    return { buildingCode: 'UCH', buildingLabel: FDU_BUILDING_DIRECTORY.UCH };
  }
  if (/ROBISON|\bROB-|\bROB\b/i.test(combined)) {
    return { buildingCode: 'ROB', buildingLabel: FDU_BUILDING_DIRECTORY.ROB };
  }
  if (/ROTHMAN|ROTHMN|FIELDHOUSE|\bFH-MS350|\bROT\b|\bROTH\b/i.test(combined)) {
    return { buildingCode: 'ROT', buildingLabel: FDU_BUILDING_DIRECTORY.ROT };
  }
  if (/LIBRARY|GIOVATTO|\bLIB1_|\bLIB2|\bGIO\b/i.test(combined)) {
    return { buildingCode: 'GIO', buildingLabel: FDU_BUILDING_DIRECTORY.GIO };
  }
  if (/KRON|\bKRN\b/i.test(combined)) {
    return { buildingCode: 'KRN', buildingLabel: FDU_BUILDING_DIRECTORY.KRN };
  }
  if (/WILLIAMS|\bWIL\b/i.test(combined)) {
    return { buildingCode: 'WIL', buildingLabel: FDU_BUILDING_DIRECTORY.WIL };
  }
  if (/ALUMNI|\bALU\b/i.test(combined)) {
    return { buildingCode: 'ALU', buildingLabel: FDU_BUILDING_DIRECTORY.ALU };
  }
  if (/MUSCARELLE|\bMUS\b/i.test(combined)) {
    return { buildingCode: 'MUS', buildingLabel: FDU_BUILDING_DIRECTORY.MUS };
  }
  if (/PUBSAFETY|\bPSO\b/i.test(combined)) {
    return { buildingCode: 'PSO', buildingLabel: FDU_BUILDING_DIRECTORY.PSO };
  }
  if (/WOODRIDGE|\bWRG\b/i.test(combined)) {
    return { buildingCode: 'WRG', buildingLabel: FDU_BUILDING_DIRECTORY.WRG };
  }
  if (/\bUSAS-|\bUNI\b/i.test(combined)) {
    return { buildingCode: 'UNI', buildingLabel: FDU_BUILDING_DIRECTORY.UNI };
  }
  if (/METRO-SUB|METROSUB|\bSUB\b/i.test(combined)) {
    return { buildingCode: 'SUB', buildingLabel: FDU_BUILDING_DIRECTORY.SUB };
  }
  if (/NORTHPOINTE|\bNPT\b/i.test(combined)) {
    return { buildingCode: 'NPT', buildingLabel: FDU_BUILDING_DIRECTORY.NPT };
  }

  for (const [code, label] of Object.entries(FDU_BUILDING_DIRECTORY)) {
    if (code !== 'CORE' && new RegExp(`\\b${code}\\b`, 'i').test(combined)) {
      return { buildingCode: code, buildingLabel: label };
    }
  }

  return {
    buildingCode: 'OTHER',
    buildingLabel: bldgHint && !bldgHint.startsWith('Connected via') ? bldgHint : 'Other Campus / IDF'
  };
}

// Determine if a CDP neighbor is a Wireless AP / Phone / Endpoint vs a Switch / Core Router
export function isWirelessOrEndpoint(platform = '', capabilities = '', hostname = '') {
  const p = String(platform).toUpperCase();
  const c = String(capabilities).toUpperCase();
  const h = String(hostname).toUpperCase();
  if (
    /AIR-AP|AIR-CAP|C9105|C9115|C9120|C9124|C9130|C9136|C9162|C9164|C9166|CW916|AP1G|PHONE|SEP[0-9A-F]{12}/i.test(
      `${p} ${h}`
    )
  ) {
    return true;
  }
  if (c.includes('TRANS-BRIDGE') && !c.includes('SWITCH')) {
    return true;
  }
  return false;
}

// Determine if an interface/media type is Fiber Optic vs Copper Ethernet
export function classifyLinkMedia(localPort = '', remotePort = '', mediaType = '', platform = '') {
  const m = `${mediaType} ${localPort} ${remotePort}`.toUpperCase();
  if (
    /^(?:TW|FO|HU)\d+\/\d+\//.test(localPort.toUpperCase()) ||
    /^(?:TW|FO|HU)\d+\/\d+\//.test(remotePort.toUpperCase()) ||
    m.includes('25G') ||
    m.includes('40G') ||
    m.includes('100G')
  ) {
    return {
      category: 'fiber',
      label: '25G / 40G / 100G Fiber Optic Trunk (SFP28/QSFP28)',
      shortLabel: '25G Fiber Optic'
    };
  }
  if (
    m.includes('SFP') ||
    m.includes('QSFP') ||
    m.includes('-SR') ||
    m.includes('-LR') ||
    m.includes('-ER') ||
    /^(?:TE|FO|TW|HU)\d+\/1\//.test(localPort.toUpperCase()) ||
    /^(?:TE|FO|TW|HU)\d+\/1\//.test(remotePort.toUpperCase())
  ) {
    return {
      category: 'fiber',
      label: 'Fiber Optic Trunk (SFP+/QSFP+)',
      shortLabel: 'Fiber Optic'
    };
  }
  if (isWirelessOrEndpoint(platform, '', '')) {
    return {
      category: 'copper-poe',
      label: 'Copper PoE/UPOE Access Cable',
      shortLabel: 'Copper PoE'
    };
  }
  return {
    category: 'copper',
    label: '10G mGig / Copper Switch Trunk',
    shortLabel: '10G mGig Trunk'
  };
}

/**
 * Reconciles all polled switches in PostgreSQL + their CDP neighbors into:
 * - nodes: Polled switches + Unpolled CDP neighbor switches/routers/APs
 * - switchNodes: Only Switches / Core Routers (with attachedEndpoints[] and tier: 1 | 2 | 3)
 * - links: All Point-A [Port A] <---> [Port B] Point-B physical connections
 * - switchLinks: Switch-to-Switch physical interconnections (for the visual multi-switch diagram)
 * - siteSummary / siteStats: Per-site counts for Metro, Florham, Halsey165, VancOakridge, Hastings
 */
export function buildGlobalAndSiteTopology(savedDevices = [], activeParsedSwitch = null) {
  const hasRealDevice = savedDevices.some(
    (d) => d.serial_number && d.serial_number !== 'FOC2534L9K1'
  );
  const allDevices = savedDevices
    .filter((d) => !hasRealDevice || d.serial_number !== 'FOC2534L9K1')
    .map((d) => {
      if (d.raw_outputs && Object.keys(d.raw_outputs).length > 0) {
        return {
          ...d,
          parsed_snapshot: correlateSwitchShowData(d.raw_outputs)
        };
      }
      return d;
    });

  // Ensure activeParsedSwitch is represented even if running in offline preview mode
  if (
    activeParsedSwitch?.device?.serialNumber &&
    (!hasRealDevice || activeParsedSwitch.device.serialNumber !== 'FOC2534L9K1')
  ) {
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
    const uplinks = snap.uplinkInterfaces || [];
    const connectedPorts =
      ports.filter((p) => p.status === 'up').length +
      uplinks.filter((u) => u.status === 'connected').length;
    const totalPoeWatts = ports.reduce((acc, p) => acc + (p.poeWatts || 0), 0);

    const nodeRole =
      siteCode === 'Halsey165' || siteCode === 'Hastings'
        ? 'colocation-switch'
        : /C9600|C9606|C9500|CORE/i.test(`${model} ${hostname}`)
        ? 'core-switch'
        : 'campus-switch';
    const bldgInfo = inferBuildingInfo(hostname, dev.building_name, nodeRole);

    const node = {
      id: normHost,
      key: normHost,
      hostname,
      normHost,
      model,
      portCount: model.includes('-24') ? 24 : 48,
      serialNumber: dev.serial_number || 'UNPOLLED',
      iosVersion: snap.device?.iosVersion || dev.ios_version || '17.x',
      mgmtIp,
      siteCode,
      buildingCode: bldgInfo.buildingCode,
      buildingLabel: bldgInfo.buildingLabel,
      buildingName: dev.building_name || bldgInfo.buildingLabel,
      isPolled: true,
      isSwitchNode: true,
      nodeRole,
      connectedPorts,
      totalPorts: (ports.length || 48) + uplinks.length,
      totalPoeWatts,
      cdpCount: (snap.cdpNeighbors || []).length,
      trunkCount: (snap.trunks || []).length,
      vlanCount: (snap.vlans || []).length,
      attachedEndpoints: [],
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
    const cfgByIntf = snap.interfaceConfigs || {};

    for (const cdp of snap.cdpNeighbors || []) {
      const localPort = normalizeInterfaceName(cdp.localInterface || '');
      const remotePort = normalizeInterfaceName(cdp.remotePort || '');
      const rawDeviceId = cdp.deviceId || 'Unknown-Neighbor';
      const portDesc =
        cdp.localDescription ||
        cfgByIntf[localPort]?.description ||
        portsByIntf[localPort]?.description ||
        '';

      // If Meraki switch reports a raw 12-hex MAC address as Device ID (e.g. e0cbbc8138e2),
      // use the parent port's human-readable interface description (e.g. rothman-meraki-mbr2-1.244)
      const isRawMacId = /^[0-9a-f]{12}$/i.test(rawDeviceId.trim());
      const cleanDesc = portDesc
        .replace(/\s+/g, '-')
        .replace(/[^a-zA-Z0-9._-]/g, '')
        .slice(0, 32);
      const targetRawHost =
        isRawMacId && cleanDesc
          ? `${cleanDesc} [${rawDeviceId.slice(-4)}]`
          : rawDeviceId;
      const targetNorm = normalizeHostname(rawDeviceId);

      // Check if target is already a Polled Switch in PostgreSQL (by hostname or IP)
      let targetNode =
        polledByNormHost.get(targetNorm) ||
        (cdp.neighborIp && cdp.neighborIp !== '—' ? polledByIp.get(cdp.neighborIp) : null);

      const isEndpoint = isWirelessOrEndpoint(
        cdp.platform || '',
        cdp.capabilities || '',
        targetRawHost
      );
      const isSwitchOrRouter = !isEndpoint;

      if (!targetNode) {
        const inferredSite = inferSiteCode(`${targetRawHost} ${portDesc}`, sourceNode.siteCode);
        targetNode = nodesByKey.get(targetNorm);
        if (!targetNode) {
          const cleanPlatform = cdp.platform
            ? cdp.platform.replace(/^cisco\s+/i, '').trim()
            : 'CDP Neighbor';
          const isCoreChassis = /C9600|C9606|C9500|N77-|NEXUS|HCORE|MCORE/i.test(
            `${cleanPlatform} ${targetRawHost} ${portDesc}`
          );
          const targetRole = isCoreChassis
            ? 'core-switch'
            : isSwitchOrRouter
            ? 'unpolled-switch'
            : 'endpoint-device';
          const targetBldg = inferBuildingInfo(
            targetRawHost,
            isEndpoint ? sourceNode.buildingLabel : portDesc,
            targetRole
          );
          targetNode = {
            id: targetNorm,
            key: targetNorm,
            hostname: targetRawHost,
            rawDeviceId,
            interfaceDescription: portDesc,
            normHost: targetNorm,
            model: cleanPlatform,
            portCount: cleanPlatform.includes('-24') ? 24 : 48,
            serialNumber: 'UNPOLLED',
            iosVersion: cdp.softwareVersion || 'Discovered via CDP',
            mgmtIp: cdp.neighborIp || '—',
            siteCode: inferredSite,
            buildingCode:
              targetBldg.buildingCode === 'OTHER' && isEndpoint
                ? sourceNode.buildingCode
                : targetBldg.buildingCode,
            buildingLabel:
              targetBldg.buildingCode === 'OTHER' && isEndpoint
                ? sourceNode.buildingLabel
                : targetBldg.buildingLabel,
            buildingName: portDesc
              ? `${portDesc} • via ${sourceHost} (${localPort})`
              : `Connected via ${sourceHost} (${localPort})`,
            isPolled: false,
            isSwitchNode: isSwitchOrRouter,
            nodeRole: targetRole,
            connectedPorts: 1,
            totalPorts: cleanPlatform.includes('-24') ? 24 : 48,
            totalPoeWatts: 0,
            cdpCount: 0,
            trunkCount: 0,
            vlanCount: 0,
            attachedEndpoints: []
          };
          nodesByKey.set(targetNorm, targetNode);
        }
      }

      // If this neighbor is an AP/Endpoint, attach it to sourceNode.attachedEndpoints for the visual node badge
      if (isEndpoint) {
        const alreadyAttached = sourceNode.attachedEndpoints.some(
          (ep) => ep.localPort === localPort && ep.hostname === targetRawHost
        );
        if (!alreadyAttached) {
          sourceNode.attachedEndpoints.push({
            hostname: targetRawHost,
            ip: cdp.neighborIp || '—',
            model: cdp.platform ? cdp.platform.replace(/^cisco\s+/i, '').trim() : 'AP',
            localPort,
            remotePort,
            poeWatts: cdp.powerWatts || 0,
            buildingCode: sourceNode.buildingCode || 'BAN',
            buildingLabel: sourceNode.buildingLabel || FDU_BUILDING_DIRECTORY.BAN
          });
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

      // Canonical key so SwitchA(Te1/0/24)<->SwitchB(Te1/0/20) and SwitchB(Te1/0/20)<->SwitchA(Te1/0/24) merge!
      const endpointA = `${sourceNode.key}:${localPort}`;
      const endpointB = `${targetNode.key}:${remotePort}`;
      const canonicalKey =
        endpointA < endpointB ? `${endpointA}<-->${endpointB}` : `${endpointB}<-->${endpointA}`;

      const existingLink = linksByCanonicalKey.get(canonicalKey);
      if (existingLink) {
        existingLink.bidirectionalVerified = true;
        existingLink.verifiedBiDirectional = true;
      } else {
        const isBiDir = Boolean(sourceNode.isPolled && targetNode.isPolled);
        linksByCanonicalKey.set(canonicalKey, {
          id: canonicalKey,
          siteCode: sourceNode.siteCode,
          sourceKey: sourceNode.key,
          sourceHostname: sourceNode.hostname,
          sourceModel: sourceNode.model,
          sourceIp: sourceNode.mgmtIp,
          sourcePort: localPort || '—',
          sourceIsPolled: sourceNode.isPolled,
          sourceBuildingCode: sourceNode.buildingCode,
          targetKey: targetNode.key,
          targetHostname: targetNode.hostname,
          targetModel: targetNode.model,
          targetIp: targetNode.mgmtIp !== '—' ? targetNode.mgmtIp : cdp.neighborIp || '—',
          targetPort: remotePort || '—',
          targetIsPolled: targetNode.isPolled,
          targetRole: targetNode.nodeRole,
          targetSerial: targetNode.serialNumber,
          targetBuildingCode: targetNode.buildingCode,
          isSwitchInterconnect: Boolean(sourceNode.isSwitchNode && targetNode.isSwitchNode),
          mediaCategory: mediaInfo.category,
          mediaLabel: mediaInfo.label,
          mediaShortLabel: mediaInfo.shortLabel,
          speed: localPortObj?.speed || localPortObj?.runningSpeed || '10G / 25G',
          isTrunk: Boolean(trunkObj) || Boolean(localPortObj?.isTrunk),
          nativeVlan: trunkObj?.nativeVlan || cdp.nativeVlan || localPortObj?.vlan || 1,
          allowedVlans: trunkObj?.allowedVlans || 'ALL',
          poeWatts: cdp.powerWatts || localPortObj?.poeWatts || 0,
          bidirectionalVerified: isBiDir,
          verifiedBiDirectional: isBiDir
        });
      }
    }
  }

  const allNodes = Array.from(nodesByKey.values());
  const allLinks = Array.from(linksByCanonicalKey.values());
  const switchNodes = allNodes.filter((n) => n.isSwitchNode);
  const switchLinks = allLinks.filter((l) => l.isSwitchInterconnect);

  // Step 3: Assign Hierarchical Tiers (Tier 1 Core -> Tier 2 Distribution/MDF -> Tier 3 Access/IDF)
  // so the Visual Multi-Switch Topology Diagram renders top-down like a real network architecture diagram!
  const coreKeys = new Set(
    switchNodes
      .filter((n) => n.nodeRole === 'core-switch' || n.nodeRole === 'colocation-switch')
      .map((n) => n.key)
  );

  // Any switch directly linked to a Tier 1 Core switch is Tier 2 (Distribution / MDF)
  const tier2Keys = new Set();
  for (const lnk of switchLinks) {
    if (coreKeys.has(lnk.sourceKey) && !coreKeys.has(lnk.targetKey)) {
      tier2Keys.add(lnk.targetKey);
    } else if (coreKeys.has(lnk.targetKey) && !coreKeys.has(lnk.sourceKey)) {
      tier2Keys.add(lnk.sourceKey);
    }
  }

  // If no explicit C9600/C9500 core was discovered yet, promote the switch with the most switch links to Tier 2
  for (const sw of switchNodes) {
    if (coreKeys.has(sw.key)) {
      sw.hierarchyTier = 1;
      sw.tierLabel = 'Tier 1 • Core / Backbone';
    } else if (tier2Keys.has(sw.key) || sw.attachedEndpoints.length > 0) {
      sw.hierarchyTier = 2;
      sw.tierLabel = 'Tier 2 • MDF / Distribution Switch';
    } else {
      sw.hierarchyTier = 3;
      sw.tierLabel = 'Tier 3 • IDF / Downstream Switch';
    }
  }

  // Step 4: Build Discovered & Polled Buildings Directory (for Building / Device Filtering)
  const buildingMap = new Map();
  for (const sw of switchNodes) {
    const code = sw.buildingCode || 'OTHER';
    const label = sw.buildingLabel || FDU_BUILDING_DIRECTORY[code] || `${code} Building`;
    if (!buildingMap.has(code)) {
      buildingMap.set(code, {
        code,
        label,
        switchCount: 0,
        polledCount: 0,
        unpolledCount: 0,
        apCount: 0
      });
    }
    const b = buildingMap.get(code);
    b.switchCount += 1;
    if (sw.isPolled) b.polledCount += 1;
    else b.unpolledCount += 1;
    b.apCount += (sw.attachedEndpoints || []).length;
  }

  const buildings = Array.from(buildingMap.values()).sort((a, b) => {
    if (a.code === 'BAN') return -1;
    if (b.code === 'BAN') return 1;
    if (a.code === 'CORE') return -1;
    if (b.code === 'CORE') return 1;
    if (b.polledCount !== a.polledCount) return b.polledCount - a.polledCount;
    return b.switchCount - a.switchCount;
  });

  // Step 5: Compute Per-Site Summary Rollups for Metro, Florham, Halsey165, VancOakridge, Hastings
  const siteStats = {};
  for (const site of GLOBAL_SITES) {
    const siteKey = site.code;
    const siteNodes = allNodes.filter((n) => n.siteCode === siteKey);
    const polledSwitches = siteNodes.filter((n) => n.isPolled);
    const unpolledSwitches = siteNodes.filter((n) => !n.isPolled && n.isSwitchNode);
    const endpoints = siteNodes.filter((n) => !n.isSwitchNode);
    const siteLinks = allLinks.filter((l) => l.siteCode === siteKey);

    siteStats[siteKey] = {
      polledCount: polledSwitches.length,
      neighborCount: unpolledSwitches.length + endpoints.length,
      unpolledSwitchCount: unpolledSwitches.length,
      endpointCount: endpoints.length,
      totalNodes: siteNodes.length,
      linkCount: siteLinks.length,
      switchLinkCount: siteLinks.filter((l) => l.isSwitchInterconnect).length,
      polledSwitchCount: polledSwitches.length,
      totalDiscoveredNodes: siteNodes.length,
      interconnectLinkCount: siteLinks.length,
      polledSwitches,
      unpolledSwitches,
      siteLinks
    };
  }

  return {
    nodes: allNodes,
    switchNodes,
    links: allLinks,
    switchLinks,
    buildings,
    siteStats,
    siteSummary: siteStats
  };
}
