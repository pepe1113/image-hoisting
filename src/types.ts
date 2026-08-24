export interface Env {
  IMAGES: R2Bucket;
  ADMIN_TOKEN?: string;
  /** @deprecated Use ADMIN_TOKEN. Kept for existing deployments. */
  AUTH_TOKEN?: string;
  IMAGE_PROFILES?: string;
  PUBLIC_BASE_URL?: string;
  CORS_ORIGINS?: string;
  MAX_UPLOAD_BYTES?: string;
  [key: string]: R2Bucket | string | undefined;
}

export interface ImageProfileDefinition {
  id: string;
  label: string;
  binding: string;
  publicBaseUrl: string;
  isDefault: boolean;
}

export interface ResolvedImageProfile extends ImageProfileDefinition {
  bucket: R2Bucket;
}

export interface CorsResult {
  allowed: boolean;
  headers: Headers;
}
