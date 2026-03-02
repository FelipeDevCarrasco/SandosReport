import dotenv from 'dotenv';
import { configureExpress } from './config/express.js';
import routes from './routes/index.js';

dotenv.config();

const PORT = process.env.PORT || 3000;
const app = configureExpress();

app.use('/api', routes);

app.listen(PORT, () => {
  console.log(`=== Servidor Sandos Report ===`);
  console.log(`Servidor corriendo en http://localhost:${PORT}`);
  console.log(`Abre tu navegador y visita la URL para usar la aplicación\n`);
});

