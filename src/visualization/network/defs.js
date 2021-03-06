/**
 * @fileoverview Network defs.
 */

/** @inheritDoc */
visflow.Network.prototype.NODE_NAME = 'Network';

/** @inheritDoc */
visflow.Network.prototype.NODE_CLASS = 'network';

/** @inheritDoc */
visflow.Network.prototype.PANEL_TEMPLATE =
  './dist/html/visualization/network/network-panel.html';

/** @private @const {number} */
visflow.Network.prototype.NODE_LABEL_SIZE_ = 14;

/** @private @const {number} */
visflow.Network.prototype.NODE_LABEL_OFFSET_X_ = 10;

/** @private @const {number} */
visflow.Network.prototype.NODE_LABEL_OFFSET_Y_ =
  visflow.Network.prototype.NODE_LABEL_SIZE_ / 2;

/** @private @const {number} */
visflow.Network.prototype.NODE_SIZE_ = 6;

/** @private @const {number} */
visflow.Network.prototype.EDGE_ARROW_LENGTH_ = 10;

/**
 * Shifting percentage of curved edge.
 * @private @const {number}
 */
visflow.Network.prototype.EDGE_CURVE_SHIFT_ = 0.1;

/** @inheritDoc */
visflow.Network.prototype.defaultOptions = function() {
  return new visflow.options.Network({
    // Whether to show label.
    nodeLabel: true,
    // Which dimension is used as label.
    labelBy: 0,
    // D3 force-directed layout force charge.
    charge: -10000,
    // Node identifier corresponding to edges,
    nodeIdBy: 0,
    // Edge dimension used as source (node id).
    sourceBy: 0,
    // Edge dimension used as target (node id).
    targetBy: 1,
    // Whether navigation is enabled.
    navigation: false
  });
};

/** @inheritDoc */
visflow.Network.prototype.defaultProperties = function() {
  return {
    color: '#555',
    border: 'black',
    width: 2,
    size: 5
  };
};

/**
 * Default properties for edges.
 * @return {!Object<number|string>}
 * @protected
 */
visflow.Network.prototype.defaultEdgeProperties = function() {
  return {
    width: 1.5,
    color: '#333'
  };
};

/** @inheritDoc */
visflow.Network.prototype.selectedProperties = function() {
  return {
    color: 'white',
    border: '#6699ee'
  };
};

/**
 * Rendering properties for selected edges.
 * @return {{color: string}}
 * @protected
 */
visflow.Network.prototype.selectedEdgeProperties = function() {
  return {
    color: '#6699ee'
  };
};

/** @inheritDoc */
visflow.Network.prototype.selectedMultiplier = function() {
  return {
    size: 1.2,
    width: 1.2
  };
};

/**
 * @return {!Array<number>}
 * @private
 */
visflow.Network.prototype.zoomExtent_ = function() {
  return [.01, 8];
};

/** @inheritDoc */
visflow.Network.prototype.contextMenuItems = function() {
  return [
    {id: 'selectAll', text: 'Select All'},
    {id: 'clearSelection', text: 'Clear Selection'},
    {id: 'nodeLabel', text: 'Node Label'},
    {id: 'navigation', text: 'Navigation'},
    {id: 'minimize', text: 'Minimize',
      icon: 'glyphicon glyphicon-resize-small'},
    {id: 'visMode', text: 'Visualization Mode',
      icon: 'glyphicon glyphicon-facetime-video'},
    {id: 'panel', text: 'Control Panel',
      icon: 'glyphicon glyphicon-th-list'},
    {id: 'delete', text: 'Delete',
      icon: 'glyphicon glyphicon-remove'}
  ];
};
