import { 
  validateCredentials, 
  createSession, 
  destroySession 
} from '../services/auth.service.js';

export async function login(req, res) {
  try {
    const { email, password } = req.body;
    
    if (!email || !password) {
      return res.status(400).json({ 
        success: false, 
        message: 'Usuario y contraseña son requeridos' 
      });
    }
    
    const isValid = validateCredentials(email, password);
    
    if (!isValid) {
      return res.status(401).json({ 
        success: false, 
        message: 'Credenciales inválidas' 
      });
    }
    
    const token = createSession(email);
    
    res.cookie('auth_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 24 * 60 * 60 * 1000,
      sameSite: 'strict'
    });
    
    return res.json({ 
      success: true, 
      message: 'Inicio de sesión exitoso' 
    });
    
  } catch (error) {
    console.error('Error en login:', error);
    return res.status(500).json({ 
      success: false, 
      message: 'Error interno del servidor' 
    });
  }
}

export async function logout(req, res) {
  try {
    const token = req.cookies?.auth_token;
    destroySession(token);
    
    res.clearCookie('auth_token');
    return res.json({ 
      success: true, 
      message: 'Sesión cerrada correctamente' 
    });
    
  } catch (error) {
    console.error('Error en logout:', error);
    return res.status(500).json({ 
      success: false, 
      message: 'Error interno del servidor' 
    });
  }
}

export async function checkAuth(req, res) {
  return res.json({ 
    success: true, 
    authenticated: true 
  });
}
