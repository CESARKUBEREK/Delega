import test from "node:test"
import assert from "node:assert/strict"
import {
  canTransitionPayment,
  canTransitionRefund,
  canTransitionSubscription,
  transitionPayment,
  transitionRefund,
  transitionSubscription,
} from "../src/lib/billing/state-machine.ts"

test("subscription transitions allow activation, recovery and scheduled cancellation", () => {
  assert.equal(canTransitionSubscription("incomplete", "active"), true)
  assert.equal(canTransitionSubscription("past_due", "active"), true)
  assert.equal(canTransitionSubscription("active", "cancel_at_period_end"), true)
  assert.equal(canTransitionSubscription("cancel_at_period_end", "active"), true)
})

test("terminal subscription states cannot be reopened", () => {
  assert.equal(canTransitionSubscription("canceled", "active"), false)
  assert.equal(canTransitionSubscription("expired", "active"), false)
  assert.throws(() => transitionSubscription("canceled", "active"), /Invalid subscription transition/)
})

test("payments cannot move backwards after success", () => {
  assert.equal(canTransitionPayment("processing", "succeeded"), true)
  assert.equal(canTransitionPayment("succeeded", "failed"), false)
  assert.throws(() => transitionPayment("succeeded", "failed"), /Invalid payment transition/)
})

test("refunds follow requested, pending, succeeded lifecycle", () => {
  assert.equal(canTransitionRefund("requested", "pending"), true)
  assert.equal(canTransitionRefund("pending", "succeeded"), true)
  assert.equal(canTransitionRefund("succeeded", "pending"), false)
  assert.throws(() => transitionRefund("succeeded", "pending"), /Invalid refund transition/)
})
