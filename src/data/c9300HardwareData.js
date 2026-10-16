// Official Cisco Catalyst 9300 Series Hardware Installation Guide Reference Data
// Source: https://www.cisco.com/c/en/us/td/docs/switches/lan/catalyst9300/hardware/install/b_c9300_hig/Product-overview.html

export const SWITCH_MODELS = {
  'C9300-48P': {
    id: 'C9300-48P',
    name: 'Catalyst 9300 48-Port PoE+',
    downlinkDesc: '48x 10/100/1000 Mbps RJ-45 PoE+ (IEEE 802.3at up to 30W/port)',
    maxPerPortWatts: 30,
    poeStandard: 'PoE+ (802.3at Type 2)',
    defaultPsu: 'PWR-C1-715WAC-P',
    defaultPoeBudget: 437,
    dualPsuPoeBudget: 1152,
    stackingTech: 'StackWise-480 (480 Gbps)',
    stackPower: true,
    dimensions: '1.73 × 17.5 × 17.5 in (4.4 × 44.5 × 44.5 cm)',
    weight: '16.33 lb (7.4 kg)',
    switchingCapacity: '256 Gbps (512 Gbps full-duplex)',
    forwardingRate: '190.48 Mpps'
  },
  'C9300-48U': {
    id: 'C9300-48U',
    name: 'Catalyst 9300 48-Port UPOE',
    downlinkDesc: '48x 10/100/1000 Mbps RJ-45 Cisco UPOE (up to 60W/port)',
    maxPerPortWatts: 60,
    poeStandard: 'Cisco UPOE (802.3bt Type 3)',
    defaultPsu: 'PWR-C1-1100WAC-P',
    defaultPoeBudget: 822,
    dualPsuPoeBudget: 1800,
    stackingTech: 'StackWise-480 (480 Gbps)',
    stackPower: true,
    dimensions: '1.73 × 17.5 × 17.5 in (4.4 × 44.5 × 44.5 cm)',
    weight: '16.63 lb (7.54 kg)',
    switchingCapacity: '256 Gbps (512 Gbps full-duplex)',
    forwardingRate: '190.48 Mpps'
  },
  'C9300-48H': {
    id: 'C9300-48H',
    name: 'Catalyst 9300 48-Port UPOE+',
    downlinkDesc: '48x 10/100/1000 Mbps RJ-45 Cisco UPOE+ (IEEE 802.3bt Type 4 up to 90W/port)',
    maxPerPortWatts: 90,
    poeStandard: 'Cisco UPOE+ (802.3bt Type 4)',
    defaultPsu: 'PWR-C1-1100WAC-P',
    defaultPoeBudget: 822,
    dualPsuPoeBudget: 1922,
    max1900WBudget: 2880,
    stackingTech: 'StackWise-480 (480 Gbps)',
    stackPower: true,
    dimensions: '1.73 × 17.5 × 17.5 in (4.4 × 44.5 × 44.5 cm)',
    weight: '16.63 lb (7.54 kg)',
    switchingCapacity: '256 Gbps (512 Gbps full-duplex)',
    forwardingRate: '190.48 Mpps'
  },
  'C9300-48UXM': {
    id: 'C9300-48UXM',
    name: 'Catalyst 9300 48-Port mGig UPOE',
    downlinkDesc: '48x Multigigabit (100M / 1G / 2.5G / 5G / 12x 10G) UPOE (up to 60W/port)',
    maxPerPortWatts: 60,
    poeStandard: 'Cisco UPOE + NBASE-T mGig',
    defaultPsu: 'PWR-C1-1100WAC-P',
    defaultPoeBudget: 490,
    dualPsuPoeBudget: 1590,
    stackingTech: 'StackWise-480 (480 Gbps)',
    stackPower: true,
    dimensions: '1.73 × 17.5 × 19.2 in (4.4 × 44.5 × 48.8 cm) — Deep Chassis',
    weight: '20.5 lb (9.3 kg)',
    switchingCapacity: '580 Gbps',
    forwardingRate: '431.54 Mpps'
  },
  'C9300-48T': {
    id: 'C9300-48T',
    name: 'Catalyst 9300 48-Port Data Only',
    downlinkDesc: '48x 10/100/1000 Mbps RJ-45 Data Interfaces (Non-PoE)',
    maxPerPortWatts: 0,
    poeStandard: 'None (Data Only)',
    defaultPsu: 'PWR-C1-350WAC-P',
    defaultPoeBudget: 0,
    dualPsuPoeBudget: 0,
    stackingTech: 'StackWise-480 (480 Gbps)',
    stackPower: true,
    dimensions: '1.73 × 17.5 × 17.5 in (4.4 × 44.5 × 44.5 cm)',
    weight: '15.88 lb (7.2 kg)',
    switchingCapacity: '256 Gbps (512 Gbps full-duplex)',
    forwardingRate: '190.48 Mpps'
  }
};

