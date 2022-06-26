'use strict'

// based on https://github.com/TehShrike/deepmerge

function isMergeableObject (value) {
  return typeof value === 'object' && value !== null && !(value instanceof RegExp) && !(value instanceof Date)
}

function mergeObject (target, source) {
  const result = {}
  if (isMergeableObject(target)) {
    const keys = Object.keys(target)
    let i, il
    for (i = 0, il = keys.length; i < il; ++i) {
      const key = keys[i]
      result[key] = isMergeableObject(target[key]) ? merge(Array.isArray(target[key]) ? [] : {}, target[key]) : target[key]
    }
  } else if (typeof target !== 'object' || target === null) {
    return isMergeableObject(source) ? merge(Array.isArray(source) ? [] : {}, source) : source
  }

  const keys = Object.keys(source)
  let i, il
  for (i = 0, il = keys.length; i < il; ++i) {
    const key = keys[i]

    if (key in target) {
      if (!(Object.hasOwnProperty.call(target, key)) && !(Object.propertyIsEnumerable.call(target, key))) {
        continue
      } else if (isMergeableObject(source[key])) {
        result[key] = merge(target[key], source[key])
        continue
      }
    }
    result[key] = isMergeableObject(source[key]) ? merge(Array.isArray(source[key]) ? [] : {}, source[key]) : source[key]
  }
  return result
}

function map (entry) {
  return isMergeableObject(entry) ? merge(Array.isArray(entry) ? [] : {}, entry) : entry
}

function merge (target, source) {
  const sourceIsArray = Array.isArray(source)
  const targetIsArray = Array.isArray(target)

  if (sourceIsArray !== targetIsArray) {
    return isMergeableObject(source) ? merge(Array.isArray(source) ? [] : {}, source) : source
  } else if (sourceIsArray) {
    const tl = target.length
    const sl = source.length
    let i = 0
    const result = new Array(tl + sl)
    for (i = 0; i < tl; ++i) {
      result[i] = map(target[i])
    }
    for (i = 0; i < sl; ++i) {
      result[i + tl] = map(source[i])
    }
    return result
  } else {
    return mergeObject(target, source)
  }
}

module.exports = merge
