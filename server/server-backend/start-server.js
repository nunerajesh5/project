// Simple wrapper to catch errors
try {
  require('./src/index.js');
} catch (err) {
  console.error('❌ Fatal Error starting server:');
  console.error(err);
  process.exit(1);
}

process.on('uncaughtException', (err) => {
  console.error('❌ Uncaught Exception:');
  console.error(err);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise);
  console.error('Reason:', reason);
});
