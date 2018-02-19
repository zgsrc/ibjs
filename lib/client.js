require("sugar").extend();

const dop = require("dop");

(window || module.exports).subscribe = async () => root.model = await (root.remote = dop.connect()).subscribe();