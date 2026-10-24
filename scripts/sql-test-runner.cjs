const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

const databaseScripts = ['01_structure.sql', '02_security.sql', '03_operations.sql'];

/** Test only a newly created database; the application's database is never reset. */
function runDatabaseTests(suite, assertions) {
  const container = process.env.SUPABASE_TEST_CONTAINER || 'supabase_db_astreintes';
  const database = `astreintes_${suite}_test_${process.pid}`;
  const root = path.resolve(__dirname, '..');
  const candidates = process.platform === 'win32'
    ? ['C:\\Program Files\\Docker\\Docker\\resources\\bin\\docker.exe',
      path.join(os.homedir(), 'AppData', 'Local', 'Programs', 'DockerDesktop', 'resources', 'bin', 'docker.exe')]
    : ['/usr/bin/docker', '/usr/local/bin/docker'];
  const executable = candidates.find(candidate => fs.existsSync(candidate));
  if (!executable) throw new Error('Docker executable not found in supported installation directories.');
  function sql(statement, target = database) {
    return execFileSync(executable, ['exec', '-i', container, 'psql', '-U', 'postgres', '-d', target, '-v', 'ON_ERROR_STOP=1'], {
      input: statement, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'], timeout: 30000,
    });
  }
  const read = file => fs.readFileSync(path.join(root, file), 'utf8');
  let created = false;
  try {
    sql(`CREATE DATABASE ${database};`, 'postgres');
    created = true;
    sql(read('supabase/tests/auth-bootstrap.sql'));
    for (const file of databaseScripts) sql(read(`supabase/database/${file}`));
    // Structure is intentionally single-use; only access and business scripts are replayed.
    for (const file of databaseScripts.slice(1)) sql(read(`supabase/database/${file}`));
    sql(read('supabase/tests/profile-fixtures.sql'));
    for (const file of assertions) sql(`BEGIN;\n${read(`supabase/tests/${file}`)}\nROLLBACK;`);
    console.log(`${suite}: full schema installation, script replay and SQL assertions OK`);
  } catch (error) {
    console.error(error.stderr?.toString() || error.message);
    process.exitCode = 1;
  } finally {
    if (created) sql(`DROP DATABASE ${database};`, 'postgres');
  }
}

module.exports = { databaseScripts, runDatabaseTests };
