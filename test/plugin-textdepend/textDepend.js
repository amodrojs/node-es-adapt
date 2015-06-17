import text from '../lib/text!./test.txt';

export function fetch (loader, resourceId, refId, location) {
  loader.setModule(module.id + '!' + resourceId, text);
};
