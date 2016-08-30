// An editor modal for creating and updating pieces. An instance of this modal is created
// each time you click "Add" or click to edit an existing piece. Relies on
// [apostrophe-schemas](../apostrophe-schemas/index.html) to edit the fields.

apos.define('apostrophe-pieces-editor-modal', {
  extend: 'apostrophe-modal',

  beforeConstruct: function(self, options) {
    if (!options.source) {
      if (options.create) {
        options.source = 'create-modal';
      } else {
        options.source = 'editor-modal';
      }
    }
  },

  construct: function(self, options) {
    self.schema = options.schema;
    self._id = options._id;
    self.name = options.name;
    self.copying = options.copying;
    self.beforeShow = function(callback) {
      self.$form = self.$el.find('[data-apos-form]');
      self.$form.on('change', self.onChange);

      self.link('apos-trash', function($el) {
        self.trash($el);
      });

      self.link('apos-copy', function($el) {
        self.copy($el);
      });

      self.link('apos-versions', function($el) {
        self.versions($el);
      });

      if (self._id) {
        return self.edit(self._id, callback);
      } else {
        return self.create(callback);
      }
    };

    self.edit = function(_id, callback) {
      return self.open('retrieve', { _id: _id }, callback);
    };

    self.create = function(callback) {
      var piece = apos.schemas.newInstance(self.schema);
      if (self.options.copying) {
        _.assign(piece, self.options.copying);
        delete piece._id;
      }
      return self.populate(piece, callback);
    };

    self.open = function(verb, data, callback) {
      self.api(verb, data, function(result) {
        if (result.status === 'notfound') {
          alert('That item does not exist.');
          return callback('error');
        } else if (result.status !== 'ok') {
          alert('An error occurred. Please try again.');
          return callback('error');
        }
        self._id = result.data._id;
        var object = result.data;
        return self.populate(object, callback);
      }, function() {
        alert('An error occurred. Please try again.');
        return callback('network');
      });
    };

    self.populate = function(piece, callback) {
      return async.series({
        beforePopulate: function(callback) {
          return self.beforePopulate(piece, callback);
        },
        populate: function(callback) {
          return apos.schemas.populate(self.$form, self.schema, piece, callback);
        },
        afterPopulate: function(callback) {
          return self.afterPopulate(piece, callback);
        }
      }, callback);
    };

    self.beforePopulate = function(piece, callback) {
      return setImmediate(callback);
    };

    self.afterPopulate = function(piece, callback) {
      return setImmediate(callback);
    };

    self.saveContent = function(callback) {
      var piece = {
        _id: self._id
      };

      return async.series({
        before: function(callback) {
          return self.beforeConvert(piece, callback);
        },
        convert: function(callback) {
          return apos.schemas.convert(self.$form, self.schema, piece, callback);
        },
        after: function(callback) {
          return self.afterConvert(piece, callback);
        }
      }, function(err) {
        if (err) {
          return callback(err);
        }
        var verb = piece._id ? 'update' : 'insert';
        self.api(verb, piece, function(result) {
          if (result.status !== 'ok') {
            alert(self.getErrorMessage(result.status));
            return callback('error');
          }
          self.unsavedChanges = false;
          // Make the saved piece available to methods like copy()
          self.savedPiece = result.data;
          return self.displayResponse(result, callback);
        }, function() {
          alert('An error occurred. Please try again');
          return callback(err);
        });
      });
    };

    self.getErrorMessage = function(err) {
      return 'An error occurred. Please try again.';
    };

    self.beforeConvert = function(piece, callback) {
      return setImmediate(callback);
    };

    self.afterConvert = function(piece, callback) {
      return setImmediate(callback);
    };

    self.displayResponse = function(result, callback) {
      if (self.options.create && result.data._url) {
        // If the response contains a _url populated, we should redirect to the
        // _url to edit the piece contextually.
        window.location.href = result.data._url;
      }
      apos.change(result.data);
      return setImmediate(callback);
    };

    self.onChange = function(e) {
      if (!self.unsavedChanges) {
        self.unsavedChanges = true;
      }
    };

    self.trash = function($el, next) {
      if (self.trashing || !confirm("Are you sure you want to trash this " + self.options.label + "?")) {
        return;
      }

      var piece = {
        _id: self._id
      };

      self.trashing = true;
      $el.addClass('apos-busy');

      self.api('trash', piece, function(result) {
        self.trashing = false;
        $el.removeClass('apos-busy');
        if (result.status !== 'ok') {
          alert('An error occurred. Please try again.');
          if (next) {
            return next('error');
          }
          return;
        }
        apos.change(self.name);
        apos.modalSupport.closeTopModal();
        if (next) {
          return next(null);
        }
        return;
      }, function() {
        self.trashing = false;
        $el.removeClass('apos-busy');
        alert('An error occurred. Please try again');
        if (next) {
          return next(err);
        }
        return;
      });
    };

    self.versions = function($el) {
      apos.versions.edit(self._id, function() {
        // After reverting, the easiest way to roll back the
        // editor modal is to just cancel it and open another one
        // with the same moog type and options. We also use
        // apos.change to signal to the list view and anything
        // else that cares. -Tom
        self.hide();
        apos.change(self.name);
        apos.create(self.__meta.name, self.options);
      });
    };

    // Save this modal, then open a new modal to create a new piece of
    // this type that starts out as a copy of the current piece

    self.copy = function($el) {
      // We must save successfully before we can start a new editor for the copy
      return self.save(function(err) {
        if (err) {
          return;
        }
        var _options = _.clone(self.options);
        _options.copying = self.savedPiece;
        _options.create = true;
        delete _options._id;
        apos.create(self.__meta.name, _options);
      });
    };
  }
});