/**
 * @fileoverview Custom underscore externs.
 */

/**
 * @param {!Object<T, *>} obj
 * @return {!Array<T>}
 * @template T
 */
_.allKeys = function(obj) {};

/**
 * @param {!Array<T>|!Object<T>} array
 * @return {!Object<T, boolean>}
 * @template T
 */
_.keySet = function(array) {};


/**
 * @param {string} attr
 * @return {function(!d3, *): *}
 */
_.getValue = function(attr) {};


/**
 * @param {!d3} arg
 */
_.fadeOut = function(arg) {};

/**
 * @param {Function} arg1
 * @param {Function} arg2
 */
_.inherit = function(arg1, arg2) {};

/**
 * @return {!d3}
 */
_.d3 = function() {};
