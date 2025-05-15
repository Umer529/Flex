const { getConnection, sql, executeStoredProcedure } = require("../config/db")

// Get student profile
exports.getProfile = async (req, res, next) => {
  try {
    const userId = req.user.id

    // Get database connection
    const pool = await getConnection()

    // Get student profile data
    const result = await pool
      .request()
      .input("userId", sql.Int, userId)
      .query(`
        SELECT s.student_id, s.name, s.roll_number, s.email, s.phone_number, s.address,
               u.domain_id, u.role, u.created_at
        FROM Students s
        JOIN Users u ON s.user_id = u.user_id
        WHERE s.user_id = @userId
      `)

    if (result.recordset.length === 0) {
      return res.status(404).json({ message: "Student profile not found" })
    }

    // Return student profile data
    res.status(200).json({
      user: result.recordset[0]
    })
  } catch (err) {
    console.error("Error in getProfile:", err)
    next(err)
  }
}

// Get student courses
exports.getCourses = async (req, res, next) => {
  try {
    const studentId = req.user.id

    // Get student ID from user ID
    const pool = await getConnection()
    const studentResult = await pool
      .request()
      .input("userId", sql.Int, studentId)
      .query(`
        SELECT student_id
        FROM Students
        WHERE user_id = @userId
      `)

    if (studentResult.recordset.length === 0) {
      return res.status(404).json({ message: "Student not found" })
    }

    const student_id = studentResult.recordset[0].student_id

    // Use stored procedure to get student courses
    const result = await executeStoredProcedure("GetStudentCourses", {
      student_id: student_id
    })

    res.status(200).json({
      courses: result.recordset,
    })
  } catch (err) {
    next(err)
  }
}

// Get student grades
exports.getGrades = async (req, res, next) => {
  try {
    const studentId = req.user.id

    // Get student ID from user ID
    const pool = await getConnection()
    const studentResult = await pool
      .request()
      .input("userId", sql.Int, studentId)
      .query(`
        SELECT student_id
        FROM Students
        WHERE user_id = @userId
      `)

    if (studentResult.recordset.length === 0) {
      return res.status(404).json({ message: "Student not found" })
    }

    const student_id = studentResult.recordset[0].student_id

    // Use stored procedure to get student grades
    const result = await executeStoredProcedure("GetStudentGrades", {
      student_id: student_id
    })

    res.status(200).json({
      grades: result.recordset,
    })
  } catch (err) {
    next(err)
  }
}

// Get student attendance
exports.getAttendance = async (req, res, next) => {
  try {
    const studentId = req.user.id

    // Get student ID from user ID
    const pool = await getConnection()
    const studentResult = await pool
      .request()
      .input("userId", sql.Int, studentId)
      .query(`
        SELECT student_id
        FROM Students
        WHERE user_id = @userId
      `)

    if (studentResult.recordset.length === 0) {
      return res.status(404).json({ message: "Student not found" })
    }

    const student_id = studentResult.recordset[0].student_id

    // Use stored procedure to get student attendance
    const result = await executeStoredProcedure("GetStudentAttendance", {
      student_id: student_id
    })

    res.status(200).json({
      attendance: result.recordset,
    })
  } catch (err) {
    next(err)
  }
}

// Get notices
exports.getNotices = async (req, res, next) => {
  try {
    // Use stored procedure to get all notices
    const result = await executeStoredProcedure("GetAllNotices")

    res.status(200).json({
      notices: result.recordset,
    })
  } catch (err) {
    next(err)
  }
}

// Get fee status
exports.getFeeStatus = async (req, res, next) => {
  try {
    const studentId = req.user.id

    // Get student ID from user ID
    const pool = await getConnection()
    const studentResult = await pool
      .request()
      .input("userId", sql.Int, studentId)
      .query(`
        SELECT student_id
        FROM Students
        WHERE user_id = @userId
      `)

    if (studentResult.recordset.length === 0) {
      return res.status(404).json({ message: "Student not found" })
    }

    const student_id = studentResult.recordset[0].student_id

    // Use stored procedure to get student fee status
    const result = await executeStoredProcedure("GetStudentFeeStatus", {
      student_id: student_id
    })

    res.status(200).json({
      fees: result.recordset,
    })
  } catch (err) {
    next(err)
  }
}

