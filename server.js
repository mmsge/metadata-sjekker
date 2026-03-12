'use strict';

const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');
const path = require('path');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ---------------------------------------------------------------------------
// Optional puppeteer
// ---------------------------------------------------------------------------
let puppeteer = null;
let puppeteerAvailable = false;
try {
  puppeteer = require('puppeteer');
  puppeteerAvailable = true;
  console.log('Puppeteer tilgjengeleg – JS-rendering aktivert');
} catch {
  console.log('Puppeteer ikkje installert – berre statisk henting tilgjengeleg');
}

// ---------------------------------------------------------------------------
// Stop-words (Norwegian + English)
// ---------------------------------------------------------------------------
const STOP_WORDS = new Set([
  // Norwegian
  'og','i','er','det','av','på','til','for','den','som','med','en','et','de',
  'om','vi','seg','men','jeg','ikke','han','hun','de','vi','dere','dem','oss',
  'sin','si','sitt','sine','var','har','hadde','vil','skal','kan','må','bør',
  'være','ha','bli','blitt','fra','ved','til','etter','under','over','mellom',
  'mot','inn','ut','opp','ned','her','der','når','da','hvis','så','men','eller',
  'at','som','hvilket','hvilken','hvilke','denne','dette','disse','noen','alle',
  'mange','mer','mest','mindre','minst','svært','veldig','også','bare','kun',
  'jo','nå','jo','an','pr','bl','ca','evt','mht','ifm','hhv','f.eks','osv',
  'dvs','jf','mr','nr','st','pkt','ang','ift','mm','eks','inkl','ekskl',
  // English
  'the','and','is','in','of','to','for','a','an','that','this','with','it',
  'are','was','be','as','at','by','we','our','your','from','or','but','not',
  'have','had','they','he','she','his','her','its','if','on','do','did','will',
  'would','could','should','may','might','been','has','more','also','about',
  'which','what','how','when','where','who','all','any','can','were','up',
  'out','their','there','than','then','so','no','my','me','him','you','us',
  'one','two','three','into','these','those','each','other','such','after',
  'before','between','through','during','without','within','against','across',
]);

// ---------------------------------------------------------------------------
// URL validation
// ---------------------------------------------------------------------------
function validateUrl(urlStr) {
  let parsed;
  try {
    parsed = new URL(urlStr);
  } catch {
    return { valid: false, error: 'INVALID_URL', message: 'Ugyldig URL-format. URL-en må starte med http:// eller https://' };
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return { valid: false, error: 'INVALID_URL', message: 'Berre http:// og https:// er støtta.' };
  }
  const hostname = parsed.hostname.toLowerCase();
  const privatePatterns = [
    /^localhost$/,
    /^127\./,
    /^10\./,
    /^192\.168\./,
    /^172\.(1[6-9]|2\d|3[01])\./,
    /^::1$/,
    /^0\.0\.0\.0$/,
  ];
  if (privatePatterns.some(p => p.test(hostname))) {
    return { valid: false, error: 'PRIVATE_URL', message: 'Private eller lokale adresser er ikkje tillate.' };
  }
  return { valid: true };
}

// ---------------------------------------------------------------------------
// Fetch helpers
// ---------------------------------------------------------------------------
const USER_AGENT = 'MetadataSjekker/1.0 (https://github.com/mmsge/metadata-sjekker)';
const MAX_SIZE = 5 * 1024 * 1024; // 5MB

async function fetchWithAxios(url) {
  const response = await axios.get(url, {
    timeout: 10000,
    maxContentLength: MAX_SIZE,
    headers: { 'User-Agent': USER_AGENT, 'Accept': 'text/html,application/xhtml+xml,*/*' },
    validateStatus: () => true,
  });
  return { html: response.data, statusCode: response.status, headers: response.headers };
}

async function fetchWithPuppeteer(url) {
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
  });
  try {
    const page = await browser.newPage();
    await page.setUserAgent(USER_AGENT);
    const response = await page.goto(url, { waitUntil: 'networkidle2', timeout: 15000 });
    await new Promise(r => setTimeout(r, 500));
    const html = await page.content();
    return { html, statusCode: response.status(), headers: response.headers() };
  } finally {
    await browser.close();
  }
}

