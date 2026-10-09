import { test, expect, type Page } from '@playwright/test';
import { rivers, reservoirs, sources } from '../../packages/shared/src/catalog';
import { pointInRegion, riverInRegion, reservoirInRegion } from '../../packages/shared/src/regions';
import type { ForecastSnapshot, Region } from '../../packages/shared/src/index';

const station = {
  id: 'test-station', name: 'Testpegel Bode', water: 'Bode', latitude: 51.75, longitude: 11.03,
  agency: 'Testquelle', sourceUrl: 'https://www.pegelonline.wsv.de/', region: 'harz',
  measurement: { value: 110, unit: 'cm', timestamp: '2026-10-09T08:00:00Z' },
  discharge: null, freshness: 'current',
};
const allStations = [station,
  { ...station, id: 'test-magdeburg', name: 'Testpegel Magdeburg', water: 'Elbe', latitude: 52.12, longitude: 11.627, region: 'sachsen-anhalt' },
  { ...station, id: 'test-hamburg', name: 'Testpegel Hamburg', water: 'Elbe', latitude: 53.5, longitude: 10.0, region: 'germany' },
];
const provider = { id: 'open-meteo', name: 'Open-Meteo', state: 'live' as const, fetchedAt: '2026-10-09T08:05:00Z', message: 'Deterministische Browser-Testdaten', url: 'https://open-meteo.com/' };
function forecastFixture(region: Region): ForecastSnapshot {
  const hours = Array.from({ length: 72 }, (_, index) => ({
    timestamp: new Date(Date.UTC(2026, 9, 9, 8 + index)).toISOString(), precipitationMm: 0, rainMm: 0, probabilityPercent: 0,
  }));
  return {
    generatedAt: '2026-10-09T08:05:00Z', region, horizonHours: 72, provider,
    riverProvider: { ...provider, id: 'open-meteo-flood' },
    locations: [
      { location: { id: 'wernigerode', name: 'Wernigerode', district: 'Harz', latitude: 51.835, longitude: 10.787 }, hourly: hours,
        totals: { next24hMm: 0, next72hMm: 0, max1hMm: 0, max6hMm: 0 }, rainfallClass: 'low', completeness: 'complete', explanation: 'Im Test wird kein Niederschlag vorhergesagt.' },
      { location: { id: 'quedlinburg', name: 'Quedlinburg', district: 'Harz', latitude: 51.79, longitude: 11.141 }, hourly: hours.map((h, i) => ({ ...h, precipitationMm: i === 0 ? null : 0 })),
        totals: { next24hMm: null, next72hMm: null, max1hMm: 0, max6hMm: null }, rainfallClass: 'unknown', completeness: 'partial', explanation: 'Eine Modellstunde fehlt.' },
    ],
    riverForecasts: [{ id: 'elbe-magdeburg', name: 'Elbe bei Magdeburg', water: 'Elbe', latitude: 52.12, longitude: 11.627, model: 'GloFAS',
      daily: [0, null, 120, 130, 115, 105, 100].map((value, index) => ({ timestamp: new Date(Date.UTC(2026, 9, 9 + index)).toISOString(), dischargeM3s: value })),
      note: 'Modellabfluss ist keine amtliche Warnstufe.' }],
    methodology: { version: '1', description: 'Niederschlagsmodelle sind keine kalibrierte Hochwasservorhersage.', thresholds: 'Regenklassen sind Orientierung, keine Gefahrenwahrscheinlichkeiten.',
      limitations: ['Keine Überflutungsflächen oder Pegelstände aus Regenmengen ableiten.', 'Punktprognosen bilden kein ganzes Einzugsgebiet ab.'], sources: [{ name: 'Open-Meteo', url: 'https://open-meteo.com/' }] },
  };
}
async function mockMap(page: Page) {
  // Exercise real MapLibre/WebGL and application GeoJSON layers without requiring external tiles.
  await page.route('https://tiles.openfreemap.org/**', route => route.fulfill({ json: {
    version: 8, name: 'Offline browser-test basemap', sources: {},
    layers: [{ id: 'background', type: 'background', paint: { 'background-color': '#e5ebe2' } }],
  } }));
}
async function mockData(page: Page) {
  await mockMap(page);
  await page.route('**/api/v1/overview?*', route => {
    const region = (new URL(route.request().url()).searchParams.get('region') || 'sachsen-anhalt') as Region;
    return route.fulfill({ json: {
      generatedAt: '2026-10-09T08:05:00Z', region,
      rivers: rivers.filter(r => riverInRegion(r, region)), reservoirs: reservoirs.filter(r => reservoirInRegion(r, region)).map(r => r.id === 'kelbra' ? { ...r, telemetry: {
        inflow: {value: 0, unit: 'm³/s', timestamp: '2026-10-09T08:00:00Z'}, freshness: 'current', sourceName: 'Testbetreiber', sourceUrl: 'https://www.talsperren-lsa.de/',
      }} : r.id === 'rappbode' ? { ...r, telemetry: {
        storage: {value: 71.2, unit: 'Mio. m³', timestamp: '2026-10-09T08:00:00Z'}, fillPercent: {value: 65.3, unit: '%', timestamp: '2026-10-09T08:00:00Z'}, freshness: 'current', sourceName: 'Testbetreiber', sourceUrl: 'https://www.talsperren-lsa.de/',
      }} : r), sources,
      stations: allStations.filter(s => pointInRegion(s.latitude, s.longitude, region)),
      warnings: [], providers: [
        {id:'lhp',name:'Länderübergreifendes Hochwasserportal',state:'live',fetchedAt:'2026-10-09T08:05:00Z',dataUpdatedAt:'2026-10-09T08:00:00Z',message:'Testdaten für UI-Prüfung',url:'https://www.hochwasserzentralen.de/'},
        {id:'nina-lhp',name:'NINA',state:'unavailable',fetchedAt:null,message:'Warnquelle im Test nicht erreichbar.',url:'https://warnung.bund.de/'},
      ], coverage:{complete:false,stations:'Abdeckung im Test eingeschränkt.',warnings:'Warnlage unbekannt. Keine Entwarnung.',geography:'Schematische Flussverläufe.'},
    }});
  });
  await page.route('**/api/v1/forecast?*', route => route.fulfill({ json: forecastFixture((new URL(route.request().url()).searchParams.get('region') || 'sachsen-anhalt') as Region) }));
  await page.route('**/api/v1/stations/test-station/history', route => route.fulfill({json:{stationId:'test-station',parameter:'W',measurements:[{timestamp:'2026-10-09T07:00:00Z',value:100,unit:'cm'},{timestamp:'2026-10-09T08:00:00Z',value:110,unit:'cm'}],provider:{id:'test',name:'Testquelle',state:'live',fetchedAt:'2026-10-09T08:05:00Z',message:'Test',url:'https://www.pegelonline.wsv.de/'}}}));
}
async function navigate(page: Page, name: string) {
  const menu = page.getByRole('button', {name:'Menü öffnen'});
  if (await menu.isVisible()) await menu.click();
  await page.getByRole('navigation',{name:'Hauptnavigation'}).getByRole('button',{name,exact:true}).click();
}
async function noHorizontalOverflow(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
}

