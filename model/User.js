const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  username: {
    type: String,
    required: [true, 'Username is required'],
    unique: true,
    trim: true,
    minlength: [3, 'Username must be at least 3 characters'],
    maxlength: [30, 'Username cannot exceed 30 characters']
  },
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    trim: true,
    lowercase: true,
    validate: {
      validator: function (v) {
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
      },
      message: props => `${props.value} is not a valid email address!`
    }
  },
  password: {
    type: String,
    required: [true, 'Password is required'],
    minlength: [8, 'Password must be at least 8 characters'],
    select: false
  },
  createdAt: {
    type: Date,
    default: Date.now,
    immutable: true
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Hash password before saving
userSchema.pre('save', async function (next) {
  try {
    if (!this.isModified('password')) return next();

    if (!this.password) {
      throw new Error('Password is required');
    }

    if (this.password.length < 8) {
      throw new Error('Password must be at least 8 characters');
    }

    const salt = await bcrypt.genSalt(12);
    this.password = await bcrypt.hash(this.password, salt);
    this.updatedAt = Date.now();
    next();
  } catch (error) {
    next(error);
  }
});

// Method to compare passwords with proper error handling
userSchema.methods.comparePassword = async function (candidatePassword) {
  try {
    if (!candidatePassword) {
      throw new Error('Password is required for comparison');
    }

    // Ensure this.password exists
    if (!this.password) {
      throw new Error('Password comparison failed - user password not available');
    }

    return await bcrypt.compare(candidatePassword, this.password);
  } catch (error) {
    console.error('Password comparison error:', error.message);
    throw error; // Re-throw to handle in the route
  }
};

// Static method for finding by credentials
userSchema.statics.findByCredentials = async function (email, password) {
  try {
    if (!email || !password) {
      throw new Error('Email and password are required');
    }

    const user = await this.findOne({ email }).select('+password');
    if (!user) {
      throw new Error('Invalid login credentials');
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      throw new Error('Invalid login credentials');
    }

    return user;
  } catch (error) {
    console.error('Authentication error:', error.message);
    throw error;
  }
};

// Handle duplicate key errors
userSchema.post('save', function (error, doc, next) {
  if (error.name === 'MongoServerError' && error.code === 11000) {
    const field = Object.keys(error.keyPattern)[0];
    next(new Error(`${field} already exists`));
  } else {
    next(error);
  }
});

module.exports = mongoose.model('User', userSchema);