// middleware/asyncHandler.js

/**
 * Wrapper untuk fungsi async route handler.
 * Menangkap error dan meneruskannya ke error handler Express.
 * Ini menghilangkan kebutuhan blok try-catch di setiap controller.
 * @param {Function} fn - Fungsi controller async yang akan dieksekusi.
 */
const asyncHandler = (fn) => (req, res, next) =>
    Promise.resolve(fn(req, res, next)).catch(next);
  
  module.exports = asyncHandler;
  