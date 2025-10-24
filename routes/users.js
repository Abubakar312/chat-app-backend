const express = require('express');
const router = express.Router();
const User = require('../models/user');
const authMiddleware = require('../middleware/auth');

// @route   GET /api/users
// @desc    Get all users (for inviting to groups)
// @access  Private
router.get('/', authMiddleware, async (req, res) => {
  try {
    // Find all users but exclude the password field
    // Also, don't send the current user back in the list
    const users = await User.find({ _id: { $ne: req.user.id } }).select('-password');
    res.json(users);
  } catch (error) {
    console.error(error.message);
    res.status(500).send('Server Error');
  }
});

module.exports = router;
