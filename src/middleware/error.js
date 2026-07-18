export function notFound(request, response) {
  response.status(404).json({
    success: false,
    message: `Route not found: ${request.method} ${request.originalUrl}`,
  });
}

export function errorHandler(error, _request, response, _next) {
  console.error(error);
  response.status(error.status ?? 500).json({
    success: false,
    message: error.message ?? 'Internal server error',
  });
}