export const NETWORK_MODULES = {
  'C9300-NM-8X': {
    id: 'C9300-NM-8X',
    name: 'C9300-NM-8X (8x 10GE SFP+)',
    portsCount: 8,
    portType: 'SFP+',
    speed: '1 GE / 10 GE',
    prefix: 'Te1/1/',
    description: 'Eight 10-Gigabit Ethernet SFP+ module slots. Supports any combination of standard SFP (1G) and SFP+ (10G) optical or DAC transceivers. Hot-swappable.'
  },
  'C9300-NM-4G': {
    id: 'C9300-NM-4G',
    name: 'C9300-NM-4G (4x 1GE SFP)',
    portsCount: 4,
    portType: 'SFP',
    speed: '1 GE',
    prefix: 'Gi1/1/',
    description: 'Four 1-Gigabit Ethernet SFP module slots. Note: SFP+ modules are not supported and will log an error if inserted.'
  },
  'C9300-NM-4M': {
    id: 'C9300-NM-4M',
    name: 'C9300-NM-4M (4x mGig RJ-45)',
    portsCount: 4,
    portType: 'RJ45-mGig',
    speed: '100M / 1G / 2.5G / 5G / 10G',
    prefix: 'Te1/1/',
    description: 'Four Multigigabit copper RJ-45 uplink interfaces supporting up to 10GBASE-T over Cat6A cabling (100m).'
  },
  'C9300-NM-2Q': {
    id: 'C9300-NM-2Q',
    name: 'C9300-NM-2Q (2x 40GE QSFP+)',
    portsCount: 2,
    portType: 'QSFP+',
    speed: '40 GE',
    prefix: 'Fo1/1/',
    description: 'Two 40-Gigabit Ethernet slots with QSFP+ cages for high-density core/aggregation fiber uplinks.'
  },
  'C9300-NM-2Y': {
    id: 'C9300-NM-2Y',
    name: 'C9300-NM-2Y (2x 25GE SFP28)',
    portsCount: 2,
    portType: 'SFP28',
    speed: '1 GE / 10 GE / 25 GE',
    prefix: 'Tw1/1/',
    description: 'Two 25-Gigabit Ethernet SFP28 module slots. Supports SFP, SFP+, and SFP28 transceivers.'
  },
  'C9300-NM-BLANK': {
    id: 'C9300-NM-BLANK',
    name: 'C9300-NM-BLANK (Blank Cover)',
    portsCount: 0,
    portType: 'BLANK',
    speed: 'N/A',
    prefix: '',
    description: 'Mandatory blank airflow cover plate when no uplink network module is installed, preserving proper front-to-back chassis pressure.'
  }
};

export const LED_MODES = [
  {
    id: 'STAT',
    label: 'STAT',
    title: 'Port Link & Activity Status (Default)',
    description: 'Green = Link up; Blinking Green = Activity (sending/receiving); Amber = Blocked by Spanning Tree Protocol (STP); Alternating Green-Amber = Link fault (CRC/jabber/collisions); Off = No link or admin down.'
  },
  {
    id: 'SPEED',
    label: 'SPEED',
    title: 'Port Operating Speed',
    description: 'Off = 10 Mbps; Solid Green = 100 Mbps; Single Green Flash (100ms on / 1900ms off) = 1000 Mbps (1 Gbps); Double Green Blink = 2.5G / 5G / 10G mGig.'
  },
  {
    id: 'DUPLX',
    label: 'DUPLX',
    title: 'Port Duplex Mode',
    description: 'Green = Full Duplex operation; Off = Half Duplex operation (Note: mGig ports only operate in Full Duplex).'
  },
  {
    id: 'ACTV',
    label: 'ACTV',
    title: 'Stack Active / Standby Role',
    description: 'Green = Active switch in stack (or standalone); Slow Blinking Green = Stack Standby member; Amber = Error during active election.'
  },
  {
    id: 'STACK',
    label: 'STACK',
    title: 'StackWise Member Sequence (Ports 1–8)',
    description: 'First 8 port LEDs indicate installed members in the StackWise-480 ring. Blinking Green = This switch’s member number; Solid Green = Other active stack members.'
  },
  {
    id: 'PoE',
    label: 'PoE',
    title: 'PoE / UPOE Power Delivery Status',
    description: 'Green = PoE/UPOE power actively delivered; Off = No PoE draw; Alternating Green-Amber = PoE denied (power budget exceeded); Blinking Amber = PoE fault/short; Solid Amber = PoE administratively disabled.'
  },
  {
    id: 'S-PWR',
    label: 'S-PWR',
    title: 'StackPower Ring & Load Shedding',
    description: 'Green = StackPower ring closed & healthy; Blinking Green = Open ring or single cable; Amber = Fault or load-shedding active.'
  },
  {
    id: 'XPS',
    label: 'XPS',
    title: 'Expandable Power System (XPS 2200)',
    description: 'Off = StackPower mode / no XPS; Green = XPS ready; Blinking Amber = Internal PSU failed & XPS is actively backing up switch.'
  }
];

