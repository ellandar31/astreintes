const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

// Never reset the developer's Supabase database: all SQL runs in a disposable database.
const container = process.env.SUPABASE_TEST_CONTAINER || 'supabase_db_astreintes';
const database = 'astreintes_exceptional_split_test';
const root = path.resolve(__dirname, '..');
// Resolve a trusted installation directly; a local PATH entry must not replace Docker.
const dockerCandidates = process.platform === 'win32'
  ? ['C:\\Program Files\\Docker\\Docker\\resources\\bin\\docker.exe',
    path.join(os.homedir(), 'AppData', 'Local', 'Programs', 'DockerDesktop', 'resources', 'bin', 'docker.exe')]
  : ['/usr/bin/docker', '/usr/local/bin/docker'];
const dockerExecutable = dockerCandidates.find(candidate => fs.existsSync(candidate));
if (!dockerExecutable) throw new Error('Docker executable not found in the supported installation directories.');
function sql(statement, target = database) {
  return execFileSync(dockerExecutable, ['exec', '-i', container, 'psql', '-U', 'postgres', '-d', target, '-v', 'ON_ERROR_STOP=1'], {
    input: statement, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'],
  });
}

// If creation fails (including an existing database), do not drop anything.
sql(`CREATE DATABASE ${database};`, 'postgres');
try {
  for (const file of [
    'supabase/tests/exceptional-split-bootstrap.sql',
    'supabase/migrations/20260912170000_relational_domain_schema.sql',
    'supabase/tests/exceptional-split-fixtures.sql',
    'supabase/migrations/20261010090000_split_exceptional_operations.sql',
  ]) {
    sql(fs.readFileSync(path.join(root, file), 'utf8'));
  }
  sql('BEGIN;\n' + fs.readFileSync(path.join(root, 'supabase/tests/exceptional-split-assertions.sql'), 'utf8') + '\nROLLBACK;');
  sql(fs.readFileSync(path.join(root, 'supabase/migrations/20261010093000_isolate_exceptional_families.sql'), 'utf8'));
  sql('BEGIN;\n' + fs.readFileSync(path.join(root, 'supabase/tests/exceptional-isolation-assertions.sql'), 'utf8') + '\nROLLBACK;');
  const noWorkInterventions = fs.readFileSync(path.join(root, 'supabase/migrations/20261010100000_remove_work_interventions.sql'), 'utf8');
  let refused = false;
  try { sql(noWorkInterventions); }
  catch (error) {
    if (!error.stderr?.toString().includes('Work interventions exist')) throw error;
    refused = true;
  }
  if (!refused) throw new Error('Migration silently dropped existing work interventions');
  sql("DO $$ BEGIN IF (select count(*) from public.exceptional_work_interventions) <> 1 THEN RAISE EXCEPTION 'Work data lost on refusal'; END IF; END; $$;");
  // Test-only cleanup: the fixture already has an actual participant covering this period.
  sql('DELETE FROM public.exceptional_work_interventions;');
  sql(noWorkInterventions);
  sql(fs.readFileSync(path.join(root, 'supabase/tests/work-without-interventions-assertions.sql'), 'utf8'));
  console.log('Exceptional isolation: migrations, independent families, work without interventions, refusal without data loss and constraints OK');
} catch (error) {
  console.error(error.stderr?.toString() || error.message);
  process.exitCode = 1;
} finally {
  sql(`DROP DATABASE ${database};`, 'postgres');
}
