const app = require('./app');
const env = require('./config/env');

app.listen(env.port, () => {
  console.log(`Server listening on port ${env.port}`);
});
