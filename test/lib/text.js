// This is formatted differently than the amodro-base one just because there is
// no common module format to target for the authoring, which would be different
// with native ES module syntax support in an engine.
'use strict';

function jsEscape(content) {
  return content.replace(/(['\\])/g, '\\$1')
    .replace(/[\f]/g, '\\f')
    .replace(/[\b]/g, '\\b')
    .replace(/[\n]/g, '\\n')
    .replace(/[\t]/g, '\\t')
    .replace(/[\r]/g, '\\r')
    .replace(/[\u2028]/g, '\\u2028')
    .replace(/[\u2029]/g, '\\u2029');
}

export var locateDetectExtension = true;

export function translate(loader, normalizedId, location, source) {
  source = 'export default \'' + jsEscape(source) + '\';\n';

  //Add in helpful debug line
  source += '\r\n//@ sourceURL=' + location;
  return source;
}
