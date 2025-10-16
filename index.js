const express = require('express');
const app = express();
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');
const allowedOrigins = ['http://localhost:3000', 'http://localhost:3002', 'http://192.168.18.252:3002', 'http://172.17.224.1:3002' , 'https://grocery-store-ecommerce-axw5.vercel.app'];

dotenv.config();

// Middleware
app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);

    if (allowedOrigins.indexOf(origin) === -1) {
      const msg = `The CORS policy for this site does not allow access from the specified Origin: ${origin}`;
      return callback(new Error(msg), false);
    }
    return callback(null, true);
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true // If you need to allow cookies/authentication
}));
app.use(express.json())
app.use(express.urlencoded({ extended: true }));

// Routes
const categoryRoutes = require('./routes/category');
const subcategoryRoutes = require('./routes/subcategory')
const productRoutes = require('./routes/products');
const reviewRoutes = require('./routes/reviewRoutes');
const authRoutes = require('./routes/auth');


// Database Connection
mongoose.connect(process.env.CONNECTION_STRING)
  .then(() => console.log('MongoDB Connected'))
  .catch(err => console.error('MongoDB Connection Error:', err));

// Route Mounting (Fixed)
app.use('/api/categories', categoryRoutes);
app.use('/api/subcategories', subcategoryRoutes);
app.use('/api/products', productRoutes);
app.use('/api/reviews', reviewRoutes);
app.use('/api/auth', authRoutes);

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));


