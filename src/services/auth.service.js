import crypto from 'crypto';

const SESSION_SECRET = process.env.SESSION_SECRET || 'sandos-report-secret-2024';

const activeSessions = new Map();

export function validateCredentials(email, password) {
  const validUser = process.env.AUTH_USER || 'bodega@sandos.cl';
  const validPassword = process.env.AUTH_PASSWORD || 'bodega123';
  
  return email === validUser && password === validPassword;
}

export function createSession(email) {
  const token = crypto.randomBytes(32).toString('hex');
  const session = {
    email,
    createdAt: Date.now(),
    expiresAt: Date.now() + (24 * 60 * 60 * 1000)
  };
  
  activeSessions.set(token, session);
  return token;
}

export function validateSession(token) {
  if (!token) return false;
  
  const session = activeSessions.get(token);
  if (!session) return false;
  
  if (Date.now() > session.expiresAt) {
    activeSessions.delete(token);
    return false;
  }
  
  return true;
}

export function destroySession(token) {
  if (token) {
    activeSessions.delete(token);
  }
}

export function getSessionUser(token) {
  const session = activeSessions.get(token);
  return session ? session.email : null;
}
