const { runDatabaseTests } = require('./sql-test-runner.cjs');

runDatabaseTests('user_roles', [
  'user-roles-assertions.sql',
  'access-assertions.sql',
  'compensation-rh-permissions-assertions.sql',
  'operation-metadata-assertions.sql',
  'directions-assertions.sql',
  'session-access-assertions.sql',
  'rh-access-assertions.sql',
  'active-assignment-assertions.sql',
  'account-preparation-assertions.sql',
]);
