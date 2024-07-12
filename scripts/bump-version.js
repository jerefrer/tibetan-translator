const fs = require("fs");
const path = require("path");

const getNextVersion = (currentVersion, bumpType) => {
  const [major, minor, patch] = currentVersion.split(".").map(Number);

  switch (bumpType) {
    case "major":
      return `${major + 1}.0.0`;
    case "minor":
      return `${major}.${minor + 1}.0`;
    case "patch":
      return `${major}.${minor}.${patch + 1}`;
    default:
      throw new Error('Invalid bump type. Use "major", "minor", or "patch".');
  }
};

// Function to update the JSON file
const updateJsonFile = (filePath, version) => {
  const fileContent = JSON.parse(fs.readFileSync(filePath));
  fileContent.version = version;
  fs.writeFileSync(filePath, JSON.stringify(fileContent, null, 2));
  `console.log(Updated version in ${filePath} to ${version});`;
};

// Function to update the Cargo.toml file
const updateTomlFile = (filePath, version) => {
  const toml = fs.readFileSync(filePath, "utf8");
  const updatedToml = toml.replace(
    /version\s*=\s*"\d+.\d+.\d+"/,
    `version = "${version}"`
  );
  fs.writeFileSync(filePath, updatedToml);
  console.log(`Updated version in ${filePath} to ${version}`);
};

// Get the bump type from the command line argument
const bumpType = process.argv[2];
if (!bumpType) {
  console.error('Please provide a bump type: "major", "minor", or "patch".');
  process.exit(1);
}

// Read the current version from package.json
const packageJsonPath = path.join(__dirname, "..", "package.json");
const packageJson = JSON.parse(fs.readFileSync(packageJsonPath));
const currentVersion = packageJson.version;

// Calculate the new version
const newVersion = getNextVersion(currentVersion, bumpType);

// Update package.json
updateJsonFile(packageJsonPath, newVersion);

// Update tauri.conf.json
updateJsonFile(
  path.join(__dirname, "..", "src-tauri", "tauri.conf.json"),
  newVersion
);

// Update Cargo.toml
updateTomlFile(path.join(__dirname, "..", "src-tauri", "Cargo.toml"), newVersion);
