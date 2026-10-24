'use strict'

// eslint-disable-next-line
const STR_ESCAPE = /[\u0000-\u001f\u0022\u005c\ud800-\udfff]/

function asString (str) {
  const len = str.length
  if (len === 0) {
    return '""'
  } else if (len < 42) {
    // magically escape strings for json
    // relying on their charCodeAt
    // everything below 32 needs JSON.stringify()
    // every string that contain surrogate needs JSON.stringify()
    // 34 and 92 happens all the time, so we
    // have a fast case for them
    let result = ''
    let last = -1
    let point = 255
    for (let i = 0; i < len; i++) {
      point = str.charCodeAt(i)
      if (
        point === 0x22 || // '"'
        point === 0x5c // '\'
      ) {
        last === -1 && (last = 0)
        result += str.slice(last, i) + '\\'
        last = i
      } else if (point < 32 || (point >= 0xD800 && point <= 0xDFFF)) {
        // The current character is non-printable characters or a surrogate.
        return JSON.stringify(str)
      }
    }
    return (last === -1 && ('"' + str + '"')) || ('"' + result + str.slice(last) + '"')
  } else if (len < 5000 && STR_ESCAPE.test(str) === false) {
    // Only use the regular expression for shorter input. The overhead is otherwise too much.
    return '"' + str + '"'
  } else {
    return JSON.stringify(str)
  }
}

module.exports = class Serializer {
  constructor (options) {
    switch (options && options.rounding) {
      case 'floor':
        this.parseInteger = Math.floor
        break
      case 'ceil':
        this.parseInteger = Math.ceil
        break
      case 'round':
        this.parseInteger = Math.round
        break
      case 'trunc':
      default:
        this.parseInteger = Math.trunc
        break
    }
    this._options = options
  }

  asInteger (i) {
    if (Number.isInteger(i)) {
      return '' + i
    } else if (typeof i === 'bigint') {
      return i.toString()
    }
    /* eslint no-undef: "off" */
    const integer = this.parseInteger(i)
    // check if number is Infinity or NaN
    // eslint-disable-next-line no-self-compare
    if (integer === Infinity || integer === -Infinity || integer !== integer) {
      throw new Error(`The value "${i}" cannot be converted to an integer.`)
    }
    return '' + integer
  }

  asNumber (i) {
    // fast cast to number
    const num = Number(i)
    // check if number is NaN
    // eslint-disable-next-line no-self-compare
    if (num !== num) {
      throw new Error(`The value "${i}" cannot be converted to a number.`)
    } else if (num === Infinity || num === -Infinity) {
      return 'null'
    } else {
      return '' + num
    }
  }

  asBoolean (bool) {
    return bool && 'true' || 'false' // eslint-disable-line
  }

  asDateTime (date) {
    if (date === null) return '""'
    if (date instanceof Date) {
      return '"' + date.toISOString() + '"'
    }
    if (typeof date === 'string') {
      return asString(date)
    }
    throw new Error(`The value "${date}" cannot be converted to a date-time.`)
  }

  asDate (date) {
    if (date === null) return '""'
    if (date instanceof Date) {
      return '"' + new Date(date.getTime() - (date.getTimezoneOffset() * 60000)).toISOString().slice(0, 10) + '"'
    }
    if (typeof date === 'string') {
      return asString(date)
    }
    throw new Error(`The value "${date}" cannot be converted to a date.`)
  }

  asTime (date) {
    if (date === null) return '""'
    if (date instanceof Date) {
      return '"' + new Date(date.getTime() - (date.getTimezoneOffset() * 60000)).toISOString().slice(11, 19) + '"'
    }
    if (typeof date === 'string') {
      return asString(date)
    }
    throw new Error(`The value "${date}" cannot be converted to a time.`)
  }

  asString (str) {
    return asString(str)
  }

  asUnsafeString (str) {
    return '"' + str + '"'
  }

  // Copy primitive strings once, ignoring array/prototype toJSON hooks. On a
  // miss, serialize the captured prefix and coerce the remaining items in order,
  // matching buildSingleTypeSerializer without rereading getters.
  asPlainStringArray (arr, len = arr.length) {
    const copy = new Array(len)
    // V8's side-effect-free JSON.stringify fast path (V8 >= 13.8) requires the
    // standard Array.prototype; a null prototype halves its throughput. Only
    // detach the prototype when a toJSON hook would otherwise be called.
    if (Array.prototype.toJSON !== undefined) Object.setPrototypeOf(copy, null)
    for (let i = 0; i < len; i++) {
      const value = arr[i]
      if (typeof value !== 'string') {
        copy.length = i
        let json = JSON.stringify(copy).slice(0, -1)
        for (let j = i; j < len; j++) {
          const item = j === i ? value : arr[j]
          if (j > 0) json += ','
          if (typeof item === 'string') {
            json += asString(item)
          } else if (item === null) {
            json += '""'
          } else if (item instanceof Date) {
            json += '"' + item.toISOString() + '"'
          } else if (item instanceof RegExp) {
            json += asString(item.source)
          } else {
            json += asString(item.toString())
          }
        }
        return json + ']'
      }
      copy[i] = value
    }
    return JSON.stringify(copy)
  }

  getState () {
    return this._options
  }

  static restoreFromState (state) {
    return new Serializer(state)
  }
}
