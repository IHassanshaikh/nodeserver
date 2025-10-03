const express = require('express');
const router = express.Router();
const User = require('../model/User');
const jwt = require('jsonwebtoken');

// Signup route with improved error handling
// In your auth routes file
router.post('/signup', async (req, res) => {
  try {
    const { username, email, password } = req.body;

    // Basic validation - ensure JSON response
    if (!username || !email || !password) {
      return res.status(400).json({
        success: false,
        message: 'All fields are required'
      });
    }

    // Validate email format
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({
        success: false,
        message: 'Please enter a valid email address'
      });
    }

    // Check if user exists
    const existingUser = await User.findOne({ $or: [{ email }, { username }] });
    if (existingUser) {
      const message = existingUser.email === email
        ? 'Email already in use'
        : 'Username already taken';
      return res.status(400).json({
        success: false,
        message
      });
    }

    // Create new user
    const user = new User({ username, email, password });
    await user.save();

    // Create token
    const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, {
      expiresIn: '1d'
    });

    // Ensure JSON response
    return res.status(201).json({
      success: true,
      message: 'User created successfully',
      token,
      user: {
        id: user._id,
        username: user.username,
        email: user.email
      }
    });

  } catch (error) {
    console.error('Signup error:', error);
    // Ensure error response is JSON
    return res.status(500).json({
      success: false,
      message: error.message || 'Registration failed'
    });
  }
});

// Login route with improved error handling
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    // Basic validation
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Email and password are required'
      });
    }

    // Find user WITH password field
    const user = await User.findOne({ email }).select('+password');
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    // Compare passwords
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    // Create token (remove password from user object first)
    const userWithoutPassword = user.toObject();
    delete userWithoutPassword.password;

    const token = jwt.sign(
      { userId: user._id },
      process.env.JWT_SECRET,
      { expiresIn: '1d' }
    );

    res.json({
      success: true,
      token,  // JWT token
      user: {
        _id: user._id,
        username: user.username,
        email: user.email
      }
    });

  } catch (error) {
    console.error('Login error:', error.message);
    res.status(500).json({
      success: false,
      message: 'Authentication failed. Please try again.'
    });
  }
});

module.exports = router;