// ---------------------------------------------------------------------------
// Meta extraction
// ---------------------------------------------------------------------------
function extractMeta($, url) {
  const og = name => $(`meta[property="og:${name}"]`).attr('content') || null;
  const tw = name => $(`meta[name="twitter:${name}"]`).attr('content') || null;
  const meta = name => $(`meta[name="${name}"]`).attr('content') || null;

  return {
    title: $('title').first().text().trim() || null,
    description: meta('description'),
    keywords: meta('keywords'),
    robots: meta('robots'),
    canonical: $('link[rel="canonical"]').attr('href') || null,
    lang: $('html').attr('lang') || null,
    charset: $('meta[charset]').attr('charset') || $('meta[http-equiv="Content-Type"]').attr('content') || null,
    viewport: meta('viewport'),
    og: {
      title: og('title'),
      description: og('description'),
      image: og('image'),
      imageWidth: og('image:width'),
      imageHeight: og('image:height'),
      imageAlt: og('image:alt'),
      url: og('url'),
      type: og('type'),
      siteName: og('site_name'),
      locale: og('locale'),
    },
    twitter: {
      card: tw('card'),
      title: tw('title'),
      description: tw('description'),
      image: tw('image'),
      imageAlt: tw('image:alt'),
      site: tw('site'),
      creator: tw('creator'),
    },
    hasStructuredData: $('script[type="application/ld+json"]').length > 0,
    hasFavicon: $('link[rel="icon"], link[rel="shortcut icon"], link[rel="apple-touch-icon"]').length > 0,
    hasRssFeed: $('link[rel="alternate"][type="application/rss+xml"]').length > 0,
  };
}

// ---------------------------------------------------------------------------
// Warnings
// ---------------------------------------------------------------------------
function generateWarnings(meta) {
  const warnings = [];
  const add = (severity, code, message, field) => warnings.push({ severity, code, message, field });

  if (!meta.title) {
    add('error', 'MISSING_TITLE', 'Sida manglar <title>-tag. Tittelen er avgjerande for søkemotorar og nettlesarfaner.', 'title');
  } else if (meta.title.length > 60) {
    add('warning', 'TITLE_TOO_LONG', `Tittelen er ${meta.title.length} teikn – tilrådde maks 60 teikn. Kan bli kutta i søkeresultat.`, 'title');
  } else if (meta.title.length < 30) {
    add('warning', 'TITLE_TOO_SHORT', `Tittelen er berre ${meta.title.length} teikn – tilrådde minimum 30 teikn.`, 'title');
  }

  if (!meta.description) {
    add('error', 'MISSING_DESCRIPTION', 'Manglar meta-beskriving. Søkemotorar brukar denne som utdrag i resultat.', 'description');
  } else if (meta.description.length > 160) {
    add('warning', 'DESCRIPTION_TOO_LONG', `Meta-beskriving er ${meta.description.length} teikn – tilrådde maks 160 teikn.`, 'description');
  } else if (meta.description.length < 70) {
    add('warning', 'DESCRIPTION_TOO_SHORT', `Meta-beskriving er berre ${meta.description.length} teikn – tilrådde minimum 70 teikn.`, 'description');
  }

  if (!meta.og.title) add('warning', 'MISSING_OG_TITLE', 'Manglar og:title – tittelen ved deling på sosiale medium vil falle tilbake til <title>.', 'og:title');
  if (!meta.og.description) add('warning', 'MISSING_OG_DESCRIPTION', 'Manglar og:description – beskriving ved deling på Facebook/LinkedIn manglar.', 'og:description');
  if (!meta.og.image) {
    add('warning', 'MISSING_OG_IMAGE', 'Manglar og:image – inga forhåndsvisning av bilde ved deling på sosiale medium.', 'og:image');
  } else {
    if (!meta.og.imageWidth || !meta.og.imageHeight) {
      add('info', 'OG_IMAGE_NO_DIMENSIONS', 'og:image manglar breidde/høgde (og:image:width, og:image:height). Tilrådde: 1200×630 px.', 'og:image:width');
    }
    if (!meta.og.imageAlt) {
      add('info', 'OG_IMAGE_NO_ALT', 'og:image:alt manglar – viktig for tilgjengelegheit ved bildedeling.', 'og:image:alt');
    }
  }

  if (!meta.twitter.card) {
    add('warning', 'MISSING_TWITTER_CARD', 'Manglar twitter:card – sida vil bli vist utan rik kortvisning på Twitter/X.', 'twitter:card');
  }

  if (!meta.canonical) add('info', 'MISSING_CANONICAL', 'Manglar kanonisk URL (<link rel="canonical">). Tilrådde for å unngå duplikatinnhald.', 'canonical');
  if (!meta.lang) add('error', 'MISSING_LANG', 'Manglar lang-attributt på <html>-elementet. Nødvendig for skjermlesar og SEO.', 'lang');
  if (!meta.viewport) add('warning', 'MISSING_VIEWPORT', 'Manglar viewport meta-tag. Sida kan sjå dårleg ut på mobile einingar.', 'viewport');
  if (!meta.hasStructuredData) add('info', 'NO_STRUCTURED_DATA', 'Ingen JSON-LD/strukturerte data funne. Strukturerte data kan gje rike søkeresultat.', 'structured-data');

  return warnings;
}

