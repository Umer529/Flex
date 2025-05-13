const { getConnection, sql, executeStoredProcedure } = require("../config/db")

// Get teacher courses
exports.getCourses = async (req, res, next) => {
  try {
    const teacherId = req.user.id

    // Get database connection
    const pool = await getConnection()

    // Get teacher ID from user ID
    const teacherResult = await pool
      .request()
      .input("userId", sql.Int, teacherId)
      .query(`
        SELECT teacher_id
        FROM Teachers
        WHERE user_id = @userId
      `)

    if (teacherResult.recordset.length === 0) {
      return res.status(404).json({ message: "Teacher not found" })
    }

    const teacher_id = teacherResult.recordset[0].teacher_id

    // Get courses taught by teacher
    const result = await pool
      .request()
      .input("teacherId", sql.Int, teacher_id)
      .query(`
        SELECT c.course_id as id, c.course_code as code, c.course_name as name, 
               c.schedule, COUNT(e.student_id) as enrolledStudents
        FROM Courses c
        LEFT JOIN Enrollments e ON c.course_id = e.course_id
        WHERE c.teacher_id = @teacherId
        GROUP BY c.course_id, c.course_code, c.course_name, c.schedule
      `)

    res.status(200).json({
      courses: result.recordset,
    })
  } catch (err) {
    next(err)
  }
}

// Get students in a course
exports.getCourseStudents = async (req, res, next) => {
  try {
    const { courseId } = req.params
    const teacherId = req.user.id

    // Get database connection
    const pool = await getConnection()

    // Get teacher ID from user ID
    const teacherResult = await pool
      .request()
      .input("userId", sql.Int, teacherId)
      .query(`
        SELECT teacher_id
        FROM Teachers
        WHERE user_id = @userId
      `)

    if (teacherResult.recordset.length === 0) {
      return res.status(404).json({ message: "Teacher not found" })
    }

    const teacher_id = teacherResult.recordset[0].teacher_id

    // Verify teacher teaches this course
    const courseCheck = await pool
      .request()
      .input("courseId", sql.Int, courseId)
      .input("teacherId", sql.Int, teacher_id)
      .query("SELECT course_id FROM Courses WHERE course_id = @courseId AND teacher_id = @teacherId")

    if (courseCheck.recordset.length === 0) {
      return res.status(403).json({ message: "You do not have permission to access this course" })
    }

    // Get students enrolled in the course
    const result = await pool
      .request()
      .input("courseId", sql.Int, courseId)
      .query(`
        SELECT s.student_id as id, s.name, s.email, s.roll_number, 
               e.enrollment_status as status, e.created_at as enrolledAt
        FROM Students s
        JOIN Enrollments e ON s.student_id = e.student_id
        WHERE e.course_id = @courseId
        ORDER BY s.name
      `)

    res.status(200).json({
      students: result.recordset,
    })
  } catch (err) {
    next(err)
  }
}

// Update student grade
exports.updateGrade = async (req, res, next) => {
  try {
    const { studentId, courseId, componentName } = req.params
    const { marks_obtained } = req.body
    const teacherId = req.user.id

    // Validate input
    if (!marks_obtained) {
      return res.status(400).json({ message: "Please provide marks obtained" })
    }

    // Get database connection
    const pool = await getConnection()

    // Get teacher ID from user ID
    const teacherResult = await pool
      .request()
      .input("userId", sql.Int, teacherId)
      .query(`
        SELECT teacher_id
        FROM Teachers
        WHERE user_id = @userId
      `)

    if (teacherResult.recordset.length === 0) {
      return res.status(404).json({ message: "Teacher not found" })
    }

    const teacher_id = teacherResult.recordset[0].teacher_id

    // Verify teacher teaches this course
    const courseCheck = await pool
      .request()
      .input("courseId", sql.Int, courseId)
      .input("teacherId", sql.Int, teacher_id)
      .query("SELECT course_id FROM Courses WHERE course_id = @courseId AND teacher_id = @teacherId")

    if (courseCheck.recordset.length === 0) {
      return res.status(403).json({ message: "You do not have permission to update grades for this course" })
    }

    // Update grade using stored procedure
    await executeStoredProcedure("UpdateStudentGrade", {
      student_id: parseInt(studentId),
      course_id: parseInt(courseId),
      component_name: componentName,
      new_marks_obtained: parseFloat(marks_obtained)
    })

    res.status(200).json({
      message: "Grade updated successfully",
    })
  } catch (err) {
    next(err)
  }
}

