const { runDatabaseTests } = require('./sql-test-runner.cjs');

runDatabaseTests('schema', [
  'user-roles-assertions.sql',
  'schema-assertions.sql',
  'access-assertions.sql',
  'compensation-rh-permissions-assertions.sql',
  'operation-metadata-assertions.sql',
  'directions-assertions.sql',
  'session-access-assertions.sql',
  'active-assignment-assertions.sql',
]);
