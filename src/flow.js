/**
 * @fileoverview FlowManager handles all operations related to flow graph.
 * Currently, we assume only one graph is being edited at any time.
 * So FlowManager equivalently represent the graph itself.
 */

/** @const */
visflow.flow = {};

/**
 * Visualization mode on/off.
 * @type {boolean}
 */
visflow.flow.visMode = false;

/**
 * De-serialization flag. Propagation and panel show are disabled during
 * de-serialization.
 * @type {boolean}
 */
visflow.flow.deserializing = false;

/**
 * Selected diagram nodes.
 * @type {!Object<!visflow.Node>}
 */
visflow.flow.nodesSelected = {};

/**
 * Hovered diagram nodes.
 * @type {!Object<!visflow.Node>}
 */
visflow.flow.nodesHovered = {};

/**
 * Selected diagram edge.
 * @type {visflow.Edge}
 */
visflow.flow.edgeSelected = null;

/**
 * Diagram nodes.
 * @type {!Object<!visflow.Node>}
 */
visflow.flow.nodes = {};

/**
 * Diagram edges.
 * @type {!Object<!visflow.Edge>}
 */
visflow.flow.edges = {};

/**
 * Data sources in the diagram, which appear first in topological order.
 * @type {!Array<!visflow.Node>}
 */
visflow.flow.dataSources = [];

/**
 * Default properties for non-vismode elements when vismode is on.
 * @private @const {!Object}
 */
visflow.flow.VISMODE_ON_CSS_ = {
  opacity: 0
};

/**
 * Default properties for non-vismode elements when vismode is off.
 * @private @const {!Object}
 */
visflow.flow.VISMODE_OFF_CSS_ = {
  opacity: 1
};

/**
 * Initializes flow manager.
 */
visflow.flow.init = function() {
  visflow.flow.resetFlow();

  $(visflow.upload).on('vf.uploaded', visflow.flow.updateDataSources_);
};

/**
 * Resets the loaded flow.
 */
visflow.flow.resetFlow = function() {
  // Clear visMode.
  visflow.flow.visMode = false;
  visflow.signal(visflow.flow, 'visMode');

  // counters start from 1
  visflow.flow.nodeCounter = 0;
  visflow.flow.edgeCounter = 0;

  visflow.flow.dataSources = [];

  visflow.flow.nodes = {};
  visflow.flow.edges = {};

  // the whole data collection
  // each id refers to a data object
  visflow.flow.data = {};

  visflow.flow.nodesSelected = {};
  visflow.flow.nodesHovered = {};
  visflow.flow.lastSelectedNode = null;

  visflow.flow.edgeSelected = null;
};


/**
 * Mapping from node type to node constructor.
 * @const @private {!Object<Function>}
 */
visflow.flow.NODE_CONSTRUCTORS_ = {
  dataSource: visflow.DataSource,
  intersect: visflow.Intersect,
  minus: visflow.Minus,
  union: visflow.Union,
  range: visflow.RangeFilter,
  value: visflow.ValueFilter,
  sampler: visflow.Sampler,
  valueExtractor: visflow.ValueExtractor,
  valueMaker: visflow.ValueMaker,
  propertyEditor: visflow.PropertyEditor,
  propertyMapping: visflow.PropertyMapping,
  table: visflow.Table,
  scatterplot: visflow.Scatterplot,
  parallelCoordinates: visflow.ParallelCoordinates,
  histogram: visflow.Histogram,
  lineChart: visflow.LineChart,
  heatmap: visflow.Heatmap,
  network: visflow.Network
};

/**
 * Mapping from obsolete type names to new ones.
 * @const @private {!Object<string>}
 */
visflow.flow.OBSOLETE_TYPES_ = {
  bandLimiter: 'sampler',
  contain: 'value'
};

/**
 * Creates a node of given type.
 * @param {string} type
 * @param {Object=} save Saved node data for de-serialization.
 * @return {visflow.Node}
 */
