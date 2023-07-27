'use strict'

const returnFnRE = /^\s+return ([.a-zA-Z0-9]+)\(\w+\)$/
const fnRE = /^\s*function\s+/
const fnNameRE = /^\s+function ([a-zA-Z0-9_]+) \(input\) {$/
const jsonConcatRE = /^\s*json\s*\+=/
const letJsonRE = /^\s*let json =/
const returnJsonRE = /^\s*return json\s*$/
const returnEmptyStringRE = /^\s*return '' \+/
const closingCurlyBracketRE = /^\s*}\s*$/
/**
 * @param {Array<string>} code
 * @returns {Array<string>}
 */
function optimize (raw) {
  let code = raw.split('\n')
  code = optimizeJsonConcat(code)
  code = optimizeLetJson(code)
  code = optimizeDirectReturn(code)
  code = optimizeReturnEmptyString(code)
  code = optimizeDirectAssignWrappedFns(code)
  return code.join('\n')
}

function optimizeJsonConcat (code) {
  const optimizedJsonConcat = []

  for (let i = 0; i < code.length; i++) {
    if (i > 0 && jsonConcatRE.test(code[i]) && jsonConcatRE.test(code[i - 1])) {
      const lastEntry = optimizedJsonConcat.pop()
      const mergedEntry = lastEntry + ' +' + code[i].substring(code[i].indexOf('json +=') + 7)
      optimizedJsonConcat.push(mergedEntry)
    } else {
      optimizedJsonConcat.push(code[i])
    }
  }

  return optimizedJsonConcat
}

function optimizeLetJson (code) {
  const optimizedLetJsonCode = []
  for (let i = 0; i < code.length; i++) {
    if (i > 0 && jsonConcatRE.test(code[i]) && letJsonRE.test(code[i - 1])) {
      const mergedEntry = code[i - 1] + ' +' + code[i].substring(code[i].indexOf('json +=') + 7)
      optimizedLetJsonCode.pop() // Remove the previous entry
      optimizedLetJsonCode.push(mergedEntry)
    } else {
      optimizedLetJsonCode.push(code[i])
    }
  }
  return optimizedLetJsonCode
}

function optimizeDirectReturn (code) {
  const optimizedDirectReturnCode = []
  for (let i = 0; i < code.length; i++) {
    if (i > 0 && returnJsonRE.test(code[i]) && letJsonRE.test(code[i - 1])) {
      const mergedEntry = code[i].slice(0, code[i].indexOf('return') + 6) + code[i - 1].substring(code[i - 1].indexOf('let json =') + 10)
      optimizedDirectReturnCode.pop() // Remove the previous entry
      optimizedDirectReturnCode.push(mergedEntry)
    } else {
      optimizedDirectReturnCode.push(code[i])
    }
  }
  return optimizedDirectReturnCode
}

function optimizeReturnEmptyString (code) {
  for (let i = 0; i < code.length; i++) {
    if (returnEmptyStringRE.test(code[i])) {
      code[i] = code[i].replace('return \'\' +', 'return')
    }
  }
  return code
}

function optimizeDirectAssignWrappedFns (code) {
  const optimizedDirectAssignFns = []
  for (let i = 0; i < code.length; i++) {
    if (
      fnRE.test(code[i]) &&
      returnFnRE.test(code[i + 1]) &&
      closingCurlyBracketRE.test(code[i + 2])
    ) {
      const serializerFnName = code[i + 1].match(returnFnRE)[1]
      const fnName = code[i].match(fnNameRE)[1]
      const whitespace = code[i].slice(0, code[i].indexOf('f'))
      optimizedDirectAssignFns[i] = `${whitespace}const ${fnName} = ${serializerFnName}`
      i += 2
    } else {
      optimizedDirectAssignFns.push(code[i])
    }
  }

  return optimizedDirectAssignFns
}
module.exports = optimize
