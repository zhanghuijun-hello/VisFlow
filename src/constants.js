/**
 * @fileoverview visflow Constants is essentially a single constant or a set of
 * constants used for filtering.
 */

'use strict';

/**
 * @param {string} text
 * @constructor
 */
visflow.Constants = function(text) {
  this.isSet = false;  // a single item is considered non-set
  this.type = 'constants'; // to be differentiated from data

  this.constantType = 'empty'; // empty, int, float, string

  // un-initialized state
  this.numElements = 0;
  this.elements = [];
  this.hasElement = {}; // collection that makes unique

  // change status
  this.changed = true;

  if (text != null) {
    if (typeof text !== 'string') {
      visflow.error('non-string input');
      return;
    }

    var eles = text.split(/[,;]+/);
    for (var i in eles) {
      this.add(eles[i]);
    }
  }
};

/**
 * Checks if another package is compatible with the constants.
 * @param {!visflow.Package} pack
 * @return {boolean}
 */
visflow.Constants.prototype.compatible = function(pack) {
  if (this.constantType == 'empty' || pack.constantType == 'empty') {
    return true;
  }
  if (this.constantType == 'string' ^ pack.constantType == 'string') {
    return false;
  }
  return true;
};

/**
 * Stringifies the constants.
 * @return {string}
 */
visflow.Constants.prototype.stringify = function() {
  var result = '';
  for (var i in this.elements) {
    result += this.elements[i];
    result += i == this.elements.length - 1 ? '' : ', ';
  }
  return result;
};

/**
 * Parses input string.
 * @param {string} text
 * @return {{type: string, value: string}}
 */
visflow.Constants.prototype.parse = function(text) {
  var res;
  res = text.match(/^-?[0-9]+/);
  if (res && res[0] === text) {
    return {
      type: 'int',
      value: parseInt(text)
    };
  }
  res = text.match(/^-?([0-9]*\.[0-9]+|[0-9]+\.[0-9]*)/);
  if (res && res[0] === text) {
    return {
      type: 'float',
      value: parseFloat(text)
    };
  }
  if (text === '') {  // empty constants are ignored
    return {
      type: 'empty',
      value: null
    };
  }
  return {
    type: 'string',
    value: text
  };
};

/** @private @enum {number} */
visflow.Constants.prototype.TYPE_GRADES_ = {
  empty: -1,
  int: 0,
  float: 1,
  string: 2
};

/** @private @const {!Array<string>} */
visflow.Constants.prototype.GRADE_TYPES_ = ['int', 'float', 'string'];

/**
 * Adds one element to the set.
 * @param {number|string} value
 */
visflow.Constants.prototype.add = function(value) {
  var grade = this.TYPE_GRADES_[this.constantType];
  var e = this.parse(value);

  if (e.type === 'empty')
    return; //  ignore empty element
  value = e.value;

  if (this.hasElement[value])
    return; // element already exists

  this.hasElement[value] = true;
  this.numElements++;
  this.elements.push(value);
  this.isSet = this.numElements > 1;

  var newgrade = Math.max(grade, this.TYPE_GRADES_[e.type]);
  this.constantType = this.GRADE_TYPES_[newgrade];

  // force conversion to higher types
  // i.e. int -> float -> string
  if (newgrade > grade) {
    for (var i in this.elements) {
      var e = this.elements[i];
      if (grade === 1) {
        e = parseFloat(e);
      } else if (grade === 2) {
        e = e.toString();
      }
      this.elements[i] = e;
    }
  }
};

/**
 * Removes all elements and returns to un-initialized state.
 */
visflow.Constants.prototype.clear = function() {
  this.numElements = 0;
  this.elements = [];
  this.isSet = false;
  this.constantType = 'empty';
};

/**
 * Gets the first element in the set.
 * @return {number|string}
 */
visflow.Constants.prototype.getOne = function() {
  if (this.numElements === 0) {
    return null;
  }
  return this.elements[0];
};

/**
 * Gets all elements of the set.
 * @return {Array<number|string>}
 */
visflow.Constants.prototype.getAll = function() {
  if (this.numElements === 0) {
    return null;
  }
  return this.elements;
};

/**
 * Counts the number of values in the constants set.
 */
visflow.Constants.prototype.count = function() {
  return this.elements.length;
};

