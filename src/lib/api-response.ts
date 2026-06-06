import { NextResponse } from "next/server"

export interface ApiErrorBody {
  error: {
    message: string
    code: string
    timestamp: string
  }
}

export function apiError(
  message: string,
  code: string,
  status = 500
): NextResponse<ApiErrorBody> {
  return NextResponse.json(
    {
      error: {
        message,
        code,
        timestamp: new Date().toISOString(),
      },
    },
    { status }
  )
}

export function apiSuccess<T>(data: T, status = 200): NextResponse<T> {
  return NextResponse.json(data, { status })
}
