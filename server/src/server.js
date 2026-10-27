const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const dotenv = require('dotenv');

dotenv.config();

const authRoutes = require('./routes/authRoutes');
const adminRoutes = require('./routes/adminRoutes');
const coordinatorRoutes = require('./routes/coordinatorRoutes');
const mentorRoutes = require('./routes/mentorRoutes');
const notificationRoutes = require('./routes/notificationRoutes');
const ticketRoutes = require('./routes/ticketRoutes');
const placementRoutes = require('./routes/placementRoutes');
const { logSystemEvent } = require('./utils/logger');
const { seedInitialAdmin } = require('./utils/seed');

const app = express();

// Middleware
app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:5173',
  credentials: true,
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request logger for debugging (non-blocking)
app.use((req, res, next) => {
  // Only log API requests in development console
  if (req.url.startsWith('/api') && process.env.NODE_ENV !== 'production') {
    console.log(`[${req.method}] ${req.url}`);
  }
  next();
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/coordinator', coordinatorRoutes);
app.use('/api/mentor', mentorRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/tickets', ticketRoutes);
app.use('/api/placement', placementRoutes);

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.status(200).json({
    status: 'online',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
  });
});

// Centralized Error Handling Middleware (Catches and logs unexpected server errors)
app.use(async (err, req, res, next) => {
  console.error('Unhandled Application Error:', err);

  try {
    await logSystemEvent({
      level: 'error',
      isError: true,
      module: 'system',
      action: 'UNHANDLED_SERVER_EXCEPTION',
      message: err.message || 'An unhandled server exception occurred.',
      error: err,
      req,
    });
  } catch (logErr) {
    console.error('Failed to record unhandled error into SystemLog:', logErr);
  }

  const statusCode = res.statusCode === 200 ? 500 : res.statusCode;
  res.status(statusCode).json({
    success: false,
    message: err.message || 'Internal Server Error',
    stack: process.env.NODE_ENV === 'production' ? null : err.stack,
  });
});

// Connect to MongoDB & Start Server
const PORT = process.env.PORT || 5000;
const MONGODB_URI = process.env.MONGO_URI || process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/student_profiling_system';

mongoose
  .connect(MONGODB_URI)
  .then(async () => {
    console.log('Connected to MongoDB successfully.');
    // Seed initial admin account
    await seedInitialAdmin();

    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT} in ${process.env.NODE_ENV || 'development'} mode.`);
    });
  })
  .catch((err) => {
    console.error('MongoDB connection error:', err.message);
    process.exit(1);
  });
