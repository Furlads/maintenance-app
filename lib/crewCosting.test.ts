import assert from 'node:assert/strict'
import test from 'node:test'
import { compareCrewCosts, type CrewCostingInput } from './crewCosting'

const crews: CrewCostingInput[] = [
  {
    id: 1,
    slug: 'steve-codie',
    name: 'Steve + Codie',
    dayRate: 300,
    durationMultiplier: 0.67,
    skillLevel: 'experienced',
    suitableJobTypes: ['landscaping', 'groundworks', 'fencing'],
    technicalSpecialist: false,
    summary: 'Fast standard crew',
    members: [{ worker: { firstName: 'Codie', lastName: '', transportRequired: true } }],
  },
  {
    id: 2,
    slug: 'luke-labourer',
    name: 'Luke + labourer',
    dayRate: 250,
    durationMultiplier: 1,
    skillLevel: 'higher-skilled / qualified',
    suitableJobTypes: ['technical', 'specialist', 'finish-critical'],
    technicalSpecialist: true,
    summary: 'Technical crew',
  },
]

test('standard fencing recommends the faster crew using total labour cost', () => {
  const result = compareCrewCosts({ scope: 'Replace garden fencing and posts', estimatedDays: 3, crews })
  const recommended = result.options.find((option) => option.recommended)
  assert.equal(recommended?.name, 'Steve + Codie')
  assert.equal(recommended?.expectedDays, 2.5)
  assert.equal(recommended?.totalLabourCost, 750)
  assert.match(recommended?.transportWarning || '', /Codie requires transport/)
})

test('finish-critical porcelain recommends the higher-skilled crew', () => {
  const result = compareCrewCosts({ scope: 'Lay a finish-critical porcelain patio', estimatedDays: 3, crews })
  const recommended = result.options.find((option) => option.recommended)
  assert.equal(recommended?.name, 'Luke + labourer')
  assert.equal(recommended?.totalLabourCost, 750)
  assert.match(recommended?.reason || '', /higher skill level/)
})

test('does not mutate or require quote, job or calendar records', () => {
  const result = compareCrewCosts({ scope: 'General garden work', estimatedDays: null, crews })
  assert.equal(result.basedOnDefaultDuration, true)
  assert.equal(result.options.length, 2)
})
