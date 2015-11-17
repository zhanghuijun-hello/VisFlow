/**
 * @fileoverview VisFlow value maker module.
 */

'use strict';

/**
 * @param params
 * @constructor
 */
visflow.ValueMaker = function(params) {
  visflow.ValueMaker.base.constructor.call(this, params);

  this.viewHeight = 40; // height + padding

  this.inPorts = [];
  this.outPorts = [
    new visflow.Port(this, 'out', 'out-multiple', 'V', true)
  ];

  // stored input value
  this.valueString = '';
  this.value = new visflow.Constants(this.valueString);
  // overwrite with constants
  this.outPorts[0].pack = this.value;

  this.prepare();
};

visflow.utils.inherit(visflow.ValueMaker, visflow.Node);

/** @inheritDoc */
visflow.ValueMaker.prototype.ICON_CLASS =
    'dataflow-value-maker-icon dataflow-flat-icon';
/** @inheritDoc */
visflow.ValueMaker.prototype.SHAPE_NAME = 'superflat';

/** @inheritDoc */
visflow.ValueMaker.prototype.contextmenuDisabled = {
  options: true
};

/** @inheritDoc */
visflow.ValueMaker.prototype.serialize = function() {
  var result = visflow.ValueMaker.base.serialize.call(this);
  result.valueString = this.valueString;
  return result;
};

/** @inheritDoc */
visflow.ValueMaker.prototype.deserialize = function(save) {
  visflow.ValueMaker.base.deserialize.call(this, save);
  this.setValueString(save.valueString);
};

/** @inheritDoc */
visflow.ValueMaker.prototype.showDetails = function() {
  visflow.ValueMaker.base.showDetails.call(this); // call parent settings

  $('<div><input id="v" style="width:80%"/></div>')
    .prependTo(this.jqview);

  this.jqinput = this.jqview.find('input')
    .addClass('dataflow-input dataflow-input-node');

  var node = this;
  this.jqinput
    .change(function(event) {
      node.setValueString(event.target.value);
    });
};

/**
 * Sets the value string.
 */
visflow.ValueMaker.prototype.setValueString = function(str) {
  if (str == this.valueString) {
    return;
  }

  this.valueString = str;
  this.value = DataflowConstants.new(str);
  this.jqinput.val(str);

  $.extend(this.ports['out'].pack, this.value);

  visflow.flowManager.propagate(this);
};