// Pay fee
exports.payFee = async (req, res, next) => {
  try {
    const { feeId } = req.params
    const studentId = req.user.id

    // Get database connection
    const pool = await getConnection()

    // Update fee status to paid
    await pool
      .request()
      .input("feeId", sql.Int, feeId)
      .input("paymentDate", sql.Date, new Date())
      .query(`
        UPDATE Fees
        SET payment_status = 'paid', payment_date = @paymentDate
        WHERE fee_id = @feeId
      `)

    res.status(200).json({
      message: "Fee paid successfully",
    })
  } catch (err) {
    next(err)
  }
}

// Enroll in course
exports.enrollInCourse = async (req, res, next) => {
  try {
    const { courseId } = req.params
    const studentId = req.user.id

    // Get student ID from user ID
    const pool = await getConnection()
    const studentResult = await pool
      .request()
      .input("userId", sql.Int, studentId)
      .query(`
        SELECT student_id
        FROM Students
        WHERE user_id = @userId
      `)

    if (studentResult.recordset.length === 0) {
      return res.status(404).json({ message: "Student not found" })
    }

    const student_id = studentResult.recordset[0].student_id

    // Check if already enrolled
    const enrollmentCheck = await pool
      .request()
      .input("studentId", sql.Int, student_id)
      .input("courseId", sql.Int, courseId)
      .query(`
        SELECT * FROM Enrollments
        WHERE student_id = @studentId AND course_id = @courseId
      `)

    if (enrollmentCheck.recordset.length > 0) {
      return res.status(400).json({ message: "Already enrolled in this course" })
    }

    // Use stored procedure to enroll student in course
    await executeStoredProcedure("EnrollStudentInCourse", {
      student_id: student_id,
      course_id: parseInt(courseId),
      enrollment_status: "registered"
    })

    res.status(201).json({
      message: "Enrolled successfully",
    })
  } catch (err) {
    next(err)
  }
}

// Get available courses
exports.getAvailableCourses = async (req, res, next) => {
  try {
    const studentId = req.user.id

    // Get student ID from user ID
    const pool = await getConnection()
    const studentResult = await pool
      .request()
      .input("userId", sql.Int, studentId)
      .query(`
        SELECT student_id
        FROM Students
        WHERE user_id = @userId
      `)

    if (studentResult.recordset.length === 0) {
      return res.status(404).json({ message: "Student not found" })
    }

    const student_id = studentResult.recordset[0].student_id

    // Get courses not enrolled in
    const result = await pool
      .request()
      .input("studentId", sql.Int, student_id)
      .query(`
        SELECT c.course_id as id, c.course_code as code, c.course_name as name, 
               c.schedule, t.name as teacher_name
        FROM Courses c
        LEFT JOIN Teachers t ON c.teacher_id = t.teacher_id
        WHERE c.course_id NOT IN (
          SELECT course_id FROM Enrollments WHERE student_id = @studentId
        )
      `)

    res.status(200).json({
      courses: result.recordset,
    })
  } catch (err) {
    next(err)
  }
}

// Update student profile
exports.updateProfile = async (req, res, next) => {
  try {
    const userId = req.user.id
    const { name, email, phone_number, address } = req.body

    // Get database connection
    const pool = await getConnection()

    // Update student profile
    await pool
      .request()
      .input("userId", sql.Int, userId)
      .input("name", sql.VarChar, name)
      .input("email", sql.VarChar, email)
      .input("phone_number", sql.VarChar, phone_number || null)
      .input("address", sql.Text, address || null)
      .query(`
        UPDATE Students
        SET name = @name, email = @email, phone_number = @phone_number, address = @address
        WHERE user_id = @userId
      `)

    res.status(200).json({
      message: "Profile updated successfully"
    })
  } catch (err) {
    console.error("Error in updateProfile:", err)
    next(err)
  }
}