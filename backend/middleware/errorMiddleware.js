const errorHandler = (err, req, res, next) => {
  console.error(err.stack)

  // SQL Server specific errors
  if (err.code && err.code.startsWith("ELOGIN")) {
    return res.status(500).json({
      message: "Database connection error",
    })
  }

  // SQL Server constraint violation
  if (err.number === 2627 || err.number === 2601) {
    return res.status(400).json({
      message: "Duplicate entry found",
    })
  }

  // Default error response
  res.status(err.statusCode || 500).json({
    message: err.message || "Server Error",
    error: process.env.NODE_ENV === "development" ? err : {},
  })
}

module.exports = { errorHandler }