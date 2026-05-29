const express = require('express')
const os = require('os')
const { connectedChargers } = require('../../ocpp/commands')
const authenticate = require('../middleware/authenticate')
const authorize = require('../middleware/authorize')

const router = express.Router()
router.use(authenticate, authorize('admin'))

// Classify a network interface by its name and MAC address
function classifyInterface(name, mac) {
  const nullMac = !mac || mac === '00:00:00:00:00:00'

  // Loopback
  if (name.startsWith('lo')) return 'loopback'

  // Virtual tunnel interfaces (VPN, WireGuard, OpenVPN, macOS utun, Linux tun/tap)
  if (/^(utun|tun|tap|ppp|wg|ipsec)/i.test(name)) return 'vpn'

  // Apple-specific virtual interfaces (AirDrop, low-latency WLAN)
  if (/^(awdl|llw|bridge|vmnet|vnet|vboxnet)/i.test(name)) return 'virtual'

  // Docker / container bridge interfaces
  if (/^(docker|br-|veth)/i.test(name)) return 'container'

  // If MAC is all-zeros but not a known tunnel prefix — still virtual
  if (nullMac) return 'virtual'

  // Physical interfaces
  if (/^en\d+/.test(name)) return 'ethernet' // macOS: en0=WiFi, en1=Thunderbolt/USB-Ethernet
  if (/^(eth|ens|enp|eno|wlan|wlp)/i.test(name)) return 'ethernet' // Linux
  if (/^Wi-Fi|Ethernet/i.test(name)) return 'ethernet' // Windows

  return 'ethernet' // unknown but has real MAC — treat as usable
}

function getInterfaces() {
  const ifaces = os.networkInterfaces()
  const result = []

  for (const [name, addrs] of Object.entries(ifaces)) {
    for (const iface of addrs) {
      if (iface.family !== 'IPv4' || iface.internal) continue

      const type = classifyInterface(name, iface.mac)
      const usable = type === 'ethernet' // only real physical interfaces are charger-usable by default

      result.push({
        name,
        address: iface.address,
        mac: iface.mac,
        type,           // 'ethernet' | 'vpn' | 'virtual' | 'container'
        usable,         // true = recommended for charger connection
      })
    }
  }

  // Sort: usable first, then others
  return result.sort((a, b) => (b.usable ? 1 : 0) - (a.usable ? 1 : 0))
}

// GET /api/settings/server
router.get('/server', (req, res) => {
  const port = parseInt(process.env.PORT_OCPP || 8887)
  const tls = process.env.TLS_ENABLED === '1'
  const scheme = tls ? 'wss' : 'ws'
  const interfaces = getInterfaces()

  res.json({
    port,
    tls_enabled: tls,
    scheme,
    // All detected IPv4 non-loopback interfaces with classification
    interfaces,
    // Backwards-compat alias used by ChargerForm dropdown (only usable ones)
    lan_ips: interfaces.filter((i) => i.usable).map((i) => ({ name: i.name, address: i.address })),
    connected_chargers: [...connectedChargers.keys()],
    connected_count: connectedChargers.size,
    sample_urls: interfaces
      .filter((i) => i.usable)
      .map((i) => ({
        label: i.name,
        address: i.address,
        url: `${scheme}://${i.address}:${port}/ocpp/{CHARGER_ID}`,
      })),
  })
})

module.exports = router
