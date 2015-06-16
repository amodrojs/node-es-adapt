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
