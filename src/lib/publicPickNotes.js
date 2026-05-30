import { hasSupabase, supabase } from './supabaseClient.js'

const pickTables = {
  Movies: { table: 'movies', idColumn: 'movie_id' },
  Series: { table: 'series', idColumn: 'series_id' },
  Games: { table: 'games', idColumn: 'game_id' },
}

function clean(value) {
  return String(value || '').trim()
}

function requireClient() {
  if (!hasSupabase || !supabase) throw new Error('Supabase is not configured.')
  return supabase
}

function pickMeta(item) {
  const meta = pickTables[item?.category]
  if (!meta) throw new Error('Notes are available for movies, series, and games.')
  if (!item?.groupId) throw new Error('Only public clique picks can have public notes.')
  if (!item?.id) throw new Error('Missing pick id.')
  return meta
}

export async function getPublicPickNote(item) {
  const client = requireClient()
  const { table, idColumn } = pickMeta(item)
  const { data, error } = await client
    .from(table)
    .select('note')
    .eq('group_id', item.groupId)
    .eq(idColumn, String(item.id))
    .maybeSingle()

  if (error) throw error
  return data?.note || ''
}

export async function savePublicPickNote(item, note, currentHandle = '') {
  const client = requireClient()
  const { table, idColumn } = pickMeta(item)
  const handle = clean(currentHandle)
  if (!handle) throw new Error('Set your profile name first to edit your note.')

  const { data, error } = await client
    .from(table)
    .update({ note: clean(note) || null, updated_at: new Date().toISOString() })
    .eq('group_id', item.groupId)
    .eq(idColumn, String(item.id))
    .eq('nominated_by', handle)
    .select('note')
    .maybeSingle()

  if (error) throw error
  if (!data) throw new Error('Only the person who suggested this pick can edit its note.')
  return { note: data.note || '' }
}