test('OpenFreeMap renderer and administrative region selection work', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  // A canvas alone also exists when a missing production worker prevents all vector rendering.
  const workerReady = page.waitForEvent('worker').then(worker => worker.evaluate(() => typeof self.postMessage));
  await mockData(page); await page.goto('/');
  await expect(page.getByRole('heading',{name:'Wasserlage beobachten.'})).toBeVisible();
  await expect(page.locator('.maplibregl-canvas')).toBeVisible();
  expect(await workerReady).toBe('function');
  await expect(page.locator('.ofm-loading')).toHaveCount(0);
  await expect(page.locator('.ofm-fallback, .ofm-partial')).toHaveCount(0);
  await expect(page.getByRole('button',{name:'Sachsen-Anhalt', exact:true})).toHaveAttribute('aria-pressed','true');
  await navigate(page,'Pegel');
  await expect(page.locator('.station-table-row')).toHaveCount(2);
  await page.getByRole('button',{name:'Landkreis Harz',exact:true}).click();
  await expect(page.locator('.station-table-row')).toHaveCount(1);
  await expect(page.locator('.station-table-row')).toContainText('Testpegel Bode');
  await page.getByRole('button',{name:'Deutschland',exact:true}).click();
  await expect(page.locator('.station-table-row')).toHaveCount(3);
  await expect(page.locator('.station-table-row').filter({hasText:'Testpegel Hamburg'})).toBeVisible();
  await noHorizontalOverflow(page);
  expect(errors).toEqual([]);
});

