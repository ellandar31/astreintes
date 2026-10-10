const { loadNycConfig } = require("@istanbuljs/load-nyc-config");

/** Exercise the installed consumer rather than testing js-yaml in isolation. */
async function main() {
  const config = await loadNycConfig({
    cwd: process.cwd(),
    nycrcPath: process.argv[2],
  });
  process.stdout.write(JSON.stringify(config));
}

void main();
