'use strict'

/* eslint no-prototype-builtins: 0 */

var Ajv = require('ajv')
var merge = require('deepmerge')

var util = require('util')
var validate = require('./schema-validator')
var stringSimilarity = null

var uglify = null
var isLong
try {
  isLong = require('long').isLong
} catch (e) {
  isLong = null
}

var addComma = `
  if (addComma) {
    json += ','
  }
  addComma = true
`

function isValidSchema (schema, name) {
  if (!validate(schema)) {
    if (name) {
      name = `"${name}" `
    } else {
      name = ''
    }
    const first = validate.errors[0]
    const err = new Error(`${name}schema is invalid: data${first.dataPath} ${first.message}`)
    err.errors = isValidSchema.errors
    throw err
  }
}

function build (schema, options) {
  options = options || {}
  isValidSchema(schema)
  if (options.schema) {
    for (const key of Object.keys(options.schema)) {
      isValidSchema(options.schema[key], key)
    }
  }

  /* eslint no-new-func: "off" */
  var code = `
    'use strict'
  `

  code += `
    ${$pad2Zeros.toString()}
    ${$asString.toString()}
    ${$asStringNullable.toString()}
    ${$asStringSmall.toString()}
    ${$asDatetime.toString()}
    ${$asDate.toString()}
    ${$asTime.toString()}
    ${$asNumber.toString()}
    ${$asNumberNullable.toString()}
    ${$asIntegerNullable.toString()}
    ${$asNull.toString()}
    ${$asBoolean.toString()}
    ${$asBooleanNullable.toString()}
  `

  // only handle longs if the module is used
  if (isLong) {
    code += `
      var isLong = ${isLong.toString()}
      ${$asInteger.toString()}
    `
  } else {
    code += `
      var $asInteger = $asNumber
    `
  }

  const fullSchema = schema
  if (schema.$ref) {
    schema = refFinder(schema.$ref, schema, options.schema)
  }

  if (schema.type === undefined) {
    schema.type = inferTypeByKeyword(schema)
  }

  var hasSchemaSomeIf = hasIf(schema)

  var main

  switch (schema.type) {
    case 'object':
      main = '$main'
      code = buildObject(schema, code, main, options.schema, fullSchema)
      break
    case 'string':
      main = schema.nullable ? $asStringNullable.name : getStringSerializer(schema.format)
      break
    case 'integer':
      main = schema.nullable ? $asIntegerNullable.name : $asInteger.name
      break
    case 'number':
      main = schema.nullable ? $asNumberNullable.name : $asNumber.name
      break
    case 'boolean':
      main = schema.nullable ? $asBooleanNullable.name : $asBoolean.name
      break
    case 'null':
      main = $asNull.name
      break
    case 'array':
      main = '$main'
      code = buildArray(schema, code, main, options.schema, schema)
      break
    default:
      throw new Error(`${schema.type} unsupported`)
  }

  code += `
    ;
     return ${main}
  `

  if (options.uglify) {
    code = uglifyCode(code)
  }

  var dependencies = []
  var dependenciesName = []
  if (hasOf(schema) || hasSchemaSomeIf) {
    dependencies.push(new Ajv(options.ajv))
    dependenciesName.push('ajv')
  }

  dependenciesName.push(code)

  if (options.debugMode) {
    dependenciesName.toString = function () {
      return dependenciesName.join('\n')
    }
    return dependenciesName
  }

  return (Function.apply(null, dependenciesName).apply(null, dependencies))
}

const objectKeywords = [
  'maxProperties',
  'minProperties',
  'required',
  'properties',
  'patternProperties',
  'additionalProperties',
  'dependencies'
]

const arrayKeywords = [
  'items',
  'additionalItems',
  'maxItems',
  'minItems',
  'uniqueItems',
  'contains'
]

const stringKeywords = [
  'maxLength',
  'minLength',
  'pattern'
]

const numberKeywords = [
  'multipleOf',
  'maximum',
  'exclusiveMaximum',
  'minimum',
  'exclusiveMinimum'
]

/**
 * Infer type based on keyword in order to generate optimized code
 * https://json-schema.org/latest/json-schema-validation.html#rfc.section.6
 */
