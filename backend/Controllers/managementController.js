const { getConnection, sql, executeStoredProcedure } = require("../config/db")

// Get management profile
exports.getProfile = async (req, res, next) => {
  try {
    const userId = req.user.id

    // Get database connection
    const pool = await getConnection()

    // Get management profile data
    const result = await pool
      .request()
      .input("userId", sql.Int, userId)
      .query(`
        SELECT m.management_id, m.name, m.email, m.phone_number,
               u.domain_id, u.role, u.created_at
        FROM Management m
        JOIN Users u ON m.user_id = u.user_id
        WHERE m.user_id = @userId
      `)

    if (result.recordset.length === 0) {
      return res.status(404).json({ message: "Management profile not found" })
    }

    // Return management profile data
    res.status(200).json({
      user: result.recordset[0]
    })
  } catch (err) {
    console.error("Error in getProfile:", err)
    next(err)
  }
}

// Update management profile
exports.updateProfile = async (req, res, next) => {
  try {
    const userId = req.user.id
    const { name, email, phone_number } = req.body

    // Get database connection
    const pool = await getConnection()

    // Update management profile
    await pool
      .request()
      .input("userId", sql.Int, userId)
      .input("name", sql.VarChar, name)
      .input("email", sql.VarChar, email)
      .input("phone_number", sql.VarChar, phone_number || null)
      .query(`
        UPDATE Management
        SET name = @name, email = @email, phone_number = @phone_number
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

// Get users
exports.getUsers = async (req, res, next) => {
  try {
    // Get database connection
    const pool = await getConnection()

    // Get all users with their details
    const result = await pool.request().query(`
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
      ORDER BY u.created_at DESC
    `)

    res.status(200).json({
      users: result.recordset,
    })
  } catch (err) {
    console.error("Error in getUsers:", err)
    next(err)
  }
}

// Create user
exports.createUser = async (req, res, next) => {
  try {
    // Sample implementation
    res.status(201).json({
      message: "User created successfully"
    })
  } catch (err) {
    console.error("Error in createUser:", err)
    next(err)
  }
}

// Update user
exports.updateUser = async (req, res, next) => {
  try {
    // Sample implementation
    res.status(200).json({
      message: "User updated successfully"
    })
  } catch (err) {
    console.error("Error in updateUser:", err)
    next(err)
  }
}

// Delete user
exports.deleteUser = async (req, res, next) => {
  try {
    // Sample implementation
    res.status(200).json({
      message: "User deleted successfully"
    })
  } catch (err) {
    console.error("Error in deleteUser:", err)
    next(err)
  }
}

// Get courses
exports.getCourses = async (req, res, next) => {
  try {
    // Get database connection
    const pool = await getConnection()

    // Get all courses with teacher names
    const result = await pool.request().query(`
      SELECT c.course_id as id, c.course_code as code, c.course_name as name, 
             c.schedule, t.name as teacher_name,
             COUNT(e.student_id) as enrolled_students
      FROM Courses c
      LEFT JOIN Teachers t ON c.teacher_id = t.teacher_id
      LEFT JOIN Enrollments e ON c.course_id = e.course_id
      GROUP BY c.course_id, c.course_code, c.course_name, c.schedule, t.name
      ORDER BY c.course_code
    `)

    res.status(200).json({
      courses: result.recordset,
    })
  } catch (err) {
    console.error("Error in getCourses:", err)
    next(err)
  }
}

// Create course
exports.createCourse = async (req, res, next) => {
  try {
    const { course_code, course_name, schedule, teacher_id } = req.body
    
    // Get database connection
    const pool = await getConnection()
    
    // Check if course code already exists
    const existingCourse = await pool
      .request()
      .input("courseCode", sql.VarChar, course_code)
      .query(`
        SELECT course_id FROM Courses WHERE course_code = @courseCode
      `)
    
    if (existingCourse.recordset.length > 0) {
      return res.status(400).json({ message: "Course code already exists" })
    }
    
    // Insert course into database
    const result = await pool
      .request()
      .input("courseCode", sql.VarChar, course_code)
      .input("courseName", sql.VarChar, course_name)
      .input("schedule", sql.VarChar, schedule || null)
      .input("teacherId", sql.Int, teacher_id ? parseInt(teacher_id) : null)
      .query(`
        INSERT INTO Courses (course_code, course_name, schedule, teacher_id)
        VALUES (@courseCode, @courseName, @schedule, @teacherId);
        
        SELECT SCOPE_IDENTITY() AS course_id;
      `)
    
    const courseId = result.recordset[0].course_id
    
    res.status(201).json({
      message: "Course created successfully",
      courseId: courseId
    })
  } catch (err) {
    console.error("Error in createCourse:", err)
    next(err)
  }
}

// Update course
exports.updateCourse = async (req, res, next) => {
  try {
    const courseId = req.params.id
    const { course_code, course_name, schedule, teacher_id } = req.body
    
    // Get database connection
    const pool = await getConnection()
    
    // Check if course exists
    const existingCourse = await pool
      .request()
      .input("courseId", sql.Int, courseId)
      .query(`
        SELECT course_id FROM Courses WHERE course_id = @courseId
      `)
    
    if (existingCourse.recordset.length === 0) {
      return res.status(404).json({ message: "Course not found" })
    }
    
    // Check if updated course code already exists for another course
    if (course_code) {
      const duplicateCode = await pool
        .request()
        .input("courseCode", sql.VarChar, course_code)
        .input("courseId", sql.Int, courseId)
        .query(`
          SELECT course_id FROM Courses 
          WHERE course_code = @courseCode AND course_id != @courseId
        `)
      
      if (duplicateCode.recordset.length > 0) {
        return res.status(400).json({ message: "Course code already exists" })
      }
    }
    
    // Update course in database
    await pool
      .request()
      .input("courseId", sql.Int, courseId)
      .input("courseCode", sql.VarChar, course_code)
      .input("courseName", sql.VarChar, course_name)
      .input("schedule", sql.VarChar, schedule || null)
      .input("teacherId", sql.Int, teacher_id ? parseInt(teacher_id) : null)
      .query(`
        UPDATE Courses
        SET course_code = @courseCode,
            course_name = @courseName,
            schedule = @schedule,
            teacher_id = @teacherId
        WHERE course_id = @courseId
      `)
    
    res.status(200).json({
      message: "Course updated successfully"
    })
  } catch (err) {
    console.error("Error in updateCourse:", err)
    next(err)
  }
}

// Delete course
exports.deleteCourse = async (req, res, next) => {
  try {
    const courseId = req.params.id
    
    // Get database connection
    const pool = await getConnection()
    
    // Check if course exists
    const existingCourse = await pool
      .request()
      .input("courseId", sql.Int, courseId)
      .query(`
        SELECT course_id FROM Courses WHERE course_id = @courseId
      `)
    
    if (existingCourse.recordset.length === 0) {
      return res.status(404).json({ message: "Course not found" })
    }
    
    // Check if course has enrollments
    const enrollments = await pool
      .request()
      .input("courseId", sql.Int, courseId)
      .query(`
        SELECT COUNT(*) as count FROM Enrollments WHERE course_id = @courseId
      `)
    
    if (enrollments.recordset[0].count > 0) {
      // Delete enrollments first
      await pool
        .request()
        .input("courseId", sql.Int, courseId)
        .query(`
          DELETE FROM Enrollments WHERE course_id = @courseId
        `)
    }
    
    // Check and delete related assignments
    await pool
      .request()
      .input("courseId", sql.Int, courseId)
      .query(`
        DELETE FROM Assignments WHERE course_id = @courseId
      `)
    
    // Check and delete related quizzes
    await pool
      .request()
      .input("courseId", sql.Int, courseId)
      .query(`
        DELETE FROM Quizzes WHERE course_id = @courseId
      `)
    
    // Delete course
    await pool
      .request()
      .input("courseId", sql.Int, courseId)
      .query(`
        DELETE FROM Courses WHERE course_id = @courseId
      `)
    
    res.status(200).json({
      message: "Course deleted successfully"
    })
  } catch (err) {
    console.error("Error in deleteCourse:", err)
    next(err)
  }
}

// Generate reports
exports.generateReports = async (req, res, next) => {
  try {
    // Sample implementation
    res.status(200).json({
      message: "Reports generated successfully"
    })
  } catch (err) {
    console.error("Error in generateReports:", err)
    next(err)
  }
}

// Manage fees
exports.manageFees = async (req, res, next) => {
  try {
    // Sample implementation
    res.status(200).json({
      message: "Fees managed successfully"
    })
  } catch (err) {
    console.error("Error in manageFees:", err)
    next(err)
  }
}

// Post notice
exports.postNotice = async (req, res, next) => {
  try {
    const { title, content } = req.body
    const userId = req.user.id
    
    // Get database connection
    const pool = await getConnection()
    
    // Get management ID for the current user
    const managementResult = await pool
      .request()
      .input("userId", sql.Int, userId)
      .query(`
        SELECT management_id FROM Management WHERE user_id = @userId
      `)
    
    if (managementResult.recordset.length === 0) {
      return res.status(404).json({ message: "Management profile not found" })
    }
    
    const managementId = managementResult.recordset[0].management_id
    
    // Insert notice into database
    await pool
      .request()
      .input("title", sql.VarChar, title)
      .input("content", sql.VarChar, content)
      .input("postedBy", sql.Int, managementId)
      .input("postedByRole", sql.VarChar, "management")
      .query(`
        INSERT INTO Notices (title, content, posted_by, posted_by_role, created_at)
        VALUES (@title, @content, @postedBy, @postedByRole, GETDATE())
      `)
    
    res.status(201).json({
      message: "Notice posted successfully"
    })
  } catch (err) {
    console.error("Error in postNotice:", err)
    next(err)
  }
}

// Get notices
exports.getNotices = async (req, res, next) => {
  try {
    // Get database connection
    const pool = await getConnection()

    // Get all notices
    const result = await pool.request().query(`
      SELECT n.notice_id as id, n.title, n.content, n.created_at, 
             CASE 
               WHEN n.posted_by_role = 'management' THEN m.name
               WHEN n.posted_by_role = 'teacher' THEN t.name
             END as posted_by
      FROM Notices n
      LEFT JOIN Management m ON n.posted_by = m.management_id AND n.posted_by_role = 'management'
      LEFT JOIN Teachers t ON n.posted_by = t.teacher_id AND n.posted_by_role = 'teacher'
      ORDER BY n.created_at DESC
    `)

    res.status(200).json({
      notices: result.recordset
    })
  } catch (err) {
    console.error("Error in getNotices:", err)
    next(err)
  }
}

// Get departments
exports.getDepartments = async (req, res, next) => {
  try {
    // Sample implementation
    res.status(200).json({
      departments: ["CS", "IT", "Math", "Physics", "SE"]
    })
  } catch (err) {
    console.error("Error in getDepartments:", err)
    next(err)
  }
}