/*global it */
'use strict';
var assert = require('assert');
var loader = require('../index');

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

it('plugin-textdepend', function(done) {
  loader(module.id, ['./plugin-textdepend/textDepend!a'], function(textValue) {
    assert.equal('hello world', textValue);
    done();
  }).catch(function(err) {
    done(err);
  });
});
