const { getConnection, sql } = require("../config/db")

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
        .query("SELECT * FROM Users WHERE domain_id = @domain_id")

      if (userCheck.recordset.length > 0) {
        await transaction.rollback()
        return res.status(400).json({ message: "User already exists" })
      }

      // Insert user
      const userResult = await request
        .input("domain_id", sql.VarChar, domain_id)
        .input("password_hash", sql.VarChar, password) // In production, this should be hashed
        .input("role", sql.VarChar, role)
        .query(`
          INSERT INTO Users (domain_id, password_hash, role)
          OUTPUT INSERTED.user_id
          VALUES (@domain_id, @password_hash, @role)
        `)

      const user_id = userResult.recordset[0].user_id

      // Insert role-specific data
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
          .query(`
            INSERT INTO Students (user_id, name, roll_number, email, phone_number, address)
            VALUES (@user_id, @name, @roll_number, @email, @phone_number, @address)
          `)
      } else if (role === "teacher") {
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
      } else if (role === "management") {
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

// Update user
exports.updateUser = async (req, res, next) => {
  const { id } = req.params
  const { name, email, phone_number, department, address } = req.body

  try {
    // Get database connection
    const pool = await getConnection()

    // Get user role
    const userCheck = await pool.request().input("id", sql.Int, id).query("SELECT role FROM Users WHERE user_id = @id")

    if (userCheck.recordset.length === 0) {
      return res.status(404).json({ message: "User not found" })
    }

    const role = userCheck.recordset[0].role

    // Update role-specific data
    let updateQuery
    const request = pool.request().input("id", sql.Int, id)

    if (role === "student") {
      updateQuery = `
        UPDATE Students
        SET name = ISNULL(@name, name),
            email = ISNULL(@email, email),
            phone_number = ISNULL(@phone_number, phone_number),
            address = ISNULL(@address, address)
        OUTPUT INSERTED.name, INSERTED.email, INSERTED.phone_number, INSERTED.address
        WHERE user_id = @id
      `
      if (name) request.input("name", sql.VarChar, name)
      if (email) request.input("email", sql.VarChar, email)
      if (phone_number) request.input("phone_number", sql.VarChar, phone_number)
      if (address) request.input("address", sql.Text, address)
    } else if (role === "teacher") {
      updateQuery = `
        UPDATE Teachers
        SET name = ISNULL(@name, name),
            email = ISNULL(@email, email),
            phone_number = ISNULL(@phone_number, phone_number),
            department = ISNULL(@department, department)
        OUTPUT INSERTED.name, INSERTED.email, INSERTED.phone_number, INSERTED.department
        WHERE user_id = @id
      `
      if (name) request.input("name", sql.VarChar, name)
      if (email) request.input("email", sql.VarChar, email)
      if (phone_number) request.input("phone_number", sql.VarChar, phone_number)
      if (department) request.input("department", sql.VarChar, department)
    } else if (role === "management") {
      updateQuery = `
        UPDATE Management
        SET name = ISNULL(@name, name),
            email = ISNULL(@email, email),
            phone_number = ISNULL(@phone_number, phone_number)
        OUTPUT INSERTED.name, INSERTED.email, INSERTED.phone_number
        WHERE user_id = @id
      `
      if (name) request.input("name", sql.VarChar, name)
      if (email) request.input("email", sql.VarChar, email)
      if (phone_number) request.input("phone_number", sql.VarChar, phone_number)
    }

    const result = await request.query(updateQuery)

    if (result.recordset.length === 0) {
      return res.status(404).json({ message: `${role} profile not found` })
    }

    res.status(200).json({
      message: "User updated successfully",
      user: {
        id: Number.parseInt(id),
        role,
        ...result.recordset[0],
      },
    })
  } catch (err) {
    next(err)
  }
}

// Delete user
exports.deleteUser = async (req, res, next) => {
  const { id } = req.params

  try {
    // Get database connection
    const pool = await getConnection()

    // Check if user exists
    const userCheck = await pool.request().input("id", sql.Int, id).query("SELECT * FROM Users WHERE user_id = @id")

    if (userCheck.recordset.length === 0) {
      return res.status(404).json({ message: "User not found" })
    }

    // Begin transaction
    const transaction = new sql.Transaction(pool)
    await transaction.begin()

    try {
      const request = new sql.Request(transaction)

      // Delete user (cascade will handle related records)
      await request.input("id", sql.Int, id).query("DELETE FROM Users WHERE user_id = @id")

      // Commit transaction
      await transaction.commit()

      res.status(200).json({
        message: "User deleted successfully",
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

    // Get database connection
    const pool = await getConnection()

    // Check if course code already exists
    const courseCheck = await pool
      .request()
      .input("course_code", sql.VarChar, course_code)
      .query("SELECT * FROM Courses WHERE course_code = @course_code")

    if (courseCheck.recordset.length > 0) {
      return res.status(400).json({ message: "Course code already exists" })
    }

    // If teacher_id provided, check if teacher exists
    if (teacher_id) {
      const teacherCheck = await pool
        .request()
        .input("teacher_id", sql.Int, teacher_id)
        .query("SELECT * FROM Teachers WHERE teacher_id = @teacher_id")

      if (teacherCheck.recordset.length === 0) {
        return res.status(400).json({ message: "Teacher not found" })
      }
    }

    // Insert course
    const result = await pool
      .request()
      .input("course_code", sql.VarChar, course_code)
      .input("course_name", sql.VarChar, course_name)
      .input("schedule", sql.VarChar, schedule || null)
      .input("teacher_id", sql.Int, teacher_id || null)
      .query(`
        INSERT INTO Courses (course_code, course_name, schedule, teacher_id)
        OUTPUT INSERTED.course_id as id, INSERTED.course_code as code, 
               INSERTED.course_name as name, INSERTED.schedule, INSERTED.teacher_id
        VALUES (@course_code, @course_name, @schedule, @teacher_id)
      `)

    const course = result.recordset[0]

    // If teacher assigned, get teacher name
    let teacher_name = null
    if (teacher_id) {
      const teacherResult = await pool
        .request()
        .input("teacher_id", sql.Int, teacher_id)
        .query("SELECT name FROM Teachers WHERE teacher_id = @teacher_id")

      if (teacherResult.recordset.length > 0) {
        teacher_name = teacherResult.recordset[0].name
      }
    }

    res.status(201).json({
      message: "Course created successfully",
      course: {
        ...course,
        teacher_name,
        enrolled_students: 0,
      },
    })
  } catch (err) {
    next(err)
  }
}

// Update course
exports.updateCourse = async (req, res, next) => {
  const { id } = req.params
  const { name, code, description, teacherId } = req.body

  try {
    // Get database connection
    const pool = await getConnection()

    // Check if course exists
    const courseCheck = await pool.request().input("id", sql.Int, id).query("SELECT * FROM Courses WHERE id = @id")

    if (courseCheck.recordset.length === 0) {
      return res.status(404).json({ message: "Course not found" })
    }

    // Build update query
    let updateQuery = "UPDATE Courses SET "
    const queryParams = []

    if (name) {
      queryParams.push("name = @name")
    }

    if (code) {
      // Check if code is already taken by another course
      const codeCheck = await pool
        .request()
        .input("code", sql.VarChar, code)
        .input("id", sql.Int, id)
        .query("SELECT * FROM Courses WHERE code = @code AND id != @id")

      if (codeCheck.recordset.length > 0) {
        return res.status(400).json({ message: "Course code already in use" })
      }

      queryParams.push("code = @code")
    }

    if (description !== undefined) {
      queryParams.push("description = @description")
    }

    if (teacherId !== undefined) {
      if (teacherId === null) {
        queryParams.push("teacherId = NULL")
      } else {
        // Check if teacher exists
        const teacherCheck = await pool
          .request()
          .input("teacherId", sql.Int, teacherId)
          .query("SELECT * FROM Users WHERE id = @teacherId AND role = 'teacher'")

        if (teacherCheck.recordset.length === 0) {
          return res.status(400).json({ message: "Teacher not found" })
        }

        queryParams.push("teacherId = @teacherId")
      }
    }

    queryParams.push("updatedAt = @updatedAt")

    if (queryParams.length === 1) {
      // Only updatedAt
      return res.status(400).json({ message: "No fields to update" })
    }

    updateQuery += queryParams.join(", ")
    updateQuery +=
      " OUTPUT INSERTED.id, INSERTED.name, INSERTED.code, INSERTED.description, INSERTED.teacherId WHERE id = @id"

    // Update course
    const request = pool.request().input("id", sql.Int, id).input("updatedAt", sql.DateTime, new Date())

    if (name) request.input("name", sql.VarChar, name)
    if (code) request.input("code", sql.VarChar, code)
    if (description !== undefined) request.input("description", sql.VarChar, description)
    if (teacherId !== undefined && teacherId !== null) request.input("teacherId", sql.Int, teacherId)

    const result = await request.query(updateQuery)

    const course = result.recordset[0]

    res.status(200).json({
      message: "Course updated successfully",
      course,
    })
  } catch (err) {
    next(err)
  }
}

// Delete course
exports.deleteCourse = async (req, res, next) => {
  const { id } = req.params

  try {
    // Get database connection
    const pool = await getConnection()

    // Check if course exists
    const courseCheck = await pool.request().input("id", sql.Int, id).query("SELECT * FROM Courses WHERE id = @id")

    if (courseCheck.recordset.length === 0) {
      return res.status(404).json({ message: "Course not found" })
    }

    // Begin transaction
    const transaction = new sql.Transaction(pool)
    await transaction.begin()

    try {
      const request = new sql.Request(transaction)

      // Delete related records first
      await request.input("courseId", sql.Int, id).query("DELETE FROM Attendance WHERE courseId = @courseId")

      await request.input("courseId", sql.Int, id).query(`
          DELETE FROM Grades 
          WHERE assignmentId IN (SELECT id FROM Assignments WHERE courseId = @courseId)
        `)

      await request.input("courseId", sql.Int, id).query("DELETE FROM Assignments WHERE courseId = @courseId")

      await request.input("courseId", sql.Int, id).query("DELETE FROM Enrollments WHERE courseId = @courseId")

      // Finally delete the course
      await request.input("courseId", sql.Int, id).query("DELETE FROM Courses WHERE id = @courseId")

      // Commit transaction
      await transaction.commit()

      res.status(200).json({
        message: "Course deleted successfully",
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
                 COUNT(e.enrollment_id) as enrolled_students,
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
                 SUM(CASE WHEN a.status = 'excused' THEN 1 ELSE 0 END) as excused_count,
                 COUNT(a.attendance_id) as total_records
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
                 AVG(CAST(g.grade as FLOAT)) as average_grade,
                 MIN(CAST(g.grade as FLOAT)) as min_grade,
                 MAX(CAST(g.grade as FLOAT)) as max_grade,
                 COUNT(g.grade_id) as grade_count
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

// Manage fees
exports.manageFees = async (req, res, next) => {
  try {
    const { action } = req.params
    const { studentId, amount, description, dueDate, feeId } = req.body

    // Get database connection
    const pool = await getConnection()

    switch (action) {
      case "create":
        // Validate input
        if (!studentId || !amount) {
          return res.status(400).json({ message: "Please provide studentId and amount" })
        }

        // Check if student exists
        const studentCheck = await pool
          .request()
          .input("studentId", sql.Int, studentId)
          .query("SELECT * FROM Students WHERE student_id = @studentId")

        if (studentCheck.recordset.length === 0) {
          return res.status(404).json({ message: "Student not found" })
        }

        // Create fee
        const createResult = await pool
          .request()
          .input("studentId", sql.Int, studentId)
          .input("amount", sql.Decimal, amount)
          .input("description", sql.VarChar, description || "Tuition Fee")
          .input("dueDate", sql.Date, dueDate ? new Date(dueDate) : new Date())
          .input("paymentStatus", sql.VarChar, "unpaid")
          .input("createdAt", sql.DateTime, new Date())
          .query(`
            INSERT INTO Fees (student_id, amount, description, due_date, payment_status, created_at)
            OUTPUT INSERTED.fee_id as id, INSERTED.amount, INSERTED.description, INSERTED.due_date, INSERTED.payment_status
            VALUES (@studentId, @amount, @description, @dueDate, @paymentStatus, @createdAt)
          `)

        res.status(201).json({
          message: "Fee created successfully",
          fee: createResult.recordset[0],
        })
        break

      case "update":
        // Validate input
        if (!feeId) {
          return res.status(400).json({ message: "Please provide feeId" })
        }

        // Check if fee exists
        const feeCheck = await pool
          .request()
          .input("feeId", sql.Int, feeId)
          .query("SELECT * FROM Fees WHERE fee_id = @feeId")

        if (feeCheck.recordset.length === 0) {
          return res.status(404).json({ message: "Fee not found" })
        }

        // Build update query
        let updateQuery = "UPDATE Fees SET "
        const updateParams = []

        if (amount) {
          updateParams.push("amount = @amount")
        }

        if (description !== undefined) {
          updateParams.push("description = @description")
        }

        if (dueDate) {
          updateParams.push("due_date = @dueDate")
        }

        updateParams.push("updated_at = @updatedAt")

        if (updateParams.length === 1) {
          // Only updatedAt
          return res.status(400).json({ message: "No fields to update" })
        }

        updateQuery += updateParams.join(", ")
        updateQuery +=
          " OUTPUT INSERTED.fee_id as id, INSERTED.amount, INSERTED.description, INSERTED.due_date, INSERTED.payment_status WHERE fee_id = @feeId"

        // Update fee
        const updateRequest = pool.request().input("feeId", sql.Int, feeId).input("updatedAt", sql.DateTime, new Date())

        if (amount) updateRequest.input("amount", sql.Decimal, amount)
        if (description !== undefined) updateRequest.input("description", sql.VarChar, description)
        if (dueDate) updateRequest.input("dueDate", sql.Date, new Date(dueDate))

        const updateResult = await updateRequest.query(updateQuery)

        res.status(200).json({
          message: "Fee updated successfully",
          fee: updateResult.recordset[0],
        })
        break

      case "delete":
        // Validate input
        if (!feeId) {
          return res.status(400).json({ message: "Please provide feeId" })
        }

        // Check if fee exists
        const deleteCheck = await pool
          .request()
          .input("feeId", sql.Int, feeId)
          .query("SELECT * FROM Fees WHERE fee_id = @feeId")

        if (deleteCheck.recordset.length === 0) {
          return res.status(404).json({ message: "Fee not found" })
        }

        // Delete fee
        await pool.request().input("feeId", sql.Int, feeId).query("DELETE FROM Fees WHERE fee_id = @feeId")

        res.status(200).json({
          message: "Fee deleted successfully",
        })
        break

      default:
        return res.status(400).json({ message: "Invalid action" })
    }
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

    // Get database connection
    const pool = await getConnection()

    // Post notice
    const result = await pool
      .request()
      .input("title", sql.VarChar, title)
      .input("content", sql.Text, content)
      .input("postedBy", sql.Int, managementId)
      .input("createdAt", sql.DateTime, new Date())
      .query(`
        INSERT INTO Notices (title, content, posted_by_user_id, created_at)
        OUTPUT INSERTED.notice_id as id, INSERTED.title, INSERTED.content, INSERTED.created_at
        VALUES (@title, @content, @postedBy, @createdAt)
      `)

    res.status(201).json({
      message: "Notice posted successfully",
      notice: result.recordset[0],
    })
  } catch (err) {
    next(err)
  }
}

// System configuration
exports.systemConfig = async (req, res, next) => {
  try {
    const { configKey, configValue, description } = req.body

    // Validate input
    if (!configKey || configValue === undefined) {
      return res.status(400).json({ message: "Please provide configKey and configValue" })
    }

    // Get database connection
    const pool = await getConnection()

    // Check if config exists
    const configCheck = await pool
      .request()
      .input("configKey", sql.VarChar, configKey)
      .query("SELECT * FROM SystemConfig WHERE config_key = @configKey")

    if (configCheck.recordset.length > 0) {
      // Update existing config
      await pool
        .request()
        .input("configKey", sql.VarChar, configKey)
        .input("configValue", sql.VarChar, configValue.toString())
        .input("description", sql.VarChar, description || configCheck.recordset[0].description)
        .input("updatedAt", sql.DateTime, new Date())
        .query(`
          UPDATE SystemConfig
          SET config_value = @configValue, description = @description, updated_at = @updatedAt
          WHERE config_key = @configKey
        `)

      res.status(200).json({
        message: "System configuration updated successfully",
        config: {
          key: configKey,
          value: configValue,
          description: description || configCheck.recordset[0].description,
        },
      })
    } else {
      // Create new config
      await pool
        .request()
        .input("configKey", sql.VarChar, configKey)
        .input("configValue", sql.VarChar, configValue.toString())
        .input("description", sql.VarChar, description || "")
        .input("createdAt", sql.DateTime, new Date())
        .query(`
          INSERT INTO SystemConfig (config_key, config_value, description, created_at)
          VALUES (@configKey, @configValue, @description, @createdAt)
        `)

      res.status(201).json({
        message: "System configuration created successfully",
        config: {
          key: configKey,
          value: configValue,
          description: description || "",
        },
      })
    }
  } catch (err) {
    next(err)
  }
}
