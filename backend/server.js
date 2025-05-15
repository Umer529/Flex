const express = require("express")
const cors = require("cors")
const morgan = require("morgan")
const { errorHandler } = require("./middleware/errorMiddleware")
const logger = require("./utils/logger")

// Import routes
const authRoutes = require("./routes/authRoute")
const studentRoutes = require("./routes/studentRoutes")
const teacherRoutes = require("./routes/teacherRoutes")
const managementRoutes = require("./routes/managementRoutes")

// Create Express app
const app = express()

// Middleware
app.use(cors())
app.use(express.json())
app.use(express.urlencoded({ extended: false }))

// Logging middleware
app.use(morgan("combined", { stream: { write: message => logger.info(message.trim()) } }))

// Routes
app.use("/api/auth", authRoutes)
app.use("/api/student", studentRoutes)
app.use("/api/teacher", teacherRoutes)
app.use("/api/management", managementRoutes)

// Basic route
app.get("/", (req, res) => {
  res.json({ message: "Welcome to the School Management API" })
})

// Error handling middleware
app.use(errorHandler)

// Start server
const PORT = process.env.PORT || 5000
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`)
  logger.info(`Server running on port ${PORT}`)
})

module.exports = app