visflow.flow.createNode = function(type, save) {
  // Convert to camel case. HTML use dash separated strings.
  type = $.camelCase(type);

  var params = {};

  // Convert old types to new ones.
  if (type in visflow.flow.OBSOLETE_TYPES_) {
    type = visflow.flow.OBSOLETE_TYPES_[type];
  }

  // Gets the node constructor.
  if (!(type in visflow.flow.NODE_CONSTRUCTORS_)) {
    visflow.error('unknown node type', type);
    return null;
  }
  var nodeConstructor = visflow.flow.NODE_CONSTRUCTORS_[type];

  _.extend(params, {
    id: ++visflow.flow.nodeCounter,
    type: type,
    container: visflow.viewManager.createNodeContainer()
  });
  var newNode = new nodeConstructor(params);
  $(newNode).on('vf.ready', function() {
    if (save) {
      // If node is created from diagram loading, then de-serialize.
      this.deserialize(save);
      this.loadCss();
    }
    this.show();
    this.focus();
    if (save) {
      // Node size might be de-serialized from save and a resize event must be
      // explicitly fired in order to re-draw correctly.
      this.resize();
    }
  }.bind(newNode));

  visflow.flow.nodes[newNode.id] = newNode;
  if (type == 'dataSource' || type == 'valueMaker') {
    visflow.flow.dataSources.push(newNode);
  }
  // Select newNode (exclusive) after node creation.
  visflow.flow.clearNodeSelection();
  visflow.flow.addNodeSelection(newNode);
  return newNode;
};

/**
 * Creates an edge in the flow from 'sourcePort' to 'targetPort'.
 * @param {!visflow.Port} sourcePort
 * @param {!visflow.Port} targetPort
 * @return {visflow.Edge}
 */
visflow.flow.createEdge = function(sourcePort, targetPort) {
  var sourceNode = sourcePort.node,
      targetNode = targetPort.node;

  var con = sourcePort.connectable(targetPort);

  if (!con.connectable) {
    visflow.tooltip.create(/** @type {string} */(con.reason));
    return null;
  }

  var newedge = new visflow.Edge({
    id: ++visflow.flow.edgeCounter,
    sourceNode: sourceNode,
    sourcePort: sourcePort,
    targetNode: targetNode,
    targetPort: targetPort,
    container: visflow.viewManager.createEdgeContainer()
  });
  newedge.show();

  sourcePort.connect(newedge);
  targetPort.connect(newedge);

  visflow.flow.edges[newedge.id] = newedge;
  return newedge;
};

/**
 * Deletes the given node.
 * @param {!visflow.Node} node
 */
visflow.flow.deleteNode = function(node) {
  node.removeEdges();
  if (visflow.flow.lastSelectedNode == node) {
    visflow.flow.lastSelectedNode = null;
  }
  // Must first clear then toggle false. Otherwise the panel will not get
  // correct left offset (as its width changes).
  visflow.optionPanel.close();
  node.remove();  // removes the container
  delete visflow.flow.nodes[node.id];
};

/**
 * Deletes the given edge.
 * @param {!visflow.Edge} edge
 */
visflow.flow.deleteEdge = function(edge) {
  // remove the references in port's connection list
  var sourcePort = edge.sourcePort,
      targetPort = edge.targetPort;

  sourcePort.disconnect(edge);
  targetPort.disconnect(edge);

  // Propagation does not include processing the node being propagated.
  // Update is required on the downflow node so that it becomes aware of the
  // upflow changes.
  if (!visflow.flow.deserializing) {
    edge.targetNode.update();
  }
  visflow.flow.propagate(edge.targetNode);

  // Remove the container
  edge.remove();

  delete visflow.flow.edges[edge.id];
};

/**
 * Checks if connecting 'sourceNode' to 'targetNode' will result in a cycle.
 * @param {!visflow.Node} sourceNode
 * @param {!visflow.Node} targetNode
 * @return {boolean}
 */
