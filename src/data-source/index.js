/**
 * @fileoverview VisFlow data source.
 */

/**
 * TODO(bowen): use params typedefs?
 * @typedef {!Object}
 */
visflow.params.DataSource;

/**
 * @param {visflow.params.DataSource} params
 * @constructor
 * @extends {visflow.Node}
 */
visflow.DataSource = function(params) {
  visflow.DataSource.base.constructor.call(this, params);

  /**
   * Data array.
   * @type {!Array<visflow.data.Info>}
   */
  this.data = [];

  /**
   * Copy of parsed data, used for switching between non-crossing and crossing.
   * @private {!Array<?visflow.TabularData>}
   */
  this.rawData_ = [];

  /**
   * Last used data type value. When this changed, we shall auto find the
   * crossing keys and attributes.
   * @private {number}
   */
  this.lastDataType_ = 0; // TODO(bowen): how is this used?

  /**
   * Created DataTable.
   * @private {DataTables|undefined}
   */
  this.table_ = undefined;

  /** @inheritDoc */
  this.ports = {
    out: new visflow.MultiplePort({
      node: this,
      id: 'out',
      isInput: false,
      isConstants: false,
      fromPort: ''
    })
  };
};

_.inherit(visflow.DataSource, visflow.Node);


/** @inheritDoc */
visflow.DataSource.prototype.serialize = function() {
  var result = visflow.DataSource.base.serialize.call(this);
  result.data = this.data;
  return result;
};

/** @inheritDoc */
visflow.DataSource.prototype.deserialize = function(save) {
  visflow.DataSource.base.deserialize.call(this, save);

  save = /** @type {!visflow.save.DataSource} */(save);

  if (save.dataSelected != null) {
    visflow.warning('older version data storage found, auto fixed');
    save.dataFile = save.dataSelected;
    save.data = [
      {
        id: '',
        name: 'data name',
        file: save.dataSelected,
        isServerData: true
      }
    ];
  }
  if (save.data == null) {
    save.data = [
      {
        id: '',
        name: save.dataName,
        file: save.dataFile,
        isServerData: save.useServerData
      }
    ];
  }
  this.data = save.data;

  var counter = 0;
  this.data.forEach(function(dataInfo) {
    if (isNaN(parseInt(dataInfo.id, 10))) {
      counter++;
    }
  });
  // Check whether all older version data has been converted.
  var convertComplete = function() {
    if (!counter) {
      // Start loading data.
      this.loadData();
    }
  }.bind(this);
  var converting = counter;
  this.data.forEach(function(dataInfo) {
    // backward compatibility, finding data id with data names
    if (isNaN(parseInt(dataInfo.id, 10))) {
      $.post(visflow.url.DATA_ID, {
        fileName: dataInfo.file
      }).done(function(id) {
        dataInfo.id = id;
      }).fail(function(res) {
        visflow.error('data for older version diagram not found:',
          res.responseText);
      }).always(function() {
        counter--;
        convertComplete();
      });
    }
  });
  if (!converting) {
    // New version of diagram. Start loading data directly.
    this.loadData();
  }
};

/** @inheritDoc */
visflow.DataSource.prototype.showDetails = function() {
  visflow.DataSource.base.showDetails.call(this);
  this.showNodeDataList_();
};

/** @inheritDoc */
visflow.DataSource.prototype.interaction = function() {
  visflow.DataSource.base.interaction.call(this);

  this.content.children('button').click(this.loadDataDialog_.bind(this));
};

/**
 * Deletes a dataset from the data list.
 * @param {number} dataIndex
 * @private
 */
visflow.DataSource.prototype.deleteData_ = function(dataIndex) {
  this.data.splice(dataIndex, 1);
  this.rawData_.splice(dataIndex, 1);
  this.process();
};

/**
 * Shows the data list in the node.
 * @private
 */
visflow.DataSource.prototype.showNodeDataList_ = function() {
  var dataName = this.content.find('#data-name');
  var text = this.data.length == 0 ? 'No Data' :
    this.data.map(function(data) {
      return data.name;
    }).join(', ');
  if (text.length > this.DATA_NAMES_LENGTH_) {
    text = text.substr(0, this.DATA_NAMES_LENGTH_ - 3) + '...';
  }
  dataName.text(text).show();
  this.content.find('#data-error').hide();
};

/**
 * Shows the data list both in panel and in node.
 */
visflow.DataSource.prototype.showDataList = function() {
  $.post(visflow.url.LIST_DATA)
    .done(function(dataList) {
      var dataInfos = {};
      dataList.forEach(function(dataInfo) {
        dataInfos[dataInfo.id] = dataInfo;
      });
      this.data.forEach(function(dataInfo) {
        if (dataInfo.id in dataInfos) {
          var info = dataInfos[dataInfo.id];
          dataInfo.name = info.name;
          dataInfo.file = info.file;
        } else {
          visflow.error('data used not listed:', dataInfo.id, dataInfo.name,
            dataInfo.file);
        }
      });
      if (visflow.optionPanel.isOpen) {
        this.createPanelDataList_(visflow.optionPanel.contentContainer());
      }
      // Show data list in node.
      this.showNodeDataList_();
    }.bind(this))
    .fail(function(res) {
      visflow.error('cannot retrieve data list:', res.responseText);
    });
};

