/**
 * @fileoverview VisFlow checkbox unit.
 */

'use strict';

/**
 * @param params
 * @constructor
 */
visflow.Checkbox = function(params) {
  visflow.Checkbox.base.constructor.call(this, params);
  this.prepare();
};

/** @inheritDoc */
visflow.Checkbox.prototype.prepare = function() {
  visflow.Checkbox.base.prepare.call(this);

  var unit = this;

  var input = this.jqinput = $('<input type="checkbox" value=""/>')
    .addClass('dataflow-input dataflow-unit-checkbox')
    .appendTo(this.jqunit);

  $(this.jqlabel)
    .css('margin-right', 5)
    .appendTo(this.jqcontainer);
  this.jqcontainer
    .css('display', 'inline-block');

  input.change(function(event) {
    var value = $(this).is(':checked');
    unit.setValue(value, event);
  });

  if (this.value != null)
    this.setValue(this.value, null, true);
};

/** @inheritDoc */
visflow.Checkbox.prototype.setValue = function(value, event, noCallback) {
  if (event == null) {
    event = {};
  }

  this.jqinput.prop('checked', value);
  this.value = value;

  if (!noCallback) {
    event.unitChange = {
      value: value,
      id: this.id
    };
    this.changeCallback(event);
  }
};
