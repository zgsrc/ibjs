require("sugar");

const studies = { };

studies.SMA = window => window.map("close").average();

module.exports = studies;