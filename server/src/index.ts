import 'dotenv/config';
import net from 'net';
import dns from 'dns';
import { validateJwtConfig } from './config/jwt';
import { logger } from './utils/logger';

// Fix Node 24 Happy Eyeballs IPv6 hanging on networks without outbound IPv6 routing
if (typeof net.setDefaultAutoSelectFamily === 'function') {
  net.setDefaultAutoSelectFamily(false);
}
if (typeof dns.setDefaultResultOrder === 'function') {
  dns.setDefaultResultOrder('ipv4first');
}

// Validate critical security configuration immediately at startup before listening
try {
  validateJwtConfig();
} catch (err: any) {
  logger.error('CRITICAL CONFIGURATION ERROR! Server startup aborted.');
  logger.error(err.message);
  process.exit(1);
}

// Jubilee Mission E-Office Server
import app from './app';

const PORT = process.env.PORT || 5000;

const server = app.listen(PORT, () => {
  logger.info(`Server is running in ${process.env.NODE_ENV || 'development'} mode on port ${PORT}`);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (err: any) => {
  logger.error('UNHANDLED REJECTION! Shutting down...');
  logger.error(err.name, err.message);
  if (err.stack) {
    logger.error(err.stack);
  }
  server.close(() => {
    process.exit(1);
  });
});

// Handle uncaught exceptions
process.on('uncaughtException', (err: any) => {
  logger.error('UNCAUGHT EXCEPTION! Shutting down...');
  logger.error(err.name, err.message);
  if (err.stack) {
    logger.error(err.stack);
  }
  process.exit(1);
});
