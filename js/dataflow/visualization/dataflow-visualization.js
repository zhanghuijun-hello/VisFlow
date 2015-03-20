
"use strict";

var extObject = {

  nodeShapeName: "vis",

  contextmenuDisabled: {},

  initialize: function(para) {
    DataflowVisualization.base.initialize.call(this, para);

    // visualization nodes have same ports
    this.inPorts = [
      DataflowPort.new(this, "in", "in-single", "D")
    ];
    this.outPorts = [
      DataflowPort.new(this, "outs", "out-multiple", "S"),
      DataflowPort.new(this, "out", "out-multiple", "D")
    ];

    this.optionsOn = false;
    this.visWidth = null;
    this.visHeight = null;

    // selection applies to all visualization
    this.selected = {};

    this.isEmpty = true;

    this.lastDataId = 0;  // default: empty data
  },

  serialize: function() {
    var result = DataflowVisualization.base.serialize.call(this);

    // view sizes
    result.viewWidth = this.viewWidth;
    result.viewHeight = this.viewHeight;
    result.visWidth = this.visWidth;
    result.visHeight = this.visHeight;

    // selection
    result.selected = this.selected;

    // last data
    result.lastDataId = this.lastDataId;

    return result;
  },

  deserialize: function(save) {
    DataflowVisualization.base.deserialize.call(this, save);
    this.visWidth = save.visWidth;
    this.visHeight = save.visHeight;
    this.viewWidth = save.viewWidth;
    this.viewHeight = save.viewHeight;

    this.selected = save.selected;
    if (this.selected instanceof Array || this.selected == null) {
      console.error("incorrect selection saved: array/null");
      this.selected = {};
    }

    this.lastDataId = save.lastDataId;
    if (this.lastDataId == null) {
      console.error("lastDataId not saved in visualization");
      this.lastDataId = 0;
    }
  },

  prepareContextmenu: function() {
    var node = this;
    // right-click menu

    this.jqview.contextmenu({
      delegate: this.jqview,
      addClass: "ui-contextmenu",
      menu: [
          {title: "Toggle Visualization", cmd: "details", uiIcon: "ui-icon-image"},
          {title: "Toggle Options", cmd: "options", uiIcon: "ui-icon-note"},
          {title: "Select All", cmd: "selall"},
          {title: "Clear Selection", cmd: "selclear"},
          {title: "Delete", cmd: "delete", uiIcon: "ui-icon-close"}
        ],
      select: function(event, ui) {
        if (ui.cmd == "details") {
          node.detailsOn = !node.detailsOn;
          node.show();
          node.prepareContextmenu();
        } else if (ui.cmd == "options") {
          node.optionsOn = !node.optionsOn;
          node.options();
        } else if (ui.cmd == "selall") {
          node.selectAll();
        } else if (ui.cmd == "selclear") {
          node.clearSelection();
        } else if (ui.cmd == "delete") {
          core.dataflowManager.deleteNode(node);
        }
      },
      beforeOpen: function(event, ui) {
        if (core.interactionManager.contextmenuLock)
          return false;
        core.interactionManager.contextmenuLock = true;
      },
      close: function(event, ui) {
        core.interactionManager.contextmenuLock = false;
      }
    });
  },

  checkDataEmpty: function() {
    this.clearMessage();
    if (this.ports["in"].pack.isEmpty()) {
      // otherwise scales may be undefined
      this.showMessage("empty data in " + this.plotName);
      this.isEmpty = true;

      if (this.svg) {
        this.svg.remove();
        this.interactionOn = false;
      }
      return;
    }
    this.isEmpty = false;
  },

  prepareSvg: function(keepOld) {
    if (this.svg) {
      if (keepOld == true) {
        return;
      }
      this.svg.remove();
      this.interactionOn = false;
    }
    this.svg = d3.selectAll(this.jqvis.toArray()).append("svg");
    this.jqsvg = $(this.svg[0]);

    this.svgSize = [this.jqsvg.width(), this.jqsvg.height()];
  },

  show: function() {
    DataflowVisualization.base.show.call(this);

    var node = this;

    if (this.detailsOn) {
      this.jqvis = $("<div></div>")
      .addClass("dataflow-visualization")
      .appendTo(this.jqview);

      this.jqview
        .css("width", this.visWidth)
        .css("height", this.visHeight)
        .resizable("enable");
      this.viewWidth = this.jqview.width();
      this.viewHeight = this.jqview.height();

      // show selection shall be in show visualization
      // so does interaction()
      this.showVisualization();
    } else {
      if (this.jqvis)
        this.jqvis.remove();
      this.jqview
        .css("width", "")
        .css("height", "")
        .resizable("disable");

      this.viewWidth = this.jqview.width();
      this.viewHeight = this.jqview.height();
      this.showIcon();
    }

    // must be called AFTER viewWidth & viewHeight are set
    this.updatePorts();
  },

  process: function() {
    var inpack = this.ports["in"].pack,
        outpack = this.ports["out"].pack,
        outspack = this.ports["outs"].pack;

    outpack.copy(inpack, true); // always pass through

    // during async data load, selection is first deserialized to vis nodes
    // however the data have not passed in
    // thus the selection might be erronesouly cleared if continue processing
    if (inpack.isEmpty()) {
      outpack.copy(inpack);
      outspack.copy(inpack);
      outspack.items = {};
      return;
    }
    this.validateSelection();

    if (this.lastDataId != inpack.data.dataId) {
      // data has changed, fire change event
      // visualization can update selected dimension in this function
      this.dataChanged();

      this.lastDataId = inpack.data.dataId;
    }

    // inheriting visualization classes may implement this
    // to change routine that sends selection to output S
    this.processSelection();
  },

  processSelection: function() {
    var inpack = this.ports["in"].pack,
        outspack = this.ports["outs"].pack;
    outspack.copy(inpack);
    outspack.filter(_.allKeys(this.selected));
  },

  validateSelection: function() {
    var inpack = this.ports["in"].pack;
    // some selection items no longer exists in the input
    // we shall remove those selection
    for (var index in this.selected) {
      if (inpack.items[index] == null){
        delete this.selected[index];
      }
    }
  },

  selectAll: function() {
    var inpack = this.ports["in"].pack;
    this.selected = {};
    for (var index in inpack.items) {
      this.selected[index] = true;
    }
    this.pushflow();
  },

  clearSelection: function() {
    this.selected = {};
    this.pushflow();
  },

  interaction: function() {
    if (!this.interactionOn) {
      this.prepareInteraction();
      this.interactionOn = true;
    }
  },

  // display a text message at the center of the node
  showMessage: function(msg) {
    this.jqmsg = $("<div></div>")
      .text(msg)
      .addClass("dataflow-visualization-message")
      .css("line-height", this.viewHeight + "px")
      .prependTo(this.jqview);
  },

  clearMessage: function() {
    if (this.jqmsg)
      this.jqmsg.remove();
  },

  keyAction: function(key, event) {
    DataflowVisualization.base.keyAction.call(this, key, event);

    if (key == "ctrl+A")
      this.selectAll();
    else if (key == "ctrl+shift+A")
      this.clearSelection();
  },

  // setting up the callback so that once a vis is interacted with
  // the view is selected
  prepareInteraction: function() {
    if (this.jqsvg == null)
      return console.error("no svg for prepareInteraction");
    var node = this;
    this.jqsvg.mousedown(function(){
      if (!core.interactionManager.shifted)
        core.dataflowManager.clearNodeSelection();
      core.dataflowManager.addNodeSelection(node);
    });
  },

  // need to call parent classes
  resize: function(size) {
    DataflowVisualization.base.resize.call(this, size);
    if (this.detailsOn) {
      this.visWidth = size.width;
      this.visHeight = size.height;
    }
  },

  resizestop: function(size) {
    DataflowVisualization.base.resizestop.call(this, size);
  },

  // abstract: to implement in inheriting class
  showVisualization: function() {},
  showOptions: function() {},
  showSelection: function() {},
  updateVisualization: function() {},
  prepareScales: function() {},
  dataChanged: function() {}

};

var DataflowVisualization = DataflowNode.extend(extObject);
