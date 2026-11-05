import test from "node:test"
import assert from "node:assert/strict"
import { isPublicAddress } from "../src/lib/business-discovery/ip-address.ts"

test("acepta IPv4 públicas y rechaza rangos privados, locales y reservados", () => {
  for (const address of ["8.8.8.8", "1.1.1.1", "93.184.216.34"]) {
    assert.equal(isPublicAddress(address), true, address)
  }
  for (const address of [
    "0.0.0.0",
    "10.0.0.1",
    "100.64.0.1",
    "127.0.0.1",
    "169.254.1.1",
    "172.16.0.1",
    "192.0.2.1",
    "192.88.99.1",
    "192.168.1.1",
    "198.18.0.1",
    "198.51.100.1",
    "203.0.113.1",
    "224.0.0.1",
    "255.255.255.255",
  ]) {
    assert.equal(isPublicAddress(address), false, address)
  }
})

test("acepta IPv6 global unicast y rechaza direcciones especiales", () => {
  for (const address of [
    "2001:4860:4860::8888",
    "2606:4700:4700::1111",
    "2a00:1450:4001::1",
  ]) {
    assert.equal(isPublicAddress(address), true, address)
  }
  for (const address of [
    "::",
    "::1",
    "::ffff:8.8.8.8",
    "64:ff9b::808:808",
    "100::1",
    "2001::1",
    "2001:db8::1",
    "2002:c000:0201::1",
    "3fff::1",
    "fc00::1",
    "fd12:3456:789a::1",
    "fe80::1",
    "ff02::1",
    "fec0::1",
  ]) {
    assert.equal(isPublicAddress(address), false, address)
  }
})

test("rechaza IPv6 malformadas y direcciones que no son IP", () => {
  for (const address of [
    "2001:::1",
    "2001:db8::1::2",
    "2001:db8:gggg::1",
    "2001:db8::1%eth0",
    "example.com",
    "",
  ]) {
    assert.equal(isPublicAddress(address), false, address)
  }
})
