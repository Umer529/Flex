const winston = require("winston")
const config = require("../config/config")

// Define log format
const logFormat = winston.format.printf(({ level, message, timestamp }) => {
  return `${timestamp} ${level}: ${message}`
})

// Create logger
const logger = winston.createLogger({
  level: config.NODE_ENV === "development" ? "debug" : "info",
  format: winston.format.combine(
    winston.format.timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
    winston.format.errors({ stack: true }),
    logFormat,
  ),
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(winston.format.colorize(), logFormat),
    }),
    new winston.transports.File({ filename: "logs/error.log", level: "error" }),
    new winston.transports.File({ filename: "logs/combined.log" }),
  ],
})

// If we're not in production, log to the console with colors
if (config.NODE_ENV !== "production") {
  logger.add(
    new winston.transports.Console({
      format: winston.format.combine(winston.format.colorize(), logFormat),
    }),
  )
}

module.exports = logger
