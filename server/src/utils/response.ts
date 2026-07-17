// src/utils/response.ts
interface ApiResponse<T = any> {
  success: boolean;
  message: string;
  data?: T;
}

export function successResponse<T>(message: string, data?: T): ApiResponse<T> {
  return {
    success: true,
    message,
    data,
  };
}

export function errorResponse(message: string, statusCode: number = 400) {
  return {
    success: false,
    message,
    statusCode,
  };
}
