const { getConnection, sql, executeStoredProcedure } = require("../config/db")

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

    // Calculate attendance statistics
    const totalClasses = result.recordset.length
    let present = 0
    let absent = 0

    result.recordset.forEach((record) => {
      if (record.status === "present") present++
      else if (record.status === "absent") absent++
    })

    const stats = {
      totalClasses,
      present,
      absent,
      presentPercentage: totalClasses > 0 ? (present / totalClasses) * 100 : 0,
      absentPercentage: totalClasses > 0 ? (absent / totalClasses) * 100 : 0,
    }

    res.status(200).json({
      attendance: result.recordset,
      stats,
    })
  } catch (err) {
    next(err)
  }
}

// Get student profile
exports.getProfile = async (req, res, next) => {
  try {
    const studentId = req.user.id

    // Use stored procedure to get student profile
    const result = await executeStoredProcedure("GetStudentProfile", {
      user_id: studentId
    })

    if (result.recordset.length === 0) {
      return res.status(404).json({ message: "Student profile not found" })
    }

    res.status(200).json({
      profile: result.recordset[0],
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

    // Calculate statistics
    let totalFees = 0
    let paidFees = 0
    let pendingFees = 0
    let unpaidFees = 0

    result.recordset.forEach((fee) => {
      totalFees += fee.amount
      if (fee.payment_status === "paid") {
        paidFees += fee.amount
      } else if (fee.payment_status === "pending") {
        pendingFees += fee.amount
      } else if (fee.payment_status === "unpaid") {
        unpaidFees += fee.amount
      }
    })

    const stats = {
      totalFees,
      paidFees,
      pendingFees,
      unpaidFees,
      paidPercentage: totalFees > 0 ? (paidFees / totalFees) * 100 : 0,
    }

    res.status(200).json({
      fees: result.recordset,
      stats,
    })
  } catch (err) {
    next(err)
  }
}

// Pay fee
exports.payFee = async (req, res, next) => {
  try {
    const studentId = req.user.id
    const { feeId } = req.params

    // Get database connection
    const pool = await getConnection()

    // Get student ID from user ID
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

    // Check if fee exists and belongs to student
    const feeCheck = await pool
      .request()
      .input("feeId", sql.Int, feeId)
      .input("studentId", sql.Int, student_id)
      .query(`
        SELECT * FROM Fees
        WHERE fee_id = @feeId AND student_id = @studentId
      `)

    if (feeCheck.recordset.length === 0) {
      return res.status(404).json({ message: "Fee not found or does not belong to student" })
    }

    // Check if fee is already paid
    if (feeCheck.recordset[0].payment_status === "paid") {
      return res.status(400).json({ message: "Fee is already paid" })
    }

    // Update fee status
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

// Enroll in a course
exports.enrollInCourse = async (req, res, next) => {
  try {
    const { courseId } = req.params
    const studentId = req.user.id

    // Get database connection
    const pool = await getConnection()

    // Get student ID from user ID
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

    // Check if course exists
    const courseCheck = await pool
      .request()
      .input("courseId", sql.Int, courseId)
      .query("SELECT * FROM Courses WHERE course_id = @courseId")

    if (courseCheck.recordset.length === 0) {
      return res.status(404).json({ message: "Course not found" })
    }

    // Check if student is already enrolled
    const enrollmentCheck = await pool
      .request()
      .input("studentId", sql.Int, student_id)
      .input("courseId", sql.Int, courseId)
      .query("SELECT * FROM Enrollments WHERE student_id = @studentId AND course_id = @courseId")

    if (enrollmentCheck.recordset.length > 0) {
      return res.status(400).json({ message: "You are already enrolled in this course" })
    }

    // Use stored procedure to enroll student in course
    await executeStoredProcedure("EnrollStudentInCourse", {
      student_id: student_id,
      course_id: parseInt(courseId),
      enrollment_status: "registered"
    })

    res.status(201).json({
      message: "Successfully enrolled in course",
    })
  } catch (err) {
    next(err)
  }
}

// Get available courses for enrollment
exports.getAvailableCourses = async (req, res, next) => {
  try {
    const studentId = req.user.id

    // Get database connection
    const pool = await getConnection()

    // Get student ID from user ID
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

    // Get courses that student is not enrolled in
    const result = await pool
      .request()
      .input("studentId", sql.Int, student_id)
      .query(`
        SELECT c.course_id as id, c.course_code as code, c.course_name as name, 
               c.schedule, t.name as teacherName
        FROM Courses c
        LEFT JOIN Teachers t ON c.teacher_id = t.teacher_id
        WHERE c.course_id NOT IN (
          SELECT course_id FROM Enrollments WHERE student_id = @studentId
        )
        ORDER BY c.course_code
      `)

    res.status(200).json({
      availableCourses: result.recordset,
    })
  } catch (err) {
    next(err)
  }
}