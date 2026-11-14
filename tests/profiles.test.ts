import assert from 'node:assert/strict'
import { test } from 'node:test'
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { avatarFile, discoverProfiles, getProfileDirectory, VALID_PROFILE } from '../server/profiles.ts'

test('discovers named bots and their existing metadata and avatar', () => {
  const root = mkdtempSync(path.join(os.tmpdir(), 'pocket-profile-test-'))
  mkdirSync(path.join(root, 'profiles', 'ember', 'assets'), { recursive: true })
  writeFileSync(path.join(root, 'profiles', 'ember', 'profile.yaml'),
    'display_name: Ember\ndescription: Study guide\nui_meta:\n  hermes-bots:\n    title: Ember · Study club\n    description: Coordinates the team\n')
  writeFileSync(path.join(root, 'profiles', 'ember', 'assets', 'avatar.png'), 'fixture-image-bytes')
  const bots = discoverProfiles(root)
  const ember = bots.find(bot => bot.id === 'ember')
  assert.equal(ember?.title, 'Ember · Study club')
  assert.equal(ember?.description, 'Coordinates the team')
  assert.equal(ember?.hasAvatar, true)
  assert.equal(ember?.avatarUrl, '/api/profiles/ember/avatar')
})

test('refuses path traversal profile names', () => {
  assert.equal(VALID_PROFILE.test('../.ssh'), false)
  assert.equal(VALID_PROFILE.test('ember'), true)
  assert.throws(() => getProfileDirectory('/somewhere', '../secrets'), /Invalid profile/)
})

test('ignores absent avatar instead of inventing image URLs', () => {
  const root = mkdtempSync(path.join(os.tmpdir(), 'pocket-avatar-test-'))
  assert.equal(avatarFile(root), null)
})
