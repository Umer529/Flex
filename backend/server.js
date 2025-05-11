const express = require("express")
const cors = require("cors")
const helmet = require("helmet")
const rateLimit = require("express-rate-limit")
const morgan = require("morgan")
const config = require("./config/config")
const errorHandler = require("./middleware/errorMiddleware")
const logger = require("./utils/logger")

// Import routes
const authRoutes = require("./routes/authRoute")
const studentRoutes = require("./routes/studentRoutes")
const teacherRoutes = require("./routes/teacherRoutes")
const managementRoutes = require("./routes/managementRoutes")

// Initialize express app
const app = express()

// Body parser
app.use(express.json())

// Enable CORS
app.use(cors())

// Set security headers
app.use(helmet())

// Rate limiting
const limiter = rateLimit({
  windowMs: config.RATE_LIMIT_WINDOW_MS,
  max: config.RATE_LIMIT_MAX,
})
app.use(limiter)

// Logging
if (config.NODE_ENV === "development") {
  app.use(morgan("dev"))
}

// Mount routes
app.use("/api/auth", authRoutes)
app.use("/api/student", studentRoutes)
app.use("/api/teacher", teacherRoutes)
app.use("/api/management", managementRoutes)

// Health check route
app.get("/health", (req, res) => {
  res.status(200).json({ status: "ok" })
})

// Error handler middleware
app.use(errorHandler)

// Handle 404 errors
app.use((req, res) => {
  res.status(404).json({ message: "Route not found" })
})

// Start server
const PORT = config.PORT
const server = app.listen(PORT, () => {
  logger.info(`Server running in ${config.NODE_ENV} mode on port ${PORT}`)
})

// Handle unhandled promise rejections
process.on("unhandledRejection", (err) => {
  logger.error(`Error: ${err.message}`)
  // Close server & exit process
  server.close(() => process.exit(1))
})

module.exports = server
