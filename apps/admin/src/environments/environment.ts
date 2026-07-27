export const environment = {
  production: false,
  appName: 'Zellavora Control Center',
  appVersion: '2.0.0',
  apiUrl: 'http://localhost:3000/api/v1',
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
    storageType: 'local', // 'local' | 's3' | 'gcs'
    uploadEndpoint: '/api/v1/media/upload',
  },

  // Storage (for S3 configuration)
  storage: {
    type: 'local',
    bucket: '',
    region: '',
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
    level: 'debug',
    enableConsole: true,
    enableRemote: false,
    remoteUrl: '',
  },

  // Cache
  cache: {
    enabled: true,
    duration: 3600000, // 1 hour
  },

  // Security
  security: {
    enableHttps: false,
    enableCors: true,
    corsOrigins: ['http://localhost:3000', 'http://localhost:4200'],
  },
};
