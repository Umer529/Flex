require("dotenv").config()

module.exports = {
  // Server configuration
  PORT: process.env.PORT || 5000,
  NODE_ENV: process.env.NODE_ENV || "development",

  // Database configuration
  DB_USER: process.env.DB_USER || "sa",
  DB_PASSWORD: process.env.DB_PASSWORD || "",
  DB_NAME: process.env.DB_NAME || "LMS2",
  DB_SERVER: process.env.DB_SERVER || "localhost",
  DB_ENCRYPT: process.env.DB_ENCRYPT === "true",
  DB_TRUST_SERVER_CERTIFICATE: process.env.DB_TRUST_SERVER_CERTIFICATE === "true",

  // JWT configuration
  JWT_SECRET: process.env.JWT_SECRET || "your_jwt_secret",
  JWT_EXPIRE: process.env.JWT_EXPIRE || "1d",

  // Rate limiting
  RATE_LIMIT_WINDOW_MS: 15 * 60 * 1000, // 15 minutes
  RATE_LIMIT_MAX: 100, // limit each IP to 100 requests per windowMs
}
