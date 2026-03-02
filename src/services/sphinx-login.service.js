/**
 * Login automático a Sphinx mediante Puppeteer (web scraping).
 * Obtiene las cookies de sesión tras iniciar sesión.
 *
 * Requisitos: npm install puppeteer
 * En Docker: ver README para instalar dependencias de Chromium
 */

import fetch from 'node-fetch';

const MAX_LOGIN_RETRIES = 3;
const RETRY_DELAY_MS = 2000;
const POST_LOGIN_DELAY_MS = 3000;

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export async function loginSphinxWithPuppeteer(retryCount = 0) {
  const puppeteer = await import('puppeteer').catch(() => null);
  if (!puppeteer) {
    throw new Error('Puppeteer no está instalado. Ejecuta: npm install puppeteer');
  }

  const baseUrl = (process.env.SPHINX_BASE_URL || 'https://sandos.sphinx.cl').replace(/\/$/, '');
  const loginUrl = process.env.SPHINX_LOGIN_URL || `${baseUrl}/`;
  const user = process.env.SPHINX_USER;
  const password = process.env.SPHINX_PASSWORD;

  if (!user || !password) {
    throw new Error('SPHINX_USER y SPHINX_PASSWORD deben estar en .env para login automático');
  }

  console.log(`🔐 Iniciando login Sphinx (intento ${retryCount + 1}/${MAX_LOGIN_RETRIES})...`);

  let browser;
  try {
    browser = await puppeteer.default.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu'
      ],
      executablePath: process.env.PUPPETEER_EXECUTABLE_PATH
    });

    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

    console.log(`🌐 Navegando a ${loginUrl}...`);
    await page.goto(loginUrl, { waitUntil: 'networkidle2', timeout: 30000 });

    const userSelector = process.env.SPHINX_USER_SELECTOR || 'form input:nth-of-type(2)';
    const passwordSelector = process.env.SPHINX_PASSWORD_SELECTOR || '#password';
    const submitSelector = process.env.SPHINX_SUBMIT_SELECTOR || '#btnSubmit';

    console.log('📝 Ingresando credenciales...');
    await page.waitForSelector(userSelector, { timeout: 10000 });
    await page.type(userSelector, user, { delay: 50 });

    await page.waitForSelector(passwordSelector, { timeout: 5000 });
    await page.type(passwordSelector, password, { delay: 50 });

    console.log('🔘 Enviando formulario...');
    await Promise.all([
      page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 20000 }).catch(() => {}),
      page.click(submitSelector)
    ]);

    console.log(`⏳ Esperando respuesta del servidor (${POST_LOGIN_DELAY_MS}ms)...`);
    await delay(POST_LOGIN_DELAY_MS);

    const cookies = await page.cookies();
    const jsessionId = cookies.find(c => c.name === 'JSESSIONID')?.value;
    const sphinxSession = cookies.find(c => c.name === 'SPHINX')?.value;
    const sphinxBase = cookies.find(c => c.name === 'SPHINX_BASE')?.value || 'sandos';

    if (!jsessionId || !sphinxSession) {
      const html = await page.content();
      if (html.includes('login') || html.includes('iniciar sesión') || html.includes('usuario') || html.includes('clave')) {
        throw new Error('Login falló: credenciales incorrectas o formulario cambió');
      }
      throw new Error('Login falló: no se obtuvieron cookies de sesión');
    }

    console.log('✅ Login exitoso, cookies obtenidas');
    return { jsessionId, sphinxSession, sphinxBase };

  } catch (error) {
    if (browser) {
      await browser.close().catch(() => {});
    }

    if (retryCount < MAX_LOGIN_RETRIES - 1) {
      console.warn(`⚠️ Login falló: ${error.message}. Reintentando en ${RETRY_DELAY_MS}ms...`);
      await delay(RETRY_DELAY_MS);
      return loginSphinxWithPuppeteer(retryCount + 1);
    }

    throw new Error(`Login falló después de ${MAX_LOGIN_RETRIES} intentos: ${error.message}`);
  } finally {
    if (browser) {
      await browser.close().catch(() => {});
    }
  }
}

/**
 * Verifica si la sesión es válida haciendo una consulta de prueba
 */
export async function verificarSesion(session) {
  if (!session || !session.jsessionId || !session.sphinxSession) {
    return false;
  }

  try {
    const baseUrl = (process.env.SPHINX_BASE_URL || 'https://sandos.sphinx.cl').replace(/\/$/, '');
    const cookies = `JSESSIONID=${session.jsessionId}; SPHINX_BASE=${session.sphinxBase || 'sandos'}; SPHINX=${session.sphinxSession}`;

    const response = await fetch(`${baseUrl}/Documento$reporte.service`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
        'Cookie': cookies,
      },
      body: new URLSearchParams({
        param: JSON.stringify({ folio: '1', idTipo: '70', maxRow: 1, page: 1 })
      }).toString()
    });

    if (!response.ok) return false;

    const text = await response.text();
    if (text.includes('No esta conectado') || text.includes('No está conectado')) {
      return false;
    }

    return true;
  } catch {
    return false;
  }
}
