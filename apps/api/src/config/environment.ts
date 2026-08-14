export function validateEnvironment() {
  const production = process.env.NODE_ENV === 'production';
  const required = ['DATABASE_URL', 'JWT_SECRET', 'WEB_ORIGIN'];
  const missing = required.filter((key) => !process.env[key]?.trim());
  if (missing.length) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }
  if (production && process.env.JWT_SECRET!.length < 32) {
    throw new Error('JWT_SECRET must be at least 32 characters in production.');
  }
  if (production && /localhost|127\.0\.0\.1/.test(process.env.WEB_ORIGIN!)) {
    throw new Error('WEB_ORIGIN must use the production HTTPS domain.');
  }
  const r2Keys = ['R2_PUBLIC_URL', 'R2_ENDPOINT', 'R2_BUCKET_NAME', 'R2_ACCESS_KEY_ID', 'R2_SECRET_ACCESS_KEY'];
  const configuredR2 = r2Keys.some((key) => process.env[key]?.trim());
  if (configuredR2) {
    const missingR2 = r2Keys.filter((key) => !process.env[key]?.trim());
    if (missingR2.length) throw new Error(`R2 configuration is incomplete: ${missingR2.join(', ')}`);
  }
}
