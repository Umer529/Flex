// Check user role
exports.authorize = (...roles) => {
    return (req, res, next) => {
      if (!req.user) {
        return res.status(401).json({
          message: "Not authorized to access this route",
        })
      }
  
      if (!roles.includes(req.user.role)) {
        return res.status(403).json({
          message: `User role ${req.user.role} is not authorized to access this route`,
        })
      }
  
      next()
    }
  }
  