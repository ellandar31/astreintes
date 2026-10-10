const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

// Only the newly created test database is dropped; never reset a developer's database.
const container = process.env.SUPABASE_TEST_CONTAINER || 'supabase_db_astreintes';
const database = `astreintes_user_roles_test_${process.pid}`;
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
  sql(fs.readFileSync(path.join(root, 'supabase/tests/user-roles-bootstrap.sql'), 'utf8'));
  const migration = fs.readFileSync(path.join(root, 'supabase/migrations/20261010190000_protect_user_roles.sql'), 'utf8');
  sql(migration);
  sql(migration); // Reapplying must not duplicate policies or reopen permissions.
  sql('BEGIN;\n' + fs.readFileSync(path.join(root, 'supabase/tests/user-roles-assertions.sql'), 'utf8') + '\nROLLBACK;');
  // The previous assertion transaction rolls back its helper; recreate it for creation checks.
  sql(`CREATE FUNCTION public.expect_denied(statement text) RETURNS void LANGUAGE plpgsql AS $$
    BEGIN BEGIN EXECUTE statement; EXCEPTION WHEN insufficient_privilege THEN RETURN; END;
    RAISE EXCEPTION 'Expected permission denial: %', statement; END; $$;`);
  sql(fs.readFileSync(path.join(root, 'supabase/tests/operation-creation-bootstrap.sql'), 'utf8'));
  sql(`BEGIN; SET LOCAL ROLE authenticated;
    SELECT set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000002', true);
    INSERT INTO public.regular_on_call_periods (title) VALUES ('Baseline user creation');
    INSERT INTO public.exceptional_on_calls (title) VALUES ('Baseline user creation');
    INSERT INTO public.exceptional_works (title) VALUES ('Baseline user creation'); ROLLBACK;`);
  const creationMigration = fs.readFileSync(path.join(root, 'supabase/migrations/20261010200000_restrict_operation_creation.sql'), 'utf8');
  sql(creationMigration);
  sql(creationMigration);
  const directorMigration = fs.readFileSync(path.join(root, 'supabase/migrations/20261010230000_allow_director_operation_creation.sql'), 'utf8');
  sql(directorMigration);
  sql(directorMigration);
  sql('BEGIN;\n' + fs.readFileSync(path.join(root, 'supabase/tests/operation-creation-assertions.sql'), 'utf8') + '\nROLLBACK;');
  sql(fs.readFileSync(path.join(root, 'supabase/tests/planning-permissions-bootstrap.sql'), 'utf8'));
  const planningMigration = fs.readFileSync(path.join(root, 'supabase/migrations/20261010210000_protect_planning_and_interventions.sql'), 'utf8');
  sql(planningMigration);
  sql(planningMigration);
  sql('BEGIN;\n' + fs.readFileSync(path.join(root, 'supabase/tests/planning-permissions-assertions.sql'), 'utf8') + '\nROLLBACK;');
  sql(fs.readFileSync(path.join(root, 'supabase/tests/exceptional-initiator-bootstrap.sql'), 'utf8'));
  const initiatorMigration = fs.readFileSync(path.join(root, 'supabase/migrations/20261010220000_scope_exceptional_initiator_writes.sql'), 'utf8');
  sql(initiatorMigration);
  sql(initiatorMigration);
  sql('BEGIN;\n' + fs.readFileSync(path.join(root, 'supabase/tests/exceptional-initiator-assertions.sql'), 'utf8') + '\nROLLBACK;');
  for (const file of ['20261010231000_add_rh_role.sql', '20261010232000_grant_rh_director_permissions.sql']) {
    const rhMigration = fs.readFileSync(path.join(root, 'supabase/migrations', file), 'utf8');
    sql(rhMigration);
    sql(rhMigration);
  }
  sql('BEGIN;\n' + fs.readFileSync(path.join(root, 'supabase/tests/rh-role-assertions.sql'), 'utf8') + '\nROLLBACK;');
  console.log('RH: director planning rights OK; role assignment remains admin-only');
  console.log('Exceptional initiator: own planning OK, foreign planning denied, own interventions OK');
  console.log('Planning permissions: dates and participants protected; own interventions OK; foreign interventions denied');
  console.log('Operation creation: ordinary users denied on all three parent tables; interventions on saved on-calls OK');
  console.log('User roles: baseline escalation reproduced; non-admin attacks denied; registration, own profile and admin CRUD OK');
} catch (error) {
  console.error(error.stderr?.toString() || error.message);
  process.exitCode = 1;
} finally {
  sql(`DROP DATABASE ${database};`, 'postgres');
}