visflow.flow.cycleTest = function(sourceNode, targetNode) {
  var visited = {};
  visited[sourceNode.id] = true;
  // traverse graph to find cycle
  var traverse = function(node) {
    if (node.id == sourceNode.id)
      return true;
    if (visited[node.id])
      return false;
    visited[node.id] = true;
    for (var i in node.outPorts) {
      var port = node.outPorts[i];
      for (var j in port.connections) {
        if (traverse(port.connections[j].targetNode))
          return true;
      }
    }
    return false;
  };
  return traverse(targetNode);
};

/**
 * Propagates result starting from a given node.
 * @param {!(visflow.Node|Array<!visflow.Node>)} node
 */
visflow.flow.propagate = function(node) {
  if (visflow.flow.deserializing) {
    return;
  }

  var topo = [], // visited node list, in reversed topo order
      visited = {};
  var traverse = function(node) {
    if (visited[node.id]) {
      return;
    }
    visited[node.id] = true;
    for (var i in node.outPorts) {
      var port = node.outPorts[i];
      for (var j in port.connections) {
        traverse(port.connections[j].targetNode);
      }
    }
    topo.push(node);
  };
  if (visflow.Node.prototype.isPrototypeOf(node)) {
    traverse(node);
  } else if (node instanceof Array) {
    for (var i in node) {
      traverse(node[i]);
    }
  }
  // Iterate in reverse order to obtain topo order.
  // Skip the first one, i.e. the node itself.
  for (var i = topo.length - 2; i >= 0; i--) {
    topo[i].update();
  }
  for (var i in topo) {
    for (var j in topo[i].ports) {
      // Clear change flags for all in/out ports.
      topo[i].ports[j].pack.changed = false;
    }
  }
};

/**
 * Serializes the current flow as JSON.
 * This function parses the current flow and returns a standard visflow config
 * object.
 * @return {!Object}
 */
visflow.flow.serializeFlow = function() {
  var result = {
    timestamp: (new Date()).getTime(),
    nodes: [],
    edges: [],
    data: []
  };
  for (var i in visflow.flow.nodes) {
    var node = visflow.flow.nodes[i];
    result.nodes.push(node.serialize());
    if (node.getClass() == 'data-source') {
      node.data.forEach(function(dataInfo) {
        result.data.push(+dataInfo.id);
      });
    }
  }
  result.data = _.unique(result.data);
  for (var i in visflow.flow.edges) {
    result.edges.push(visflow.flow.edges[i].serialize());
  }
  return result;
};

/**
 * Deserializes a flow from a flow JSON.
 * @param {!Object} flow
 */
visflow.flow.deserializeFlow = function(flow) {
  visflow.flow.clearFlow();

  visflow.flow.deserializing = true;  // temporarily switch off propagation

  var hashes = {};

  // Count pending node loads.
  var loadCount = 0;

  flow.nodes.forEach(function(nodeSaved) {
    var type = nodeSaved.type;

    for (var i = 0; i < type.length; i++) {
      if (type[i] == '_') {
        type = type.replace(/_/g, '-');
        visflow.warning('fix old type with underscore');
        break;
      }
    }
    if (type == 'datasrc') {
      type = 'dataSource';
      visflow.warning('fix old type datasrc');
    }
    loadCount++;
    var newNode = visflow.flow.createNode(type, nodeSaved);
    $(newNode).on('vf.ready', function() {
      loadCount--;
      if (loadCount == 0) {
        visflow.flow.deserializeFlowEdges_(flow, hashes);
      }
    });
    hashes[nodeSaved.hashtag] = newNode;
  });

  // Corner case: saved diagram is empty. In this case no edge de-serialization
  // is called and we have to turn deserializing flag off here.
  if (flow.nodes.length == 0) {
    visflow.flow.deserializing = false;
  }
};

/**
 * De-serializes the flow edges.
 * @param {!Object} flow
 * @param {!Object<!visflow.Node>} hashes
 * @private
 */
