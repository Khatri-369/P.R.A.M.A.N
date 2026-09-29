export function errorHandler(error, req, res, next) {
  if (res.headersSent) return next(error);
  let status = error.status || 500,
    message = error.message;
  if (error.code === 11000) {
    status = 409;
    message = "This record already exists.";
  }
  if (error.name === "ValidationError" || error.name === "CastError") {
    status = 400;
    message = "Invalid request data.";
  }
  if (error.code === "LIMIT_FILE_SIZE") {
    status = 413;
    message = "Maximum file size is 10 MB.";
  } else if (error.name === "MulterError") {
    status = 400;
    message = "Provide one evidence file in the file field.";
  }
  if (status >= 500) {
    console.error(error.name, error.code || "");
    message = "The request could not be completed. Please try again.";
  }
  res.status(status).json({ success: false, message });
}
