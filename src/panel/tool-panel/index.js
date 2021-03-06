/**
 * @fileoverview Visflow tool panel.
 */

/** @const */
visflow.toolPanel = {};

/** @private {!jQuery} */
visflow.toolPanel.container_ = $();

/**
 * Initializes the tool panel to retrieve its container.
 */
visflow.toolPanel.init = function() {
  var container = visflow.toolPanel.container_ = $('#tool-panel');

  container.find('.to-tooltip').tooltip({
    delay: visflow.panel.TOOLTIP_DELAY
  });

  // Alt hold
  var alted = container.find('#alted');
  alted.click(function() {
    visflow.interaction.toggleAltHold();
  });

  // VisMode button
  var visMode = container.find('#vis-mode');
  visMode
    .click(function() {
      visflow.flow.toggleVisMode();
    })
    .on('mouseenter', function() {
      if (!visflow.flow.visMode) {
        visflow.flow.previewVisMode(true);
      }
    })
    .on('mouseleave', function() {
      if (!visflow.flow.visMode) {
        visflow.flow.previewVisMode(false);
      }
    });

  var upload = container.find('#upload');
  upload.click(function() {
    visflow.upload.upload();
  });

  visflow.toolPanel.initUpdateHandlers_();
};

/**
 * Creates event listeners for system-wide update.
 * @private
 */
visflow.toolPanel.initUpdateHandlers_ = function() {
  $(visflow.flow).on('vf.visMode', function() {
    visflow.toolPanel.updateVisMode_();
  });
  $(visflow.interaction).on('vf.alt', function() {
    visflow.toolPanel.updateAlt_();
  });

  var disableUpload = function() {
    visflow.toolPanel.container_.find('#upload')
      .prop('disabled', true)
      .attr('title', 'upload data (login required)')
      .tooltip('destroy')
      .tooltip({
        delay: visflow.panel.TOOLTIP_DELAY
      });
  };

  $(visflow.user)
    .on('vf.logout', disableUpload)
    .on('vf.login', function() {
      if (!visflow.user.writePermission()) {
        disableUpload();
        return;
      }
      visflow.toolPanel.container_.find('#upload')
        .prop('disabled', false)
        .attr('title', 'upload data')
        .tooltip('destroy')
        .tooltip({
          delay: visflow.panel.TOOLTIP_DELAY
        });
    });
};

/**
 * Updates the visMode button active state.
 * @private
 */
visflow.toolPanel.updateVisMode_ = function() {
  visflow.toolPanel.container_.find('#vis-mode')
    .toggleClass('active', visflow.flow.visMode);
};

/**
 * Updates the alt button's active class to reflect the system's alted state.
 * @private
 */
visflow.toolPanel.updateAlt_ = function() {
  visflow.toolPanel.container_.find('#alted')
    .toggleClass('active', visflow.interaction.isAlted());
};
