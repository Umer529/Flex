const bcrypt = require("bcryptjs")
const jwt = require("jsonwebtoken")
const { getConnection, sql, executeStoredProcedure } = require("../config/db")
const config = require("../config/config")

// Register a new user
exports.register = async (req, res, next) => {
  const { domain_id, password, role, name, email, phone_number, department, address, roll_number } = req.body

  try {
    // Validate input
    if (!domain_id || !password || !name || !email) {
      return res.status(400).json({ message: "Please provide domain_id, password, name, and email" })
    }

    // Get database connection
    const pool = await getConnection()

    // Begin transaction
    const transaction = new sql.Transaction(pool)
    await transaction.begin()

    try {
      const request = new sql.Request(transaction)

      // Check if user already exists
      const userCheck = await request
        .input("domain_id", sql.VarChar, domain_id)
        .query("SELECT * FROM Users WHERE domain_id = @domain_id")

      if (userCheck.recordset.length > 0) {
        await transaction.rollback()
        return res.status(400).json({ message: "User already exists" })
      }

      // Default role is student if not specified
      const userRole = role || "student"

      // Hash password
      const salt = await bcrypt.genSalt(10)
      const hashedPassword = await bcrypt.hash(password, salt)

      // Insert user using direct query
      const userInsertRequest = new sql.Request(transaction)
      const userResult = await userInsertRequest
        .input("domain_id", sql.VarChar, domain_id)
        .input("password_hash", sql.VarChar, hashedPassword)
        .input("role", sql.VarChar, userRole)
        .query(`
          INSERT INTO Users (domain_id, password_hash, role)
          OUTPUT INSERTED.user_id
          VALUES (@domain_id, @password_hash, @role)
        `)

      const user_id = userResult.recordset[0].user_id

      // Insert role-specific data using direct queries
      if (userRole === "student") {
        if (!roll_number) {
          await transaction.rollback()
          return res.status(400).json({ message: "Roll number is required for students" })
        }

        await request
          .input("user_id", sql.Int, user_id)
          .input("name", sql.VarChar, name)
          .input("roll_number", sql.VarChar, roll_number)
          .input("email", sql.VarChar, email)
          .input("phone_number", sql.VarChar, phone_number || null)
          .input("address", sql.Text, address || null)
          .query(`
            INSERT INTO Students (user_id, name, roll_number, email, phone_number, address)
            VALUES (@user_id, @name, @roll_number, @email, @phone_number, @address)
          `)
      } else if (userRole === "teacher") {
        await request
          .input("user_id", sql.Int, user_id)
          .input("name", sql.VarChar, name)
          .input("email", sql.VarChar, email)
          .input("phone_number", sql.VarChar, phone_number || null)
          .input("department", sql.VarChar, department || null)
          .query(`
            INSERT INTO Teachers (user_id, name, email, phone_number, department)
            VALUES (@user_id, @name, @email, @phone_number, @department)
          `)
      } else if (userRole === "management") {
        await request
          .input("user_id", sql.Int, user_id)
          .input("name", sql.VarChar, name)
          .input("email", sql.VarChar, email)
          .input("phone_number", sql.VarChar, phone_number || null)
          .query(`
            INSERT INTO Management (user_id, name, email, phone_number)
            VALUES (@user_id, @name, @email, @phone_number)
          `)
      }

      // Commit transaction
      await transaction.commit()

      // Generate JWT token
      const token = jwt.sign({ id: user_id, role: userRole }, config.JWT_SECRET, { expiresIn: config.JWT_EXPIRE })

      res.status(201).json({
        message: "User registered successfully",
        user: {
          id: user_id,
          domain_id,
          role: userRole,
          name,
          email,
        },
        token,
      })
    } catch (err) {
      // Rollback transaction on error
      await transaction.rollback()
      throw err
    }
  } catch (err) {
    next(err)
  }
}

// Login user
exports.login = async (req, res, next) => {
  const { domain_id, password } = req.body

  try {
    // Validate input
    if (!domain_id || !password) {
      return res.status(400).json({ message: "Please provide domain_id and password" })
    }

    console.log(`Login attempt for user: ${domain_id}`)

    // Get database connection
    const pool = await getConnection()

    // Use direct query instead of stored procedure
    const result = await pool
      .request()
      .input("domain_id", sql.VarChar, domain_id)
      .query("SELECT * FROM Users WHERE domain_id = @domain_id")

    if (result.recordset.length === 0) {
      console.log(`User not found: ${domain_id}`)
      return res.status(401).json({ message: "Invalid credentials" })
    }
    
    const user = result.recordset[0]
    console.log(`User found: ${user.domain_id}, role: ${user.role}`)

    // Direct password comparison for plain text passwords
    if (password === user.password_hash) {
      console.log("Password matched directly (plain text)")
      
      // Generate JWT token
      const token = jwt.sign({ id: user.user_id, role: user.role }, config.JWT_SECRET, { expiresIn: config.JWT_EXPIRE })

      // Return user data and token
      return res.status(200).json({
        message: "Login successful",
        user: {
          id: user.user_id,
          domain_id: user.domain_id,
          role: user.role,
        },
        token,
      })
    }

    // Try bcrypt compare as fallback
    try {
      const isMatch = await bcrypt.compare(password, user.password_hash)
      if (isMatch) {
        console.log("Password matched with bcrypt")
        
        // Generate JWT token
        const token = jwt.sign({ id: user.user_id, role: user.role }, config.JWT_SECRET, { expiresIn: config.JWT_EXPIRE })

        // Return user data and token
        return res.status(200).json({
          message: "Login successful",
          user: {
            id: user.user_id,
            domain_id: user.domain_id,
            role: user.role,
          },
          token,
        })
      }
    } catch (err) {
      console.log("Bcrypt compare failed:", err.message)
    }

    console.log("Password did not match")
    return res.status(401).json({ message: "Invalid credentials" })
  } catch (err) {
    console.error("Login error:", err)
    next(err)
  }
}

