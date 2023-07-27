'use strict'

// eslint-disable-next-line
const STR_ESCAPE = /[\u0000-\u001f\u0022\u005c\ud800-\udfff]|[\ud800-\udbff](?![\udc00-\udfff])|(?:[^\ud800-\udbff]|^)[\udc00-\udfff]/

class Serializer {
  constructor (options) {
    this._options = options
  }

  asNumber (i) {
    const num = Number(i)
    if (Number.isNaN(num)) {
      throw new Error(`The value "${i}" cannot be converted to a number.`)
    } else if (!Number.isFinite(num)) {
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
    if (typeof str !== 'string') {
      if (str === null) {
        return '""'
      }
      if (str instanceof Date) {
        return '"' + str.toISOString() + '"'
      }
      if (str instanceof RegExp) {
        str = str.source
      } else {
        str = str.toString()
      }
    }

    // Fast escape chars check
    if (str.length < 42) {
      return Serializer.asStringSmall(str)
    } else if (STR_ESCAPE.test(str) === false) {
      return '"' + str + '"'
    } else  {
      return JSON.stringify(str)
    }
  }

  // magically escape strings for json
  // relying on their charCodeAt
  // everything below 32 needs JSON.stringify()
  // every string that contain surrogate needs JSON.stringify()
  // 34 and 92 happens all the time, so we
  // have a fast case for them
  static asStringSmall (str) {
    const len = str.length
    let result = ''
    let last = -1
    let point = 255

    // eslint-disable-next-line
    for (var i = 0; i < len; i++) {
      point = str.charCodeAt(i)
      if (point < 32) {
        return JSON.stringify(str)
      }
      if (point >= 0xD800 && point <= 0xDFFF) {
        // The current character is a surrogate.
        return JSON.stringify(str)
      }
      if (
        point === 0x22 || // '"'
        point === 0x5c // '\'
      ) {
        last === -1 && (last = 0)
        result += str.slice(last, i) + '\\'
        last = i
      }
    }

    return (last === -1 && ('"' + str + '"')) || ('"' + result + str.slice(last) + '"')
  }

  getState () {
    return this._options
  }

}

class SerializerFloor extends Serializer {
  asInteger (i) {
    if (typeof i === 'number') {
      if (i === Infinity || i === -Infinity) {
        throw new Error(`The value "${i}" cannot be converted to an integer.`)
      }
      if (Number.isInteger(i)) {
        return '' + i
      }
      if (Number.isNaN(i)) {
        throw new Error(`The value "${i}" cannot be converted to an integer.`)
      }
      return '' + Math.floor(i)
    } else if (i === null) {
      return '0'
    } else if (typeof i === 'bigint') {
      return i.toString()
    } else {
      /* eslint no-undef: "off" */
      const integer = Math.floor(i)
      if (Number.isFinite(integer)) {
        return '' + integer
      } else {
        throw new Error(`The value "${i}" cannot be converted to an integer.`)
      }
    }
  }
}

class SerializerCeil extends Serializer {
  asInteger (i) {
    if (typeof i === 'number') {
      if (i === Infinity || i === -Infinity) {
        throw new Error(`The value "${i}" cannot be converted to an integer.`)
      }
      if (Number.isInteger(i)) {
        return '' + i
      }
      if (Number.isNaN(i)) {
        throw new Error(`The value "${i}" cannot be converted to an integer.`)
      }
      return '' + Math.ceil(i)
    } else if (i === null) {
      return '0'
    } else if (typeof i === 'bigint') {
      return i.toString()
    } else {
      /* eslint no-undef: "off" */
      const integer = Math.ceil(i)
      if (Number.isFinite(integer)) {
        return '' + integer
      } else {
        throw new Error(`The value "${i}" cannot be converted to an integer.`)
      }
    }
  }
}

class SerializerTrunc extends Serializer {
  asInteger (i) {
    if (typeof i === 'number') {
      if (i === Infinity || i === -Infinity) {
        throw new Error(`The value "${i}" cannot be converted to an integer.`)
      }
      if (Number.isInteger(i)) {
        return '' + i
      }
      if (Number.isNaN(i)) {
        throw new Error(`The value "${i}" cannot be converted to an integer.`)
      }
      return '' + Math.trunc(i)
    } else if (i === null) {
      return '0'
    } else if (typeof i === 'bigint') {
      return i.toString()
    } else {
      /* eslint no-undef: "off" */
      const integer = Math.trunc(i)
      if (Number.isFinite(integer)) {
        return '' + integer
      } else {
        throw new Error(`The value "${i}" cannot be converted to an integer.`)
      }
    }
  }
}

class SerializerRound extends Serializer {
  asInteger (i) {
    if (typeof i === 'number') {
      if (i === Infinity || i === -Infinity) {
        throw new Error(`The value "${i}" cannot be converted to an integer.`)
      }
      if (Number.isInteger(i)) {
        return '' + i
      }
      if (Number.isNaN(i)) {
        throw new Error(`The value "${i}" cannot be converted to an integer.`)
      }
      return '' + Math.round(i)
    } else if (i === null) {
      return '0'
    } else if (typeof i === 'bigint') {
      return i.toString()
    } else {
      /* eslint no-undef: "off" */
      const integer = Math.round(i)
      if (Number.isFinite(integer)) {
        return '' + integer
      } else {
        throw new Error(`The value "${i}" cannot be converted to an integer.`)
      }
    }
  }
}

function SerializerFactory (options) {
  switch (options && options.rounding) {
    case 'floor':
      return new SerializerFloor(options)
    case 'ceil':
      return new SerializerCeil(options)
    case 'round':
      return new SerializerRound(options)
    case 'trunc':
    default:
      return new SerializerTrunc(options)
  }
}

module.exports = SerializerFactory
module.exports.Serializer = Serializer
module.exports.restoreFromState = function restoreFromState (state) {
  return SerializerFactory(state)
}