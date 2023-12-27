'use strict'

const test = require('tap').test
const optimize = require('../lib/optimize')

test('optimize consecutive "json +=" lines', (t) => {
  t.plan(1)

  const unoptimized = `
    json += "A"
    json += "B"
  `

  const optimized = optimize(unoptimized)

  t.equal(optimized, `
    json += "A" + "B"
  `)
})

test('optimize consecutive "json +=" lines', (t) => {
  t.plan(1)

  const unoptimized = `
    json += "A"
    json += "B"
    json += "C"
    Math.random()
  `

  const optimized = optimize(unoptimized)

  t.equal(optimized, `
    json += "A" + "B" + "C"
    Math.random()
  `)
})

test('optimize consecutive "let json" and following "json +="', (t) => {
  t.plan(1)

  const unoptimized = `
    let json = "A"
    json += "B"
  `

  const optimized = optimize(unoptimized)

  t.equal(optimized, `
    let json = "A" + "B"
  `)
})

test('optimize consecutive "let json" and following "return json"', (t) => {
  t.plan(1)

  const unoptimized = `
    let json = "A"
    return json
  `

  const optimized = optimize(unoptimized)

  t.equal(optimized, `
    return "A"
  `)
})

test('optimize return \'\' + ...', (t) => {
  t.plan(1)

  const unoptimized = `
    let json = ''
    json += 'B'
    return json
  `

  const optimized = optimize(unoptimized)

  t.equal(optimized, `
    return 'B'
  `)
})

test('optimize function x (input) { return asX() } to const x = asX', (t) => {
  t.plan(1)

  const unoptimized = `
    function main (input) {
      return anonymous(input)
    }
  `

  const optimized = optimize(unoptimized)

  t.equal(optimized, `
    const main = anonymous
  `)
})

test('optimize function x (input) { return asX() } to const x = asX', (t) => {
  t.plan(1)

  const unoptimized = `
    function main (input) {
      return anonymous0(input)
    }
  `

  const optimized = optimize(unoptimized)

  t.equal(optimized, `
    const main = anonymous0
  `)
})

test('optimize all cases at once', (t) => {
  t.plan(1)

  const unoptimized = `
    let json = ''
    json += "B"
    return json
  `

  const optimized = optimize(unoptimized)

  t.equal(optimized, `
    return "B"
  `)
})
