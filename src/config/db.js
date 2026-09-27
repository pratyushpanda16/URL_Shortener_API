const mongoose = require('mongoose');

function redact(message) {
  return String(message)
    .replace(/mongodb(\+srv)?:\/\/[^\s'"]+/gi, 'mongodb://[redacted]')
    .replace(/\/\/[^/\s:]+:[^@\s/]+@/g, '//[redacted]@');
}

async function connectDB() {
  const uri = process.env.MONGODB_URI;

  if (!uri || !uri.trim()) {
    const error = new Error('MONGODB_URI is required');
    console.error(error.message);
    throw error;
  }

  if (!/^mongodb(\+srv)?:\/\//i.test(uri.trim())) {
    const error = new Error('MONGODB_URI must start with mongodb:// or mongodb+srv://');
    console.error(error.message);
    throw error;
  }

  try {
    await mongoose.connect(uri.trim());
    console.log(`MongoDB connected (database: ${mongoose.connection.name})`);
    return mongoose.connection;
  } catch (error) {
    console.error(`MongoDB connection failed: ${redact(error.message)}`);
    throw error;
  }
}

module.exports = connectDB;
