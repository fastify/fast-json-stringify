'use strict'

// eslint-disable-next-line
const STR_ESCAPE = /[\u0000-\u001f\u0022\u005c\ud800-\udfff]/

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
    if (i === null) {
      return '0'
    } else if (typeof i === 'bigint') {
      return i.toString()
    } else {
      /* eslint no-undef: "off" */
      i = this.parseInteger(i)
      // check if number is Infinity or NaN
      // eslint-disable-next-line no-self-compare
      if (i === Infinity || i === -Infinity || i !== i) {
        throw new Error('The value cannot be converted to an integer.')
      }
      return '' + i
    }
  }

  asNumber (i) {
    // fast cast to number
    i = +i
    // check if number is NaN
    // eslint-disable-next-line no-self-compare
    if (i !== i) {
      throw new Error('The value cannot be converted to a number.')
    } else if (i === Infinity || i === -Infinity) {
      return 'null'
    } else {
      return '' + i
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
      return '"' + date + '"'
    }
    throw new Error(`The value "${date}" cannot be converted to a date-time.`)
  }

  asDate (date) {
    if (date === null) return '""'
    if (date instanceof Date) {
      return '"' + new Date(date.getTime() - (date.getTimezoneOffset() * 60000)).toISOString().slice(0, 10) + '"'
    }
    if (typeof date === 'string') {
      return '"' + date + '"'
    }
    throw new Error(`The value "${date}" cannot be converted to a date.`)
  }

  asTime (date) {
    if (date === null) return '""'
    if (date instanceof Date) {
      return '"' + new Date(date.getTime() - (date.getTimezoneOffset() * 60000)).toISOString().slice(11, 19) + '"'
    }
    if (typeof date === 'string') {
      return '"' + date + '"'
    }
    throw new Error(`The value "${date}" cannot be converted to a time.`)
  }

  asString (str) {
    const len = str.length
    if (len < 42) {
      // magically escape strings for json
      // relying on their charCodeAt
      // everything below 32 needs JSON.stringify()
      // every string that contain surrogate needs JSON.stringify()
      // 34 and 92 happens all the time, so we
      // have a fast case for them
      let result = ''
      let last = -1
      let point = 255
      // eslint-disable-next-line
      for (var i = 0; i < len; i++) {
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
