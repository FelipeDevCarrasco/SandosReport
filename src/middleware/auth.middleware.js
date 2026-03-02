import { validateSession } from '../services/auth.service.js';

export function requireAuth(req, res, next) {
  const token = req.cookies?.auth_token;
  
  if (!validateSession(token)) {
    if (req.xhr || req.headers.accept?.includes('application/json')) {
      return res.status(401).json({ 
        success: false, 
        message: 'No autenticado' 
      });
    }
    return res.redirect('/login.html');
  }
  
  next();
}

export function redirectIfAuthenticated(req, res, next) {
  const token = req.cookies?.auth_token;
  
  if (validateSession(token)) {
    return res.redirect('/');
  }
  
  next();
}