test('map layers and keyboard object selection remain accessible', async ({ page }) => {
  await mockData(page); await page.goto('/');
  await expect(page.locator('.ofm-loading')).toHaveCount(0);
  await page.getByRole('button',{name:'Ebenen',exact:true}).click();
  const gauges = page.getByRole('checkbox',{name:/^Pegel/});
  await gauges.uncheck(); await expect(gauges).not.toBeChecked();
  await gauges.check(); await expect(gauges).toBeChecked();
  const riverLayer = page.getByRole('checkbox',{name:/^Flusskatalog/});
  await riverLayer.check();
  await expect(page.getByText('Gestrichelte Flüsse: schematischer Katalog, kein genauer Gewässerverlauf.')).toBeVisible();
  await page.getByRole('button',{name:'Objekt auswählen',exact:true}).click();
  await page.getByRole('searchbox',{name:'Gewässer oder Pegel finden'}).fill('Bode');
  await page.getByRole('button',{name:'Fluss Bode auswählen',exact:true}).focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('heading',{name:'Bode',level:2,exact:true})).toBeVisible();
  await noHorizontalOverflow(page);
});

test('river region and basin filters retain useful search', async ({ page }) => {
  await mockData(page); await page.goto('/');
  await navigate(page,'Flüsse');
  await expect(page.locator('.river-directory-card').filter({has:page.getByRole('heading',{name:'Oker',exact:true})})).toHaveCount(0);
  await page.getByRole('button',{name:'Deutschland',exact:true}).click();
  await page.getByRole('combobox',{name:'Flüsse nach Einzugsgebiet filtern'}).selectOption('Weser');
  await expect(page.locator('.river-directory-card').filter({has:page.getByRole('heading',{name:'Oker',exact:true})})).toBeVisible();
  await expect(page.locator('.river-directory-card').filter({has:page.getByRole('heading',{name:'Bode',exact:true})})).toHaveCount(0);
  const search=page.getByRole('textbox',{name:'Pegel, Flüsse und Talsperren suchen'});
  await search.fill('Rappbodetalsperre'); await search.press('Enter');
  await expect(page.getByRole('heading',{name:'Rappbodetalsperre',level:2,exact:true})).toBeVisible();
  await noHorizontalOverflow(page);
});

test('station history and unavailable warnings do not imply all clear', async ({ page }) => {
  await mockData(page); await page.goto('/');
  await expect(page.locator('.source-availability')).toContainText('Teilweise Datenlücken: NINA');
  await page.getByRole('button', {name:'Quellenstatus ansehen'}).click();
  await expect(page.locator('.provider-card').filter({hasText:'NINA'})).toContainText('Eingeschränkt');
  await navigate(page,'Pegel');
  await page.locator('.station-table-row').filter({hasText:'Testpegel Bode'}).click();
  await expect(page.getByRole('heading',{name:'Testpegel Bode',exact:true})).toBeVisible();
  await expect(page.locator('.history-chart svg')).toBeVisible();
  await navigate(page,'Warnungen');
  await expect(page.getByText('Amtliche Warnlage immer direkt prüfen.')).toBeVisible();
  await expect(page.getByText(/Das ist keine Aussage darüber/)).toBeVisible();
});