export const COMPONENTS_CATALOG = {
  'chassis-main': {
    id: 'chassis-main',
    higCallout: 'Overview',
    zone: 'Chassis & Internal',
    title: '1RU Galvanized Steel Chassis (C9300-48)',
    subtitle: '1.73" H × 17.5" W × 17.5" D | StackWise-480 Architecture',
    partNumber: 'C9300-48P / C9300-48U / C9300-48H',
    status: 'Healthy',
    summary: 'Heavy-duty 1RU enterprise rackmount enclosure with front-to-back and side-to-rear cooling channels, housing the UADP 2.0 ASIC, x86 CPU complex, 48 downlink RJ-45 ports, modular network uplink bay, dual hot-swap PSU bays, and 3 hot-swap fan bays.',
    specs: [
      { label: 'Form Factor', value: '1 Rack Unit (1RU) — 1.73 in (4.4 cm) height' },
      { label: 'Dimensions (W × D)', value: '17.5 in × 17.5 in (19.2 in for C9300-48UXM)' },
      { label: 'Airflow Pattern', value: 'Front-to-Rear and Side-to-Rear exhaust via 3× FAN-T2=' },
      { label: 'Operating Temp', value: '23°F to 113°F (-5°C to 45°C) up to 5,000 ft' },
      { label: 'MTBF', value: '299,000+ hours (predicted hardware reliability)' }
    ],
    cliCommands: [
      'show version',
      'show inventory',
      'show environment all',
      'show platform hardware fed switch active fwd-asic resource tcam utilization'
    ]
  },
  'beacon-uid': {
    id: 'beacon-uid',
    higCallout: 'Front Callout #1 / Rear Callout #3',
    zone: 'Front Panel (Left)',
    title: 'Blue Beacon LED & UID Button',
    subtitle: 'Front Tactile UID Button + Rear BEACON Indicator',
    partNumber: 'Integrated Chassis Locator',
    status: 'Interactive',
    summary: 'Bright solid-blue Unit Identifier (UID) locator LED present on both the front left bezel (push-button labeled UID) and rear panel (LED labeled BEACON). Used by datacenter technicians to visually pinpoint a specific switch inside a crowded 42U equipment rack.',
    specs: [
      { label: 'Front Control', value: 'Physical push-button labeled UID (toggles beacon on/off)' },
      { label: 'Rear Indicator', value: 'Synchronized blue LED labeled BEACON near RJ-45 Console' },
      { label: 'Cloud Mode State', value: 'Flashing Blue = Provisioning; Solid Blue = Unable to reach cloud' },
      { label: 'On-Prem State', value: 'Solid Blue = Operator requested physical identification' }
    ],
    cliCommands: [
      'hw-module beacon slot 1 on',
      'hw-module beacon slot 1 off',
      'show facility-alarm status'
    ]
  },
  'mode-button': {
    id: 'mode-button',
    higCallout: 'Front Callout #2',
    zone: 'Front Panel (Left)',
    title: 'Mode Button & Reset Trigger',
    subtitle: 'Cycles Port LED Display Modes Across Entire Stack',
    partNumber: 'Integrated Tactile Switch',
    status: 'Interactive',
    summary: 'Pressing the Mode button cycles the meaning of the 48 port LEDs through STAT, SPEED, DUPLX, ACTV, STACK, and PoE modes across all switches in the StackWise ring simultaneously. Holding for 21+ seconds triggers a factory reset on cloud-managed (-M) units.',
    specs: [
      { label: 'Short Press Action', value: 'Cycles STAT → SPEED → DUPLX → ACTV → STACK → PoE' },
      { label: 'Stack Synchronization', value: 'Broadcasts selected LED mode to all 8 stack members' },
      { label: 'Bootloader / Recovery', value: 'Hold during power-up to enter ROMMON (switch: prompt)' },
      { label: 'Factory Reset (-M)', value: 'Hold for ≥21 seconds until LEDs stop flashing' }
    ],
    cliCommands: [
      'show switch detail',
      'system ignore startupconfig switch all'
    ]
  },
  'status-leds': {
    id: 'status-leds',
    higCallout: 'Front Callout #3',
    zone: 'Front Panel (Left)',
    title: 'System & Mode Status LED Cluster',
    subtitle: 'SYST • ACTV • STAT • SPEED • DUPLX • STACK • PoE • S-PWR • XPS',
    partNumber: 'Front Diagnostic Array',
    status: 'Healthy',
    summary: 'Diagnostic LED bank on the left bezel showing overall system health (SYST), stack active election role (ACTV), StackPower ring health (S-PWR), XPS status, and the currently selected port LED display mode.',
    specs: [
      { label: 'SYST LED', value: 'Off = No Power | Green = Normal | Blinking Green = Booting | Amber = Fan/POST Fault' },
      { label: 'ACTV LED', value: 'Green = Active Switch | Slow Blink Green = Standby | Off = Member | Amber = Election Error' },
      { label: 'PoE LED', value: 'Green = PoE Mode Selected | Blinking Amber = Port PoE Fault/Denied' },
      { label: 'S-PWR LED', value: 'Green = Closed Ring | Blinking Green = Open Ring | Amber = Load Shedding / Cable Fault' }
    ],
    cliCommands: [
      'show environment status',
      'show post',
      'show stack-power'
    ]
  },
  'usb-mini-console': {
    id: 'usb-mini-console',
    higCallout: 'Front Callout #4',
    zone: 'Front Panel (Left)',
    title: 'USB Mini-Type B Console Port (5-Pin)',
    subtitle: 'Front-Access Serial CLI Console (Takes Precedence Over Rear RJ-45)',
    partNumber: 'CAB-CONSOLE-USB=',
    status: 'Standby (Ready)',
    summary: '5-pin USB mini-Type B serial console connector on the front panel with dedicated green activity LED. Console output is mirrored to both RJ-45 and USB ports, but USB console input automatically preempts the rear RJ-45 console when plugged in.',
    specs: [
      { label: 'Connector Type', value: '5-pin USB Mini-Type B (4-pin cables are NOT compatible)' },
      { label: 'Default Baud Rate', value: '9600 bps, 8 data bits, no parity, 1 stop bit (9600 8N1)' },
      { label: 'Preemption Rule', value: 'Overrides rear RJ-45 console input when cable is inserted' },
      { label: 'OS Support', value: 'Native CDC-ACM on macOS/Linux; Cisco USB driver on Windows' }
    ],
    cliCommands: [
      'line console 0',
      'media-type rj45 | auto-detect',
      'usb-inactivity-timeout 30'
    ]
  },
  'usb-type-a': {
    id: 'usb-type-a',
    higCallout: 'Front Callout #5',
    zone: 'Front Panel (Left)',
    title: 'USB 3.0 Type-A Host Storage Port',
    subtitle: 'External Flash Drive Support (5V @ 900mA)',
    partNumber: 'USB-3.0-HOST (usbflash0:)',
    status: 'Ready',
    summary: 'Front-panel USB 3.0 Type-A connector providing access to FAT-formatted external USB flash drives (128 MB to 8 GB+ Cisco USB keys). A single USB drive inserted into any member switch can upgrade IOS-XE across the entire switch stack.',
    specs: [
      { label: 'File System Mount', value: 'usbflash0: (FAT16 / FAT32 supported)' },
      { label: 'Power Output', value: '5V DC sourcing up to 900 mA (USB 3.0 spec)' },
      { label: 'Stack-Wide Upgrade', value: 'Accessible from active supervisor to image all stack members' },
      { label: 'Emergency Recovery', value: 'Boot directly from usbflash0: in ROMMON if bootflash: corrupts' }
    ],
    cliCommands: [
      'dir usbflash0:',
      'install add file usbflash0:cat9k_iosxe.17.12.04.SPA.bin activate commit',
      'copy running-config usbflash0:backup-cfg.txt'
    ]
  },
  'uplink-module': {
    id: 'uplink-module',
    higCallout: 'Front Callout #6',
    zone: 'Front Panel (Right)',
    title: 'Hot-Swappable Network Uplink Module Bay',
    subtitle: 'Supports C9300-NM-8X / 4G / 4M / 2Q / 2Y',
    partNumber: 'C9300-NM-8X (Installed)',
    status: 'Active (80 Gbps Capacity)',
    summary: 'Modular hot-swappable expansion bay on the right side of the front panel. Accepts interchangeable Cisco Catalyst 9300 network modules secured by two captive knurled thumbscrews. Never leave the slot open—install C9300-NM-BLANK if unpopulated.',
    specs: [
      { label: 'Supported Modules', value: 'C9300-NM-4G (4x1G), NM-4M (4xmGig), NM-8X (8x10G), NM-2Y (2x25G), NM-2Q (2x40G)' },
      { label: 'Hot-Swap Support', value: 'Online Insertion and Removal (OIR) without rebooting chassis' },
      { label: 'Captive Torque', value: 'Tighten thumbscrews to 5–7 in-lb (0.56–0.79 N·m)' },
      { label: 'Airflow Requirement', value: 'Requires C9300-NM-BLANK if no uplink module is present' }
    ],
    cliCommands: [
      'show inventory',
      'show interfaces TenGigabitEthernet1/1/1 transceiver detail',
      'show platform software yang-management process'
    ]
  },
  'psu-1': {
    id: 'psu-1',
    higCallout: 'Rear Callout #11 (Slot A / PS1)',
    zone: 'Rear Panel (Left)',
    title: 'Power Supply Module 1 (PS1 — Primary)',
    subtitle: 'Hot-Swappable Redundant AC/DC Power Bay A',
    partNumber: 'PWR-C1-1100WAC-P',
    status: 'Operational (AC OK: Green | PS OK: Green)',
    summary: 'Primary internal hot-swappable power supply module with integrated cooling fan, AC input retainer clip, and dual status LEDs (AC OK input & PS OK output). Shares power across the chassis and optionally into the Cisco StackPower pool.',
    specs: [
      { label: 'Supported Models', value: '350W, 715W, 1100W, 1900W Platinum AC (PWR-C1-*-P) & 715W DC' },
      { label: 'AC OK LED', value: 'Green = AC Input Present | Off = No AC Input Power' },
      { label: 'PS OK LED', value: 'Green = 56V DC Output Active | Red = PSU Output Fault' },
      { label: 'Efficiency Rating', value: '80 Plus Platinum Certified (PWR-C1-*-P series)' }
    ],
    cliCommands: [
      'show environment power all',
      'show power inline',
      'power supply 1'
    ]
  },
  'psu-2': {
    id: 'psu-2',
    higCallout: 'Rear Callout #11 (Slot B / PS2)',
    zone: 'Rear Panel (Left)',
    title: 'Power Supply Module 2 (PS2 — Secondary/Redundant)',
    subtitle: 'Hot-Swappable Redundant AC/DC Power Bay B',
    partNumber: 'PWR-C1-1100WAC-P',
    status: 'Configurable (Click to Toggle Fault / Blank)',
    summary: 'Secondary hot-swappable power supply slot. Can operate in 1+1 redundant mode or combined mode to double the available PoE/UPOE+ wattage (up to 1800W–2880W). Caution: Never operate with an empty open slot—install PWR-C1-BLANK if unused.',
    specs: [
      { label: 'Operating Modes', value: 'Redundant (1+1 failover) or Combined (Full PoE Budget Pool)' },
      { label: 'Hot-Swap OIR', value: 'Pinch release latch and slide out via color-coded grab handle' },
      { label: 'Thermal Caution', value: 'Always install PWR-C1-BLANK if Slot 2 is unpopulated' },
      { label: '1900W Note', value: 'PWR-C1-1900WAC-P delivers 1900W @ 230V AC or 1500W @ 115V AC' }
    ],
    cliCommands: [
      'show environment power all',
      'show power inline police',
      'stack-power stack Powerstack1'
    ]
  },
  'fan-1': {
    id: 'fan-1',
    higCallout: 'Rear Callout #6 (Fan Bay 1)',
    zone: 'Rear Panel (Center-Right)',
    title: 'Hot-Swappable Fan Module 1 (FAN-T2=)',
    subtitle: '12V Variable-Speed PWM Exhaust Fan Assembly #1',
    partNumber: 'FAN-T2=',
    status: 'Operational (11,400 RPM)',
    summary: 'First of three field-replaceable 12V cooling fan modules. Draws cool intake air from the front faceplate and side hexagonal vents across the UADP ASIC and PoE controllers, exhausting warm air out the rear panel.',
    specs: [
      { label: 'Spare Part Number', value: 'FAN-T2= (Hot-swappable 12V dual-rotor fan pack)' },
      { label: 'Status LED Location', value: 'Top-left corner of fan bezel (Green = OK, Amber = Tachometer Fault)' },
      { label: 'Redundancy Rule', value: 'Switch survives 1 fan failure (remaining 2 ramp to 100% duty cycle)' },
      { label: 'Airflow Direction', value: 'Front-to-Rear and Side-to-Rear exhaust' }
    ],
    cliCommands: [
      'show environment fan',
      'show environment temperature'
    ]
  },
  'fan-2': {
    id: 'fan-2',
    higCallout: 'Rear Callout #6 (Fan Bay 2)',
    zone: 'Rear Panel (Center-Right)',
    title: 'Hot-Swappable Fan Module 2 (FAN-T2=)',
    subtitle: '12V Variable-Speed PWM Exhaust Fan Assembly #2',
    partNumber: 'FAN-T2=',
    status: 'Operational (11,350 RPM)',
    summary: 'Center field-replaceable 12V cooling fan module positioned directly behind the UADP 2.0 ASIC thermal channel. Pinch top and bottom plastic tabs simultaneously to extract while the switch remains online.',
    specs: [
      { label: 'Spare Part Number', value: 'FAN-T2= (Hot-swappable 12V dual-rotor fan pack)' },
      { label: 'Status LED Location', value: 'Top-left corner of fan bezel (Green = OK, Amber = Tachometer Fault)' },
      { label: 'Acoustic Output', value: '44 dBA nominal at 25°C ambient' },
      { label: 'Airflow Direction', value: 'Front-to-Rear and Side-to-Rear exhaust' }
    ],
    cliCommands: [
      'show environment fan',
      'show environment all'
    ]
  },
  'fan-3': {
    id: 'fan-3',
    higCallout: 'Rear Callout #6 (Fan Bay 3)',
    zone: 'Rear Panel (Center-Right)',
    title: 'Hot-Swappable Fan Module 3 (FAN-T2=)',
    subtitle: '12V Variable-Speed PWM Exhaust Fan Assembly #3',
    partNumber: 'FAN-T2=',
    status: 'Interactive (Toggle Fault Simulation)',
    summary: 'Rightmost field-replaceable 12V fan module. If a fan encounters a tachometer fault, its top-left LED turns Amber and the front SYST LED turns Amber, while Fan 1 and Fan 2 automatically boost RPM to prevent thermal shutdown.',
    specs: [
      { label: 'Spare Part Number', value: 'FAN-T2= (Hot-swappable 12V dual-rotor fan pack)' },
      { label: 'Fault Behavior', value: 'Top-left LED turns Amber; SNMP envMonFanStatusChangeNotification sent' },
      { label: 'Replacement Window', value: 'Hot-swap within 2 minutes of extraction to maintain thermal envelope' },
      { label: 'Airflow Direction', value: 'Front-to-Rear and Side-to-Rear exhaust' }
    ],
    cliCommands: [
      'show environment fan',
      'show logging | include FAN'
    ]
  },
  'stackwise-ports': {
    id: 'stackwise-ports',
    higCallout: 'Rear Callout #10',
    zone: 'Rear Panel (Center)',
    title: 'Dual StackWise-480 Data Stacking Ports',
    subtitle: '480 Gbps Bi-Directional Ring Fabric (Up to 8 Switches)',
    partNumber: 'STACK-T1-50CM / 1M / 3M',
    status: 'Ring Closed (Full 480 Gbps Bandwidth)',
    summary: 'Two high-density shielded StackWise-480 connectors (Stack Port 1 & Stack Port 2) on the rear panel. Interconnects up to 8 Catalyst 9300 switches into a single unified control plane and forwarding fabric with Stateful Switchover (SSO) sub-50ms resiliency.',
    specs: [
      { label: 'Stacking Bandwidth', value: '480 Gbps (1000 Gbps StackWise-1T on C9300X; 320 Gbps on C9300L)' },
      { label: 'Max Stack Members', value: 'Up to 8 switches in a closed dual-path ring topology' },
      { label: 'Supported Cables', value: 'STACK-T1-50CM (0.5m default), STACK-T1-1M (1.0m), STACK-T1-3M (3.0m)' },
      { label: 'Fastener Torque', value: 'Hand-tighten dual knurled thumbscrews evenly to prevent pin skew' }
    ],
    cliCommands: [
      'show switch detail',
      'show switch stack-ports summary',
      'show switch stack-ring speed'
    ]
  },
  'stackpower-ports': {
    id: 'stackpower-ports',
    higCallout: 'Rear Callout #7',
    zone: 'Rear Panel (Center)',
    title: 'Cisco StackPower Connectors (Port 1 & Port 2)',
    subtitle: 'Zero-Footprint DC Power Backplane Sharing (Up to 4 Switches)',
    partNumber: 'CAB-SPWR-30CM / CAB-SPWR-150CM',
    status: 'Power-Sharing Ring Active',
    summary: 'Two color-coded keyed StackPower connectors that pool all installed power supplies across up to 4 switches in a ring (or up to 9 switches with an XPS 2200). If both PSUs fail in one switch, neighboring switches seamlessly supply its PoE+ and chassis power.',
    specs: [
      { label: 'Max Ring Size', value: 'Up to 4 switches per StackPower ring (no external RPS required)' },
      { label: 'Operating Modes', value: 'Power-Sharing Mode (default) or Redundant Mode (reserves largest PSU)' },
      { label: 'Cable Options', value: 'CAB-SPWR-30CM (0.3m green/yellow band) & CAB-SPWR-150CM (1.5m)' },
      { label: 'Keyed Polarity', value: 'XOR keyed connectors prevent accidental cross-plugging with StackWise' }
    ],
    cliCommands: [
      'show stack-power detail',
      'show stack-power budgeting',
      'stack-power stack PowerStack1 mode redundant'
    ]
  },
  'rear-mgmt-block': {
    id: 'rear-mgmt-block',
    higCallout: 'Rear Callouts #1–5',
    zone: 'Rear Panel (Far Right)',
    title: 'Rear Out-of-Band Management, Console, SSD & Ground Block',
    subtitle: 'RJ-45 Console • 1G VRF Mgmt (Gi0/0) • USB 3.0 SSD • Ground Lug • RFID',
    partNumber: 'SSD-120G / SSD-240G (Optional)',
    status: 'Gi0/0 Up (10.254.0.10/24) | SSD-240G Mounted',
    summary: 'Rightmost rear service cluster housing the dedicated 10/100/1000 Ethernet management port (Gi0/0 in Mgmt-vrf), EIA/TIA-232 RJ-45 serial console port, rear blue BEACON LED, field-replaceable USB 3.0 SSD slot (120GB/240GB for Wireshark PCAPs & Docker containers), dual-hole grounding lug, and passive UHF RFID asset tag.',
    specs: [
      { label: 'MGMT Port (Gi0/0)', value: '10/100/1000 RJ-45 isolated in VRF Mgmt-vrf (Never connect to switch ports!)' },
      { label: 'CONSOLE Port', value: 'EIA/TIA-232 RJ-45 serial port (Disabled automatically if front USB-B active)' },
      { label: 'USB 3.0 SSD Slot', value: 'Pluggable 120GB / 240GB SSD (flash1:/usbslot:) for IOx App Hosting & PCAP' },
      { label: 'Grounding & RFID', value: '2-hole M4 chassis ground lug + ISO 18000-6C 860–960 MHz passive UHF RFID' }
    ],
    cliCommands: [
      'show interfaces GigabitEthernet0/0',
      'show ip interface brief vrf Mgmt-vrf',
      'dir usbslot0:',
      'show app-hosting list'
    ]
  },
  'internal-uadp-asic': {
    id: 'internal-uadp-asic',
    higCallout: 'Internal Architecture',
    zone: 'Internal Motherboard',
    title: 'Cisco UADP 2.0 ASIC (Unified Access Data Plane)',
    subtitle: 'Programmable Layer-2/Layer-3 Silicon + Skived Copper Heatsink',
    partNumber: 'UADP-2.0-ASIC',
    status: 'Core Temp: 46°C (Optimal)',
    summary: 'The heart of the Cisco Catalyst 9300: Cisco’s programmable Unified Access Data Plane (UADP 2.0) Application-Specific Integrated Circuit. Delivers 256 Gbps switching capacity, hardware VXLAN/LISP SD-Access fabric encapsulation, line-rate AES-256 MACsec encryption, 32,000 MAC addresses, and Flexible NetFlow.',
    specs: [
      { label: 'Silicon Architecture', value: 'Cisco UADP 2.0 Programmable Pipeline ASIC' },
      { label: 'Packet Buffer', value: '16 MB shared dynamic buffer (32 MB on -UB deep-buffer models)' },
      { label: 'Hardware Encryption', value: 'Line-rate IEEE 802.1AE MACsec-256 + Encrypted Traffic Analytics (ETA)' },
      { label: 'Routing Scale', value: 'Up to 32,000 IPv4 routes, 16,000 IPv6 routes, 1,000 active VLANs' }
    ],
    cliCommands: [
      'show platform resources',
      'show platform hardware fed switch active fwd-asic insight',
      'show environment temperature'
    ]
  },
  'internal-x86-cpu': {
    id: 'internal-x86-cpu',
    higCallout: 'Internal Architecture',
    zone: 'Internal Motherboard',
    title: 'x86 Multi-Core CPU Complex, 8GB DRAM & 16GB Flash',
    subtitle: 'Control Plane Processor + Cisco IOx Container Hosting Engine',
    partNumber: 'X86-64-CTRL-8G',
    status: 'CPU Load: 8% | DRAM: 3.1 / 8.0 GB',
    summary: 'Dedicated multi-core x86-64 processor with 8 GB DDR4 DRAM and 16 GB internal bootflash. Runs modular Linux-based Cisco IOS-XE, Trustworthy Systems Secure Boot anchor chip, and supports native Docker/IOx application hosting directly on the switch.',
    specs: [
      { label: 'Control Plane CPU', value: 'Intel x86-64 4-Core 1.8 GHz Processor' },
      { label: 'Memory & Storage', value: '8 GB DDR4 SDRAM + 16 GB Internal Flash + Optional 240 GB Rear USB SSD' },
      { label: 'Security Anchor', value: 'Cisco Trust Anchor Module (TAM) hardware root of trust (SUDI 2099)' },
      { label: 'App Hosting', value: 'Runs ThousandEyes Enterprise Agent, Wireshark, and Docker containers' }
    ],
    cliCommands: [
      'show processes cpu sorted',
      'show platform software status control-processor brief',
      'show trustpoint'
    ]
  },
  'internal-poe-board': {
    id: 'internal-poe-board',
    higCallout: 'Internal Architecture',
    zone: 'Internal Motherboard',
    title: 'PoE+ / UPOE+ Power Controller Daughterboard & Magnetics',
    subtitle: '48-Port IEEE 802.3af/at/bt PSE Controllers & Isolation Transformers',
    partNumber: 'PSE-48CH-UPOE',
    status: 'Delivering 412W across 32 Active PoE Ports',
    summary: 'High-density Power Sourcing Equipment (PSE) daughterboard and line magnetics sitting immediately behind the 48 RJ-45 jacks. Performs real-time LLDP/CDP power negotiation, perpetual PoE (maintaining power to phones/APs during warm IOS-XE reloads), and Fast PoE (power within seconds of AC restore).',
    specs: [
      { label: 'Power Features', value: 'Perpetual PoE (uninterrupted during reload) & Fast PoE (<5s on cold boot)' },
      { label: 'IEEE Standards', value: '802.3af (15.4W), 802.3at (30W), 802.3bt Type 3 (60W) & Type 4 (90W)' },
      { label: 'Safety Protection', value: 'Limited Power Source (LPS) IEC 60950-1 per-port current policing' },
      { label: 'Autoclass & LLDP-MED', value: 'Dynamic 0.1W granularity power negotiation with Cisco endpoints' }
    ],
    cliCommands: [
      'show power inline',
      'show power inline consumption',
      'interface range Gi1/0/1-48 -> power inline perpetual-poe-ha'
    ]
  },
  'rack-brackets': {
    id: 'rack-brackets',
    higCallout: 'Installation Guide',
    zone: 'Chassis Side Mounts',
    title: '19-Inch EIA Rack-Mounting Brackets & Side Intake Vents',
    subtitle: 'Front / Mid / Rear 4-Post & 2-Post Mounting Ears + Hex Airflow Grilles',
    partNumber: 'RCKMNT-1RU-2KX=',
    status: 'Installed (Front-Mount 19" EIA Position)',
    summary: 'Heavy-gauge stamped steel rack-mounting brackets bolted to threaded side-chassis holes with four Phillips flat-head 8-32 screws per side. Behind the brackets are precision hexagonal side intake vents that feed cool air into the internal chassis plenum.',
    specs: [
      { label: 'Rack Compatibility', value: 'Standard 19-inch EIA-310-D 2-post or 4-post equipment racks (optional 23"/24"/ETSI)' },
      { label: 'Mounting Positions', value: 'Front-flush, recessed 2-inch, or mid-mount Telco balance position' },
      { label: 'Side Clearance', value: 'Maintain ≥2.5 in (6.4 cm) clearance on sides for intake ventilation' },
      { label: 'Fasteners', value: '8× 8-32 × 0.25 in Phillips flat-head machine screws (15 in-lb torque)' }
    ],
    cliCommands: [
      'show environment temperature'
    ]
  }
};

