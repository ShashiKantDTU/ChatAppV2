const winston = require('winston');

// Create and configure the logger
const logger = winston.createLogger({
    level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
    format: winston.format.combine(
        winston.format.timestamp({
            format: 'YYYY-MM-DD HH:mm:ss'
        }),
        winston.format.errors({ stack: true }),
        winston.format.splat(),
        winston.format.json()
    ),
    defaultMeta: { service: 'chat-app-backend' },
    transports: [
        // Write all logs with level 'error' and below to error.log
        new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
        // Write all logs with level 'info' and below to combined.log
        new winston.transports.File({ filename: 'logs/combined.log' }),
    ],
});

// If we're not in production, also log to the console with a simpler format
if (process.env.NODE_ENV !== 'production') {
    logger.add(new winston.transports.Console({
        format: winston.format.combine(
            winston.format.colorize(),
            winston.format.simple()
        ),
    }));
}

// Create a stream object with a 'write' function that will be used by morgan
logger.stream = {
    write: function(message) {
        // Remove the newline character added by morgan
        logger.info(message.trim());
    },
};

module.exports = logger; 