// Get current user
exports.getCurrentUser = async (req, res, next) => {
  try {
    // Get database connection
    const pool = await getConnection()

    // Find user by id
    const result = await pool
      .request()
      .input("id", sql.Int, req.user.id)
      .query(`
        SELECT u.user_id as id, u.domain_id, u.role, u.created_at,
        CASE 
          WHEN u.role = 'student' THEN s.name
          WHEN u.role = 'teacher' THEN t.name
          WHEN u.role = 'management' THEN m.name
        END as name,
        CASE 
          WHEN u.role = 'student' THEN s.email
          WHEN u.role = 'teacher' THEN t.email
          WHEN u.role = 'management' THEN m.email
        END as email
        FROM Users u
        LEFT JOIN Students s ON u.user_id = s.user_id
        LEFT JOIN Teachers t ON u.user_id = t.user_id
        LEFT JOIN Management m ON u.user_id = m.user_id
        WHERE u.user_id = @id
      `)

    if (result.recordset.length === 0) {
      return res.status(404).json({ message: "User not found" })
    }

    const user = result.recordset[0]

    // Return user data
    res.status(200).json({
      user,
    })
  } catch (err) {
    next(err)
  }
}

// Change password
exports.changePassword = async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body
    const userId = req.user.id

    // Validate input
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ message: "Please provide current and new password" })
    }

    // Get database connection
    const pool = await getConnection()

    // Find user by id
    const result = await pool.request().input("id", sql.Int, userId).query("SELECT * FROM Users WHERE user_id = @id")

    if (result.recordset.length === 0) {
      return res.status(404).json({ message: "User not found" })
    }

    const user = result.recordset[0]

    // Check current password - handle plain text
    let isMatch = false
    if (currentPassword === user.password_hash) {
      isMatch = true
    } else {
      try {
        isMatch = await bcrypt.compare(currentPassword, user.password_hash)
      } catch (err) {
        isMatch = false
      }
    }

    if (!isMatch) {
      return res.status(401).json({ message: "Current password is incorrect" })
    }

    // Hash new password
    const salt = await bcrypt.genSalt(10)
    const hashedPassword = await bcrypt.hash(newPassword, salt)

    // Update password using direct query
    await pool
      .request()
      .input("id", sql.Int, userId)
      .input("password", sql.VarChar, hashedPassword)
      .query("UPDATE Users SET password_hash = @password WHERE user_id = @id")

    res.status(200).json({
      message: "Password changed successfully",
    })
  } catch (err) {
    next(err)
  }
}

// Forgot password
exports.forgotPassword = async (req, res, next) => {
  try {
    const { email } = req.body

    // Validate input
    if (!email) {
      return res.status(400).json({ message: "Please provide email" })
    }

    // Get database connection
    const pool = await getConnection()

    // Find user by email
    const result = await pool
      .request()
      .input("email", sql.VarChar, email)
      .query(`
        SELECT u.user_id, u.role
        FROM Users u
        LEFT JOIN Students s ON u.user_id = s.user_id
        LEFT JOIN Teachers t ON u.user_id = t.user_id
        LEFT JOIN Management m ON u.user_id = m.user_id
        WHERE s.email = @email OR t.email = @email OR m.email = @email
      `)

    if (result.recordset.length === 0) {
      // For security reasons, don't reveal that the email doesn't exist
      return res
        .status(200)
        .json({ message: "If your email exists in our system, you will receive a password reset link" })
    }

    const user = result.recordset[0]

    // Generate reset token
    const resetToken = jwt.sign({ id: user.user_id }, config.JWT_SECRET, { expiresIn: "15m" })

    // In a real application, you would send an email with the reset token
    // For this example, we'll just return the token in the response
    res.status(200).json({
      message: "If your email exists in our system, you will receive a password reset link",
      resetToken, // In production, this would be sent via email, not in the response
    })
  } catch (err) {
    next(err)
  }
}

// Reset password
exports.resetPassword = async (req, res, next) => {
  try {
    const { resetToken, newPassword } = req.body

    // Validate input
    if (!resetToken || !newPassword) {
      return res.status(400).json({ message: "Please provide reset token and new password" })
    }

    // Verify token
    let decoded
    try {
      decoded = jwt.verify(resetToken, config.JWT_SECRET)
    } catch (err) {
      return res.status(401).json({ message: "Invalid or expired reset token" })
    }

    // Get database connection
    const pool = await getConnection()

    // Find user by id
    const result = await pool
      .request()
      .input("id", sql.Int, decoded.id)
      .query("SELECT * FROM Users WHERE user_id = @id")

    if (result.recordset.length === 0) {
      return res.status(404).json({ message: "User not found" })
    }

    // Hash new password
    const salt = await bcrypt.genSalt(10)
    const hashedPassword = await bcrypt.hash(newPassword, salt)

    // Update password
    await pool
      .request()
      .input("id", sql.Int, decoded.id)
      .input("password", sql.VarChar, hashedPassword)
      .query("UPDATE Users SET password_hash = @password WHERE user_id = @id")

    res.status(200).json({
      message: "Password reset successfully",
    })
  } catch (err) {
    next(err)
  }
}