export const environment = {
  production: true,
  appName: 'Zellavora Control Center',
  appVersion: '2.0.0',
  apiUrl: 'https://api.zellavora.com/api/v1',
  apiTimeout: 30000,

  // Authentication
  auth: {
    enabled: true,
    tokenEndpoint: '/api/v1/auth/login',
    refreshEndpoint: '/api/v1/auth/refresh',
    meEndpoint: '/api/v1/auth/me',
    logoutEndpoint: '/api/v1/auth/logout',
    mfaEndpoint: '/api/v1/auth/mfa',
  },

  // File Upload
  fileUpload: {
    maxFileSize: 50 * 1024 * 1024, // 50MB
    allowedTypes: [
      'image/jpeg',
      'image/png',
      'image/gif',
      'image/webp',
      'video/mp4',
      'video/webm',
      'application/pdf',
      'text/plain',
    ],
    storageType: 's3', // 'local' | 's3' | 'gcs'
    uploadEndpoint: '/api/v1/media/upload',
  },

  // Storage (for S3 configuration)
  storage: {
    type: 's3',
    bucket: 'zellavora-media',
    region: 'us-east-1',
    accessKeyId: '',
    secretAccessKey: '',
  },

  // Features
  features: {
    portfolio: true,
    dashboard: true,
    users: true,
    blog: true,
    media: true,
    analytics: true,
    admin: true,
    settings: true,
  },

  // Logging
  logging: {
    level: 'info',
    enableConsole: false,
    enableRemote: true,
    remoteUrl: 'https://logs.zellavora.com',
  },

  // Cache
  cache: {
    enabled: true,
    duration: 86400000, // 24 hours
  },

  // Security
  security: {
    enableHttps: true,
    enableCors: true,
    corsOrigins: ['https://zellavora.com', 'https://app.zellavora.com'],
  },
};
