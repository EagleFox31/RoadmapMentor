import test from "node:test";
import assert from "node:assert/strict";
import {
  InvalidScopeChangeTransitionError,
  nextScopeChangeStatus,
} from "../server/domain/scopeChangeWorkflow";

test("mentor quotes a proposed request", () => {
  assert.equal(nextScopeChangeStatus("PROPOSED", "QUOTE", "MENTOR"), "QUOTED");
});

test("mentor can revise a quote before learner decision", () => {
  assert.equal(nextScopeChangeStatus("QUOTED", "QUOTE", "MENTOR"), "QUOTED");
});

test("learner accepts or rejects only a quoted request", () => {
  assert.equal(nextScopeChangeStatus("QUOTED", "ACCEPT", "LEARNER"), "ACCEPTED");
  assert.equal(nextScopeChangeStatus("QUOTED", "REJECT", "LEARNER"), "REJECTED");
});

test("mentor can link accepted scope to roadmap work and then deliver it", () => {
  assert.equal(
    nextScopeChangeStatus("ACCEPTED", "LINK_ROADMAP", "MENTOR"),
    "ACCEPTED",
  );
  assert.equal(
    nextScopeChangeStatus("ACCEPTED", "DELIVER", "MENTOR"),
    "DELIVERED",
  );
});

test("mentor cannot accept on behalf of the learner", () => {
  assert.throws(
    () => nextScopeChangeStatus("QUOTED", "ACCEPT", "MENTOR"),
    InvalidScopeChangeTransitionError,
  );
});

test("learner cannot mark work delivered", () => {
  assert.throws(
    () => nextScopeChangeStatus("ACCEPTED", "DELIVER", "LEARNER"),
    InvalidScopeChangeTransitionError,
  );
});

test("delivered or rejected requests are terminal", () => {
  assert.throws(
    () => nextScopeChangeStatus("DELIVERED", "QUOTE", "MENTOR"),
    InvalidScopeChangeTransitionError,
  );
  assert.throws(
    () => nextScopeChangeStatus("REJECTED", "QUOTE", "MENTOR"),
    InvalidScopeChangeTransitionError,
  );
});
