import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

const outDir = process.argv[2] || 'before';
const baseUrl = 'http://localhost:3000';

const routes = [
  { path: '/', name: 'home' },
  { path: '/clinica', name: 'clinica' },
  { path: '/equipe', name: 'profissionais' },
  { path: '/convenios', name: 'convenios' },
  { path: '/contato', name: 'contato' }
];

async function takeScreenshots() {
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }

  const browser = await chromium.launch();
  const page = await browser.newPage({
    viewport: { width: 1440, height: 1080 }
  });

  for (const route of routes) {
    try {
      console.log(`Navigating to ${route.path}...`);
      await page.goto(`${baseUrl}${route.path}`, { waitUntil: 'networkidle', timeout: 30000 });
      await page.waitForTimeout(2000); // wait for framer motion animations
      
      const filePath = path.join(outDir, `${route.name}.png`);
      await page.screenshot({ path: filePath, fullPage: true });
      console.log(`Saved screenshot to ${filePath}`);
    } catch (err) {
      console.error(`Failed to screenshot ${route.path}:`, err);
    }
  }

  await browser.close();
}

takeScreenshots();
