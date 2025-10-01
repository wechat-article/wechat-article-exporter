export default defineTask({
  meta: {
    name: 'db:migrate',
    description: 'Run database migrations',
  },
  run({ payload, context }) {
    console.log(arguments);
    console.log('Running DB migration task...');
    return { result: 'Success' };
  },
});
