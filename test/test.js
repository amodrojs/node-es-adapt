/*global it */
'use strict';
var assert = require('assert');
var loader = require('../index');

// ES modules depending on ES modules.
it('a-b-c', function(done) {
  loader(module.id, ['./a-b-c/a'], function(a) {
    assert.equal(a.default.name, 'a');
    assert.equal(a.default.b.name, 'b');
    assert.equal(a.default.b.c.name, 'c');
    done();
  }).catch(function(err) {
    done(err);
  });
});

// ES depend on traditional node module with lots of internal node_modules
// dependencies.
it('a-b-request', function(done) {
  loader(module.id, ['./a-b-request/a'], function(a) {
    assert.equal(a.default.name, 'a');
    assert.equal(a.default.b.name, 'b');

    a.default.b.request('http://www.google.com',
    function (error, response, body) {
      done(error);
    });
  }).catch(function(err) {
    done(err);
  });
});

// Loader plugin test.
it('plugin-textdepend', function(done) {
  loader(module.id, ['./plugin-textdepend/textDepend!a'], function(textValue) {
    assert.equal('hello world', textValue);
    done();
  }).catch(function(err) {
    done(err);
  });
});

// Traditional node module asking for ES module via async require.
it('a-b-ces', function(done) {
  loader(module.id, ['./a-b-ces/a'], function(a) {
    assert.equal(a.name, 'a');
    assert.equal(a.b.name, 'b');
    a.b.runC().then(function(deps) {
      var c = deps[0];
      assert.equal(c.name, 'c');
      done();
    }).catch(function(err) {
      done(err);
    });
  }).catch(function(err) {
    done(err);
  });
});