// Generate rich, realistic 48-port enterprise configuration & telemetry
const ENDPOINT_PROFILES = [
  { type: 'ap', role: 'Cisco Catalyst CW9166I Wi-Fi 6E AP', vlan: 20, vlanName: 'WLAN-MGMT', speed: '1000', poeClass: 'Class 6 (UPOE)', watts: 42.5, cdp: true },
  { type: 'phone', role: 'Cisco IP Phone 8865 Video', vlan: 110, vlanName: 'VOICE-CORP', speed: '1000', poeClass: 'Class 4 (PoE+)', watts: 14.2, cdp: true },
  { type: 'camera', role: 'Axis Q6135-LE PTZ Dome Camera', vlan: 40, vlanName: 'SEC-SURVEILLANCE', speed: '1000', poeClass: 'Class 6 (UPOE)', watts: 51.0, cdp: false },
  { type: 'workstation', role: 'CAD Engineering Workstation', vlan: 10, vlanName: 'CORP-DATA', speed: '1000', poeClass: 'Non-PoE', watts: 0, cdp: false },
  { type: 'iot', role: 'Smart Building BACnet HVAC PoE Node', vlan: 50, vlanName: 'BMS-IOT', speed: '100', poeClass: 'Class 3 (PoE)', watts: 11.8, cdp: false },
  { type: 'led', role: 'PoE+ Smart Tunable LED Ceiling Array', vlan: 50, vlanName: 'BMS-IOT', speed: '100', poeClass: 'Class 8 (UPOE+)', watts: 74.0, cdp: false },
  { type: 'printer', role: 'Enterprise Floor MFP Laser Printer', vlan: 30, vlanName: 'PRINT-SVCS', speed: '1000', poeClass: 'Non-PoE', watts: 0, cdp: false }
];