visflow.flow.deserializeFlowEdges_ = function(flow, hashes) {
  flow.edges.forEach(function(edgeSaved) {
    var sourceNode = hashes[edgeSaved.sourceNodeHash],
      targetNode = hashes[edgeSaved.targetNodeHash];
    var sourcePort = sourceNode.getPort(edgeSaved.sourcePortId),
      targetPort = targetNode.getPort(edgeSaved.targetPortId);

    visflow.assert(sourceNode != null);
    visflow.assert(targetNode != null);

    if (targetPort == null) {
      visflow.error('old version found, port id may have changed');
      targetPort = targetNode.getPort('in');
    }
    visflow.flow.createEdge(sourcePort, targetPort);
  });
  visflow.flow.deserializing = false; // full propagation
  visflow.flow.propagate(visflow.flow.dataSources);
};

/**
 * Previews the VisMode on/off effect.
 * @param {boolean} state
 */
visflow.flow.previewVisMode = function(state) {
  if (state) {
    // Save the css, as animation will move the nodes' positions.
    for (var id in visflow.flow.nodes) {
      var node = visflow.flow.nodes[id];
      node.getContainer().stop(true, true);
      node.saveCss();
    }

    for (var id in visflow.flow.edges) {
      var edge = visflow.flow.edges[id];
      edge.getContainer()
        .stop(true, true)
        .animate(visflow.flow.VISMODE_ON_CSS_);
    }
    for (var id in visflow.flow.nodes) {
      var node = visflow.flow.nodes[id];
      if (node.getOption('visMode')) {
        node.hidePorts();
        node.getContainer()
          .stop(true)
          .animate(node.visCss, function() {
            // Enable visMode so that the view temporarily gets the correct
            // visMode size.
            visflow.flow.visMode = true;
            if (this.getOption('minimized')) {
              this.backMinimized = true;
              this.setMinimized(false);
            }
            this.updateContent();
            visflow.flow.visMode = false;
          }.bind(node));
      } else {
        node.getContainer()
          .stop(true)
          .animate(visflow.flow.VISMODE_ON_CSS_);
      }
    }
  } else {
    for (var id in visflow.flow.edges) {
      var edge = visflow.flow.edges[id];
      edge.getContainer()
        .stop(true)
        .animate(visflow.flow.VISMODE_OFF_CSS_);
    }
    for (var id in visflow.flow.nodes) {
      var node = visflow.flow.nodes[id];
      if (node.getOption('visMode')) {
        var css = node.css;
        if (node.backMinimized) {
          node.backMinimized = false;
          css = _.pick(css, 'left', 'top');
          node.setMinimized(true);
        } else if (node.getOption('minimized')) {
          // Already set minimized by toggleVisMode.
          continue;
        }
        node.showPorts();
        node.getContainer()
          .stop(true)
          .animate(css, function() {
            this.updateContent();
            this.updatePorts();
          }.bind(node));
      } else {
        node.getContainer()
          .stop(true)
          .animate(visflow.flow.VISMODE_OFF_CSS_);
      }
    }
  }
};

/**
 * Toggles the VisMode.
 */
