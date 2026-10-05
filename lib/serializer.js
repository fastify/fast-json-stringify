'use strict'

// eslint-disable-next-line
const STR_ESCAPE = /[\u0000-\u001f\u0022\u005c\ud800-\udfff]/

// '00' ... '99', so date parts never need padding at serialization time
const TWO_DIGITS = new Array(100)
for (let i = 0; i < 100; i++) {
  TWO_DIGITS[i] = (i < 10 ? '0' : '') + i
}

// Zero-pads a year to 4 digits, or returns null when it falls outside the range
// ISO 8601 writes without the expanded '+YYYYYY' notation. Callers fall back to
// toISOString() for those.
function asYear (year) {
  if (year >= 1000) return year <= 9999 ? '' + year : null
  if (year >= 100) return '0' + year
  if (year >= 10) return '00' + year
  if (year >= 0) return '000' + year
  return null
}

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
      const year = asYear(date.getUTCFullYear())
      if (year === null) return '"' + date.toISOString() + '"'
      const ms = date.getUTCMilliseconds()
      return '"' + year +
        '-' + TWO_DIGITS[date.getUTCMonth() + 1] +
        '-' + TWO_DIGITS[date.getUTCDate()] +
        'T' + TWO_DIGITS[date.getUTCHours()] +
        ':' + TWO_DIGITS[date.getUTCMinutes()] +
        ':' + TWO_DIGITS[date.getUTCSeconds()] +
        '.' + (ms < 10 ? '00' : ms < 100 ? '0' : '') + ms + 'Z"'
    }
    if (typeof date === 'string') {
      return asString(date)
    }
    throw new Error(`The value "${date}" cannot be converted to a date-time.`)
  }

  asDate (date) {
    if (date === null) return '""'
    if (date instanceof Date) {
      const year = asYear(date.getFullYear())
      if (year === null) {
        return '"' + new Date(date.getTime() - (date.getTimezoneOffset() * 60000)).toISOString().slice(0, 10) + '"'
      }
      return '"' + year + '-' + TWO_DIGITS[date.getMonth() + 1] + '-' + TWO_DIGITS[date.getDate()] + '"'
    }
    if (typeof date === 'string') {
      return asString(date)
    }
    throw new Error(`The value "${date}" cannot be converted to a date.`)
  }

  asTime (date) {
    if (date === null) return '""'
    if (date instanceof Date) {
      const hours = TWO_DIGITS[date.getHours()]
      // undefined only for an invalid Date; let toISOString() raise as before
      if (hours === undefined) {
        return '"' + new Date(date.getTime() - (date.getTimezoneOffset() * 60000)).toISOString().slice(11, 19) + '"'
      }
      return '"' + hours + ':' + TWO_DIGITS[date.getMinutes()] + ':' + TWO_DIGITS[date.getSeconds()] + '"'
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

  getState () {
    return this._options
  }

  static restoreFromState (state) {
    return new Serializer(state)
  }
}