// ---------------------------------------------------------------------------
// SEO analysis
// ---------------------------------------------------------------------------
function analyzeSeo($) {
  // Extract visible text
  const textNodes = [];
  $('body').find('p, h1, h2, h3, h4, h5, h6, li, td, th, span, div, a, blockquote').each((_, el) => {
    const $el = $(el);
    if ($el.parents('script, style, noscript, nav, footer, header').length === 0) {
      const text = $el.clone().children().remove().end().text().trim();
      if (text) textNodes.push(text);
    }
  });

  const fullText = textNodes.join(' ');
  const tokens = fullText.toLowerCase().replace(/[^a-zæøåéèêëàâîïôùûüœ0-9\s]/g, ' ').split(/\s+/).filter(t => t.length > 2 && !STOP_WORDS.has(t));
  const totalWords = fullText.split(/\s+/).filter(w => w.trim()).length;

  const freq = {};
  for (const token of tokens) {
    freq[token] = (freq[token] || 0) + 1;
  }

  const topKeywords = Object.entries(freq)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20)
    .map(([term, count]) => ({
      term,
      count,
      density: totalWords > 0 ? Math.round((count / totalWords) * 10000) / 100 : 0,
    }));

  // Headings
  const headings = [];
  $('h1, h2, h3, h4, h5, h6').each((_, el) => {
    headings.push({ level: parseInt(el.tagName[1]), text: $(el).text().trim() });
  });

  return {
    totalWords,
    uniqueWords: Object.keys(freq).length,
    readingTimeMinutes: Math.ceil(totalWords / 200),
    topKeywords,
    headings,
    h1Count: headings.filter(h => h.level === 1).length,
  };
}

// ---------------------------------------------------------------------------
// Accessibility analysis
// ---------------------------------------------------------------------------
function analyzeAccessibility($) {
  // 1. Language
  const langAttr = $('html').attr('lang');
  const lang = { present: !!langAttr, value: langAttr || null };

  // 2. Semantic tags
  const semanticTagList = ['header', 'nav', 'main', 'footer', 'article', 'section', 'aside', 'figure', 'figcaption'];
  const semanticTags = semanticTagList.map(tag => {
    const count = $(tag).length;
    return { tag, count, present: count > 0 };
  });
  const mainCount = $('main').length;
  const multipleMainWarning = mainCount > 1;

  // 3. Images
  const allImages = [];
  $('img').each((_, el) => {
    const $el = $(el);
    const src = $el.attr('src') || '';
    const altAttr = $el.attr('alt');
    const hasAlt = altAttr !== undefined;
    const emptyAlt = hasAlt && altAttr === '';
    const ariaHidden = $el.attr('aria-hidden') === 'true';
    const rolePresentation = $el.attr('role') === 'presentation' || $el.attr('role') === 'none';
    allImages.push({
      src,
      alt: altAttr !== undefined ? altAttr : null,
      hasAlt,
      emptyAlt,
      isDecorative: emptyAlt && (ariaHidden || rolePresentation),
    });
  });
  const images = {
    total: allImages.length,
    withAlt: allImages.filter(i => i.hasAlt && !i.emptyAlt).length,
    withEmptyAlt: allImages.filter(i => i.emptyAlt).length,
    missingAlt: allImages.filter(i => !i.hasAlt).length,
    images: allImages,
  };

  // 4. Heading hierarchy
  const headings = [];
  $('h1, h2, h3, h4, h5, h6').each((_, el) => {
    headings.push({ level: parseInt(el.tagName[1]), text: $(el).text().trim() });
  });
  const h1Count = headings.filter(h => h.level === 1).length;
  const skips = [];
  for (let i = 1; i < headings.length; i++) {
    if (headings[i].level > headings[i - 1].level + 1) {
      skips.push({ from: headings[i - 1].level, to: headings[i].level, text: headings[i].text });
    }
  }
  const headingHierarchy = { h1Count, hasSkips: skips.length > 0, skips };

  // 5. Forms
  const unlabelledInputs = [];
  const buttons = [];
  $('input:not([type="hidden"]), select, textarea').each((_, el) => {
    const $el = $(el);
    const id = $el.attr('id');
    const hasLabelFor = id ? $(`label[for="${id}"]`).length > 0 : false;
    const hasAriaLabel = !!$el.attr('aria-label');
    const hasAriaLabelledBy = !!$el.attr('aria-labelledby');
    const hasTitle = !!$el.attr('title');
    if (!hasLabelFor && !hasAriaLabel && !hasAriaLabelledBy && !hasTitle) {
      unlabelledInputs.push({
        type: $el.attr('type') || el.tagName.toLowerCase(),
        name: $el.attr('name') || '',
        id: id || '',
      });
    }
  });
  $('button, [role="button"]').each((_, el) => {
    const $el = $(el);
    const text = $el.text().trim();
    const ariaLabel = $el.attr('aria-label');
    const ariaLabelledBy = $el.attr('aria-labelledby');
    const title = $el.attr('title');
    buttons.push({
      text: text || null,
      hasAccessibleName: !!(text || ariaLabel || ariaLabelledBy || title),
    });
  });
  const totalInputs = $('input:not([type="hidden"]), select, textarea').length;
  const forms = {
    totalInputs,
    inputsWithLabel: totalInputs - unlabelledInputs.length,
    inputsMissingLabel: unlabelledInputs.length,
    unlabelledInputs,
    buttons,
  };

  // 6. ARIA landmarks
  const ariaLandmarks = {
    banner: $('[role="banner"]').length,
    navigation: $('[role="navigation"]').length,
    main: $('[role="main"]').length,
    contentinfo: $('[role="contentinfo"]').length,
    search: $('[role="search"]').length,
    complementary: $('[role="complementary"]').length,
  };

  // 7. Tabindex issues
  const tabindexIssues = [];
  $('[tabindex]').each((_, el) => {
    const val = parseInt($(el).attr('tabindex'));
    if (val > 0) {
      tabindexIssues.push({
        tag: el.tagName.toLowerCase(),
        tabindex: val,
        text: $(el).text().trim().slice(0, 50),
      });
    }
  });

  return {
    lang,
    semanticTags,
    multipleMainWarning,
    images,
    headings: headingHierarchy,
    forms,
    ariaLandmarks,
    tabindexIssues,
    notices: [
      'Fargekontrast kan ikkje kontrollerast server-side. Bruk verktøy som Lighthouse eller axe DevTools for fullstendig sjekk.',
    ],
  };
}