function inferTypeByKeyword (schema) {
  for (const keyword of objectKeywords) {
    if (keyword in schema) return 'object'
  }
  for (const keyword of arrayKeywords) {
    if (keyword in schema) return 'array'
  }
  for (const keyword of stringKeywords) {
    if (keyword in schema) return 'string'
  }
  for (const keyword of numberKeywords) {
    if (keyword in schema) return 'number'
  }
  return schema.type
}

function hasOf (schema) {
  if (!schema) { return false }
  if ('anyOf' in schema || 'oneOf' in schema) { return true }

  var objectKeys = Object.keys(schema)
  for (var i = 0; i < objectKeys.length; i++) {
    var value = schema[objectKeys[i]]
    if (typeof value === 'object') {
      if (hasOf(value)) { return true }
    }
  }

  return false
}

function hasIf (schema) {
  const str = JSON.stringify(schema)
  return /"if":{/.test(str) && /"then":{/.test(str)
}

const stringSerializerMap = {
  'date-time': '$asDatetime',
  date: '$asDate',
  time: '$asTime'
}

function getStringSerializer (format) {
  return stringSerializerMap[format] || '$asString'
}

function $pad2Zeros (num) {
  var s = '00' + num
  return s[s.length - 2] + s[s.length - 1]
}

function $asNull () {
  return 'null'
}

function $asInteger (i) {
  if (isLong && isLong(i)) {
    return i.toString()
  } else if (typeof i === 'bigint') {
    return i.toString()
  } else {
    return $asNumber(i)
  }
}

function $asIntegerNullable (i) {
  return i === null ? null : $asInteger(i)
}

function $asNumber (i) {
  var num = Number(i)
  if (isNaN(num)) {
    return 'null'
  } else {
    return '' + num
  }
}

function $asNumberNullable (i) {
  return i === null ? null : $asNumber(i)
}

function $asBoolean (bool) {
  return bool && 'true' || 'false' // eslint-disable-line
}

function $asBooleanNullable (bool) {
  return bool === null ? null : $asBoolean(bool)
}

function $asDatetime (date) {
  if (date instanceof Date) {
    return '"' + date.toISOString() + '"'
  } else if (date && typeof date.toISOString === 'function') {
    return '"' + date.toISOString() + '"'
  } else {
    return $asString(date)
  }
}

function $asDate (date) {
  if (date instanceof Date) {
    var year = new Intl.DateTimeFormat('en', { year: 'numeric' }).format(date)
    var month = new Intl.DateTimeFormat('en', { month: '2-digit' }).format(date)
    var day = new Intl.DateTimeFormat('en', { day: '2-digit' }).format(date)
    return '"' + year + '-' + month + '-' + day + '"'
  } else if (date && typeof date.format === 'function') {
    return '"' + date.format('YYYY-MM-DD') + '"'
  } else {
    return $asString(date)
  }
}

function $asTime (date) {
  if (date instanceof Date) {
    var hour = new Intl.DateTimeFormat('en', { hour: 'numeric', hour12: false }).format(date)
    var minute = new Intl.DateTimeFormat('en', { minute: 'numeric' }).format(date)
    var second = new Intl.DateTimeFormat('en', { second: 'numeric' }).format(date)
    return '"' + $pad2Zeros(hour) + ':' + $pad2Zeros(minute) + ':' + $pad2Zeros(second) + '"'
  } else if (date && typeof date.format === 'function') {
    return '"' + date.format('HH:mm:ss') + '"'
  } else {
    return $asString(date)
  }
}

function $asString (str) {
  if (str instanceof Date) {
    return '"' + str.toISOString() + '"'
  } else if (str === null) {
    return '""'
  } else if (str instanceof RegExp) {
    str = str.source
  } else if (typeof str !== 'string') {
    str = str.toString()
  }

  if (str.length < 42) {
    return $asStringSmall(str)
  } else {
    return JSON.stringify(str)
  }
}

function $asStringNullable (str) {
  return str === null ? null : $asString(str)
}

// magically escape strings for json
// relying on their charCodeAt
// everything below 32 needs JSON.stringify()
// every string that contain surrogate needs JSON.stringify()
// 34 and 92 happens all the time, so we
// have a fast case for them
function $asStringSmall (str) {
  var result = ''
  var last = 0
  var found = false
  var surrogateFound = false
  var l = str.length
  var point = 255
  for (var i = 0; i < l && point >= 32; i++) {
    point = str.charCodeAt(i)
    if (point >= 0xD800 && point <= 0xDFFF) {
      // The current character is a surrogate.
      surrogateFound = true
    }
    if (point === 34 || point === 92) {
      result += str.slice(last, i) + '\\'
      last = i
      found = true
    }
  }

  if (!found) {
    result = str
  } else {
    result += str.slice(last)
  }
  return ((point < 32) || (surrogateFound === true)) ? JSON.stringify(str) : '"' + result + '"'
}

function addPatternProperties (schema, externalSchema, fullSchema) {
  var pp = schema.patternProperties
  var code = `
      var properties = ${JSON.stringify(schema.properties)} || {}
      var keys = Object.keys(obj)
      for (var i = 0; i < keys.length; i++) {
        if (properties[keys[i]]) continue
  `
  Object.keys(pp).forEach((regex, index) => {
    if (pp[regex].$ref) {
      pp[regex] = refFinder(pp[regex].$ref, fullSchema, externalSchema)
    }
    var type = pp[regex].type
    var format = pp[regex].format
    var stringSerializer = getStringSerializer(format)
    try {
      RegExp(regex)
    } catch (err) {
      throw new Error(`${err.message}. Found at ${regex} matching ${JSON.stringify(pp[regex])}`)
    }
    code += `
        if (/${regex.replace(/\\*\//g, '\\/')}/.test(keys[i])) {
    `
    if (type === 'object') {
      code += buildObject(pp[regex], '', 'buildObjectPP' + index, externalSchema, fullSchema)
      code += `
          ${addComma}
          json += $asString(keys[i]) + ':' + buildObjectPP${index}(obj[keys[i]])
      `
    } else if (type === 'array') {
      code += buildArray(pp[regex], '', 'buildArrayPP' + index, externalSchema, fullSchema)
      code += `
          ${addComma}
          json += $asString(keys[i]) + ':' + buildArrayPP${index}(obj[keys[i]])
      `
    } else if (type === 'null') {
      code += `
          ${addComma}
          json += $asString(keys[i]) +':null'
      `
    } else if (type === 'string') {
      code += `
          ${addComma}
          json += $asString(keys[i]) + ':' + ${stringSerializer}(obj[keys[i]])
      `
    } else if (type === 'integer') {
      code += `
          ${addComma}
          json += $asString(keys[i]) + ':' + $asInteger(obj[keys[i]])
      `
    } else if (type === 'number') {
      code += `
          ${addComma}
          json += $asString(keys[i]) + ':' + $asNumber(obj[keys[i]])
      `
    } else if (type === 'boolean') {
      code += `
          ${addComma}
          json += $asString(keys[i]) + ':' + $asBoolean(obj[keys[i]])
      `
    } else {
      code += `
        throw new Error('Cannot coerce ' + obj[keys[i]] + ' to ' + ${JSON.stringify(type)})
      `
    }

    code += `
          continue
        }
    `
  })
  if (schema.additionalProperties) {
    code += additionalProperty(schema, externalSchema, fullSchema)
  }

  code += `
      }
  `
  return code
}

function additionalProperty (schema, externalSchema, fullSchema) {
  var ap = schema.additionalProperties
  var code = ''
  if (ap === true) {
    return `
        if (obj[keys[i]] !== undefined) {
          ${addComma}
          json += $asString(keys[i]) + ':' + JSON.stringify(obj[keys[i]])
        }
    `
  }
  if (ap.$ref) {
    ap = refFinder(ap.$ref, fullSchema, externalSchema)
  }

  var type = ap.type
  var format = ap.format
  var stringSerializer = getStringSerializer(format)
  if (type === 'object') {
    code += buildObject(ap, '', 'buildObjectAP', externalSchema)
    code += `
        ${addComma}
        json += $asString(keys[i]) + ':' + buildObjectAP(obj[keys[i]])
    `
  } else if (type === 'array') {
    code += buildArray(ap, '', 'buildArrayAP', externalSchema, fullSchema)
    code += `
        ${addComma}
        json += $asString(keys[i]) + ':' + buildArrayAP(obj[keys[i]])
    `
  } else if (type === 'null') {
    code += `
        ${addComma}
        json += $asString(keys[i]) +':null'
    `
  } else if (type === 'string') {
    code += `
        ${addComma}
        json += $asString(keys[i]) + ':' + ${stringSerializer}(obj[keys[i]])
    `
  } else if (type === 'integer') {
    code += `
        var t = Number(obj[keys[i]])
    `
    if (isLong) {
      code += `
          if (isLong(obj[keys[i]]) || !isNaN(t)) {
            ${addComma}
            json += $asString(keys[i]) + ':' + $asInteger(obj[keys[i]])
          }
      `
    } else {
      code += `
          if (!isNaN(t)) {
            ${addComma}
            json += $asString(keys[i]) + ':' + t
          }
      `
    }
  } else if (type === 'number') {
    code += `
        var t = Number(obj[keys[i]])
        if (!isNaN(t)) {
          ${addComma}
          json += $asString(keys[i]) + ':' + t
        }
    `
  } else if (type === 'boolean') {
    code += `
        ${addComma}
        json += $asString(keys[i]) + ':' + $asBoolean(obj[keys[i]])
    `
  } else {
    code += `
        throw new Error('Cannot coerce ' + obj[keys[i]] + ' to ' + ${JSON.stringify(type)})
    `
  }
  return code
}

function addAdditionalProperties (schema, externalSchema, fullSchema) {
  return `
      var properties = ${JSON.stringify(schema.properties)} || {}
      var keys = Object.keys(obj)
      for (var i = 0; i < keys.length; i++) {
        if (properties[keys[i]]) continue
        ${additionalProperty(schema, externalSchema, fullSchema)}
      }
  `
}

function idFinder (schema, searchedId) {
  let objSchema
  const explore = (schema, searchedId) => {
    Object.keys(schema || {}).forEach((key, i, a) => {
      if (key === '$id' && schema[key] === searchedId) {
        objSchema = schema
      } else if (objSchema === undefined && typeof schema[key] === 'object') {
        explore(schema[key], searchedId)
      }
    })
  }
  explore(schema, searchedId)
  return objSchema
}

function refFinder (ref, schema, externalSchema) {
  if (externalSchema && externalSchema[ref]) return externalSchema[ref]

  // Split file from walk
  ref = ref.split('#')

  // If external file
  if (ref[0]) {
    schema = externalSchema[ref[0]]

    if (schema === undefined) {
      findBadKey(externalSchema, [ref[0]])
    }

    if (schema.$ref) {
      return refFinder(schema.$ref, schema, externalSchema)
    }
  }

  var code = 'return schema'
  // If it has a path
  if (ref[1]) {
    // ref[1] could contain a JSON pointer - ex: /definitions/num
    // or plain name fragment id without suffix # - ex: customId
    var walk = ref[1].split('/')
    if (walk.length === 1) {
      var targetId = `#${ref[1]}`
      var dereferenced = idFinder(schema, targetId)
      if (dereferenced === undefined && !ref[0]) {
        for (var key of Object.keys(externalSchema)) {
          dereferenced = idFinder(externalSchema[key], targetId)
          if (dereferenced !== undefined) break
        }
      }
      return dereferenced
    } else {
      for (var i = 1; i < walk.length; i++) {
        code += `[${JSON.stringify(walk[i])}]`
      }
    }
  }
  var result
  try {
    result = (new Function('schema', code))(schema)
  } catch (err) {}

  if (result === undefined) {
    findBadKey(schema, walk.slice(1))
  }
  return result.$ref ? refFinder(result.$ref, schema, externalSchema) : result

  function findBadKey (obj, keys) {
    if (keys.length === 0) return null
    const key = keys.shift()
    if (obj[key] === undefined) {
      stringSimilarity = stringSimilarity || require('string-similarity')
      const { bestMatch } = stringSimilarity.findBestMatch(key, Object.keys(obj))
      if (bestMatch.rating >= 0.5) {
        throw new Error(`Cannot find reference ${JSON.stringify(key)}, did you mean ${JSON.stringify(bestMatch.target)}?`)
      } else {
        throw new Error(`Cannot find reference ${JSON.stringify(key)}`)
      }
    }
    return findBadKey(obj[key], keys)
  }
}

function buildCode (schema, code, laterCode, name, externalSchema, fullSchema) {
  if (schema.$ref) {
    schema = refFinder(schema.$ref, fullSchema, externalSchema)
  }

  var required = schema.required

  Object.keys(schema.properties || {}).forEach((key, i, a) => {
    if (schema.properties[key].$ref) {
      // if the schema object is deep in the tree, we must resolve the ref in the parent scope
      const isRelative = schema.definitions && schema.properties[key].$ref[0] === '#'
      schema.properties[key] = refFinder(schema.properties[key].$ref, isRelative ? schema : fullSchema, externalSchema)
    }

    // Using obj['key'] !== undefined instead of obj.hasOwnProperty(prop) for perf reasons,
    // see https://github.com/mcollina/fast-json-stringify/pull/3 for discussion.

    var type = schema.properties[key].type
    var nullable = schema.properties[key].nullable
    var sanitized = JSON.stringify(key)
    var asString = JSON.stringify(sanitized)

    if (nullable) {
      code += `
        if (obj[${sanitized}] === null) {
          ${addComma}
          json += ${asString} + ':null'
          var rendered = true
        } else {
      `
    }

    if (type === 'number') {
      code += `
          var t = Number(obj[${sanitized}])
          if (!isNaN(t)) {
            ${addComma}
            json += ${asString} + ':' + t
      `
    } else if (type === 'integer') {
      code += `
          var rendered = false
      `
      if (isLong) {
        code += `
            if (isLong(obj[${sanitized}])) {
              ${addComma}
              json += ${asString} + ':' + obj[${sanitized}].toString()
              rendered = true
            } else {
              var t = Number(obj[${sanitized}])
              if (!isNaN(t)) {
                ${addComma}
                json += ${asString} + ':' + t
                rendered = true
              }
            }
        `
      } else {
        code += `
            var t = Number(obj[${sanitized}])
            if (!isNaN(t)) {
              ${addComma}
              json += ${asString} + ':' + t
              rendered = true
            }
        `
      }
      code += `
          if (rendered) {
      `
    } else {
      code += `
        if (obj[${sanitized}] !== undefined) {
          ${addComma}
          json += ${asString} + ':'
        `

      var result = nested(laterCode, name, key, schema.properties[key], externalSchema, fullSchema, undefined, false)
      code += result.code
      laterCode = result.laterCode
    }

    var defaultValue = schema.properties[key].default
    if (defaultValue !== undefined) {
      required = filterRequired(schema.required, key)
      code += `
      } else {
        ${addComma}
        json += ${asString} + ':' + ${JSON.stringify(JSON.stringify(defaultValue))}
      `
    } else if (schema.required && schema.required.indexOf(key) !== -1) {
      required = filterRequired(schema.required, key)
      code += `
      } else {
        throw new Error('${sanitized} is required!')
      `
    }

    code += `
      }
    `

    if (nullable) {
      code += `
        }
      `
    }
  })

  if (required && required.length > 0) {
    code += 'var required = ['
    for (var i = 0; i < required.length; i++) {
      if (i > 0) {
        code += ','
      }
      code += `${JSON.stringify(required[i])}`
    }
    code += ']'
    code += `
      for (var i = 0; i < required.length; i++) {
        if (obj[required[i]] === undefined) throw new Error('"' + required[i] + '" is required!')
      }
    `
  }

  return { code: code, laterCode: laterCode }
}

function filterRequired (required, key) {
  if (!required) {
    return required
  }
  return required.filter(k => k !== key)
}

function buildCodeWithAllOfs (schema, code, laterCode, name, externalSchema, fullSchema) {
  if (schema.allOf) {
    schema.allOf.forEach((ss) => {
      var builtCode = buildCodeWithAllOfs(ss, code, laterCode, name, externalSchema, fullSchema)

      code = builtCode.code
      laterCode = builtCode.laterCode
    })
  } else {
    var builtCode = buildCode(schema, code, laterCode, name, externalSchema, fullSchema)

    code = builtCode.code
    laterCode = builtCode.laterCode
  }

  return { code: code, laterCode: laterCode }
}

function buildInnerObject (schema, name, externalSchema, fullSchema) {
  var result = buildCodeWithAllOfs(schema, '', '', name, externalSchema, fullSchema)
  if (schema.patternProperties) {
    result.code += addPatternProperties(schema, externalSchema, fullSchema)
  } else if (schema.additionalProperties && !schema.patternProperties) {
    result.code += addAdditionalProperties(schema, externalSchema, fullSchema)
  }
  return result
}

function addIfThenElse (schema, name, externalSchema, fullSchema) {
  var code = ''
  var r
  var laterCode = ''
  var innerR

  const copy = merge({}, schema)
  const i = copy.if
  const then = copy.then
  const e = copy.else ? copy.else : { additionalProperties: true }
  delete copy.if
  delete copy.then
  delete copy.else
  var merged = merge(copy, then)

  code += `
    valid = ajv.validate(${util.inspect(i, { depth: null })}, obj)
    if (valid) {
  `
  if (merged.if && merged.then) {
    innerR = addIfThenElse(merged, name + 'Then', externalSchema, fullSchema)
    code += innerR.code
    laterCode = innerR.laterCode
  }

  r = buildInnerObject(merged, name + 'Then', externalSchema, fullSchema)
  code += r.code
  laterCode += r.laterCode

  code += `
    }
  `
  merged = merge(copy, e)

  code += `
      else {
    `

  if (merged.if && merged.then) {
    innerR = addIfThenElse(merged, name + 'Else', externalSchema, fullSchema)
    code += innerR.code
    laterCode += innerR.laterCode
  }

  r = buildInnerObject(merged, name + 'Else', externalSchema, fullSchema)
  code += r.code
  laterCode += r.laterCode

  code += `
      }
    `
  return { code: code, laterCode: laterCode }
}

function toJSON (variableName) {
  return `typeof ${variableName}.toJSON === 'function'
    ? ${variableName}.toJSON()
    : ${variableName}
  `
}

function buildObject (schema, code, name, externalSchema, fullSchema) {
  code += `
    function ${name} (input) {
  `
  if (schema.nullable) {
    code += `
      if(input === null) {
        return '${$asNull()}';
      }
  `
  }
  code += `
      var obj = ${toJSON('input')}
      var json = '{'
      var addComma = false
  `

  var laterCode = ''
  var r
  if (schema.if && schema.then) {
    code += `
      var valid
    `
    r = addIfThenElse(schema, name, externalSchema, fullSchema)
  } else {
    r = buildInnerObject(schema, name, externalSchema, fullSchema)
  }

  code += r.code
  laterCode = r.laterCode

  // Removes the comma if is the last element of the string (in case there are not properties)
  code += `
      json += '}'
      return json
    }
  `

  code += laterCode
  return code
}

function buildArray (schema, code, name, externalSchema, fullSchema) {
  code += `
    function ${name} (obj) {
  `
  if (schema.nullable) {
    code += `
      if(obj === null) {
        return '${$asNull()}';
      }
    `
  }
  code += `
      var json = '['
  `
  var laterCode = ''

  if (schema.items.$ref) {
    schema.items = refFinder(schema.items.$ref, fullSchema, externalSchema)
  }

  var result = { code: '', laterCode: '' }
  if (Array.isArray(schema.items)) {
    result = schema.items.reduce((res, item, i) => {
      var accessor = '[i]'
      const tmpRes = nested(laterCode, name, accessor, item, externalSchema, fullSchema, i, true)
      var condition = `i === ${i} && ${buildArrayTypeCondition(item.type, accessor)}`
      return {
        code: `${res.code}
        ${i > 0 ? 'else' : ''} if (${condition}) {
          ${tmpRes.code}
        }`,
        laterCode: `${res.laterCode}
        ${tmpRes.laterCode}`
      }
    }, result)
    result.code += `
    else {
      throw new Error(\`Item at $\{i} does not match schema definition.\`)
    }
    `
  } else {
    result = nested(laterCode, name, '[i]', schema.items, externalSchema, fullSchema, undefined, true)
  }

  code += `
    var l = obj.length
    var w = l - 1
    for (var i = 0; i < l; i++) {
      if (i > 0) {
        json += ','
      }
      ${result.code}
    }
  `

  laterCode = result.laterCode

  code += `
      json += ']'
      return json
    }
  `

  code += laterCode

  return code
}

function buildArrayTypeCondition (type, accessor) {
  var condition
  switch (type) {
    case 'null':
      condition = `obj${accessor} === null`
      break
    case 'string':
      condition = `typeof obj${accessor} === 'string'`
      break
    case 'integer':
      condition = `Number.isInteger(obj${accessor})`
      break
    case 'number':
      condition = `Number.isFinite(obj${accessor})`
      break
    case 'boolean':
      condition = `typeof obj${accessor} === 'boolean'`
      break
    case 'object':
      condition = `obj${accessor} && typeof obj${accessor} === 'object' && obj${accessor}.constructor === Object`
      break
    case 'array':
      condition = `Array.isArray(obj${accessor})`
      break
    default:
      if (Array.isArray(type)) {
        var conditions = type.map((subType) => {
          return buildArrayTypeCondition(subType, accessor)
        })
        condition = `(${conditions.join(' || ')})`
      } else {
        throw new Error(`${type} unsupported`)
      }
  }
  return condition
}

function dereferenceOfRefs (schema, externalSchema, fullSchema, type) {
  schema[type].forEach((s, index) => {
    // follow the refs
    while (s.$ref) {
      schema[type][index] = refFinder(s.$ref, fullSchema, externalSchema)
      s = schema[type][index]
    }
  })
}

var strNameCounter = 0
function asFuncName (str) {
  // only allow chars that can work
  var rep = str.replace(/[^a-zA-Z0-9$_]/g, '')

  if (rep.length === 0) {
    return 'anan' + strNameCounter++
  } else if (rep !== str) {
    rep += strNameCounter++
  }

  return rep
}

function nested (laterCode, name, key, schema, externalSchema, fullSchema, subKey, isArray) {
  var code = ''
  var funcName

  subKey = subKey || ''

  if (schema.$ref) {
    schema = refFinder(schema.$ref, fullSchema, externalSchema)
  }

  if (schema.type === undefined) {
    var inferedType = inferTypeByKeyword(schema)
    if (inferedType) {
      schema.type = inferedType
    }
  }

  var type = schema.type
  var nullable = schema.nullable === true

  var accessor = isArray ? key : `[${JSON.stringify(key)}]`

  switch (type) {
    case 'null':
      code += `
        json += $asNull()
      `
      break
    case 'string':
      var stringSerializer = getStringSerializer(schema.format)
      code += nullable ? `json += obj${accessor} === null ? null : ${stringSerializer}(obj${accessor})` : `json += ${stringSerializer}(obj${accessor})`
      break
    case 'integer':
      code += nullable ? `json += obj${accessor} === null ? null : $asInteger(obj${accessor})` : `json += $asInteger(obj${accessor})`
      break
    case 'number':
      code += nullable ? `json += obj${accessor} === null ? null : $asNumber(obj${accessor})` : `json += $asNumber(obj${accessor})`
      break
    case 'boolean':
      code += nullable ? `json += obj${accessor} === null ? null : $asBoolean(obj${accessor})` : `json += $asBoolean(obj${accessor})`
      break
    case 'object':
      funcName = asFuncName(name + key + subKey)
      laterCode = buildObject(schema, laterCode, funcName, externalSchema, fullSchema)
      code += `
        json += ${funcName}(obj${accessor})
      `
      break
    case 'array':
      funcName = asFuncName('$arr' + name + key + subKey) // eslint-disable-line
      laterCode = buildArray(schema, laterCode, funcName, externalSchema, fullSchema)
      code += `
        json += ${funcName}(obj${accessor})
      `
      break
    case undefined:
      if ('anyOf' in schema) {
        dereferenceOfRefs(schema, externalSchema, fullSchema, 'anyOf')
        schema.anyOf.forEach((s, index) => {
          var nestedResult = nested(laterCode, name, key, s, externalSchema, fullSchema, subKey !== '' ? subKey : 'i' + index, isArray)
          code += `
            ${index === 0 ? 'if' : 'else if'}(ajv.validate(${require('util').inspect(s, { depth: null })}, obj${accessor}))
              ${nestedResult.code}
          `
          laterCode = nestedResult.laterCode
        })
        code += `
          else json+= null
        `
      } else if ('oneOf' in schema) {
        dereferenceOfRefs(schema, externalSchema, fullSchema, 'oneOf')
        schema.oneOf.forEach((s, index) => {
          var nestedResult = nested(laterCode, name, key, s, externalSchema, fullSchema, subKey !== '' ? subKey : 'i' + index, isArray)
          code += `
            ${index === 0 ? 'if' : 'else if'}(ajv.validate(${require('util').inspect(s, { depth: null })}, obj${accessor}))
              ${nestedResult.code}
          `
          laterCode = nestedResult.laterCode
        })
        code += `
          else json+= null
        `
      } else if (isEmpty(schema)) {
        code += `
          json += JSON.stringify(obj${accessor})
        `
      } else {
        throw new Error(`${schema.type} unsupported`)
      }
      break
    default:
      if (Array.isArray(type)) {
        const nullIndex = type.indexOf('null')
        const sortedTypes = nullIndex !== -1 ? [type[nullIndex]].concat(type.slice(0, nullIndex)).concat(type.slice(nullIndex + 1)) : type
        sortedTypes.forEach((type, index) => {
          var tempSchema = Object.assign({}, schema, { type })
          var nestedResult = nested(laterCode, name, key, tempSchema, externalSchema, fullSchema, subKey, isArray)

          if (type === 'string') {
            code += `
              ${index === 0 ? 'if' : 'else if'}(obj${accessor} === null || typeof obj${accessor} === "${type}" || obj${accessor} instanceof Date || typeof obj${accessor}.toISOString === "function" || obj${accessor} instanceof RegExp)
                ${nestedResult.code}
            `
          } else if (type === 'null') {
            code += `
              ${index === 0 ? 'if' : 'else if'}(obj${accessor} == null)
              ${nestedResult.code}
            `
          } else if (type === 'array') {
            code += `
              ${index === 0 ? 'if' : 'else if'}(Array.isArray(obj${accessor}))
              ${nestedResult.code}
            `
          } else if (type === 'integer') {
            code += `
              ${index === 0 ? 'if' : 'else if'}(Number.isInteger(obj${accessor}) || obj${accessor} === null)
              ${nestedResult.code}
            `
          } else if (type === 'number') {
            code += `
              ${index === 0 ? 'if' : 'else if'}(isNaN(obj${accessor}) === false)
              ${nestedResult.code}
            `
          } else {
            code += `
              ${index === 0 ? 'if' : 'else if'}(typeof obj${accessor} === "${type}")
              ${nestedResult.code}
            `
          }
          laterCode = nestedResult.laterCode
        })
        code += `
          else json+= null
        `
      } else {
        throw new Error(`${type} unsupported`)
      }
  }

  return {
    code,
    laterCode
  }
}

function uglifyCode (code) {
  if (!uglify) {
    loadUglify()
  }

  var uglified = uglify.minify(code, { parse: { bare_returns: true } })

  if (uglified.error) {
    throw uglified.error
  }

  return uglified.code
}

function loadUglify () {
  try {
    uglify = require('uglify-es')
    var uglifyVersion = require('uglify-es/package.json').version

    if (uglifyVersion[0] !== '3') {
      throw new Error('Only version 3 of uglify-es is supported')
    }
  } catch (e) {
    uglify = null
    if (e.code === 'MODULE_NOT_FOUND') {
      throw new Error('In order to use uglify, you have to manually install `uglify-es`')
    }

    throw e
  }
}

function isEmpty (schema) {
  for (var key in schema) {
    if (schema.hasOwnProperty(key)) return false
  }
  return true
}

module.exports = build

module.exports.restore = function (debugModeStr, options = {}) {
  const dependencies = [debugModeStr]
  const args = []
  if (debugModeStr.startsWith('ajv')) {
    dependencies.unshift('ajv')
    args.push(new Ajv(options.ajv))
  }

  // eslint-disable-next-line
  return (Function.apply(null, ['ajv', debugModeStr])
    .apply(null, args))
}
