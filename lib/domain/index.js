/**
 * @rkit/domain - Domain Detection & Routing Module
 * @module lib/domain
 * @version 0.1.0
 */

const detector = require('./detector');
const router = require('./router');
const cross = require('./cross');

module.exports = {
  ...detector,
  ...router,
  ...cross,
};
