// middleware/errorMiddleware.js

/**
 * Middleware untuk menangani Not Found (404) errors.
 * Ini akan berjalan jika tidak ada route handler lain yang cocok.
 */
const notFound = (req, res, next) => {
    const error = new Error(`Not Found - ${req.originalUrl}`);
    res.status(404);
    next(error);
  };
  
  /**
   * Middleware error handler terpusat.
   * Ini akan menangkap semua error yang dilempar di dalam aplikasi.
   * Memastikan semua response error dikirim dalam format JSON.
   */
  const errorHandler = (err, req, res, next) => {
    // Terkadang error datang dengan statusCode 200, kita ubah ke 500 jika begitu
    let statusCode = res.statusCode === 200 ? 500 : res.statusCode;
    let message = err.message;
  
    // Khusus untuk Mongoose CastError (e.g., ObjectId tidak valid)
    if (err.name === 'CastError' && err.kind === 'ObjectId') {
      statusCode = 404;
      message = 'Resource not found';
    }
  
    // Khusus untuk Mongoose Duplicate Key Error
    if (err.code === 11000) {
      statusCode = 400; // Bad Request
      const field = Object.keys(err.keyValue);
      message = `Duplicate field value entered for: ${field}. Please use another value.`;
    }
  
    res.status(statusCode).json({
      message: message,
      // Hanya tampilkan stack trace jika kita tidak dalam mode production
      stack: process.env.NODE_ENV === 'production' ? null : err.stack,
    });
  };
  
  module.exports = { notFound, errorHandler };
  