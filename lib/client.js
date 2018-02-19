require("sugar").extend();

const dop = require("dop"),
      constants = require("./constants");

let root = (window || module.exports);

root.subscribe = async () => {
    root.model = await (root.remote = dop.connect()).subscribe();
    Object.assign(root.model, constants);
    return root.model;
};