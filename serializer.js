'use strict'

module.exports = class Serializer {
  constructor (options = {}) {
    switch (options.rounding) {
      case 'floor':
        this.parseInteger = Math.floor
        break
      case 'ceil':
        this.parseInteger = Math.ceil
        break
      case 'round':
        this.parseInteger = Math.round
        break
      default:
        this.parseInteger = Math.trunc
        break
    }
  }

  asAny (i) {
    return JSON.stringify(i)
  }

  asNull () {
    return 'null'
  }

  asInteger (i) {
    if (typeof i === 'bigint') {
      return i.toString()
    } else if (Number.isInteger(i)) {
      return '' + i
    } else {
      /* eslint no-undef: "off" */
      const integer = this.parseInteger(i)
      if (Number.isNaN(integer) || !Number.isFinite(integer)) {
        throw new Error(`The value "${i}" cannot be converted to an integer.`)
      } else {
        return '' + integer
      }
    }
  }

  asIntegerNullable (i) {
    return i === null ? 'null' : this.asInteger(i)
  }

  asNumber (i) {
    const num = Number(i)
    if (Number.isNaN(num)) {
      throw new Error(`The value "${i}" cannot be converted to a number.`)
    } else if (!Number.isFinite(num)) {
      return null
    } else {
      return '' + num
    }
  }

  asNumberNullable (i) {
    return i === null ? 'null' : this.asNumber(i)
  }

  asBoolean (bool) {
    return bool && 'true' || 'false' // eslint-disable-line
  }

  asBooleanNullable (bool) {
    return bool === null ? 'null' : this.asBoolean(bool)
  }

  asDateTime (date) {
    if (date === null) return '""'
    if (date instanceof Date) {
      return '"' + date.toISOString() + '"'
    }
    throw new Error(`The value "${date}" cannot be converted to a date-time.`)
  }

  asDateTimeNullable (date) {
    return date === null ? 'null' : this.asDateTime(date)
  }

  asDate (date) {
    if (date === null) return '""'
    if (date instanceof Date) {
      return '"' + new Date(date.getTime() - (date.getTimezoneOffset() * 60000)).toISOString().slice(0, 10) + '"'
    }
    throw new Error(`The value "${date}" cannot be converted to a date.`)
  }

  asDateNullable (date) {
    return date === null ? 'null' : this.asDate(date)
  }

  asTime (date) {
    if (date === null) return '""'
    if (date instanceof Date) {
      return '"' + new Date(date.getTime() - (date.getTimezoneOffset() * 60000)).toISOString().slice(11, 19) + '"'
    }
    throw new Error(`The value "${date}" cannot be converted to a time.`)
  }

  asTimeNullable (date) {
    return date === null ? 'null' : this.asTime(date)
  }

  asString (str) {
    const quotes = '"'
    if (str instanceof Date) {
      return quotes + str.toISOString() + quotes
    } else if (str === null) {
      return quotes + quotes
    } else if (str instanceof RegExp) {
      str = str.source
    } else if (typeof str !== 'string') {
      str = str.toString()
    }

    if (str.length < 42) {
      return this.asStringSmall(str)
    } else {
      return JSON.stringify(str)
    }
  }

  asStringNullable (str) {
    return str === null ? 'null' : this.asString(str)
  }

  // magically escape strings for json
  // relying on their charCodeAt
  // everything below 32 needs JSON.stringify()
  // every string that contain surrogate needs JSON.stringify()
  // 34 and 92 happens all the time, so we
  // have a fast case for them
  asStringSmall (str) {
    const l = str.length
    let result = ''
    let last = 0
    let found = false
    let surrogateFound = false
    let point = 255
    // eslint-disable-next-line
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
}
