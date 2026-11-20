export interface Env {
  IMAGES: R2Bucket;
  ACCESS_TEAM_DOMAIN?: string;
  ACCESS_AUD?: string;
  ACCESS_ALLOWED_EMAILS?: string;
  ACCESS_DEV_EMAIL?: string;
  IMAGE_PROFILES?: string | unknown[];
  DEFAULT_PROFILE_LABEL?: string;
  PUBLIC_BASE_URL?: string;
  CORS_ORIGINS?: string;
  MAX_UPLOAD_BYTES?: string;
  [key: string]: R2Bucket | string | unknown[] | undefined;
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
