import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import path from 'path';
import { fileURLToPath } from 'url';
import { validateSession } from '../services/auth.service.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export function configureExpress() {
  const app = express();
  
  app.use(cors());
  app.use(express.json());
  app.use(cookieParser());
  
  app.get('/login.html', (req, res, next) => {
    const token = req.cookies?.auth_token;
    if (validateSession(token)) {
      return res.redirect('/');
    }
    next();
  });
  
  app.use('/login.html', express.static(path.join(__dirname, '../../public/login.html')));
  
  app.get('/', (req, res, next) => {
    const token = req.cookies?.auth_token;
    if (!validateSession(token)) {
      return res.redirect('/login.html');
    }
    next();
  });
  
  app.use((req, res, next) => {
    const publicPaths = ['/login.html', '/styles.css', '/api/auth/login'];
    const isPublic = publicPaths.some(p => req.path === p || req.path.startsWith('/api/auth'));
    
    if (isPublic) {
      return next();
    }
    
    const token = req.cookies?.auth_token;
    if (!validateSession(token)) {
      if (req.path.startsWith('/api/')) {
        return res.status(401).json({ success: false, message: 'No autenticado' });
      }
      return res.redirect('/login.html');
    }
    
    next();
  });
  
  app.use(express.static(path.join(__dirname, '../../public')));
  
  return app;
}

