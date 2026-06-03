import test from 'node:test'
import assert from 'node:assert/strict'
import {
  decisionOptionsOrFallback,
  defaultDecisionQuestion,
  fallbackDecisionOptions,
  formatStructuredDecisionOption,
  isPollOpen,
  leadingPollOptions,
  parseDecisionOptions,
  parseStructuredDecisionOption,
  pollOptionStats,
  totalPollVotes,
} from './decisionLoop.js'

test('defaultDecisionQuestion uses the clique name when available', () => {
  assert.equal(defaultDecisionQuestion('Horror Friday'), 'What should Horror Friday pick tonight?')
  assert.equal(defaultDecisionQuestion('   '), 'What should we pick tonight?')
})

test('formatStructuredDecisionOption creates media-aware options', () => {
  assert.equal(formatStructuredDecisionOption('movie', '123', 'Dune: Part Two'), '[movie:123] Dune: Part Two')
  assert.equal(formatStructuredDecisionOption('unknown', 'abc', 'Mystery pick'), '[other:abc] Mystery pick')
  assert.equal(formatStructuredDecisionOption('game', '', 'Manual pick'), 'Manual pick')
})

test('parseStructuredDecisionOption reads media-aware options', () => {
  assert.deepEqual(parseStructuredDecisionOption('[Series:456] Severance'), {
    itemType: 'series',
    itemId: '456',
    label: 'Severance',
    structured: true,
  })
  assert.deepEqual(parseStructuredDecisionOption('Manual pick'), {
    itemType: 'other',
    itemId: '',
    label: 'Manual pick',
    structured: false,
  })
})

test('parseDecisionOptions trims, dedupes, removes blanks, and limits options', () => {
  assert.deepEqual(
    parseDecisionOptions(' Dune \nDune\n  Baldur\'s Gate 3\n\nSeverance ', 3),
    ['Dune', "Baldur's Gate 3", 'Severance'],
  )
})

test('parseDecisionOptions dedupes structured options by media identity', () => {
  assert.deepEqual(
    parseDecisionOptions('[movie:123] Dune\n[movie:123] Dune: Part Two\n[game:123] Dune Game'),
    ['[movie:123] Dune', '[game:123] Dune Game'],
  )
})

test('decisionOptionsOrFallback returns defaults when no options are provided', () => {
  assert.deepEqual(decisionOptionsOrFallback(''), fallbackDecisionOptions)
})

test('totalPollVotes totals all option votes', () => {
  assert.equal(totalPollVotes({ options: [{ votes: 2 }, { votes: '3' }, { votes: null }] }), 5)
})

test('isPollOpen treats missing status as open and closed as locked', () => {
  assert.equal(isPollOpen({}), true)
  assert.equal(isPollOpen({ status: 'open' }), true)
  assert.equal(isPollOpen({ status: 'closed' }), false)
})

test('pollOptionStats calculates percentages, selected option, and leaders', () => {
  const stats = pollOptionStats({
    myOptionId: 'a',
    options: [
      { id: 'a', label: 'Movie', votes: 2 },
      { id: 'b', label: 'Game', votes: 1 },
      { id: 'c', label: 'Series', votes: 1 },
    ],
  })

  assert.deepEqual(stats.map((option) => option.percent), [50, 25, 25])
  assert.equal(stats[0].selected, true)
  assert.equal(stats[0].leading, true)
  assert.equal(stats[1].leading, false)
})

test('leadingPollOptions returns all tied leaders', () => {
  const leaders = leadingPollOptions({
    options: [
      { id: 'a', label: 'Movie', votes: 2 },
      { id: 'b', label: 'Game', votes: 2 },
      { id: 'c', label: 'Series', votes: 1 },
    ],
  })

  assert.deepEqual(leaders.map((option) => option.label), ['Movie', 'Game'])
})

test('leadingPollOptions returns no leader before anyone votes', () => {
  assert.deepEqual(leadingPollOptions({ options: [{ id: 'a', label: 'Movie', votes: 0 }] }), [])
})
