const env = require('./config/env');
const connectDB = require('./config/db');
const app = require('./app');

async function startServer() {
  try {
    await connectDB();
  } catch (error) {
    console.error('Startup aborted: MongoDB connection could not be established');
    process.exit(1);
  }

  const server = app.listen(env.port, () => {
    console.log(`Server listening on port ${env.port}`);
  });

  server.on('error', (error) => {
    console.error(`Server failed to start: ${error.message}`);
    process.exit(1);
  });
}

startServer();
