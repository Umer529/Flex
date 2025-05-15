const { getConnection, sql, executeStoredProcedure } = require("../config/db")
const { validationResult } = require("express-validator")

// Get teacher profile
exports.getProfile = async (req, res, next) => {
  try {
    const userId = req.user.id

    // Get database connection
    const pool = await getConnection()

    // Get teacher profile data
    const result = await pool
      .request()
      .input("userId", sql.Int, userId)
      .query(`
        SELECT t.teacher_id, t.name, t.email, t.phone_number, t.department,
               u.domain_id, u.role, u.created_at
        FROM Teachers t
        JOIN Users u ON t.user_id = u.user_id
        WHERE t.user_id = @userId
      `)

    if (result.recordset.length === 0) {
      return res.status(404).json({ message: "Teacher profile not found" })
    }

    // Return teacher profile data
    res.status(200).json({
      user: result.recordset[0]
    })
  } catch (err) {
    console.error("Error in getProfile:", err)
    next(err)
  }
}

// Update teacher profile
exports.updateProfile = async (req, res, next) => {
  try {
    const userId = req.user.id
    const { name, email, phone_number, department } = req.body

    // Get database connection
    const pool = await getConnection()

    // Update teacher profile
    await pool
      .request()
      .input("userId", sql.Int, userId)
      .input("name", sql.VarChar, name)
      .input("email", sql.VarChar, email)
      .input("phone_number", sql.VarChar, phone_number || null)
      .input("department", sql.VarChar, department || null)
      .query(`
        UPDATE Teachers
        SET name = @name, email = @email, phone_number = @phone_number, department = @department
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

// Get teacher courses
exports.getCourses = async (req, res, next) => {
  try {
    const teacherId = req.user.id

    // Get teacher ID from user ID
    const pool = await getConnection()
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

    // Get courses taught by this teacher
    const coursesResult = await pool
      .request()
      .input("teacherId", sql.Int, teacher_id)
      .query(`
        SELECT c.course_id as id, c.course_code as code, c.course_name as name, 
               c.schedule, COUNT(e.student_id) as enrolled_students
        FROM Courses c
        LEFT JOIN Enrollments e ON c.course_id = e.course_id
        WHERE c.teacher_id = @teacherId
        GROUP BY c.course_id, c.course_code, c.course_name, c.schedule
        ORDER BY c.course_code
      `)

    res.status(200).json({
      courses: coursesResult.recordset,
    })
  } catch (err) {
    console.error("Error in getCourses:", err)
    next(err)
  }
}

// Get all assignments for a teacher
exports.getAssignments = async (req, res, next) => {
  try {
    // Return sample data for now
    res.status(200).json({
      assignments: [
        {
          id: 1,
          title: "Sample Assignment 1",
          course_code: "CS101",
          course_name: "Introduction to Programming",
          due_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          total_marks: 100,
          submitted: 5,
          pending: 10
        },
        {
          id: 2,
          title: "Sample Assignment 2",
          course_code: "CS102",
          course_name: "Data Structures",
          due_date: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
          total_marks: 50,
          submitted: 8,
          pending: 7
        }
      ]
    });
  } catch (err) {
    console.error("Error in getAssignments:", err);
    next(err);
  }
}

// Get pending assignments
exports.getPendingAssignments = async (req, res, next) => {
  try {
    // Return sample data for now
    res.status(200).json({
      pendingAssignments: [
        {
          id: 1,
          title: "Sample Assignment 1",
          course_code: "CS101",
          due_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          pending: 10
        },
        {
          id: 2,
          title: "Sample Assignment 2",
          course_code: "CS102",
          due_date: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
          pending: 7
        }
      ]
    });
  } catch (err) {
    console.error("Error in getPendingAssignments:", err);
    next(err);
  }
}

// Get recent submissions
exports.getRecentSubmissions = async (req, res, next) => {
  try {
    // Return sample data for now
    res.status(200).json({
      recentSubmissions: [
        {
          id: 1,
          assignment_title: "Sample Assignment 1",
          student_name: "John Doe",
          course_code: "CS101",
          submitted_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000)
        },
        {
          id: 2,
          assignment_title: "Sample Assignment 2",
          student_name: "Jane Smith",
          course_code: "CS102",
          submitted_at: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000)
        }
      ]
    });
  } catch (err) {
    console.error("Error in getRecentSubmissions:", err);
    next(err);
  }
}

// Grade assignment
exports.gradeAssignment = async (req, res, next) => {
  try {
    const { assignmentId, studentId } = req.params;
    const { marks, feedback } = req.body;
    const teacherId = req.user.id;

    // Validate input
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    if (marks === undefined || marks === null) {
      return res.status(400).json({ message: "Marks are required" });
    }

    // Get database connection
    const pool = await getConnection();

    // Get teacher ID from user ID
    const teacherResult = await pool
      .request()
      .input("userId", sql.Int, teacherId)
      .query(`
        SELECT teacher_id
        FROM Teachers
        WHERE user_id = @userId
      `);

    if (teacherResult.recordset.length === 0) {
      return res.status(404).json({ message: "Teacher not found" });
    }

    const teacher_id = teacherResult.recordset[0].teacher_id;

    // Verify assignment belongs to a course taught by this teacher
    const assignmentResult = await pool
      .request()
      .input("assignmentId", sql.Int, assignmentId)
      .input("teacherId", sql.Int, teacher_id)
      .query(`
        SELECT a.assignment_id, a.total_marks
        FROM Assignments a
        JOIN Courses c ON a.course_id = c.course_id
        WHERE a.assignment_id = @assignmentId AND c.teacher_id = @teacherId
      `);

    if (assignmentResult.recordset.length === 0) {
      return res.status(403).json({ message: "Not authorized to grade this assignment" });
    }

    const totalMarks = assignmentResult.recordset[0].total_marks;

    // Validate marks
    if (marks < 0 || marks > totalMarks) {
      return res.status(400).json({ 
        message: `Marks must be between 0 and ${totalMarks}` 
      });
    }

    // Verify submission exists
    const submissionResult = await pool
      .request()
      .input("assignmentId", sql.Int, assignmentId)
      .input("studentId", sql.Int, studentId)
      .query(`
        SELECT submission_id
        FROM AssignmentSubmissions
        WHERE assignment_id = @assignmentId AND student_id = @studentId
      `);

    if (submissionResult.recordset.length === 0) {
      return res.status(404).json({ message: "Submission not found" });
    }

    // Update submission with grade
    await pool
      .request()
      .input("assignmentId", sql.Int, assignmentId)
      .input("studentId", sql.Int, studentId)
      .input("marks", sql.Int, marks)
      .input("feedback", sql.VarChar, feedback || null)
      .input("gradedBy", sql.Int, teacher_id)
      .query(`
        UPDATE AssignmentSubmissions
        SET marks = @marks, feedback = @feedback, graded_by = @gradedBy, graded_at = GETDATE()
        WHERE assignment_id = @assignmentId AND student_id = @studentId
      `);

    res.status(200).json({
      message: "Assignment graded successfully"
    });
  } catch (err) {
    console.error("Error in gradeAssignment:", err);
    next(err);
  }
}

// Grade quiz
exports.gradeQuiz = async (req, res, next) => {
  try {
    const { quizId, studentId } = req.params;
    const { marks, feedback } = req.body;
    const teacherId = req.user.id;

    // Validate input
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    if (marks === undefined || marks === null) {
      return res.status(400).json({ message: "Marks are required" });
    }

    // Get database connection
    const pool = await getConnection();

    // Get teacher ID from user ID
    const teacherResult = await pool
      .request()
      .input("userId", sql.Int, teacherId)
      .query(`
        SELECT teacher_id
        FROM Teachers
        WHERE user_id = @userId
      `);

    if (teacherResult.recordset.length === 0) {
      return res.status(404).json({ message: "Teacher not found" });
    }

    const teacher_id = teacherResult.recordset[0].teacher_id;

    // Verify quiz belongs to a course taught by this teacher
    const quizResult = await pool
      .request()
      .input("quizId", sql.Int, quizId)
      .input("teacherId", sql.Int, teacher_id)
      .query(`
        SELECT q.quiz_id, q.total_marks
        FROM Quizzes q
        JOIN Courses c ON q.course_id = c.course_id
        WHERE q.quiz_id = @quizId AND c.teacher_id = @teacherId
      `);

    if (quizResult.recordset.length === 0) {
      return res.status(403).json({ message: "Not authorized to grade this quiz" });
    }

    const totalMarks = quizResult.recordset[0].total_marks;

    // Validate marks
    if (marks < 0 || marks > totalMarks) {
      return res.status(400).json({ 
        message: `Marks must be between 0 and ${totalMarks}` 
      });
    }

    // Verify submission exists
    const submissionResult = await pool
      .request()
      .input("quizId", sql.Int, quizId)
      .input("studentId", sql.Int, studentId)
      .query(`
        SELECT submission_id
        FROM QuizSubmissions
        WHERE quiz_id = @quizId AND student_id = @studentId
      `);

    if (submissionResult.recordset.length === 0) {
      return res.status(404).json({ message: "Submission not found" });
    }

    // Update submission with grade
    await pool
      .request()
      .input("quizId", sql.Int, quizId)
      .input("studentId", sql.Int, studentId)
      .input("marks", sql.Int, marks)
      .input("feedback", sql.VarChar, feedback || null)
      .input("gradedBy", sql.Int, teacher_id)
      .query(`
        UPDATE QuizSubmissions
        SET marks = @marks, feedback = @feedback, graded_by = @gradedBy, graded_at = GETDATE()
        WHERE quiz_id = @quizId AND student_id = @studentId
      `);

    res.status(200).json({
      message: "Quiz graded successfully"
    });
  } catch (err) {
    console.error("Error in gradeQuiz:", err);
    next(err);
  }
}

// Get attendance
exports.getAttendance = async (req, res, next) => {
  try {
    const { courseId } = req.params;
    const teacherId = req.user.id;
    
    // Get database connection
    const pool = await getConnection();
    
    // Get teacher ID from user ID
    const teacherResult = await pool
      .request()
      .input("userId", sql.Int, teacherId)
      .query(`
        SELECT teacher_id
        FROM Teachers
        WHERE user_id = @userId
      `);
    
    if (teacherResult.recordset.length === 0) {
      return res.status(404).json({ message: "Teacher not found" });
    }
    
    const teacher_id = teacherResult.recordset[0].teacher_id;
    
    // Verify course belongs to teacher
    const courseResult = await pool
      .request()
      .input("courseId", sql.Int, courseId)
      .input("teacherId", sql.Int, teacher_id)
      .query(`
        SELECT course_id
        FROM Courses
        WHERE course_id = @courseId AND teacher_id = @teacherId
      `);
    
    if (courseResult.recordset.length === 0) {
      return res.status(403).json({ message: "Not authorized to access this course" });
    }
    
    // Get attendance records
    const attendanceResult = await pool
      .request()
      .input("courseId", sql.Int, courseId)
      .query(`
        SELECT a.attendance_id, a.date, a.status,
               s.student_id, s.name as student_name, s.roll_number
        FROM Attendance a
        JOIN Students s ON a.student_id = s.student_id
        WHERE a.course_id = @courseId
        ORDER BY a.date DESC, s.name
      `);
    
    res.status(200).json({
      attendance: attendanceResult.recordset
    });
  } catch (err) {
    console.error("Error in getAttendance:", err);
    next(err);
  }
}

// Mark attendance
exports.markAttendance = async (req, res, next) => {
  try {
    const { courseId } = req.params;
    const { date, attendanceData } = req.body;
    const teacherId = req.user.id;
    
    // Validate input
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    
    if (!date || !attendanceData || !Array.isArray(attendanceData)) {
      return res.status(400).json({ message: "Invalid attendance data format" });
    }
    
    // Get database connection
    const pool = await getConnection();
    
    // Get teacher ID from user ID
    const teacherResult = await pool
      .request()
      .input("userId", sql.Int, teacherId)
      .query(`
        SELECT teacher_id
        FROM Teachers
        WHERE user_id = @userId
      `);
    
    if (teacherResult.recordset.length === 0) {
      return res.status(404).json({ message: "Teacher not found" });
    }
    
    const teacher_id = teacherResult.recordset[0].teacher_id;
    
    // Verify course belongs to teacher
    const courseResult = await pool
      .request()
      .input("courseId", sql.Int, courseId)
      .input("teacherId", sql.Int, teacher_id)
      .query(`
        SELECT course_id
        FROM Courses
        WHERE course_id = @courseId AND teacher_id = @teacherId
      `);
    
    if (courseResult.recordset.length === 0) {
      return res.status(403).json({ message: "Not authorized to access this course" });
    }
    
    // Begin transaction
    const transaction = pool.transaction();
    await transaction.begin();
    
    try {
      // Delete existing attendance for this date and course
      await transaction
        .request()
        .input("courseId", sql.Int, courseId)
        .input("date", sql.Date, new Date(date))
        .query(`
          DELETE FROM Attendance
          WHERE course_id = @courseId AND date = @date
        `);
      
      // Insert new attendance records
      for (const record of attendanceData) {
        await transaction
          .request()
          .input("courseId", sql.Int, courseId)
          .input("studentId", sql.Int, record.studentId)
          .input("date", sql.Date, new Date(date))
          .input("status", sql.VarChar, record.status)
          .query(`
            INSERT INTO Attendance (course_id, student_id, date, status)
            VALUES (@courseId, @studentId, @date, @status)
          `);
      }
      
      // Commit transaction
      await transaction.commit();
      
      res.status(200).json({
        message: "Attendance marked successfully"
      });
    } catch (err) {
      // Rollback transaction on error
      await transaction.rollback();
      throw err;
    }
  } catch (err) {
    console.error("Error in markAttendance:", err);
    next(err);
  }
}

// Get grades
exports.getGrades = async (req, res, next) => {
  try {
    const { courseId } = req.params;
    const teacherId = req.user.id;

    // Get database connection
    const pool = await getConnection();

    // Get teacher ID from user ID
    const teacherResult = await pool
      .request()
      .input("userId", sql.Int, teacherId)
      .query(`
        SELECT teacher_id
        FROM Teachers
        WHERE user_id = @userId
      `);

    if (teacherResult.recordset.length === 0) {
      return res.status(404).json({ message: "Teacher not found" });
    }

    const teacher_id = teacherResult.recordset[0].teacher_id;

    // Verify course belongs to teacher
    const courseResult = await pool
      .request()
      .input("courseId", sql.Int, courseId)
      .input("teacherId", sql.Int, teacher_id)
      .query(`
        SELECT course_id
        FROM Courses
        WHERE course_id = @courseId AND teacher_id = @teacherId
      `);

    if (courseResult.recordset.length === 0) {
      return res.status(403).json({ message: "Not authorized to access this course" });
    }

    // Get students enrolled in the course
    const studentsResult = await pool
      .request()
      .input("courseId", sql.Int, courseId)
      .query(`
        SELECT s.student_id, s.name, s.roll_number
        FROM Students s
        JOIN Enrollments e ON s.student_id = e.student_id
        WHERE e.course_id = @courseId
        ORDER BY s.name
      `);

    const students = studentsResult.recordset;

    // Get assignments for the course
    const assignmentsResult = await pool
      .request()
      .input("courseId", sql.Int, courseId)
      .query(`
        SELECT assignment_id, title, total_marks
        FROM Assignments
        WHERE course_id = @courseId
        ORDER BY due_date
      `);

    const assignments = assignmentsResult.recordset;

    // Get quizzes for the course
    const quizzesResult = await pool
      .request()
      .input("courseId", sql.Int, courseId)
      .query(`
        SELECT quiz_id, title, total_marks
        FROM Quizzes
        WHERE course_id = @courseId
        ORDER BY due_date
      `);

    const quizzes = quizzesResult.recordset;

    // Get assignment grades
    const assignmentGradesResult = await pool
      .request()
      .input("courseId", sql.Int, courseId)
      .query(`
        SELECT s.student_id, a.assignment_id, as.marks
        FROM Students s
        JOIN Enrollments e ON s.student_id = e.student_id
        JOIN Assignments a ON a.course_id = e.course_id
        LEFT JOIN AssignmentSubmissions as ON as.assignment_id = a.assignment_id AND as.student_id = s.student_id
        WHERE e.course_id = @courseId
      `);

    // Get quiz grades
    const quizGradesResult = await pool
      .request()
      .input("courseId", sql.Int, courseId)
      .query(`
        SELECT s.student_id, q.quiz_id, qs.marks
        FROM Students s
        JOIN Enrollments e ON s.student_id = e.student_id
        JOIN Quizzes q ON q.course_id = e.course_id
        LEFT JOIN QuizSubmissions qs ON qs.quiz_id = q.quiz_id AND qs.student_id = s.student_id
        WHERE e.course_id = @courseId
      `);

    // Process grades data
    const gradesData = students.map(student => {
      const studentGrades = {
        student_id: student.student_id,
        name: student.name,
        roll_number: student.roll_number,
        assignments: {},
        quizzes: {},
        total_marks: 0,
        total_possible: 0,
        percentage: 0
      };

      // Add assignment grades
      assignments.forEach(assignment => {
        const grade = assignmentGradesResult.recordset.find(
          g => g.student_id === student.student_id && g.assignment_id === assignment.assignment_id
        );
        
        studentGrades.assignments[assignment.assignment_id] = {
          title: assignment.title,
          marks: grade ? grade.marks : null,
          total_marks: assignment.total_marks
        };

        if (grade && grade.marks !== null) {
          studentGrades.total_marks += grade.marks;
          studentGrades.total_possible += assignment.total_marks;
        }
      });

      // Add quiz grades
      quizzes.forEach(quiz => {
        const grade = quizGradesResult.recordset.find(
          g => g.student_id === student.student_id && g.quiz_id === quiz.quiz_id
        );
        
        studentGrades.quizzes[quiz.quiz_id] = {
          title: quiz.title,
          marks: grade ? grade.marks : null,
          total_marks: quiz.total_marks
        };

        if (grade && grade.marks !== null) {
          studentGrades.total_marks += grade.marks;
          studentGrades.total_possible += quiz.total_marks;
        }
      });

      // Calculate percentage
      if (studentGrades.total_possible > 0) {
        studentGrades.percentage = (studentGrades.total_marks / studentGrades.total_possible) * 100;
      }

      return studentGrades;
    });

    res.status(200).json({
      assignments,
      quizzes,
      grades: gradesData
    });
  } catch (err) {
    console.error("Error in getGrades:", err);
    next(err);
  }
}

// Update grades
exports.updateGrades = async (req, res, next) => {
  try {
    const { courseId } = req.params;
    const { grades } = req.body;
    const teacherId = req.user.id;

    // Validate input
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    if (!grades || !Array.isArray(grades) || grades.length === 0) {
      return res.status(400).json({ message: "Invalid grades data format" });
    }

    // Get database connection
    const pool = await getConnection();

    // Get teacher ID from user ID
    const teacherResult = await pool
      .request()
      .input("userId", sql.Int, teacherId)
      .query(`
        SELECT teacher_id
        FROM Teachers
        WHERE user_id = @userId
      `);

    if (teacherResult.recordset.length === 0) {
      return res.status(404).json({ message: "Teacher not found" });
    }

    const teacher_id = teacherResult.recordset[0].teacher_id;

    // Verify course belongs to teacher
    const courseResult = await pool
      .request()
      .input("courseId", sql.Int, courseId)
      .input("teacherId", sql.Int, teacher_id)
      .query(`
        SELECT course_id
        FROM Courses
        WHERE course_id = @courseId AND teacher_id = @teacherId
      `);

    if (courseResult.recordset.length === 0) {
      return res.status(403).json({ message: "Not authorized to access this course" });
    }

    // Begin transaction
    const transaction = pool.transaction();
    await transaction.begin();

    try {
      // Process each grade update
      for (const grade of grades) {
        const { student_id, assignment_id, quiz_id, marks } = grade;

        if (assignment_id) {
          // Update assignment grade
          await transaction
            .request()
            .input("assignmentId", sql.Int, assignment_id)
            .input("studentId", sql.Int, student_id)
            .input("marks", sql.Int, marks)
            .input("gradedBy", sql.Int, teacher_id)
            .query(`
              UPDATE AssignmentSubmissions
              SET marks = @marks, graded_by = @gradedBy, graded_at = GETDATE()
              WHERE assignment_id = @assignmentId AND student_id = @studentId
            `);
        } else if (quiz_id) {
          // Update quiz grade
          await transaction
            .request()
            .input("quizId", sql.Int, quiz_id)
            .input("studentId", sql.Int, student_id)
            .input("marks", sql.Int, marks)
            .input("gradedBy", sql.Int, teacher_id)
            .query(`
              UPDATE QuizSubmissions
              SET marks = @marks, graded_by = @gradedBy, graded_at = GETDATE()
              WHERE quiz_id = @quizId AND student_id = @studentId
            `);
        }
      }

      // Commit transaction
      await transaction.commit();

      res.status(200).json({
        message: "Grades updated successfully"
      });
    } catch (err) {
      // Rollback transaction on error
      await transaction.rollback();
      throw err;
    }
  } catch (err) {
    console.error("Error in updateGrades:", err);
    next(err);
  }
}

// Get notices
exports.getNotices = async (req, res, next) => {
  try {
    const teacherId = req.user.id;
    
    // Get database connection
    const pool = await getConnection();
    
    // Get teacher ID from user ID
    const teacherResult = await pool
      .request()
      .input("userId", sql.Int, teacherId)
      .query(`
        SELECT teacher_id
        FROM Teachers
        WHERE user_id = @userId
      `);
    
    if (teacherResult.recordset.length === 0) {
      return res.status(404).json({ message: "Teacher not found" });
    }
    
    const teacher_id = teacherResult.recordset[0].teacher_id;
    
    // Get notices created by this teacher
    const noticesResult = await pool
      .request()
      .input("teacherId", sql.Int, teacher_id)
      .query(`
        SELECT n.notice_id, n.title, n.content, n.created_at, n.updated_at,
               c.course_id, c.course_code, c.course_name
        FROM Notices n
        LEFT JOIN Courses c ON n.course_id = c.course_id
        WHERE n.created_by = @teacherId
        ORDER BY n.created_at DESC
      `);
    
    res.status(200).json({
      notices: noticesResult.recordset
    });
  } catch (err) {
    console.error("Error in getNotices:", err);
    next(err);
  }
}

// Create notice
exports.createNotice = async (req, res, next) => {
  try {
    const { title, content, courseId } = req.body;
    const teacherId = req.user.id;
    
    // Validate input
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    
    if (!title || !content) {
      return res.status(400).json({ message: "Title and content are required" });
    }
    
    // Get database connection
    const pool = await getConnection();
    
    // Get teacher ID from user ID
    const teacherResult = await pool
      .request()
      .input("userId", sql.Int, teacherId)
      .query(`
        SELECT teacher_id
        FROM Teachers
        WHERE user_id = @userId
      `);
    
    if (teacherResult.recordset.length === 0) {
      return res.status(404).json({ message: "Teacher not found" });
    }
    
    const teacher_id = teacherResult.recordset[0].teacher_id;
    
    // If courseId is provided, verify course belongs to teacher
    if (courseId) {
      const courseResult = await pool
        .request()
        .input("courseId", sql.Int, courseId)
        .input("teacherId", sql.Int, teacher_id)
        .query(`
          SELECT course_id
          FROM Courses
          WHERE course_id = @courseId AND teacher_id = @teacherId
        `);
      
      if (courseResult.recordset.length === 0) {
        return res.status(403).json({ message: "Not authorized to create notice for this course" });
      }
    }
    
    // Create notice
    const result = await pool
      .request()
      .input("title", sql.VarChar, title)
      .input("content", sql.VarChar, content)
      .input("courseId", sql.Int, courseId || null)
      .input("createdBy", sql.Int, teacher_id)
      .query(`
        INSERT INTO Notices (title, content, course_id, created_by)
        OUTPUT INSERTED.notice_id
        VALUES (@title, @content, @courseId, @createdBy)
      `);
    
    const noticeId = result.recordset[0].notice_id;
    
    res.status(201).json({
      message: "Notice created successfully",
      noticeId
    });
  } catch (err) {
    console.error("Error in createNotice:", err);
    next(err);
  }
}

// Get course by ID
exports.getCourseById = async (req, res, next) => {
  try {
    const courseId = req.params.id;
    const teacherId = req.user.id;

    // Get database connection
    const pool = await getConnection();

    // Get teacher ID from user ID
    const teacherResult = await pool
      .request()
      .input("userId", sql.Int, teacherId)
      .query(`
        SELECT teacher_id
        FROM Teachers
        WHERE user_id = @userId
      `);

    if (teacherResult.recordset.length === 0) {
      return res.status(404).json({ message: "Teacher not found" });
    }

    const teacher_id = teacherResult.recordset[0].teacher_id;

    // Get course details
    const courseResult = await pool
      .request()
      .input("courseId", sql.Int, courseId)
      .input("teacherId", sql.Int, teacher_id)
      .query(`
        SELECT c.course_id, c.course_code, c.course_name, c.description, 
               c.schedule, c.semester, c.academic_year, c.credits
        FROM Courses c
        WHERE c.course_id = @courseId AND c.teacher_id = @teacherId
      `);

    if (courseResult.recordset.length === 0) {
      return res.status(404).json({ message: "Course not found or not authorized" });
    }

    // Get enrollment count
    const enrollmentResult = await pool
      .request()
      .input("courseId", sql.Int, courseId)
      .query(`
        SELECT COUNT(*) as enrolled_count
        FROM Enrollments
        WHERE course_id = @courseId
      `);

    const course = {
      ...courseResult.recordset[0],
      enrolled_students: enrollmentResult.recordset[0].enrolled_count
    };

    res.status(200).json({ course });
  } catch (err) {
    console.error("Error in getCourseById:", err);
    next(err);
  }
}

// Get students by course
exports.getStudentsByCourse = async (req, res, next) => {
  try {
    const { courseId } = req.params;
    const teacherId = req.user.id;

    // Get database connection
    const pool = await getConnection();

    // Get teacher ID from user ID
    const teacherResult = await pool
      .request()
      .input("userId", sql.Int, teacherId)
      .query(`
        SELECT teacher_id
        FROM Teachers
        WHERE user_id = @userId
      `);

    if (teacherResult.recordset.length === 0) {
      return res.status(404).json({ message: "Teacher not found" });
    }

    const teacher_id = teacherResult.recordset[0].teacher_id;

    // Verify course belongs to teacher
    const courseResult = await pool
      .request()
      .input("courseId", sql.Int, courseId)
      .input("teacherId", sql.Int, teacher_id)
      .query(`
        SELECT course_id
        FROM Courses
        WHERE course_id = @courseId AND teacher_id = @teacherId
      `);

    if (courseResult.recordset.length === 0) {
      return res.status(403).json({ message: "Not authorized to access this course" });
    }

    // Get students enrolled in the course
    const studentsResult = await pool
      .request()
      .input("courseId", sql.Int, courseId)
      .query(`
        SELECT s.student_id, s.name, s.roll_number, s.email, s.department, s.semester
        FROM Students s
        JOIN Enrollments e ON s.student_id = e.student_id
        WHERE e.course_id = @courseId
        ORDER BY s.name
      `);

    res.status(200).json({
      students: studentsResult.recordset
    });
  } catch (err) {
    console.error("Error in getStudentsByCourse:", err);
    next(err);
  }
}

// Get course assignments
exports.getCourseAssignments = async (req, res, next) => {
  try {
    const { courseId } = req.params;
    const teacherId = req.user.id;

    // Get database connection
    const pool = await getConnection();

    // Get teacher ID from user ID
    const teacherResult = await pool
      .request()
      .input("userId", sql.Int, teacherId)
      .query(`
        SELECT teacher_id
        FROM Teachers
        WHERE user_id = @userId
      `);

    if (teacherResult.recordset.length === 0) {
      return res.status(404).json({ message: "Teacher not found" });
    }

    const teacher_id = teacherResult.recordset[0].teacher_id;

    // Verify course belongs to teacher
    const courseResult = await pool
      .request()
      .input("courseId", sql.Int, courseId)
      .input("teacherId", sql.Int, teacher_id)
      .query(`
        SELECT course_id
        FROM Courses
        WHERE course_id = @courseId AND teacher_id = @teacherId
      `);

    if (courseResult.recordset.length === 0) {
      return res.status(403).json({ message: "Not authorized to access this course" });
    }

    // Get assignments for the course
    const assignmentsResult = await pool
      .request()
      .input("courseId", sql.Int, courseId)
      .query(`
        SELECT a.assignment_id, a.title, a.description, a.due_date, 
               a.total_marks, a.created_at,
               (SELECT COUNT(*) FROM AssignmentSubmissions WHERE assignment_id = a.assignment_id) as submission_count
        FROM Assignments a
        WHERE a.course_id = @courseId
        ORDER BY a.due_date DESC
      `);

    res.status(200).json({
      assignments: assignmentsResult.recordset
    });
  } catch (err) {
    console.error("Error in getCourseAssignments:", err);
    next(err);
  }
}

// Create assignment
exports.createAssignment = async (req, res, next) => {
  try {
    const { courseId } = req.params;
    const { title, description, dueDate, totalMarks } = req.body;
    const teacherId = req.user.id;

    // Validate input
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    // Get database connection
    const pool = await getConnection();

    // Get teacher ID from user ID
    const teacherResult = await pool
      .request()
      .input("userId", sql.Int, teacherId)
      .query(`
        SELECT teacher_id
        FROM Teachers
        WHERE user_id = @userId
      `);

    if (teacherResult.recordset.length === 0) {
      return res.status(404).json({ message: "Teacher not found" });
    }

    const teacher_id = teacherResult.recordset[0].teacher_id;

    // Verify course belongs to teacher
    const courseResult = await pool
      .request()
      .input("courseId", sql.Int, courseId)
      .input("teacherId", sql.Int, teacher_id)
      .query(`
        SELECT course_id
        FROM Courses
        WHERE course_id = @courseId AND teacher_id = @teacherId
      `);

    if (courseResult.recordset.length === 0) {
      return res.status(403).json({ message: "Not authorized to access this course" });
    }

    // Create assignment
    const result = await pool
      .request()
      .input("courseId", sql.Int, courseId)
      .input("title", sql.VarChar, title)
      .input("description", sql.VarChar, description)
      .input("dueDate", sql.DateTime, new Date(dueDate))
      .input("totalMarks", sql.Int, totalMarks)
      .query(`
        INSERT INTO Assignments (course_id, title, description, due_date, total_marks)
        OUTPUT INSERTED.assignment_id
        VALUES (@courseId, @title, @description, @dueDate, @totalMarks)
      `);

    const assignmentId = result.recordset[0].assignment_id;

    res.status(201).json({
      message: "Assignment created successfully",
      assignmentId
    });
  } catch (err) {
    console.error("Error in createAssignment:", err);
    next(err);
  }
}

// Update assignment
exports.updateAssignment = async (req, res, next) => {
  try {
    const { courseId, assignmentId } = req.params;
    const { title, description, dueDate, totalMarks } = req.body;
    const teacherId = req.user.id;

    // Validate input
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    // Get database connection
    const pool = await getConnection();

    // Get teacher ID from user ID
    const teacherResult = await pool
      .request()
      .input("userId", sql.Int, teacherId)
      .query(`
        SELECT teacher_id
        FROM Teachers
        WHERE user_id = @userId
      `);

    if (teacherResult.recordset.length === 0) {
      return res.status(404).json({ message: "Teacher not found" });
    }

    const teacher_id = teacherResult.recordset[0].teacher_id;

    // Verify course and assignment belong to teacher
    const assignmentResult = await pool
      .request()
      .input("courseId", sql.Int, courseId)
      .input("assignmentId", sql.Int, assignmentId)
      .input("teacherId", sql.Int, teacher_id)
      .query(`
        SELECT a.assignment_id
        FROM Assignments a
        JOIN Courses c ON a.course_id = c.course_id
        WHERE a.assignment_id = @assignmentId 
          AND a.course_id = @courseId 
          AND c.teacher_id = @teacherId
      `);

    if (assignmentResult.recordset.length === 0) {
      return res.status(404).json({ message: "Assignment not found or not authorized" });
    }

    // Update assignment
    await pool
      .request()
      .input("assignmentId", sql.Int, assignmentId)
      .input("title", sql.VarChar, title)
      .input("description", sql.VarChar, description)
      .input("dueDate", sql.DateTime, new Date(dueDate))
      .input("totalMarks", sql.Int, totalMarks)
      .query(`
        UPDATE Assignments
        SET title = @title, description = @description, due_date = @dueDate, total_marks = @totalMarks
        WHERE assignment_id = @assignmentId
      `);

    res.status(200).json({
      message: "Assignment updated successfully"
    });
  } catch (err) {
    console.error("Error in updateAssignment:", err);
    next(err);
  }
}

// Delete assignment
exports.deleteAssignment = async (req, res, next) => {
  try {
    const { courseId, assignmentId } = req.params;
    const teacherId = req.user.id;

    // Get database connection
    const pool = await getConnection();

    // Get teacher ID from user ID
    const teacherResult = await pool
      .request()
      .input("userId", sql.Int, teacherId)
      .query(`
        SELECT teacher_id
        FROM Teachers
        WHERE user_id = @userId
      `);

    if (teacherResult.recordset.length === 0) {
      return res.status(404).json({ message: "Teacher not found" });
    }

    const teacher_id = teacherResult.recordset[0].teacher_id;

    // Verify course and assignment belong to teacher
    const assignmentResult = await pool
      .request()
      .input("courseId", sql.Int, courseId)
      .input("assignmentId", sql.Int, assignmentId)
      .input("teacherId", sql.Int, teacher_id)
      .query(`
        SELECT a.assignment_id
        FROM Assignments a
        JOIN Courses c ON a.course_id = c.course_id
        WHERE a.assignment_id = @assignmentId 
          AND a.course_id = @courseId 
          AND c.teacher_id = @teacherId
      `);

    if (assignmentResult.recordset.length === 0) {
      return res.status(404).json({ message: "Assignment not found or not authorized" });
    }

    // Delete assignment
    await pool
      .request()
      .input("assignmentId", sql.Int, assignmentId)
      .query(`
        DELETE FROM Assignments
        WHERE assignment_id = @assignmentId
      `);

    res.status(200).json({
      message: "Assignment deleted successfully"
    });
  } catch (err) {
    console.error("Error in deleteAssignment:", err);
    next(err);
  }
}

// Get course quizzes
exports.getCourseQuizzes = async (req, res, next) => {
  try {
    const { courseId } = req.params;
    const teacherId = req.user.id;

    // Get database connection
    const pool = await getConnection();

    // Get teacher ID from user ID
    const teacherResult = await pool
      .request()
      .input("userId", sql.Int, teacherId)
      .query(`
        SELECT teacher_id
        FROM Teachers
        WHERE user_id = @userId
      `);

    if (teacherResult.recordset.length === 0) {
      return res.status(404).json({ message: "Teacher not found" });
    }

    const teacher_id = teacherResult.recordset[0].teacher_id;

    // Verify course belongs to teacher
    const courseResult = await pool
      .request()
      .input("courseId", sql.Int, courseId)
      .input("teacherId", sql.Int, teacher_id)
      .query(`
        SELECT course_id
        FROM Courses
        WHERE course_id = @courseId AND teacher_id = @teacherId
      `);

    if (courseResult.recordset.length === 0) {
      return res.status(403).json({ message: "Not authorized to access this course" });
    }

    // Get quizzes for the course
    const quizzesResult = await pool
      .request()
      .input("courseId", sql.Int, courseId)
      .query(`
        SELECT q.quiz_id, q.title, q.description, q.due_date, 
               q.total_marks, q.duration_minutes, q.created_at,
               (SELECT COUNT(*) FROM QuizSubmissions WHERE quiz_id = q.quiz_id) as submission_count
        FROM Quizzes q
        WHERE q.course_id = @courseId
        ORDER BY q.due_date DESC
      `);

    res.status(200).json({
      quizzes: quizzesResult.recordset
    });
  } catch (err) {
    console.error("Error in getCourseQuizzes:", err);
    next(err);
  }
}

// Create quiz
exports.createQuiz = async (req, res, next) => {
  try {
    const { courseId } = req.params;
    const { title, description, dueDate, totalMarks, durationMinutes, questions } = req.body;
    const teacherId = req.user.id;

    // Validate input
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    if (!questions || !Array.isArray(questions) || questions.length === 0) {
      return res.status(400).json({ message: "Quiz must contain at least one question" });
    }

    // Get database connection
    const pool = await getConnection();

    // Get teacher ID from user ID
    const teacherResult = await pool
      .request()
      .input("userId", sql.Int, teacherId)
      .query(`
        SELECT teacher_id
        FROM Teachers
        WHERE user_id = @userId
      `);

    if (teacherResult.recordset.length === 0) {
      return res.status(404).json({ message: "Teacher not found" });
    }

    const teacher_id = teacherResult.recordset[0].teacher_id;

    // Verify course belongs to teacher
    const courseResult = await pool
      .request()
      .input("courseId", sql.Int, courseId)
      .input("teacherId", sql.Int, teacher_id)
      .query(`
        SELECT course_id
        FROM Courses
        WHERE course_id = @courseId AND teacher_id = @teacherId
      `);

    if (courseResult.recordset.length === 0) {
      return res.status(403).json({ message: "Not authorized to access this course" });
    }

    // Begin transaction
    const transaction = pool.transaction();
    await transaction.begin();

    try {
      // Create quiz
      const quizResult = await transaction
        .request()
        .input("courseId", sql.Int, courseId)
        .input("title", sql.VarChar, title)
        .input("description", sql.VarChar, description)
        .input("dueDate", sql.DateTime, new Date(dueDate))
        .input("totalMarks", sql.Int, totalMarks)
        .input("durationMinutes", sql.Int, durationMinutes)
        .query(`
          INSERT INTO Quizzes (course_id, title, description, due_date, total_marks, duration_minutes)
          OUTPUT INSERTED.quiz_id
          VALUES (@courseId, @title, @description, @dueDate, @totalMarks, @durationMinutes)
        `);

      const quizId = quizResult.recordset[0].quiz_id;

      // Add questions
      for (const [index, question] of questions.entries()) {
        const { questionText, questionType, marks, options } = question;

        const questionResult = await transaction
          .request()
          .input("quizId", sql.Int, quizId)
          .input("questionText", sql.VarChar, questionText)
          .input("questionType", sql.VarChar, questionType)
          .input("marks", sql.Int, marks)
          .input("questionOrder", sql.Int, index + 1)
          .query(`
            INSERT INTO QuizQuestions (quiz_id, question_text, question_type, marks, question_order)
            OUTPUT INSERTED.question_id
            VALUES (@quizId, @questionText, @questionType, @marks, @questionOrder)
          `);

        const questionId = questionResult.recordset[0].question_id;

        // Add options if provided
        if (options && Array.isArray(options)) {
          for (const [optIndex, option] of options.entries()) {
            const { optionText, isCorrect } = option;
            await transaction
              .request()
              .input("questionId", sql.Int, questionId)
              .input("optionText", sql.VarChar, optionText)
              .input("isCorrect", sql.Bit, isCorrect ? 1 : 0)
              .input("optionOrder", sql.Int, optIndex + 1)
              .query(`
                INSERT INTO QuestionOptions (question_id, option_text, is_correct, option_order)
                VALUES (@questionId, @optionText, @isCorrect, @optionOrder)
              `);
          }
        }
      }

      // Commit transaction
      await transaction.commit();

      res.status(201).json({
        message: "Quiz created successfully",
        quizId
      });
    } catch (err) {
      // Rollback transaction on error
      await transaction.rollback();
      throw err;
    }
  } catch (err) {
    console.error("Error in createQuiz:", err);
    next(err);
  }
}

// Delete quiz
exports.deleteQuiz = async (req, res, next) => {
  try {
    const { courseId, quizId } = req.params;
    const teacherId = req.user.id;

    // Get database connection
    const pool = await getConnection();

    // Get teacher ID from user ID
    const teacherResult = await pool
      .request()
      .input("userId", sql.Int, teacherId)
      .query(`
        SELECT teacher_id
        FROM Teachers
        WHERE user_id = @userId
      `);

    if (teacherResult.recordset.length === 0) {
      return res.status(404).json({ message: "Teacher not found" });
    }

    const teacher_id = teacherResult.recordset[0].teacher_id;

    // Verify course and quiz belong to teacher
    const quizResult = await pool
      .request()
      .input("courseId", sql.Int, courseId)
      .input("quizId", sql.Int, quizId)
      .input("teacherId", sql.Int, teacher_id)
      .query(`
        SELECT q.quiz_id
        FROM Quizzes q
        JOIN Courses c ON q.course_id = c.course_id
        WHERE q.quiz_id = @quizId 
          AND q.course_id = @courseId 
          AND c.teacher_id = @teacherId
      `);

    if (quizResult.recordset.length === 0) {
      return res.status(404).json({ message: "Quiz not found or not authorized" });
    }

    // Delete quiz
    await pool
      .request()
      .input("quizId", sql.Int, quizId)
      .query(`
        DELETE FROM Quizzes
        WHERE quiz_id = @quizId
      `);

    res.status(200).json({
      message: "Quiz deleted successfully"
    });
  } catch (err) {
    console.error("Error in deleteQuiz:", err);
    next(err);
  }
}