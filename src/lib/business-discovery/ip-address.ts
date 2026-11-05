import { isIP } from "node:net"

function parseIpv6(input: string): number[] | null {
  let address = input.toLowerCase()
  if (!address || address.includes("%") || address.includes(":::")) return null

  // Normalize an embedded IPv4 tail into its two hexadecimal groups.
  if (address.includes(".")) {
    const separator = address.lastIndexOf(":")
    if (separator < 0) return null
    const ipv4 = address.slice(separator + 1)
    if (isIP(ipv4) !== 4) return null
    const octets = ipv4.split(".").map(Number)
    const high = ((octets[0] << 8) | octets[1]).toString(16)
    const low = ((octets[2] << 8) | octets[3]).toString(16)
    address = `${address.slice(0, separator)}:${high}:${low}`
  }

  const halves = address.split("::")
  if (halves.length > 2) return null
  const left = halves[0] ? halves[0].split(":") : []
  const right = halves.length === 2 && halves[1] ? halves[1].split(":") : []
  const missing = 8 - left.length - right.length
  if (halves.length === 2 && missing < 1) return null
  const groups = halves.length === 2
    ? [...left, ...Array(missing).fill("0"), ...right]
    : left

  if (groups.length !== 8 || groups.some((group) => !/^[\da-f]{1,4}$/.test(group))) return null
  return groups.map((group) => Number.parseInt(group, 16))
}

function inIpv6Range(address: number[], network: number[], prefixLength: number): boolean {
  const fullGroups = Math.floor(prefixLength / 16)
  const remainingBits = prefixLength % 16
  for (let index = 0; index < fullGroups; index += 1) {
    if (address[index] !== network[index]) return false
  }
  if (remainingBits === 0) return true
  const mask = (0xffff << (16 - remainingBits)) & 0xffff
  return (address[fullGroups] & mask) === (network[fullGroups] & mask)
}

function isPublicIpv4(address: string): boolean {
  const parts = address.split(".").map(Number)
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) return false
  const [a, b, c] = parts
  if (a === 0 || a === 10 || a === 127 || a >= 224) return false
  if (a === 100 && b >= 64 && b <= 127) return false
  if (a === 169 && b === 254) return false
  if (a === 172 && b >= 16 && b <= 31) return false
  if (a === 192 && (b === 0 || b === 168)) return false
  if (a === 192 && b === 88 && c === 99) return false
  if (a === 192 && b === 0 && c === 2) return false
  if (a === 198 && (b === 18 || b === 19 || (b === 51 && c === 100))) return false
  if (a === 203 && b === 0 && c === 113) return false
  return true
}

/**
 * Accepts globally routable unicast addresses only.
 * IPv6 is restricted to prefixes currently allocated in the IANA registry;
 * special-purpose assignments are excluded even when inside an allocation.
 */
export function isPublicAddress(address: string): boolean {
  const version = isIP(address)
  if (version === 4) return isPublicIpv4(address)
  if (version !== 6) return false

  const parsed = parseIpv6(address)
  if (!parsed) return false

  // IANA IPv6 Global Unicast Address Space (2025-10-10).
  // Unlisted space inside 2000::/3 is reserved for future allocation.
  const allocatedGlobalUnicast = [
    ["2001:200::", 23], ["2001:400::", 23], ["2001:600::", 23],
    ["2001:800::", 22], ["2001:c00::", 23], ["2001:e00::", 23],
    ["2001:1200::", 23], ["2001:1400::", 22], ["2001:1800::", 23],
    ["2001:1a00::", 23], ["2001:1c00::", 22], ["2001:2000::", 19],
    ["2001:4000::", 23], ["2001:4200::", 23], ["2001:4400::", 23],
    ["2001:4600::", 23], ["2001:4800::", 23], ["2001:4a00::", 23],
    ["2001:4c00::", 23], ["2001:5000::", 20], ["2001:8000::", 19],
    ["2001:a000::", 20], ["2001:b000::", 20], ["2003::", 18],
    ["2400::", 12], ["2410::", 12], ["2600::", 12],
    ["2610::", 23], ["2620::", 23], ["2630::", 12],
    ["2800::", 12], ["2a00::", 12], ["2a10::", 12], ["2c00::", 12],
  ] as const

  const ietfProtocolAssignments = parseIpv6("2001::")!
  const documentation2001 = parseIpv6("2001:db8::")!
  const sixToFour = parseIpv6("2002::")!
  const documentation = parseIpv6("3fff::")!

  return allocatedGlobalUnicast.some(([network, prefix]) =>
    inIpv6Range(parsed, parseIpv6(network)!, prefix),
  )
    && !inIpv6Range(parsed, ietfProtocolAssignments, 23)
    && !inIpv6Range(parsed, documentation2001, 32)
    && !inIpv6Range(parsed, sixToFour, 16)
    && !inIpv6Range(parsed, documentation, 20)
}