// ---------------------------------------------------------------------------
// API routes
// ---------------------------------------------------------------------------
app.get('/api/capabilities', (req, res) => {
  res.json({ puppeteerAvailable });
});

app.post('/api/check', async (req, res) => {
  const { url, renderJs = false } = req.body || {};

  if (!url) {
    return res.status(400).json({ error: 'MISSING_URL', message: 'URL er påkravd.' });
  }

  const validation = validateUrl(url);
  if (!validation.valid) {
    return res.status(400).json({ error: validation.error, message: validation.message });
  }

  let fetchResult;
  let renderedWithJs = false;

  try {
    if (renderJs && puppeteerAvailable) {
      fetchResult = await fetchWithPuppeteer(url);
      renderedWithJs = true;
    } else {
      fetchResult = await fetchWithAxios(url);
    }
  } catch (err) {
    const msg = err.code === 'ECONNREFUSED' ? 'Tilkoblingen vart avvist.'
      : err.code === 'ENOTFOUND' ? 'Domenet vart ikkje funne.'
      : err.code === 'ETIMEDOUT' || err.message.includes('timeout') ? 'Forespørselen fekk tidsavbrot.'
      : `Kunne ikkje hente sida: ${err.message}`;
    return res.status(502).json({ error: 'FETCH_FAILED', message: msg });
  }

  const { html, statusCode } = fetchResult;

  if (statusCode >= 400) {
    return res.status(502).json({
      error: 'HTTP_ERROR',
      message: `Sida svara med HTTP ${statusCode}.`,
    });
  }

  let $;
  try {
    $ = cheerio.load(html);
  } catch (err) {
    return res.status(500).json({ error: 'PARSE_ERROR', message: 'Klarte ikkje analysere HTML-en frå sida.' });
  }

  const meta = extractMeta($, url);
  const warnings = generateWarnings(meta);
  const seo = analyzeSeo($);
  const accessibility = analyzeAccessibility($);

  res.json({
    url,
    fetchedAt: new Date().toISOString(),
    renderedWithJs,
    puppeteerAvailable,
    statusCode,
    meta,
    warnings,
    seo,
    accessibility,
  });
});

// ---------------------------------------------------------------------------
// Start
// ---------------------------------------------------------------------------
module.exports = app;

if (require.main === module) {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log(`Metadata-sjekker køyrer på http://localhost:${PORT}`);
  });
}
