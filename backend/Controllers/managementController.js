const { getConnection, sql, executeStoredProcedure } = require("../config/db")
const bcrypt = require("bcryptjs")

// Get all users
exports.getUsers = async (req, res, next) => {
  try {
    // Get database connection
    const pool = await getConnection()

    // Get query parameters for filtering
    const { role, search } = req.query

    // Build query
    let query = `
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
      WHERE 1=1
    `

    const queryParams = []
    const request = pool.request()

    // Add role filter if provided
    if (role) {
      query += " AND u.role = @role"
      request.input("role", sql.VarChar, role)
    }

    // Add search filter if provided
    if (search) {
      query += ` AND (
        u.domain_id LIKE @search OR
        s.name LIKE @search OR
        t.name LIKE @search OR
        m.name LIKE @search OR
        s.email LIKE @search OR
        t.email LIKE @search OR
        m.email LIKE @search
      )`
      request.input("search", sql.VarChar, `%${search}%`)
    }

    // Add order by
    query += " ORDER BY u.created_at DESC"

    // Execute query
    const result = await request.query(query)

    res.status(200).json({
      users: result.recordset,
    })
  } catch (err) {
    next(err)
  }
}

// Create new user
exports.createUser = async (req, res, next) => {
  const { domain_id, password, role, name, email, phone_number, department, address, roll_number } = req.body

  try {
    // Validate input
    if (!domain_id || !password || !role || !name || !email) {
      return res.status(400).json({ message: "Please provide domain_id, password, role, name, and email" })
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
        .execute("GetUserByDomainId")

      if (userCheck.recordset.length > 0) {
        await transaction.rollback()
        return res.status(400).json({ message: "User already exists" })
      }

      // Hash password
      const salt = await bcrypt.genSalt(10)
      const hashedPassword = await bcrypt.hash(password, salt)

      // Insert user using stored procedure
      await request
        .input("domain_id", sql.VarChar, domain_id)
        .input("password_hash", sql.VarChar, hashedPassword)
        .input("role", sql.VarChar, role)
        .execute("InsertUser")

      // Get the inserted user ID
      const userResult = await request
        .input("domain_id", sql.VarChar, domain_id)
        .execute("GetUserByDomainId")

      const user_id = userResult.recordset[0].user_id

      // Insert role-specific data using stored procedures
      if (role === "student") {
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
          .execute("InsertStudent")
      } else if (role === "teacher") {
        await request
          .input("user_id", sql.Int, user_id)
          .input("name", sql.VarChar, name)
          .input("email", sql.VarChar, email)
          .input("phone_number", sql.VarChar, phone_number || null)
          .input("department", sql.VarChar, department || null)
          .execute("InsertTeacher")
      } else if (role === "management") {
        await request
          .input("user_id", sql.Int, user_id)
          .input("name", sql.VarChar, name)
          .input("email", sql.VarChar, email)
          .input("phone_number", sql.VarChar, phone_number || null)
          .execute("InsertManagement")
      }

      // Commit transaction
      await transaction.commit()

      res.status(201).json({
        message: "User created successfully",
        user: {
          id: user_id,
          domain_id,
          role,
          name,
          email,
        },
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

// Update user (stub implementation)
exports.updateUser = async (req, res, next) => {
  try {
    res.status(501).json({ message: "Feature not implemented yet" })
  } catch (err) {
    next(err)
  }
}

// Delete user (stub implementation)
exports.deleteUser = async (req, res, next) => {
  try {
    res.status(501).json({ message: "Feature not implemented yet" })
  } catch (err) {
    next(err)
  }
}

// Get all courses
exports.getCourses = async (req, res, next) => {
  try {
    // Get database connection
    const pool = await getConnection()

    // Get query parameters for filtering
    const { teacher_id, search } = req.query

    // Build query
    let query = `
      SELECT c.course_id as id, c.course_code as code, c.course_name as name, 
             c.schedule, c.teacher_id, t.name as teacher_name,
             COUNT(e.student_id) as enrolled_students
      FROM Courses c
      LEFT JOIN Teachers t ON c.teacher_id = t.teacher_id
      LEFT JOIN Enrollments e ON c.course_id = e.course_id
    `

    const whereConditions = []
    const request = pool.request()

    // Add teacher filter if provided
    if (teacher_id) {
      whereConditions.push("c.teacher_id = @teacher_id")
      request.input("teacher_id", sql.Int, teacher_id)
    }

    // Add search filter if provided
    if (search) {
      whereConditions.push("(c.course_code LIKE @search OR c.course_name LIKE @search)")
      request.input("search", sql.VarChar, `%${search}%`)
    }

    // Add where clause if conditions exist
    if (whereConditions.length > 0) {
      query += " WHERE " + whereConditions.join(" AND ")
    }

    // Add group by and order by
    query += " GROUP BY c.course_id, c.course_code, c.course_name, c.schedule, c.teacher_id, t.name"
    query += " ORDER BY c.course_code"

    // Execute query
    const result = await request.query(query)

    res.status(200).json({
      courses: result.recordset,
    })
  } catch (err) {
    next(err)
  }
}

// Create new course
exports.createCourse = async (req, res, next) => {
  const { course_code, course_name, schedule, teacher_id } = req.body

  try {
    // Validate input
    if (!course_code || !course_name) {
      return res.status(400).json({ message: "Please provide course code and name" })
    }

    // Use stored procedure to create course
    const result = await executeStoredProcedure("InsertNewCourse", {
      course_code: course_code,
      course_name: course_name,
      schedule: schedule || null,
      teacher_id: teacher_id || null
    })

    res.status(201).json({
      message: "Course created successfully",
      course: {
        course_code,
        course_name,
        schedule,
        teacher_id
      }
    })
  } catch (err) {
    next(err)
  }
}

// Update course (stub implementation)
exports.updateCourse = async (req, res, next) => {
  try {
    res.status(501).json({ message: "Feature not implemented yet" })
  } catch (err) {
    next(err)
  }
}

// Delete course (stub implementation)
exports.deleteCourse = async (req, res, next) => {
  try {
    res.status(501).json({ message: "Feature not implemented yet" })
  } catch (err) {
    next(err)
  }
}

// Post notice
exports.postNotice = async (req, res, next) => {
  try {
    const { title, content } = req.body
    const managementId = req.user.id

    // Validate input
    if (!title || !content) {
      return res.status(400).json({ message: "Please provide title and content" })
    }

    // Use stored procedure to post notice
    await executeStoredProcedure("PostNewNotice", {
      title: title,
      content: content,
      posted_by_user_id: managementId
    })

    res.status(201).json({
      message: "Notice posted successfully"
    })
  } catch (err) {
    next(err)
  }
}

// Manage fees
exports.manageFees = async (req, res, next) => {
  try {
    const { action } = req.params
    const { studentId, amount, payment_status, payment_date } = req.body

    // Get database connection
    const pool = await getConnection()

    switch (action) {
      case "create":
        // Validate input
        if (!studentId || !amount) {
          return res.status(400).json({ message: "Please provide studentId and amount" })
        }

        // Use stored procedure to insert fee payment
        await executeStoredProcedure("InsertFeePayment", {
          student_id: parseInt(studentId),
          amount: parseFloat(amount),
          payment_status: payment_status || "unpaid",
          payment_date: payment_date ? new Date(payment_date) : null
        })

        res.status(201).json({
          message: "Fee created successfully"
        })
        break;

      default:
        return res.status(400).json({ message: "Invalid action" })
    }
  } catch (err) {
    next(err)
  }
}

// Generate reports
exports.generateReports = async (req, res, next) => {
  try {
    const { reportType } = req.params

    // Get database connection
    const pool = await getConnection()

    let reportData = []
    let reportTitle = ""

    switch (reportType) {
      case "enrollment":
        // Generate enrollment report
        reportTitle = "Course Enrollment Report"
        const enrollmentResult = await pool.request().query(`
          SELECT c.course_id, c.course_code, c.course_name, 
                 COUNT(e.student_id) as enrolled_students,
                 t.name as teacher_name
          FROM Courses c
          LEFT JOIN Enrollments e ON c.course_id = e.course_id
          LEFT JOIN Teachers t ON c.teacher_id = t.teacher_id
          GROUP BY c.course_id, c.course_code, c.course_name, t.name
          ORDER BY enrolled_students DESC
        `)
        reportData = enrollmentResult.recordset
        break

      case "attendance":
        // Generate attendance report
        reportTitle = "Attendance Report"
        const attendanceResult = await pool.request().query(`
          SELECT c.course_id, c.course_code, c.course_name,
                 COUNT(DISTINCT a.student_id) as total_students,
                 SUM(CASE WHEN a.status = 'present' THEN 1 ELSE 0 END) as present_count,
                 SUM(CASE WHEN a.status = 'absent' THEN 1 ELSE 0 END) as absent_count,
                 COUNT(a.student_id) as total_records
          FROM Courses c
          LEFT JOIN Attendance a ON c.course_id = a.course_id
          GROUP BY c.course_id, c.course_code, c.course_name
          ORDER BY c.course_code
        `)
        reportData = attendanceResult.recordset
        break

      case "fees":
        // Generate fees report
        reportTitle = "Fee Payment Report"
        const feesResult = await pool.request().query(`
          SELECT s.student_id, s.name, s.roll_number,
                 SUM(f.amount) as total_fees,
                 SUM(CASE WHEN f.payment_status = 'paid' THEN f.amount ELSE 0 END) as paid_amount,
                 SUM(CASE WHEN f.payment_status = 'unpaid' THEN f.amount ELSE 0 END) as unpaid_amount,
                 SUM(CASE WHEN f.payment_status = 'pending' THEN f.amount ELSE 0 END) as pending_amount
          FROM Students s
          LEFT JOIN Fees f ON s.student_id = f.student_id
          GROUP BY s.student_id, s.name, s.roll_number
          ORDER BY s.name
        `)
        reportData = feesResult.recordset
        break

      case "grades":
        // Generate grades report
        reportTitle = "Student Grades Report"
        const gradesResult = await pool.request().query(`
          SELECT s.student_id, s.name, s.roll_number,
                 c.course_id, c.course_code, c.course_name,
                 AVG(g.weightage_gained) as average_grade,
                 SUM(g.weightage_gained) as total_grade,
                 COUNT(g.component_name) as component_count
          FROM Students s
          JOIN Enrollments e ON s.student_id = e.student_id
          JOIN Courses c ON e.course_id = c.course_id
          LEFT JOIN Grades g ON s.student_id = g.student_id AND c.course_id = g.course_id
          GROUP BY s.student_id, s.name, s.roll_number, c.course_id, c.course_code, c.course_name
          ORDER BY s.name, c.course_code
        `)
        reportData = gradesResult.recordset
        break

      default:
        return res.status(400).json({ message: "Invalid report type" })
    }

    res.status(200).json({
      title: reportTitle,
      type: reportType,
      generatedAt: new Date(),
      data: reportData,
    })
  } catch (err) {
    next(err)
  }
}

// System config (stub implementation)
exports.systemConfig = async (req, res, next) => {
  try {
    res.status(501).json({ message: "Feature not implemented yet" })
  } catch (err) {
    next(err)
  }
}