import test from 'node:test';
import assert from 'node:assert/strict';
import { onControllerChange } from '../../src/hooks/useAppUpdate.js';

test('a first install replaces nothing, so nothing reloads', () => {
  assert.equal(onControllerChange({ hadController: false, interacted: false }), 'ignore');
  assert.equal(onControllerChange({ hadController: false, interacted: true }), 'ignore');
});

test('an untouched page reloads straight onto the new version', () => {
  assert.equal(onControllerChange({ hadController: true, interacted: false }), 'reload');
});

test('a page someone is using is offered the update, never reloaded under them', () => {
  // The case that matters: a half-typed report must not be thrown away.
  assert.equal(onControllerChange({ hadController: true, interacted: true }), 'offer');
});
