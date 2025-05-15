const express = require("express")
const router = express.Router()
const {
  getProfile,
  updateProfile,
  getUsers,
  createUser,
  updateUser,
  deleteUser,
  getCourses,
  createCourse,
  updateCourse,
  deleteCourse,
  generateReports,
  manageFees,
  postNotice,
  getNotices,
  getDepartments
} = require("../Controllers/managementController")
const { protect } = require("../middleware/authMiddleware")
const { authorize } = require("../middleware/roleCheck")

// All routes are protected and require management role
router.use(protect)
router.use(authorize("management"))

// Dashboard route
router.get("/dashboard", generateReports)

// Profile routes
router.get("/profile", getProfile)
router.put("/profile", updateProfile)

// User management routes
router.get("/users", getUsers)
router.post("/users", createUser)
router.put("/users/:id", updateUser)
router.delete("/users/:id", deleteUser)

// Course management routes
router.get("/courses", getCourses)
router.post("/courses", createCourse)
router.put("/courses/:id", updateCourse)
router.delete("/courses/:id", deleteCourse)

// Report generation routes
router.get("/reports/:reportType", generateReports)

// Fee management routes
router.post("/fees/:action", manageFees)
router.get("/fees/:action", manageFees)

// Notice board routes
router.post("/notices", postNotice)
router.get("/notices", getNotices)

// Department routes
router.get("/departments", getDepartments)

module.exports = router