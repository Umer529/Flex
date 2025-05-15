const express = require("express")
const router = express.Router()
const { check } = require("express-validator")
const {
  getProfile,
  updateProfile,
  getCourses,
  getCourseById,
  getStudentsByCourse,
  getCourseAssignments,
  createAssignment,
  updateAssignment,
  deleteAssignment,
  getCourseQuizzes,
  createQuiz,
  deleteQuiz,
  getAssignments,
  getPendingAssignments,
  getRecentSubmissions,
  gradeAssignment,
  gradeQuiz,
  getAttendance,
  markAttendance,
  getGrades,
  updateGrades,
  getNotices,
  createNotice
} = require("../Controllers/teacherController")
const { protect } = require("../middleware/authMiddleware")
const { authorize } = require("../middleware/roleCheck")

// All routes are protected and require teacher role
router.use(protect)
router.use(authorize("teacher"))

// Teacher routes
router.get("/profile", getProfile)
router.put("/profile", [
  check("name").notEmpty().withMessage("Name is required"),
  check("email").isEmail().withMessage("Valid email is required")
], updateProfile)
router.get("/courses", getCourses)
router.get("/courses/:id", getCourseById)
router.get("/courses/:courseId/students", getStudentsByCourse)

// Dashboard routes
router.get("/assignments", getAssignments)
router.get("/assignments/pending", getPendingAssignments)
router.get("/assignments/submissions", getRecentSubmissions)
router.get("/notices", getNotices)
router.post("/notices", [
  check("title").notEmpty().withMessage("Title is required"),
  check("content").notEmpty().withMessage("Content is required")
], createNotice)

// Assignment routes
router.get("/courses/:courseId/assignments", getCourseAssignments)
router.post("/courses/:courseId/assignments", [
  check("title").notEmpty().withMessage("Title is required"),
  check("dueDate").isISO8601().withMessage("Valid due date is required"),
  check("totalMarks").isInt({ min: 1 }).withMessage("Total marks must be a positive integer")
], createAssignment)
router.put("/courses/:courseId/assignments/:assignmentId", [
  check("title").notEmpty().withMessage("Title is required"),
  check("dueDate").isISO8601().withMessage("Valid due date is required"),
  check("totalMarks").isInt({ min: 1 }).withMessage("Total marks must be a positive integer")
], updateAssignment)
router.delete("/courses/:courseId/assignments/:assignmentId", deleteAssignment)
router.post("/assignments/:assignmentId/students/:studentId/grade", [
  check("marks").isInt({ min: 0 }).withMessage("Marks must be a non-negative integer")
], gradeAssignment)

// Quiz routes
router.get("/courses/:courseId/quizzes", getCourseQuizzes)
router.post("/courses/:courseId/quizzes", [
  check("title").notEmpty().withMessage("Title is required"),
  check("dueDate").isISO8601().withMessage("Valid due date is required"),
  check("totalMarks").isInt({ min: 1 }).withMessage("Total marks must be a positive integer"),
  check("durationMinutes").isInt({ min: 1 }).withMessage("Duration must be a positive integer")
], createQuiz)
router.delete("/courses/:courseId/quizzes/:quizId", deleteQuiz)
router.post("/quizzes/:quizId/students/:studentId/grade", [
  check("marks").isInt({ min: 0 }).withMessage("Marks must be a non-negative integer")
], gradeQuiz)

// Attendance routes
router.get("/courses/:courseId/attendance", getAttendance)
router.post("/courses/:courseId/attendance", [
  check("date").isISO8601().withMessage("Valid date is required"),
  check("attendanceData").isArray().withMessage("Attendance data must be an array")
], markAttendance)

// Grades routes
router.get("/courses/:courseId/grades", getGrades)
router.post("/courses/:courseId/grades", [
  check("grades").isArray().withMessage("Grades data must be an array")
], updateGrades)

module.exports = router