test('API outage retains regional catalog and identifies unavailable live data', async ({ page }) => {
  await mockData(page);
  await page.route('**/api/v1/overview?*', route=>route.abort('failed'));
  await page.goto('/');
  await expect(page.getByText(/Live-Daten sind gerade nicht erreichbar/)).toBeVisible();
  await navigate(page,'Flüsse');
  await expect(page.locator('.river-directory-card').filter({has:page.getByRole('heading',{name:'Bode',exact:true})})).toBeVisible();
  await expect(page.locator('.river-directory-card').filter({has:page.getByRole('heading',{name:'Oker',exact:true})})).toHaveCount(0);
  await navigate(page,'Datenquellen');
  await expect(page.getByRole('link',{name:'API-Dokumentation'})).toBeVisible();
  await noHorizontalOverflow(page);
});

test('forecast distinguishes zero from missing values, supports location changes and explains methodology', async ({ page }) => {
  await mockData(page); await page.goto('/'); await navigate(page,'Regen & Prognose');
  await expect(page.getByRole('heading',{name:'Regen über Wernigerode.'})).toBeVisible();
  await expect(page.locator('.rain-forecast-metrics').first()).toContainText('0mm');
  await page.getByText('Stündliche Werte ansehen',{exact:true}).click();
  await expect(page.locator('.rain-forecast-card tbody tr').first()).toContainText('0 mm');
  await page.getByRole('combobox',{name:'Prognoseort auswählen'}).selectOption('quedlinburg');
  await expect(page.getByRole('heading',{name:'Regen über Quedlinburg.'})).toBeVisible();
  await expect(page.locator('.rain-forecast-metrics > div').first()).toContainText('—mm');
  await expect(page.locator('.rain-forecast-card tbody tr').first()).toContainText('— mm');
  await expect(page.getByText(/Unvollständige Summen werden nicht als 0 mm dargestellt/)).toBeVisible();
  await page.getByText('So entsteht diese Prognose',{exact:true}).click();
  await expect(page.getByText('Niederschlagsmodelle sind keine kalibrierte Hochwasservorhersage.',{exact:true})).toBeVisible();
  await page.getByText('Tageswerte ansehen',{exact:true}).click();
  await expect(page.locator('.river-forecast-card tbody tr').nth(0)).toContainText('0 m³/s');
  await expect(page.locator('.river-forecast-card tbody tr').nth(1)).toContainText('— m³/s');
  await noHorizontalOverflow(page);
});

test('forecast outage remains explicit and official warnings remain reachable', async ({ page }) => {
  await mockData(page);
  await page.route('**/api/v1/forecast?*', route => route.abort('failed'));
  await page.goto('/'); await navigate(page,'Regen & Prognose');
  await expect(page.getByText('Regenprognose gerade nicht verfügbar',{exact:true})).toBeVisible();
  await expect(page.getByText(/Fehlende Prognosen sind keine Entwarnung/)).toBeVisible();
  await navigate(page,'Warnungen');
  await expect(page.getByText('Amtliche Warnlage immer direkt prüfen.')).toBeVisible();
});

test('reservoir readings show source timestamps and zero inflow without invented storage', async ({ page }) => {
  await mockData(page); await page.goto('/'); await navigate(page, 'Talsperren');
  const rappbode = page.locator('.reservoir-card').filter({has: page.getByRole('heading', {name: 'Rappbodetalsperre', exact: true})});
  await expect(rappbode).toContainText('65,3%');
  await rappbode.click();
  await expect(page.getByRole('region', {name:'Betriebsdaten der Talsperre'})).toContainText('71,2 Mio. m³');
  await expect(page.locator('.telemetry-metric time').first()).toContainText('09. Okt.');
  await expect(page.getByRole('link', {name:'Testbetreiber'})).toHaveAttribute('href', 'https://www.talsperren-lsa.de/');
  const search = page.getByRole('textbox', {name:'Pegel, Flüsse und Talsperren suchen'});
  await search.fill('Kelbra'); await search.press('Enter');
  await expect(page.getByRole('heading', {name:'Talsperre Kelbra', exact:true})).toBeVisible();
  await expect(page.locator('.telemetry-metric')).toHaveCount(1);
  await expect(page.locator('.telemetry-metric')).toContainText('Zufluss0 m³/s');
  await expect(page.locator('#selection-detail').getByText('Keine aktuellen Messwerte', {exact:true})).not.toBeVisible();
  await noHorizontalOverflow(page);
});

