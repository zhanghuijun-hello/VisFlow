
"use strict";

var extObject = {

  initialize: function(para) {
    DataflowIntersect.base.initialize.call(this, para);

    this.inPorts = [
      DataflowPort.new(this, "ina", "in-single"),
      DataflowPort.new(this, "inb", "in-single")
    ];
    this.outPorts = [
      DataflowPort.new(this, "out", "out-multiple")
    ];
    this.prepare();
  },

  show: function() {

    DataflowIntersect.base.show.call(this); // call parent settings

    this.jqicon = $("<div></div>")
      .addClass("dataflow-intersect-icon")
      .appendTo(this.jqview);
  },

  process: function() {
    var packa = this.ports["ina"].pack,
        packb = this.ports["inb"].pack;

    if (!packa.data.matchDataFormat(packb.data))
      return console.error("cannot make intersection of two different types of datasets");

    // for every item in A, check if it is in B
    var result = {};
    for (var index in packa.items) {
      var itema = packa.items[index];
      var itemb = packb.items[index];
      if (itemb != null) {
        var e = {
          properties: {}
        };
        // merge rendering property in to a new one
        _(e).extend(itema.properties, itemb.properties);
        result[index] = e;
      }
    }
    var outpack = this.ports["out"].pack;
    outpack.copy(packa);  // either A or B will work
    // not using filter because the properties are new
    outpack.items = result;
  }

};

var DataflowIntersect = DataflowSet.extend(extObject);