export function generatePortsData(modelId = 'C9300-48U') {
  const model = SWITCH_MODELS[modelId] || SWITCH_MODELS['C9300-48U'];
  const isMgig = modelId === 'C9300-48UXM';
  const isDataOnly = modelId === 'C9300-48T';

  const ports = [];
  for (let i = 1; i <= 48; i++) {
    let status = 'up';
    let profile = ENDPOINT_PROFILES[i % ENDPOINT_PROFILES.length];

    // Introduce realistic enterprise port variety
    if ([7, 15, 23, 31, 39, 44, 46].includes(i)) {
      status = 'down';
    } else if (i === 19) {
      status = 'stp-blocking';
    } else if (i === 33) {
      status = 'poe-fault';
    } else if (i <= 8) {
      // Ports 1-8 dedicated to High-Density Wi-Fi 6E/7 Access Points
      profile = ENDPOINT_PROFILES[0];
    } else if (i >= 9 && i <= 24) {
      // Ports 9-24 IP Phones + Desktop Workstations
      profile = i % 2 === 0 ? ENDPOINT_PROFILES[1] : ENDPOINT_PROFILES[3];
    } else if (i >= 25 && i <= 36) {
      // Ports 25-36 PTZ Security Cameras & Smart Building IoT
      profile = i % 3 === 0 ? ENDPOINT_PROFILES[2] : ENDPOINT_PROFILES[4];
    } else {
      // Ports 37-48 High-power UPOE/UPOE+ lighting, APs & Printers
      profile = i % 2 === 0 ? ENDPOINT_PROFILES[5] : ENDPOINT_PROFILES[6];
    }

    const effectiveSpeed =
      status === 'down'
        ? 'auto'
        : isMgig && profile.type === 'ap'
        ? '5000'
        : profile.speed;

    let watts = 0;
    if (!isDataOnly && status === 'up') {
      watts = Math.min(profile.watts, model.maxPerPortWatts);
    }

    const row = i % 2 === 1 ? 'Top Row (Odd)' : 'Bottom Row (Even)';
    const bank = Math.ceil(i / 12); // Four 12-port banks across the faceplate

    ports.push({
      portNumber: i,
      interfaceName: isMgig ? `Te1/0/${i}` : `Gi1/0/${i}`,
      row,
      bank,
      status, // 'up' | 'down' | 'stp-blocking' | 'poe-fault'
      speed: effectiveSpeed, // '100' | '1000' | '2500' | '5000' | '10000' | 'auto'
      duplex: status === 'down' ? 'auto' : 'full',
      vlan: status === 'down' ? 999 : profile.vlan,
      vlanName: status === 'down' ? 'UNUSED-PARKING' : profile.vlanName,
      poeClass: isDataOnly || status === 'down' ? 'Off' : profile.poeClass,
      poeWatts: watts,
      endpointType: status === 'down' ? 'none' : profile.type,
      connectedDevice:
        status === 'down'
          ? 'Not Connected (RJ-45 Open)'
          : status === 'stp-blocking'
          ? 'Redundant Access Switch Loop (STP Alt/Blk)'
          : status === 'poe-fault'
          ? 'Damaged Cat5e Patch Cable (IEEE Short Detected)'
          : `${profile.role} #${i}`,
      hostname:
        status === 'down'
          ? '—'
          : `${profile.type.toUpperCase()}-FL3-${String(i).padStart(2, '0')}.corp.local`,
      ipAddress:
        status === 'down'
          ? '—'
          : `10.${profile.vlan}.${Math.ceil(i / 12)}.${100 + i}`,
      macAddress: `00:50:56:${(10 + bank).toString(16)}:${(20 + i).toString(16).padStart(2, '0')}:${(40 + i).toString(16).padStart(2, '0')}`,
      cableLengthMeters: status === 'down' ? 0 : 12 + ((i * 7) % 78),
      cableCategory: isMgig && effectiveSpeed === '5000' ? 'Cat6A S/FTP' : 'Cat6 UTP',
      rxRateMbps: status === 'up' ? Number(((i * 13.7) % 420 + 8.4).toFixed(1)) : 0,
      txRateMbps: status === 'up' ? Number(((i * 9.3) % 310 + 12.1).toFixed(1)) : 0
    });
  }
  return ports;
}