visflow.flow.toggleVisMode = function() {
  if (!visflow.flow.visMode) {
    // Do not save css as they have been saved in preview.
    visflow.flow.visMode = true;
    for (var id in visflow.flow.edges) {
      var edge = visflow.flow.edges[id];
      edge.getContainer()
        .stop(true)
        .animate(visflow.flow.VISMODE_ON_CSS_, edge.hide.bind(edge));
    }
    for (var id in visflow.flow.nodes) {
      var node = visflow.flow.nodes[id];
      if (node.getOption('visMode')) {
        node.getContainer()
          .stop(true)
          .animate(node.visCss, function() {
            if (this.getOption('minimized')) {
              this.backMinimized = true;
              this.setMinimized(false);
            }
            this.updateContent();
          }.bind(node));
      } else {
        node.getContainer()
          .stop(true)
          .animate(visflow.flow.VISMODE_ON_CSS_, node.hide.bind(node));
      }
    }
  } else {
    // First save the current configuration for vismode.
    for (var id in visflow.flow.nodes) {
      var node = visflow.flow.nodes[id];
      node.getContainer().stop(true, true);
      node.saveCss();
    }
    // Then change flag.
    visflow.flow.visMode = false;

    for (var id in visflow.flow.nodes) {
      var node = visflow.flow.nodes[id];
      if (node.getOption('visMode')) {
        var css = node.css;
        if (node.backMinimized) {
          node.backMinimized = false;
          node.setMinimized(true);
          css = _.pick(node.css, 'left', 'top');
        }
        node.getContainer()
          .stop(true)
          .animate(css, function() {
            this.showPorts();
            this.updatePorts();
            this.updateContent();
          }.bind(node));
      } else {
        node.show();
        node.getContainer()
          .stop(true)
          .animate(visflow.flow.VISMODE_OFF_CSS_);
      }
    }
    for (var id in visflow.flow.edges) {
      var edge = visflow.flow.edges[id];
      edge.show();
      edge.getContainer()
        .stop(true)
        .animate(visflow.flow.VISMODE_OFF_CSS_);
    }
  }
  visflow.signal(visflow.flow, 'visMode');
};

/**
 * Clears the current flow.
 */
visflow.flow.clearFlow = function() {
  // clear screen
  visflow.viewManager.clearFlowViews();
  visflow.flow.resetFlow();
  visflow.optionPanel.close();
};

/**
 * Adds an edge to the edge selection.
 * @param {!visflow.Edge} edge
 */
visflow.flow.addEdgeSelection = function(edge) {
  // can only select a single edge at a time by hovering
  visflow.flow.edgeSelected = edge;
};

/**
 * Clears the edge seletion.
 */
visflow.flow.clearEdgeSelection = function() {
  visflow.flow.edgeSelected = null;
};

/**
 * Adds a list of nodes to the node selection.
 * @param {!(Array<!visflow.Node>|Object<!visflow.Node>|visflow.Node)} nodes
 */
visflow.flow.addNodeSelection = function(nodes) {
  var toAdd = {};
  if (nodes instanceof Array) {
    for (var i in nodes) {
      toAdd[nodes[i].id] = nodes[i];
    }
  } else if (visflow.Node.prototype.isPrototypeOf(nodes)) {
    toAdd[nodes.id] = nodes;
  } else {
    toAdd = nodes;
  }
  for (var i in toAdd) {
    var node = toAdd[i];
    visflow.flow.nodesSelected[node.id] = node;
    node.container.addClass('selected');
    visflow.flow.lastSelectedNode = node;
  }
};

/**
 * Clears the selection a set of nodes.
 * @param {(!Array<!visflow.Node>|!visflow.Node)=} nodes
 */
visflow.flow.clearNodeSelection = function(nodes) {
  var toClear = {};
  if (nodes == null) {
    toClear = visflow.flow.nodesSelected;
  } else if (nodes instanceof Array) {
    for (var i in nodes) {
      var node = nodes[i];
      toClear[node.id] = node;
    }
  } else {
    toClear[nodes.id] = nodes;
  }
  for (var i in toClear) {
    var node = toClear[i];
    node.container.removeClass('selected');
    if (node == visflow.flow.lastSelectedNode) {
      visflow.flow.lastSelectedNode = null;
    }
    delete visflow.flow.nodesSelected[node.id];
  }
};

/**
 * Clears the selection because of background click.
 */
visflow.flow.backgroundClearSelection = function() {
  visflow.flow.clearNodeSelection();
  visflow.optionPanel.toggle(false);
};

/**
 * Adds hovering to a set of nodes.
 * @param {!Array<!visflow.Node>|!visflow.Node} nodes
 */
visflow.flow.addNodeHover = function(nodes) {
  var toAdd = {};
  if (nodes instanceof Array) {
    for (var i in nodes) {
      toAdd[nodes[i].id] = nodes[i];
    }
  } else if (visflow.Node.prototype.isPrototypeOf(nodes)) {
    toAdd[nodes.id] = nodes;
  } else {
    toAdd = nodes;
  }
  for (var i in toAdd) {
    var node = toAdd[i];
    node.container.addClass('hover');
    visflow.flow.nodesHovered[node.id] = node;
  }
};

