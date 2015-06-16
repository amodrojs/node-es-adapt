/*global it */
'use strict';
var assert = require('assert');
var loader = require('../index');
var Module = require('module');

console.log('PATHS: ' + Module._resolveLookupPaths('./a-b-c/a', new Module(module.id)));


it('a-b-c', function(done) {
console.log('MODULE.id: ' + module.id);
  loader(module.id, ['./a-b-c/a'], function(a) {
    assert.equal(a.default.name, 'a');
    assert.equal(a.default.b.name, 'b');
    assert.equal(a.default.b.c.name, 'c');
    done();
  }).catch(function(err) {
    done(err);
  });
});
