// Security configuration and utilities

export const SECURITY_CONFIG = {
  // Allowed domains for authentication redirects
  ALLOWED_DOMAINS: [
    'localhost',
    'black-george-console.pages.dev',
    'georgemogga.com'
  ],
  
  // Session configuration
  SESSION_TIMEOUT: 24 * 60 * 60 * 1000, // 24 hours in milliseconds
  
  // OAuth security settings
  OAUTH_SETTINGS: {
    access_type: 'online',
    prompt: 'select_account',
    include_granted_scopes: true
  }
};

export function validateDomain(domain: string): boolean {
  return SECURITY_CONFIG.ALLOWED_DOMAINS.includes(domain);
}

export function sanitizeRedirectUrl(url: string): string {
  try {
    const parsedUrl = new URL(url);
    
    // Only allow HTTPS in production (except localhost)
    if (process.env.NODE_ENV === 'production' && parsedUrl.protocol !== 'https:') {
      if (!parsedUrl.hostname.includes('localhost')) {
        throw new Error('Only HTTPS URLs allowed in production');
      }
    }
    
    // Validate domain
    if (!validateDomain(parsedUrl.hostname)) {
      throw new Error('Domain not in allowlist');
    }
    
    return url;
  } catch (error) {
    console.error('Invalid redirect URL:', error);
    // Return safe default
    return process.env.NODE_ENV === 'production' 
      ? 'https://georgemogga.com/' 
      : 'http://localhost:3000/';
  }
}

export function clearSensitiveData(): void {
  if (typeof window !== 'undefined') {
    // Clear any sensitive data from localStorage that might be left behind
    const sensitiveKeys = ['access_token', 'refresh_token', 'id_token'];
    sensitiveKeys.forEach(key => {
      localStorage.removeItem(key);
      sessionStorage.removeItem(key);
    });
  }
}

export function generateSecureState(): string {
  // Generate a secure random state for OAuth CSRF protection
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
}