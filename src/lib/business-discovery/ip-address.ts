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
 * IPv6 special-purpose blocks are deliberately excluded even when they sit
 * inside the global-unicast allocation (2000::/3).
 */
export function isPublicAddress(address: string): boolean {
  const version = isIP(address)
  if (version === 4) return isPublicIpv4(address)
  if (version !== 6) return false

  const parsed = parseIpv6(address)
  if (!parsed) return false

  const globalUnicast = parseIpv6("2000::")!
  const ietfProtocolAssignments = parseIpv6("2001::")!
  const documentation2001 = parseIpv6("2001:db8::")!
  const sixToFour = parseIpv6("2002::")!
  const documentation = parseIpv6("3fff::")!
  const srv6Sids = parseIpv6("5f00::")!
  const reservedGlobalUnicast = [
    ["2d00::", 8], ["2e00::", 7], ["3000::", 5], ["3800::", 6],
    ["3c00::", 7], ["3e00::", 8], ["3f00::", 9], ["3f80::", 10],
    ["3fc0::", 11], ["3fe0::", 12], ["3ff0::", 13], ["3ff8::", 14],
    ["3ffc::", 15], ["3ffe::", 16],
  ] as const

  return inIpv6Range(parsed, globalUnicast, 3)
    && !inIpv6Range(parsed, ietfProtocolAssignments, 23)
    && !inIpv6Range(parsed, documentation2001, 32)
    && !inIpv6Range(parsed, sixToFour, 16)
    && !inIpv6Range(parsed, documentation, 20)
    && !inIpv6Range(parsed, srv6Sids, 16)
    && !reservedGlobalUnicast.some(([network, prefix]) => inIpv6Range(parsed, parseIpv6(network)!, prefix))
}
