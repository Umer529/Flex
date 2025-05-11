const express = require("express")
const router = express.Router()
const {
  getProfile,
  getCourses,
  getCourseStudents,
  updateGrade,
  takeAttendance,
  createAssignment,
  postNotice,
  getCourseAssignments,
  updateGrades,
  getCourseAttendance,
  getStudentProgress,
  createQuiz,
} = require("../Controllers/teacherController")
const { protect } = require("../middleware/authMiddleware")
const { authorize } = require("../middleware/roleCheck")

// All routes are protected and require teacher role
router.use(protect)
router.use(authorize("teacher"))

// Teacher routes
router.get("/profile", getProfile)
router.get("/courses", getCourses)
router.get("/courses/:courseId/students", getCourseStudents)
router.put("/grades/:gradeId", updateGrade)
router.post("/courses/:courseId/attendance", takeAttendance)
router.post("/courses/:courseId/assignments", createAssignment)
router.post("/notices", postNotice)
router.get("/courses/:courseId/assignments", getCourseAssignments)
router.put("/courses/:courseId/components/:componentName/grades", updateGrades)
router.get("/courses/:courseId/attendance", getCourseAttendance)
router.get("/courses/:courseId/students/:studentId/progress", getStudentProgress)
router.post("/courses/:courseId/quizzes", createQuiz)

module.exports = router