/**
 * Clears the hovering of a set of nodes.
 * @param {(!Array<!visflow.Node>|!visflow.Node)=} nodes
 */
visflow.flow.clearNodeHover = function(nodes) {
  var toClear = {};
  if (nodes == null) {
    toClear = visflow.flow.nodesHovered;
  } else if (nodes instanceof Array) {
    for (var i in nodes) {
      var node = nodes[i];
      toClear[node.id] = node;
    }
  } else {
    toClear[nodes.id] = nodes;
  }
  for (var i in toClear) {
    var node = toClear[i];
    node.container.removeClass('hover');
    delete visflow.flow.nodesHovered[node.id];
  }
};

/**
 * Gets the nodes currently inside the selection box (box has not yet been
 * released).
 * @param {{left: number, top: number, width: number, height: number}} selectbox
 * @return {!Array<!visflow.Node>}
 */
visflow.flow.getNodesInSelectbox = function(selectbox) {
  var result = [];
  for (var i in visflow.flow.nodes) {
    var container = visflow.flow.nodes[i].getContainer();
    var box1 = {
      width: /** @type {number} */(container.width()),
      height: /** @type {number} */(container.height()),
      left: container.position().left,
      top: container.position().top
    };
    if (visflow.viewManager.intersectBox(box1, selectbox)) {
      result.push(visflow.flow.nodes[i]);
    }
  }
  return result;
};

/**
 * Adds the currently hovered nodes to selection.
 */
visflow.flow.addHoveredToSelection = function() {
  visflow.flow.addNodeSelection(visflow.flow.nodesHovered);
  visflow.flow.clearNodeHover();
};

/**
 * Moves a set of nodes by (dx, dy)
 * @param {number} dx
 * @param {number} dy
 * @param {!Object<!visflow.Node>} nodes
 */
visflow.flow.moveNodes = function(dx, dy, nodes) {
  for (var id in nodes) {
    var node = nodes[id];
    if (visflow.flow.visMode && !node.getOption('visMode')) {
      // Prevent moving non-vismode nodes in vismode.
      continue;
    }
    var container = node.getContainer();
    var x = container.position().left,
        y = container.position().top;
    container.css({
      left: x + dx,
      top: y + dy
    });
    node.updatePorts();
  }
};

/**
 * Checks if a node is selected.
 * @param {!visflow.Node} node
 * @return {boolean}
 */
visflow.flow.isNodeSelected = function(node) {
  return visflow.flow.nodesSelected[node.id] != null;
};

/**
 * Passes key actions to selected nodes and edge.
 * @param {string} key
 * @param {!jQuery.Event} event
 */
visflow.flow.keyAction = function(key, event) {
  switch (key) {
    case 'ctrl+E':
      visflow.diagram.new();
      event.preventDefault();
      break;
    case 'ctrl+S':
      visflow.diagram.save();
      event.preventDefault();
      break;
    case 'ctrl+L':
      visflow.diagram.load();
      event.preventDefault();
      break;
    default:
      // Edge and node selection are exclusive.
      if (visflow.flow.edgeSelected == null) {
        for (var id in visflow.flow.nodesSelected) {
          var node = visflow.flow.nodesSelected[id];
          node.keyAction(key, event);
        }
      } else {
        visflow.flow.edgeSelected.keyAction(key);
      }
  }
};

/**
 * Updates the node labels based on the currently node label visibility option.
 */
visflow.flow.updateNodeLabels = function() {
  for (var id in visflow.flow.nodes) {
    var node = visflow.flow.nodes[id];
    node.showLabel();
  }
};

/**
 * Updates the data source data names/files when new data is uploaded.
 * @private
 */
visflow.flow.updateDataSources_ = function() {
  visflow.flow.dataSources.forEach(function(node) {
    node.showDataList();
  });
};
