export const GROUPS_STORAGE_KEY = 'cliquebase_groups'
export const ACTIVE_GROUP_STORAGE_KEY = 'cliquebase_active_group'
export const PENDING_GROUP_INVITE_STORAGE_KEY = 'cliquebase_pending_group_invite'
export const GROUPS_CHANGED_EVENT = 'cliquebase:groups-changed'

function emitGroupsChanged() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event(GROUPS_CHANGED_EVENT))
  }
}

function safeParse(value, fallback) {
  try {
    return JSON.parse(value) || fallback
  } catch {
    return fallback
  }
}

function clean(value) {
  return String(value || '').trim()
}

function slugify(value) {
  return clean(value).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 28) || 'group'
}

function makeId(name) {
  return `${slugify(name)}-${Math.random().toString(36).slice(2, 8)}`
}

function makeInviteCode(name) {
  return `${slugify(name)}-${Math.random().toString(36).slice(2, 7)}`
}

function normalizeGroup(group) {
  return {
    id: clean(group?.id) || makeId(group?.name || 'Group'),
    name: clean(group?.name) || 'Untitled group',
    inviteCode: clean(group?.inviteCode) || makeInviteCode(group?.name || 'Group'),
    createdBy: clean(group?.createdBy) || 'anonymous',
    createdAt: group?.createdAt || new Date().toISOString(),
    members: Array.from(new Set((group?.members || []).map(clean).filter(Boolean))),
    source: group?.source || 'local',
  }
}

export function parseInviteCode(value) {
  return clean(value).replace(/^.*\/invite\//, '').replace(/^.*\/g\//, '').replace(/^.*\/cliques\//, '').replace(/[?#].*$/, '')
}

export function getGroups() {
  const groups = safeParse(localStorage.getItem(GROUPS_STORAGE_KEY), [])
  return Array.isArray(groups) ? groups.map(normalizeGroup) : []
}

export function saveGroups(groups) {
  const normalized = groups.map(normalizeGroup)
  localStorage.setItem(GROUPS_STORAGE_KEY, JSON.stringify(normalized))
  emitGroupsChanged()
  return normalized
}

export function getActiveGroupId() {
  return clean(localStorage.getItem(ACTIVE_GROUP_STORAGE_KEY) || '')
}

export function getActiveGroup() {
  const activeId = getActiveGroupId()
  return getGroups().find((group) => group.id === activeId) || null
}

export function setActiveGroup(groupId) {
  const id = clean(groupId)
  const currentId = getActiveGroupId()

  if (!id) {
    if (!currentId) return null
    localStorage.removeItem(ACTIVE_GROUP_STORAGE_KEY)
    emitGroupsChanged()
    return null
  }

  if (id === currentId) {
    return getGroups().find((group) => group.id === id) || null
  }

  localStorage.setItem(ACTIVE_GROUP_STORAGE_KEY, id)
  emitGroupsChanged()
  return getGroups().find((group) => group.id === id) || null
}

export function createGroup(name, createdBy = 'anonymous') {
  const group = normalizeGroup({
    id: makeId(name),
    name: clean(name) || 'New group',
    inviteCode: makeInviteCode(name),
    createdBy,
    createdAt: new Date().toISOString(),
    members: [createdBy].filter(Boolean),
  })

  const groups = saveGroups([group, ...getGroups()])
  localStorage.setItem(ACTIVE_GROUP_STORAGE_KEY, group.id)
  emitGroupsChanged()
  return groups.find((item) => item.id === group.id) || group
}

export function joinGroup(inviteCode, handle = 'anonymous') {
  const code = parseInviteCode(inviteCode)
  if (!code) return null

  const groups = getGroups()
  const existingIndex = groups.findIndex((group) => group.inviteCode === code || group.id === code)

  if (existingIndex >= 0) {
    const group = groups[existingIndex]
    const members = Array.from(new Set([...group.members, handle].map(clean).filter(Boolean)))
    const updated = { ...group, members }
    const nextGroups = groups.slice()
    nextGroups[existingIndex] = updated
    saveGroups(nextGroups)
    if (getActiveGroupId() !== updated.id) {
      localStorage.setItem(ACTIVE_GROUP_STORAGE_KEY, updated.id)
      emitGroupsChanged()
    }
    return updated
  }

  const joined = normalizeGroup({
    id: code,
    name: `Joined group ${code.slice(0, 6)}`,
    inviteCode: code,
    createdBy: 'invite',
    createdAt: new Date().toISOString(),
    members: [handle].filter(Boolean),
  })

  saveGroups([joined, ...groups])
  localStorage.setItem(ACTIVE_GROUP_STORAGE_KEY, joined.id)
  emitGroupsChanged()
  return joined
}

export function getGroupInvitePath(group) {
  return group?.inviteCode ? `/invite/${group.inviteCode}` : '/cliques'
}

export function getGroupOpenPath(group) {
  return group?.id ? `/cliques/${group.id}` : '/cliques'
}

export function getGroupInviteUrl(group) {
  const path = getGroupInvitePath(group)
  if (typeof window === 'undefined') return path
  const base = (import.meta.env.BASE_URL || '/').replace(/\/?$/, '/')
  const invitePath = `${base}${path.replace(/^\//, '')}`
  return new URL(invitePath, window.location.origin).toString()
}
