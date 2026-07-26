export function jsonResponse<T>(data: T, status = 200, headers?: Record<string, string>) {
  const body = JSON.stringify({
    success: true,
    data,
    meta: {
      timestamp: new Date().toISOString(),
      version: '1.0.0',
    },
  });

  return new Response(body, {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-tenant-id',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS, PATCH',
      ...headers,
    },
  });
}

export function errorResponse(errorObj: { message: string; code: string; statusCode: number; details?: any }) {
  const body = JSON.stringify({
    success: false,
    error: {
      message: errorObj.message,
      code: errorObj.code,
      statusCode: errorObj.statusCode,
      details: errorObj.details,
    },
    meta: {
      timestamp: new Date().toISOString(),
      version: '1.0.0',
    },
  });

  return new Response(body, {
    status: errorObj.statusCode,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-tenant-id',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS, PATCH',
    },
  });
}

export function corsResponse() {
  return new Response('ok', {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-tenant-id',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS, PATCH',
    },
  });
}