/**
 * Updates the data crossing option.
 * @private
 */
visflow.DataSource.prototype.updateCrossing_ = function() {
  if (visflow.optionPanel.isOpen) {
    var panelContainer = visflow.optionPanel.contentContainer();
    panelContainer.find('#crossing-section').toggle(this.options.crossing);
  }
  this.process();
};

/**
 * Checks if there are duplicate attribute in crossing keys.
 * @private
 */
visflow.DataSource.prototype.validateCrossingAttributes_ = function() {
  var keys = _.keySet(this.options.crossingKeys);
  var duplicate = false;
  this.options.crossingAttrs.forEach(function(dim) {
    if (dim in keys) {
      duplicate = true;
    }
  });
  if (duplicate) {
    visflow.warning('crossing attribute duplicate in keys');
  }
};

/**
 * Updates the active section in the dialog based on server/online data is used.
 * @param {!jQuery} dialog
 * @private
 */
visflow.DataSource.prototype.updateActiveSections_ = function(dialog) {
  var server = dialog.find('.server');
  var online = dialog.find('.online');
  var btnServer = dialog.find('#btn-server');
  var btnOnline = dialog.find('#btn-online');
  if (this.options.useServerData) {
    server.removeClass('disabled');
    btnServer.hide();
    online.addClass('disabled');
    btnOnline.show();
  } else {
    online.removeClass('disabled');
    btnServer.show();
    server.addClass('disabled');
    btnOnline.hide();
  }
};

/**
 * Creates the load data dialog.
 * @private
 */
visflow.DataSource.prototype.loadDataDialog_ = function() {
  visflow.dialog.create({
    template: this.SELECT_DATA_TEMPLATE_,
    complete: function(dialog) {

      dialog.find('.to-tooltip').tooltip({
        delay: this.TOOLTIP_DELAY
      });

      var select = dialog.find('select');

      var dataId = '';
      var dataName = '';
      var dataFile = '';
      var confirm = dialog.find('#confirm');

      // Checks whether upload options have been all set.
      var uploadable = function() {
        var allSet;
        if (this.options.useServerData) {
          allSet = dataId !== '' && dataName !== '';
        } else {
          allSet = dataFile !== '' && dataName !== '';
        }
        confirm.prop('disabled', !allSet);
      }.bind(this);

      confirm.click(function() {
        this.data.push({
          id: this.options.useServerData ? dataId : dataFile,
          name: dataName,
          file: dataFile,
          isServerData: this.options.useServerData
        });
        this.loadData(this.data.length - 1);
      }.bind(this));

      $.get(visflow.url.LIST_DATA)
        .done(function(dataList) {
          var table = dialog.find('table');
          if (this.table_) {
            this.table_.destroy();
          }
          this.table_ = visflow.upload.listDataTable(table, dataList);
          table
            .on('select.dt', function(event, dt, type, tableIndices) {
              var data = /** @type {DataTables} */(dt)
                .row(tableIndices[0]).data();
              dataId = data.id;
              dataName = data.name;
              dataFile = data.file;
              uploadable();
            })
            .on('deselect.dt', function() {
              dataId = '';
              dataName = '';
              dataFile = '';
              uploadable();
            });
        }.bind(this))
        .fail(function(res) {
          visflow.error('cannot list server data:', res.responseText);
        });

      dialog.find('.online #data-name').keyup(function(event) {
        dataName = $(event.target).val();
        uploadable();
      }.bind(this));
      dialog.find('.online #url').keyup(function(event) {
        dataFile = $(event.target).val();
        uploadable();
      }.bind(this));

      dialog.find('#btn-server').click(function() {
        this.options.useServerData = true;
        this.updateActiveSections_(dialog);
        uploadable();
      }.bind(this));
      dialog.find('#btn-online').click(function() {
        this.options.useServerData = false;
        this.updateActiveSections_(dialog);
        uploadable();
      }.bind(this));
      this.updateActiveSections_(dialog);

      dialog.find('#btn-upload').click(function(event) {
        event.stopPropagation();
        visflow.upload.setComplete(this.loadDataDialog_.bind(this));
        visflow.upload.upload();
      }.bind(this));
    }.bind(this)
  });
};

/**
 * Clears the currently loaded data.
 * @private
 */
visflow.DataSource.prototype.clearData_ = function() {
  this.data = [];
  this.rawData_ = [];
  this.showDataList();
  this.process();
};

/**
 * Loads the data specified in the data array.
 * @param {number=} opt_index If specified, then force data at this index to be
 *     reloaded.
 */
