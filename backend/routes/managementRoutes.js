const express = require("express")
const router = express.Router()
const {
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
  systemConfig,
} = require("../Controllers/managementController")
const { protect } = require("../middleware/authMiddleware")
const { authorize } = require("../middleware/roleCheck")

// All routes are protected and require management role
router.use(protect)
router.use(authorize("management"))

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

// Notice board routes
router.post("/notices", postNotice)

// System configuration routes
router.post("/system-config", systemConfig)

module.exports = router
