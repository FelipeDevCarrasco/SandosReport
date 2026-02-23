/**
 * Login automático a Sphinx mediante Puppeteer (web scraping).
 * Obtiene las cookies de sesión tras iniciar sesión.
 *
 * Requisitos: npm install puppeteer
 * En Docker: ver README para instalar dependencias de Chromium
 */

export async function loginSphinxWithPuppeteer() {
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

  const browser = await puppeteer.default.launch({
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu'
    ],
    executablePath: process.env.PUPPETEER_EXECUTABLE_PATH
  });

  try {
    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

    await page.goto(loginUrl, { waitUntil: 'networkidle2', timeout: 30000 });

    // Selectores para sandos.sphinx.cl (CSS - page.$x no disponible en Puppeteer reciente)
    const userSelector = process.env.SPHINX_USER_SELECTOR || 'form input:nth-of-type(2)';
    const passwordSelector = process.env.SPHINX_PASSWORD_SELECTOR || '#password';
    const submitSelector = process.env.SPHINX_SUBMIT_SELECTOR || '#btnSubmit';

    await page.waitForSelector(userSelector, { timeout: 10000 });
    await page.type(userSelector, user, { delay: 50 });

    await page.waitForSelector(passwordSelector, { timeout: 5000 });
    await page.type(passwordSelector, password, { delay: 50 });

    await Promise.all([
      page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 15000 }).catch(() => {}),
      page.click(submitSelector)
    ]);

    await new Promise(r => setTimeout(r, 2000));

    const cookies = await page.cookies();
    const jsessionId = cookies.find(c => c.name === 'JSESSIONID')?.value;
    const sphinxSession = cookies.find(c => c.name === 'SPHINX')?.value;
    const sphinxBase = cookies.find(c => c.name === 'SPHINX_BASE')?.value || 'sandos';

    if (!jsessionId || !sphinxSession) {
      const html = await page.content();
      if (html.includes('login') || html.includes('iniciar sesión') || html.includes('usuario') || html.includes('clave')) {
        throw new Error('Login falló: credenciales incorrectas o formulario cambió. Revisa SPHINX_USER_SELECTOR, SPHINX_PASSWORD_SELECTOR en .env');
      }
      throw new Error('Login falló: no se obtuvieron cookies de sesión');
    }

    return { jsessionId, sphinxSession, sphinxBase };
  } finally {
    await browser.close();
  }
}
