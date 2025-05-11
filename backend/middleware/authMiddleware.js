const jwt = require("jsonwebtoken")
const config = require("../config/config")
const { getConnection, sql } = require("../config/db")

// Protect routes
exports.protect = async (req, res, next) => {
  let token

  // Check if token exists in headers
  if (req.headers.authorization && req.headers.authorization.startsWith("Bearer")) {
    token = req.headers.authorization.split(" ")[1]
  }

  // Check if token exists
  if (!token) {
    return res.status(401).json({
      message: "Not authorized to access this route",
    })
  }

  try {
    // Verify token
    const decoded = jwt.verify(token, config.JWT_SECRET)

    // Get user from database
    const pool = await getConnection()
    const result = await pool
      .request()
      .input("userId", sql.Int, decoded.id)
      .query("SELECT user_id, domain_id, role FROM Users WHERE user_id = @userId")

    if (result.recordset.length === 0) {
      return res.status(401).json({
        message: "User not found",
      })
    }

    // Set user in request
    req.user = {
      id: result.recordset[0].user_id,
      domain_id: result.recordset[0].domain_id,
      role: result.recordset[0].role,
    }

    next()
  } catch (err) {
    return res.status(401).json({
      message: "Not authorized to access this route",
    })
  }
}
