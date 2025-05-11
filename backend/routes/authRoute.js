const express = require("express")
const router = express.Router()
const {
  register,
  login,
  getCurrentUser,
  changePassword,
  forgotPassword,
  resetPassword,
} = require("../Controllers/authController")
const { protect } = require("../middleware/authMiddleware")

// Public routes
router.post("/register", register)
router.post("/login", login)
router.post("/forgot-password", forgotPassword)
router.post("/reset-password", resetPassword)

// Protected routes
router.get("/me", protect, getCurrentUser)
router.put("/change-password", protect, changePassword)

module.exports = router
