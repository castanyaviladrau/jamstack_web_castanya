// Exposed to templates as `stock`. Exporting a function (not the object) makes
// Eleventy re-evaluate it every build, so dev-server rebuilds see fresh flags.
const { loadStock } = require('../../scripts/product-stock.js');

module.exports = () => loadStock();
