'use strict'

// What the fuzzer is made of: a seeded generator, so a failure prints the seed that reproduces
// it; the loop over rounds; and the shrinking, which drops the parts of a failing case one at a
// time for as long as the failure survives, so what gets printed is the few lines worth pasting
// into a test rather than the whole round.

/** @param {number} seed @returns {() => number} the same sequence for the same seed */
function mulberry32 (seed) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const int = (rng, min, max) => min + Math.floor(rng() * (max - min + 1))
const pick = (rng, items) => items[Math.floor(rng() * items.length)]
const chance = (rng, p) => rng() < p

function parseArgs (argv) {
  const flag = (name, fallback) => {
    const at = argv.indexOf(`--${name}`)
    return at === -1 ? fallback : Number(argv[at + 1])
  }
  return {
    rounds: flag('rounds', 200),
    seed: flag('seed', (Date.now() ^ (process.pid << 16)) >>> 0),
    keepGoing: argv.includes('--keep-going'),
    noShrink: argv.includes('--no-shrink')
  }
}

// drops parts of a failing case one at a time, keeping every drop the failure survives
async function shrink (plan, variants, fails) {
  let current = plan
  let progress = true
  while (progress) {
    progress = false
    for (const smaller of variants(current)) {
      if (await fails(smaller)) {
        current = smaller
        progress = true
        break
      }
    }
  }
  return current
}

// the loop: draw a case per round, run it, and on a divergence print the seed, shrink the case
// and print it as source
async function main (fuzzer) {
  const args = parseArgs(process.argv.slice(2))
  console.log(`${fuzzer.name}: ${args.rounds} rounds from seed ${args.seed}`)
  let found = 0
  for (let round = 0; round < args.rounds; round++) {
    const seed = (args.seed + round) >>> 0
    const plan = fuzzer.draw(mulberry32(seed))
    const divergence = await fuzzer.run(plan)
    if (!divergence) {
      if (round % 50 === 49) console.log(`  ${round + 1} rounds, no divergence`)
      continue
    }
    found++
    console.log(`\n=== divergence in round ${round}, seed ${seed} (replay: --seed ${seed} --rounds 1)`)
    console.log(divergence)
    if (!args.noShrink) {
      console.log('\nshrinking...')
      const small = await shrink(plan, fuzzer.variants, async (p) => Boolean(await fuzzer.run(p)))
      console.log(`\n${fuzzer.source(small)}`)
      console.log(await fuzzer.run(small))
    }
    if (!args.keepGoing) break
  }
  console.log(`\n${found} divergence${found === 1 ? '' : 's'}`)
  process.exit(found ? 1 : 0)
}

module.exports = { mulberry32, int, pick, chance, shrink, main }
