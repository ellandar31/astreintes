const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

// Only the newly created test database is dropped; never reset a developer's database.
const container = process.env.SUPABASE_TEST_CONTAINER || 'supabase_db_astreintes';
const database = `astreintes_schema_test_${process.pid}`;
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

sql(`CREATE DATABASE ${database};`, 'postgres');
try {
  const bootstrap = fs.readFileSync(path.join(root, 'supabase/tests/user-roles-bootstrap.sql'), 'utf8');
  // Reuse only the Supabase Auth contract and fixtures, never its reduced domain tables.
  sql(bootstrap.slice(0, bootstrap.indexOf('CREATE TYPE public.user_role')));
  sql(fs.readFileSync(path.join(root, 'schema.sql'), 'utf8'));
  const fixtures = bootstrap.slice(bootstrap.indexOf('INSERT INTO auth.users'), bootstrap.indexOf('ALTER TABLE public.app_users ENABLE'));
  sql(fixtures);
  sql('BEGIN;\n' + fs.readFileSync(path.join(root, 'supabase/tests/user-roles-assertions.sql'), 'utf8') + '\nROLLBACK;');
  sql('BEGIN;\n' + fs.readFileSync(path.join(root, 'supabase/tests/schema-assertions.sql'), 'utf8') + '\nROLLBACK;');
  console.log('Fresh schema: installation, profile permissions, family isolation, constraints OK');
} catch (error) {
  console.error(error.stderr?.toString() || error.message);
  process.exitCode = 1;
} finally {
  sql(`DROP DATABASE ${database};`, 'postgres');
}