test('history retains the whole interval and exposes invalid responses with retry', async ({ page }) => {
  await mockData(page);
  let invalid = true;
  await page.route('**/api/v1/stations/test-station/history', route => {
    return route.fulfill({json: {
      stationId: invalid ? 'wrong-station' : 'test-station', parameter:'W', provider,
      measurements: Array.from({length:400}, (_, i) => ({value:i, unit:'cm', timestamp:new Date(Date.UTC(2026,9,5,0,i * 15)).toISOString()})).reverse(),
    }});
  });
  await page.goto('/'); await navigate(page,'Pegel');
  await page.locator('.station-table-row').filter({hasText:'Testpegel Bode'}).click();
  await expect(page.getByText('Der Messwertverlauf konnte nicht geladen werden.', {exact:true})).toBeVisible();
  invalid = false;
  await page.getByRole('button', {name:'Verlauf erneut laden'}).click();
  await expect(page.locator('.history-chart svg')).toHaveAttribute('aria-label', /Wasserstand von 0 bis 399 cm/);
  await expect(page.locator('.history-chart')).toContainText('400 Beobachtungen');
  await page.getByText('Messwerte als Tabelle', {exact:true}).click();
  await expect(page.locator('.history-values tbody tr')).toHaveCount(400);
  await noHorizontalOverflow(page);
});

test('rapid station selection cannot show the previous response and one observation is visible', async ({ page }) => {
  await mockData(page);
  let release!: () => void;
  let requested!: () => void;
  const started = new Promise<void>(resolve => { requested = resolve; });
  const pending = new Promise<void>(resolve => { release = resolve; });
  await page.route('**/api/v1/stations/test-station/history', async route => {
    requested(); await pending;
    await route.fulfill({json:{stationId:'test-station', parameter:'W', provider, measurements:[{value:10, unit:'cm', timestamp:'2026-10-09T07:00:00Z'}, {value:20, unit:'cm', timestamp:'2026-10-09T08:00:00Z'}]}}).catch(() => {});
  });
  await page.route('**/api/v1/stations/test-magdeburg/history', route => route.fulfill({json:{
    stationId:'test-magdeburg', parameter:'W', provider, measurements:[{value:0, unit:'cm', timestamp:'2026-10-09T08:00:00Z'}],
  }}));
  await page.goto('/'); await navigate(page,'Pegel');
  await page.locator('.station-table-row').filter({hasText:'Testpegel Bode'}).click();
  await started;
  const search = page.getByRole('textbox', {name:'Pegel, Flüsse und Talsperren suchen'});
  await search.fill('Testpegel Magdeburg'); await search.press('Enter');
  await expect(page.getByRole('heading', {name:'Testpegel Magdeburg', exact:true})).toBeVisible();
  await expect(page.locator('.history-chart svg')).toHaveAttribute('aria-label', /Wasserstand von 0 bis 0 cm/);
  release();
  await expect(page.locator('.history-chart')).toContainText('Bisher eine Beobachtung.');
  await expect(page.locator('.history-chart svg circle')).toHaveCount(1);
  await expect(page.locator('.level-label')).toContainText('Keine amtliche Einstufung verfügbar');
  if (test.info().project.name === 'mobile') {
    const detail = await page.locator('#selection-detail').boundingBox();
    expect(detail!.y).toBeGreaterThanOrEqual(0);
    expect(detail!.y).toBeLessThan(80);
  }
  await noHorizontalOverflow(page);
});