visflow.DataSource.prototype.loadData = function(opt_index) {
  if (opt_index != null) {
    this.rawData_[opt_index] = null;
  }

  var counter = 0;
  // Check if all data has been loaded, if so we process and propagate.
  var complete = function() {
    if (counter > 0) {
      return;
    }
    this.process();
  }.bind(this);
  var hasAsyncLoad = false;
  this.data.forEach(function(data, dataIndex) {
    if (this.rawData_[dataIndex]) {
      // Skip already loaded data.
      return;
    }
    counter++;
    var url = data.isServerData ?
      visflow.url.GET_DATA + '?id=' + data.id :
      visflow.utils.standardURL(data.file);

    var duplicateData = visflow.data.duplicateData(data);
    if (duplicateData != null) {
      this.rawData_[dataIndex] = duplicateData;
      --counter;
      return;
    }

    hasAsyncLoad = true;

    $.get(url)
      .done(function(result) {
        visflow.assert(result != null);
        // CSV parser will report error itself.
        result = visflow.parser.csv(result);

        // Store a copy of parsed data, so that we can switch between crossing
        // and non-crossing.
        this.rawData_[dataIndex] = result;

        visflow.data.registerRawData(data, result);

        --counter;
        complete();
      }.bind(this))
      .fail(function(res) {
        visflow.error('cannot get data:', res.responseText);

        --counter;
        complete();
      }.bind(this));
  }, this);

  if (!hasAsyncLoad) {
    this.process();
  }
};

/**
 * Sets empty data to be propagated.
 * @param {boolean=} opt_isError
 * @private
 */
visflow.DataSource.prototype.useEmptyData_ = function(opt_isError) {
  if (opt_isError) {
    this.content.find('#data-name').hide();
    this.content.find('#data-error').show();
  }
  // No data. Create empty package and propagate.
  $.extend(this.ports['out'].pack, new visflow.Package());
  visflow.flow.propagate(this);
};

/**
 * Automatically finds a string dimension for crossing key.
 * @return {!Array<number>} Dimension index.
 */
visflow.DataSource.prototype.findCrossingDims = function() {
  if (this.data.length == 0) {
    return [];
  }
  var data = _.first(this.rawData_);
  for (var dim = 0; dim < data.dimensionTypes.length; dim++) {
    if (data.dimensionTypes[dim] == visflow.ValueType.STRING &&
        !data.dimensionDuplicate[dim]) {
      return [dim];
    }
  }
  return [visflow.data.INDEX_DIM];
};

/**
 * Automatically finds numerical attributes for crossing attibutes.
 * @return {!Array<number>} Dimension index.
 */
visflow.DataSource.prototype.findCrossingAttrs = function() {
  if (this.data.length == 0) {
    return [];
  }
  var data = _.first(this.rawData_);
  var dims = [];
  for (var dim = 0; dim < data.dimensionTypes.length; dim++) {
    if (data.dimensionTypes[dim] != visflow.ValueType.STRING) {
      if (dims.length < this.DEFAULT_NUM_ATTRS_) {
        dims.push(dim);
      }
    }
  }
  return dims;
};

/**
 * Processes all data sets and produces output.
 */
visflow.DataSource.prototype.process = function() {
  var values = [];
  var mismatched = {};
  var type;
  var firstDataIndex = null;
  this.rawData_.forEach(function(data, dataIndex) {
    if (firstDataIndex == null) {
      firstDataIndex = dataIndex;
      type = data.type;
    } else if (data.type != type) { // Data type mismatch.
      visflow.error('data type mismatch');
      mismatched[dataIndex] = true;
      return;
    }
    values = values.concat(data.values);
  });

  if (firstDataIndex == null) {
    this.useEmptyData_();
    this.showDataList();
    return;
  }

  for (var dataIndex in mismatched) {
    this.data.splice(dataIndex, 1);
    this.rawData_.splice(dataIndex, 1);
  }
  var finalData = /** @type {visflow.TabularData} */(
    $.extend({}, this.rawData_[firstDataIndex]));
  finalData.values = values;

  this.showDataList();

  // Apply crossing.
  if (this.options.crossing) {
    if (this.options.crossingKeys.length == 0) {
      this.options.crossingKeys = this.findCrossingDims();
      this.options.crossingAttrs = this.findCrossingAttrs();
    }
    var result = visflow.parser.cross(
      finalData,
      this.options.crossingKeys,
      this.options.crossingAttrs,
      this.options.crossingName
    );
    if (!result.success) {
      visflow.error('failed to cross data:', result.msg);
      this.useEmptyData_(true);
      return;
    }
    finalData = /** @type {visflow.TabularData} */(result.data);
  }

  var lengthSuffix = this.data.length > 3 ? '...' : '';
  var firstThreeData = this.data.slice(0, 3);
  var finalName = firstThreeData.map(function(data) {
    return data.name;
  }).join(',') + lengthSuffix;
  var finalFile = firstThreeData.map(function(data) {
    return data.file;
  }).join(',') + lengthSuffix;

  _.extend(finalData, {
    name: finalName,
    file: finalFile
  });

  var data = new visflow.Data(/** @type {visflow.TabularData} */(finalData));
  if (data.type !== '') {
    visflow.data.registerData(data);
  }
  // Overwrite data object (to keep the same reference).
  $.extend(this.ports['out'].pack, new visflow.Package(data));
  visflow.flow.propagate(this);
};
