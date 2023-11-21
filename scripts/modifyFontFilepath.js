const fs = require("fs");
const path = require("path");
const replace = require("replace");

exports.default = async function (context) {
  const workDir = path.join(context.appDir, "css");
  const files = fs.readdirSync(workDir);
  replace({
    regex: "app:///fonts",
    replacement: "app://./fonts",
    paths: files.map((val) => path.join(workDir, val)),
    recursive: false,
    silent: false,
  });
  return true;
};