// Take attendance
exports.takeAttendance = async (req, res, next) => {
  try {
    const { courseId } = req.params
    const { attendanceRecords } = req.body
    const teacherId = req.user.id

    // Validate input
    if (!attendanceRecords || !Array.isArray(attendanceRecords)) {
      return res.status(400).json({ message: "Please provide attendance records" })
    }

    // Get database connection
    const pool = await getConnection()

    // Get teacher ID from user ID
    const teacherResult = await pool
      .request()
      .input("userId", sql.Int, teacherId)
      .query(`
        SELECT teacher_id
        FROM Teachers
        WHERE user_id = @userId
      `)

    if (teacherResult.recordset.length === 0) {
      return res.status(404).json({ message: "Teacher not found" })
    }

    const teacher_id = teacherResult.recordset[0].teacher_id

    // Verify teacher teaches this course
    const courseCheck = await pool
      .request()
      .input("courseId", sql.Int, courseId)
      .input("teacherId", sql.Int, teacher_id)
      .query("SELECT course_id FROM Courses WHERE course_id = @courseId AND teacher_id = @teacherId")

    if (courseCheck.recordset.length === 0) {
      return res.status(403).json({ message: "You do not have permission to take attendance for this course" })
    }

    // Begin transaction
    const transaction = new sql.Transaction(pool)
    await transaction.begin()

    try {
      const request = new sql.Request(transaction)
      const date = new Date()

      // Insert attendance records using stored procedure
      for (const record of attendanceRecords) {
        await executeStoredProcedure("InsertAttendance", {
          student_id: record.studentId,
          course_id: parseInt(courseId),
          attendance_date: date,
          status: record.status
        }, request)
      }

      // Commit transaction
      await transaction.commit()

      res.status(201).json({
        message: "Attendance recorded successfully",
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

// Get teacher profile
exports.getProfile = async (req, res, next) => {
  try {
    const teacherId = req.user.id

    // Use stored procedure to get teacher profile
    const result = await executeStoredProcedure("GetTeacherProfile", {
      user_id: teacherId
    })

    if (result.recordset.length === 0) {
      return res.status(404).json({ message: "Teacher profile not found" })
    }

    res.status(200).json({
      profile: result.recordset[0],
    })
  } catch (err) {
    next(err)
  }
}

// Post notice
exports.postNotice = async (req, res, next) => {
  try {
    const { title, content } = req.body
    const teacherId = req.user.id

    // Validate input
    if (!title || !content) {
      return res.status(400).json({ message: "Please provide title and content" })
    }

    // Use stored procedure to post notice
    const result = await executeStoredProcedure("PostNewNotice", {
      title: title,
      content: content,
      posted_by_user_id: teacherId
    })

    res.status(201).json({
      message: "Notice posted successfully",
    })
  } catch (err) {
    next(err)
  }
}

// Insert student grade
exports.insertGrade = async (req, res, next) => {
  try {
    const { courseId } = req.params
    const { studentId, componentType, componentName, marksObtained, totalMarks, weightage } = req.body
    const teacherId = req.user.id

    // Validate input
    if (!studentId || !componentType || !componentName || !marksObtained || !totalMarks || !weightage) {
      return res.status(400).json({ message: "Please provide all required fields" })
    }

    // Get database connection
    const pool = await getConnection()

    // Get teacher ID from user ID
    const teacherResult = await pool
      .request()
      .input("userId", sql.Int, teacherId)
      .query(`
        SELECT teacher_id
        FROM Teachers
        WHERE user_id = @userId
      `)

    if (teacherResult.recordset.length === 0) {
      return res.status(404).json({ message: "Teacher not found" })
    }

    const teacher_id = teacherResult.recordset[0].teacher_id

    // Verify teacher teaches this course
    const courseCheck = await pool
      .request()
      .input("courseId", sql.Int, courseId)
      .input("teacherId", sql.Int, teacher_id)
      .query("SELECT course_id FROM Courses WHERE course_id = @courseId AND teacher_id = @teacherId")

    if (courseCheck.recordset.length === 0) {
      return res.status(403).json({ message: "You do not have permission to add grades for this course" })
    }

    // Use stored procedure to insert grade
    await executeStoredProcedure("InsertStudentGrade", {
      student_id: parseInt(studentId),
      course_id: parseInt(courseId),
      component_type: componentType,
      component_name: componentName,
      marks_obtained: parseFloat(marksObtained),
      total_marks: parseFloat(totalMarks),
      weightage: parseFloat(weightage)
    })

    res.status(201).json({
      message: "Grade added successfully",
    })
  } catch (err) {
    next(err)
  }
}

// Create assignment (stub implementation)
exports.createAssignment = async (req, res, next) => {
  try {
    res.status(501).json({ message: "Feature not implemented yet" })
  } catch (err) {
    next(err)
  }
}

// Get course assignments (stub implementation)
exports.getCourseAssignments = async (req, res, next) => {
  try {
    res.status(501).json({ message: "Feature not implemented yet" })
  } catch (err) {
    next(err)
  }
}

// Update grades (stub implementation)
exports.updateGrades = async (req, res, next) => {
  try {
    res.status(501).json({ message: "Feature not implemented yet" })
  } catch (err) {
    next(err)
  }
}

// Get course attendance (stub implementation)
exports.getCourseAttendance = async (req, res, next) => {
  try {
    res.status(501).json({ message: "Feature not implemented yet" })
  } catch (err) {
    next(err)
  }
}

// Get student progress (stub implementation)
exports.getStudentProgress = async (req, res, next) => {
  try {
    res.status(501).json({ message: "Feature not implemented yet" })
  } catch (err) {
    next(err)
  }
}

// Create quiz (stub implementation)
exports.createQuiz = async (req, res, next) => {
  try {
    res.status(501).json({ message: "Feature not implemented yet" })
  } catch (err) {
    next(err)
  }
}