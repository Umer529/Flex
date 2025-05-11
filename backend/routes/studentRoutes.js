const express = require("express")
const router = express.Router()
const {
  getProfile,
  getCourses,
  getGrades,
  getAttendance,
  getNotices,
  getFeeStatus,
  payFee,
  enrollInCourse,
  getAvailableCourses,
} = require("../Controllers/studentController")
const { protect } = require("../middleware/authMiddleware")
const { authorize } = require("../middleware/roleCheck")

// All routes are protected and require student role
router.use(protect)
router.use(authorize("student"))

// Student routes
router.get("/profile", getProfile)
router.get("/courses", getCourses)
router.get("/grades", getGrades)
router.get("/attendance", getAttendance)
router.get("/notices", getNotices)
router.get("/fees", getFeeStatus)
router.post("/fees/:feeId/pay", payFee)
router.post("/courses/:courseId/enroll", enrollInCourse)
router.get("/available-courses", getAvailableCourses)

module.exports = router
