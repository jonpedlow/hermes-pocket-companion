import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import YAML from 'yaml'

export interface BotProfile {
  id: string
  name: string
  title: string
  description: string
  hasAvatar: boolean
  avatarUrl: string | null
  group: string
  initials: string
}

export const VALID_PROFILE = /^[a-zA-Z0-9][a-zA-Z0-9_-]{0,63}$/

export function resolveHermesHome(): string {
  if (process.env.HERMES_HOME) return path.resolve(process.env.HERMES_HOME)
  const windowsHome = process.env.LOCALAPPDATA && path.join(process.env.LOCALAPPDATA, 'hermes')
  if (windowsHome && existsSync(windowsHome)) return windowsHome
  return path.join(os.homedir(), '.hermes')
}

export function getProfileDirectory(home: string, profile: string): string {
  if (!VALID_PROFILE.test(profile)) throw new Error('Invalid profile')
  return profile === 'default' ? home : path.join(home, 'profiles', profile)
}

function readProfileMeta(directory: string): Record<string, unknown> {
  const yamlFile = path.join(directory, 'profile.yaml')
  if (!existsSync(yamlFile)) return {}
  try {
    const decoded = YAML.parse(readFileSync(yamlFile, 'utf8'))
    return decoded && typeof decoded === 'object' && !Array.isArray(decoded) ? decoded : {}
  } catch {
    // A malformed metadata file must never stop the whole roster loading.
    return {}
  }
}

function dictionary(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown> : {}
}

function stringOrEmpty(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

export function avatarFile(directory: string): { path: string; mime: string } | null {
  for (const [name, mime] of [
    ['avatar.png', 'image/png'],
    ['avatar.webp', 'image/webp'],
    ['avatar.jpg', 'image/jpeg']
  ] as const) {
    const candidate = path.join(directory, 'assets', name)
    if (!existsSync(candidate)) continue
    try {
      const stat = statSync(candidate)
      if (stat.isFile() && stat.size > 0 && stat.size <= 5_000_000) {
        return { path: candidate, mime }
      }
    } catch { /* avatar was replaced during this read */ }
  }
  return null
}

export function profileFromDirectory(home: string, id: string): BotProfile {
  const directory = getProfileDirectory(home, id)
  const meta = readProfileMeta(directory)
  const botMeta = dictionary(dictionary(meta.ui_meta)['hermes-bots'])
  const display = stringOrEmpty(meta.display_name) || (id.charAt(0).toUpperCase() + id.slice(1))
  const title = stringOrEmpty(botMeta.title) || display
  const hasAvatar = Boolean(avatarFile(directory))
  return {
    id,
    name: display,
    title,
    description: stringOrEmpty(botMeta.description) || stringOrEmpty(meta.description) || 'Hermes Agent',
    hasAvatar,
    avatarUrl: hasAvatar ? `/api/profiles/${encodeURIComponent(id)}/avatar` : null,
    group: stringOrEmpty(botMeta.section_name) || 'My agents',
    initials: title.slice(0, 1).toUpperCase()
  }
}

export function discoverProfiles(home = resolveHermesHome()): BotProfile[] {
  if (!existsSync(home)) return []
  const ids = ['default']
  const profilesDir = path.join(home, 'profiles')
  if (existsSync(profilesDir)) {
    for (const entry of readdirSync(profilesDir, { withFileTypes: true })) {
      if (!entry.isDirectory() || !VALID_PROFILE.test(entry.name)) continue
      const directory = path.join(profilesDir, entry.name)
      const hasIdentity = ['profile.yaml', 'config.yaml', '.env', 'SOUL.md', 'state.db', 'auth.json']
        .some(file => existsSync(path.join(directory, file)))
      if (hasIdentity) ids.push(entry.name)
    }
  }
  return ids.map(id => profileFromDirectory(home, id))
}
