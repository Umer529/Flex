const { getConnection, sql } = require("../config/db")

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
    const { gradeId } = req.params
    const { grade, feedback } = req.body
    const teacherId = req.user.id

    // Validate input
    if (!grade) {
      return res.status(400).json({ message: "Please provide a grade" })
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

    // Verify teacher has permission to update this grade
    const gradeCheck = await pool
      .request()
      .input("gradeId", sql.Int, gradeId)
      .input("teacherId", sql.Int, teacher_id)
      .query(`
        SELECT g.id
        FROM Grades g
        JOIN Assignments a ON g.assignmentId = a.id
        JOIN Courses c ON a.courseId = c.id
        WHERE g.id = @gradeId AND c.teacherId = @teacherId
      `)

    if (gradeCheck.recordset.length === 0) {
      return res.status(403).json({ message: "You do not have permission to update this grade" })
    }

    // Update grade
    await pool
      .request()
      .input("gradeId", sql.Int, gradeId)
      .input("grade", sql.VarChar, grade)
      .input("feedback", sql.VarChar, feedback || "")
      .input("gradedAt", sql.DateTime, new Date())
      .query(`
        UPDATE Grades
        SET grade = @grade, feedback = @feedback, gradedAt = @gradedAt
        WHERE id = @gradeId
      `)

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

      // Insert attendance records
      for (const record of attendanceRecords) {
        await request
          .input("studentId", sql.Int, record.studentId)
          .input("courseId", sql.Int, courseId)
          .input("date", sql.Date, date)
          .input("status", sql.VarChar, record.status)
          .query(`
            INSERT INTO Attendance (student_id, course_id, attendance_date, status)
            VALUES (@studentId, @courseId, @date, @status)
          `)
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

    // Get database connection
    const pool = await getConnection()

    // Get teacher profile
    const result = await pool
      .request()
      .input("teacherId", sql.Int, teacherId)
      .query(`
        SELECT t.teacher_id as id, t.name, t.email, t.phone_number, t.department
        FROM Teachers t
        JOIN Users u ON t.user_id = u.user_id
        WHERE u.user_id = @teacherId
      `)

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

// Create assignment
exports.createAssignment = async (req, res, next) => {
  try {
    const { courseId } = req.params
    const { title, description, dueDate, totalMarks } = req.body
    const teacherId = req.user.id

    // Validate input
    if (!title || !totalMarks) {
      return res.status(400).json({ message: "Please provide title and total marks" })
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
      return res.status(403).json({ message: "You do not have permission to create assignments for this course" })
    }

    // Create assignment
    const result = await pool
      .request()
      .input("courseId", sql.Int, courseId)
      .input("title", sql.VarChar, title)
      .input("description", sql.VarChar, description || null)
      .input("dueDate", sql.Date, dueDate ? new Date(dueDate) : null)
      .input("totalMarks", sql.Decimal, totalMarks)
      .input("createdAt", sql.DateTime, new Date())
      .query(`
        INSERT INTO Assignments (course_id, title, description, due_date, total_marks, created_at)
        OUTPUT INSERTED.id, INSERTED.title, INSERTED.description, INSERTED.due_date, INSERTED.total_marks
        VALUES (@courseId, @title, @description, @dueDate, @totalMarks, @createdAt)
      `)

    res.status(201).json({
      message: "Assignment created successfully",
      assignment: result.recordset[0],
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

    // Get database connection
    const pool = await getConnection()

    // Post notice
    const result = await pool
      .request()
      .input("title", sql.VarChar, title)
      .input("content", sql.Text, content)
      .input("postedBy", sql.Int, teacherId)
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


// Get course assignments
exports.getCourseAssignments = async (req, res, next) => {
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

    // Get assignments for the course
    const result = await pool
      .request()
      .input("courseId", sql.Int, courseId)
      .query(`
        SELECT assignment_id as id, title, description, due_date, total_marks, created_at
        FROM Assignments
        WHERE course_id = @courseId
        ORDER BY created_at DESC
      `)

    res.status(200).json({
      assignments: result.recordset,
    })
  } catch (err) {
    next(err)
  }
}

// Update grades for a course component
exports.updateGrades = async (req, res, next) => {
  try {
    const { courseId, componentName } = req.params
    const { grades } = req.body
    const teacherId = req.user.id

    // Validate input
    if (!grades || !Array.isArray(grades)) {
      return res.status(400).json({ message: "Please provide grades as an array" })
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

    // Begin transaction
    const transaction = new sql.Transaction(pool)
    await transaction.begin()

    try {
      const request = new sql.Request(transaction)
      const now = new Date()

      // Update grades
      for (const grade of grades) {
        if (!grade.studentId || !grade.grade) {
          continue // Skip invalid entries
        }

        // Check if grade exists
        const gradeCheck = await request
          .input("studentId", sql.Int, grade.studentId)
          .input("courseId", sql.Int, courseId)
          .input("componentName", sql.VarChar, componentName)
          .query(`
            SELECT grade_id
            FROM Grades
            WHERE student_id = @studentId AND course_id = @courseId AND component_name = @componentName
          `)

        if (gradeCheck.recordset.length > 0) {
          // Update existing grade
          await request
            .input("gradeId", sql.Int, gradeCheck.recordset[0].grade_id)
            .input("grade", sql.VarChar, grade.grade)
            .input("feedback", sql.VarChar, grade.feedback || null)
            .input("updatedAt", sql.DateTime, now)
            .query(`
              UPDATE Grades
              SET grade = @grade, feedback = @feedback, updated_at = @updatedAt
              WHERE grade_id = @gradeId
            `)
        } else {
          // Insert new grade
          await request
            .input("studentId", sql.Int, grade.studentId)
            .input("courseId", sql.Int, courseId)
            .input("componentName", sql.VarChar, componentName)
            .input("grade", sql.VarChar, grade.grade)
            .input("feedback", sql.VarChar, grade.feedback || null)
            .input("createdAt", sql.DateTime, now)
            .query(`
              INSERT INTO Grades (student_id, course_id, component_name, grade, feedback, created_at)
              VALUES (@studentId, @courseId, @componentName, @grade, @feedback, @createdAt)
            `)
        }
      }

      // Commit transaction
      await transaction.commit()

      res.status(200).json({
        message: "Grades updated successfully",
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

// Get course attendance
exports.getCourseAttendance = async (req, res, next) => {
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

    // Get attendance records for the course
    const result = await pool
      .request()
      .input("courseId", sql.Int, courseId)
      .query(`
        SELECT a.attendance_id as id, a.attendance_date as date, a.status,
               s.student_id as studentId, s.name as studentName, s.roll_number as rollNumber
        FROM Attendance a
        JOIN Students s ON a.student_id = s.student_id
        WHERE a.course_id = @courseId
        ORDER BY a.attendance_date DESC, s.name
      `)

    // Group attendance by date
    const attendanceByDate = {}
    result.recordset.forEach((record) => {
      const dateStr = record.date.toISOString().split("T")[0]
      if (!attendanceByDate[dateStr]) {
        attendanceByDate[dateStr] = []
      }
      attendanceByDate[dateStr].push({
        id: record.id,
        studentId: record.studentId,
        studentName: record.studentName,
        rollNumber: record.rollNumber,
        status: record.status,
      })
    })

    res.status(200).json({
      attendance: attendanceByDate,
    })
  } catch (err) {
    next(err)
  }
}

// Get student progress
exports.getStudentProgress = async (req, res, next) => {
  try {
    const { courseId, studentId } = req.params
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

    // Verify student is enrolled in this course
    const enrollmentCheck = await pool
      .request()
      .input("courseId", sql.Int, courseId)
      .input("studentId", sql.Int, studentId)
      .query("SELECT enrollment_id FROM Enrollments WHERE course_id = @courseId AND student_id = @studentId")

    if (enrollmentCheck.recordset.length === 0) {
      return res.status(404).json({ message: "Student is not enrolled in this course" })
    }

    // Get student details
    const studentResult = await pool
      .request()
      .input("studentId", sql.Int, studentId)
      .query(`
        SELECT student_id as id, name, roll_number, email
        FROM Students
        WHERE student_id = @studentId
      `)

    if (studentResult.recordset.length === 0) {
      return res.status(404).json({ message: "Student not found" })
    }

    const student = studentResult.recordset[0]

    // Get student grades for this course
    const gradesResult = await pool
      .request()
      .input("courseId", sql.Int, courseId)
      .input("studentId", sql.Int, studentId)
      .query(`
        SELECT grade_id as id, component_name, grade, feedback, created_at
        FROM Grades
        WHERE course_id = @courseId AND student_id = @studentId
        ORDER BY created_at DESC
      `)

    // Get student attendance for this course
    const attendanceResult = await pool
      .request()
      .input("courseId", sql.Int, courseId)
      .input("studentId", sql.Int, studentId)
      .query(`
        SELECT attendance_id as id, attendance_date as date, status
        FROM Attendance
        WHERE course_id = @courseId AND student_id = @studentId
        ORDER BY attendance_date DESC
      `)

    // Calculate attendance statistics
    const totalClasses = attendanceResult.recordset.length
    let present = 0
    let absent = 0
    let excused = 0

    attendanceResult.recordset.forEach((record) => {
      if (record.status === "present") present++
      else if (record.status === "absent") absent++
      else if (record.status === "excused") excused++
    })

    const attendanceStats = {
      totalClasses,
      present,
      absent,
      excused,
      presentPercentage: totalClasses > 0 ? (present / totalClasses) * 100 : 0,
      absentPercentage: totalClasses > 0 ? (absent / totalClasses) * 100 : 0,
      excusedPercentage: totalClasses > 0 ? (excused / totalClasses) * 100 : 0,
    }

    // Get assignment submissions
    const submissionsResult = await pool
      .request()
      .input("courseId", sql.Int, courseId)
      .input("studentId", sql.Int, studentId)
      .query(`
        SELECT s.submission_id as id, s.submitted_at, s.status, s.score,
               a.assignment_id, a.title as assignmentTitle, a.due_date as dueDate, a.total_marks
        FROM Submissions s
        JOIN Assignments a ON s.assignment_id = a.assignment_id
        WHERE a.course_id = @courseId AND s.student_id = @studentId
        ORDER BY s.submitted_at DESC
      `)

    res.status(200).json({
      student,
      grades: gradesResult.recordset,
      attendance: {
        records: attendanceResult.recordset,
        stats: attendanceStats,
      },
      submissions: submissionsResult.recordset,
    })
  } catch (err) {
    next(err)
  }
}

// Create quiz
exports.createQuiz = async (req, res, next) => {
  try {
    const { courseId } = req.params
    const { title, description, dueDate, questions, totalMarks } = req.body
    const teacherId = req.user.id

    // Validate input
    if (!title || !questions || !Array.isArray(questions) || questions.length === 0) {
      return res.status(400).json({ message: "Please provide title and questions" })
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
      return res.status(403).json({ message: "You do not have permission to create quizzes for this course" })
    }

    // Begin transaction
    const transaction = new sql.Transaction(pool)
    await transaction.begin()

    try {
      const request = new sql.Request(transaction)
      const now = new Date()

      // Insert quiz
      const quizResult = await request
        .input("courseId", sql.Int, courseId)
        .input("title", sql.VarChar, title)
        .input("description", sql.VarChar, description || null)
        .input("dueDate", sql.Date, dueDate ? new Date(dueDate) : null)
        .input("totalMarks", sql.Decimal, totalMarks || questions.length)
        .input("createdAt", sql.DateTime, now)
        .query(`
          INSERT INTO Quizzes (course_id, title, description, due_date, total_marks, created_at)
          OUTPUT INSERTED.quiz_id
          VALUES (@courseId, @title, @description, @dueDate, @totalMarks, @createdAt)
        `)

      const quizId = quizResult.recordset[0].quiz_id

      // Insert questions
      for (let i = 0; i < questions.length; i++) {
        const question = questions[i]

        if (!question.text || !question.options || !Array.isArray(question.options)) {
          continue // Skip invalid questions
        }

        // Insert question
        const questionResult = await request
          .input("quizId", sql.Int, quizId)
          .input("questionText", sql.VarChar, question.text)
          .input("questionType", sql.VarChar, question.type || "multiple-choice")
          .input("marks", sql.Decimal, question.marks || 1)
          .input("orderIndex", sql.Int, i + 1)
          .query(`
            INSERT INTO QuizQuestions (quiz_id, question_text, question_type, marks, order_index)
            OUTPUT INSERTED.question_id
            VALUES (@quizId, @questionText, @questionType, @marks, @orderIndex)
          `)

        const questionId = questionResult.recordset[0].question_id

        // Insert options
        for (let j = 0; j < question.options.length; j++) {
          const option = question.options[j]

          await request
            .input("questionId", sql.Int, questionId)
            .input("optionText", sql.VarChar, option.text)
            .input("isCorrect", sql.Bit, option.isCorrect ? 1 : 0)
            .input("orderIndex", sql.Int, j + 1)
            .query(`
              INSERT INTO QuizOptions (question_id, option_text, is_correct, order_index)
              VALUES (@questionId, @optionText, @isCorrect, @orderIndex)
            `)
        }
      }

      // Commit transaction
      await transaction.commit()

      res.status(201).json({
        message: "Quiz created successfully",
        quizId,
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