export const RJ45_PINOUT_SPEC = [
  { pin: 1, signal1000T: 'BI_DA+', colorT568B: 'White/Orange', poeModeA: 'Positive Vport (+)', poe4PairUpoe: 'Pair 1 Positive (+)' },
  { pin: 2, signal1000T: 'BI_DA-', colorT568B: 'Orange', poeModeA: 'Positive Vport (+)', poe4PairUpoe: 'Pair 1 Positive (+)' },
  { pin: 3, signal1000T: 'BI_DB+', colorT568B: 'White/Green', poeModeA: 'Negative Vport (-)', poe4PairUpoe: 'Pair 2 Negative (-)' },
  { pin: 4, signal1000T: 'BI_DC+', colorT568B: 'Blue', poeModeA: 'Unused (Mode B +)', poe4PairUpoe: 'Pair 3 Positive (+)' },
  { pin: 5, signal1000T: 'BI_DC-', colorT568B: 'White/Blue', poeModeA: 'Unused (Mode B +)', poe4PairUpoe: 'Pair 3 Positive (+)' },
  { pin: 6, signal1000T: 'BI_DB-', colorT568B: 'Green', poeModeA: 'Negative Vport (-)', poe4PairUpoe: 'Pair 2 Negative (-)' },
  { pin: 7, signal1000T: 'BI_DD+', colorT568B: 'White/Brown', poeModeA: 'Unused (Mode B -)', poe4PairUpoe: 'Pair 4 Negative (-)' },
  { pin: 8, signal1000T: 'BI_DD-', colorT568B: 'Brown', poeModeA: 'Unused (Mode B -)', poe4PairUpoe: 'Pair 4 Negative (-)' }
];
