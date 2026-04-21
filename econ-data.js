// ============================================================
// econ-data.js  —  Dr. Ed's Economic Chart
// Shared between chart.html and admin.html
// Database: Supabase (PostgreSQL via REST)
// ============================================================

// ── CONFIGURE YOUR SUPABASE PROJECT ───────────────────────
const SUPABASE_URL      = 'https://gtzwdcrkcavaafbsodzw.supabase.co/rest/v1/';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd0endkY3JrY2F2YWFmYnNvZHp3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY3ODcxOTMsImV4cCI6MjA5MjM2MzE5M30.0rumJkOGutGBI86DIMWYj_-eOvBFlm0V4XC7Jde6ZFw';
// ──────────────────────────────────────────────────────────
// SQL to run in Supabase SQL Editor to create required tables:
//
//   create table econ_datapoints (
//     indicator text not null,
//     period    text not null,
//     value     text,
//     primary key (indicator, period)
//   );
//   alter table econ_datapoints enable row level security;
//   create policy "public read"  on econ_datapoints for select using (true);
//   create policy "anon insert"  on econ_datapoints for insert with check (true);
//   create policy "anon update"  on econ_datapoints for update using (true);
//   create policy "anon delete"  on econ_datapoints for delete using (true);
//
//   create table econ_meta (
//     key   text primary key,
//     value text
//   );
//   alter table econ_meta enable row level security;
//   create policy "public read"  on econ_meta for select using (true);
//   create policy "anon write"   on econ_meta for all using (true) with check (true);
// ──────────────────────────────────────────────────────────

const FRED_API_KEY = '200289ff3a7c48065226a6e82da446b0';

const MONTH_ABBR = ['','Jan','Feb','Mar','Apr','May','Jun',
                    'Jul','Aug','Sep','Oct','Nov','Dec'];

// Latest displayed month = prior month-end relative to today
// e.g. if today = Apr 21 2026 → latest month = 2026-03
function getLatestMonthKey() {
  const now = new Date();
  const d = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
}

function getMonthColumns(count) {
  const [ly, lm] = getLatestMonthKey().split('-').map(Number);
  const cols = [];
  for (let i = count - 1; i >= 0; i--) {
    const d = new Date(ly, lm - 1 - i, 1);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2,'0');
    cols.push({ key:`${y}-${m}`, label:`${MONTH_ABBR[+m]}-${String(y).slice(2)}` });
  }
  return cols;
}

function getYearColumns(count) {
  const y = new Date().getFullYear();
  const cols = [];
  for (let i = count - 1; i >= 0; i--)
    cols.push({ key: String(y - i), label: String(y - i) });
  return cols;
}

// ── FRED SERIES DEFINITIONS ────────────────────────────────
const FRED_SERIES = {
  'ISM Manufacturing Index':
    { id:'NAPM',          fmt: x => +x.toFixed(2) },
  'Federal Funds Rate-%':
    { id:'FEDFUNDS',      fmt: x => +x.toFixed(2) },
  'Prime Rate-%':
    { id:'DPRIME',        fmt: x => +x.toFixed(2) },
  '3-Month Treasury Bill-%':
    { id:'TB3MS',         fmt: x => +x.toFixed(2) },
  '10-Year Treasury CMT % (Month Average)':
    { id:'GS10',          fmt: x => +x.toFixed(2) },
  '30 Year Mortgage Rate-%':
    { id:'MORTGAGE30US',  fmt: x => +x.toFixed(2) },
  'SOFR -%':
    { id:'SOFR',          fmt: x => +x.toFixed(2) },
  'Japan (Yen ¥ per US $1)':
    { id:'DEXJPUS',       fmt: x => +x.toFixed(2) },
  'Europe (US $ per Euro €1)':
    { id:'DEXUSEU',       fmt: x => +x.toFixed(2) },
  'U.S. Trade Deficit-$ bil':
    { id:'BOPGSTB',       fmt: x => +x.toFixed(1) },
  'M2-Money Supply- $ bil':
    { id:'M2SL',          fmt: x => Math.round(x) },
  'U.S. Coincident Index (2016=100)':
    { id:'USPHCI',        fmt: x => +x.toFixed(2) },
  'Industrial Prod. Index (2017=100)':
    { id:'INDPRO',        fmt: x => +x.toFixed(2) },
  'U.S. Unemployment Rate-%':
    { id:'UNRATE',        fmt: x => +x.toFixed(1) },
  'Capacity Utilization Rate-%':
    { id:'TCU',           fmt: x => +x.toFixed(2) },
  'Retail & Food Service Sales-$ bil':
    { id:'RSXFS',         fmt: x => +(x/1000).toFixed(2) },
  'Housing Starts, millions-units':
    { id:'HOUST',         fmt: x => +(x/1000).toFixed(2) },
  'Average Hourly Earnings-$':
    { id:'CES0500000003', fmt: x => +x.toFixed(2) },
  'Producer Price Index LTM%':
    { id:'PPIACO',        fmt:null, isYoY:true },
  'Consumer Price Index LTM%':
    { id:'CPIAUCSL',      fmt:null, isYoY:true },
  'Core Inflation Index LTM%':
    { id:'CPILFESL',      fmt:null, isYoY:true },
  'Dow Jones Industrial Average':
    { id:'DJIA',          fmt: x => Math.round(x) },
  'NASDAQ':
    { id:'NASDAQCOM',     fmt: x => Math.round(x) },
  'U.S. Treasury Yield Spread (10y-3m Monthly Avgerage)': {
    id:null, isComputed:true, components:['GS10','TB3MS'],
    fmt:(a,b) => +(a-b).toFixed(2)
  },
};

const MANUAL_ONLY = [
  'U.S. Leading/Diffusion Index (2016=100)',
  'Recession Threat Index-%',
  'London Interbank Offered Rate-%',
  'New Jobs (Total Nonfarm) - millions S.A.',
  'Gold-$ per ounce',
  'Copper-$ per Pound',
  'Oil Price-$ per Barrel',
  'Corn (No. 2 N. Central Ill.)-$ per bu',
  'Wheat (KC Hard)-$ per bu',
  'Beef (Dressed Steer 80% Choice)',
];

const SECTIONS = [
  { name:'Forecast Indicators', key:'forecast', indicators:[
    'U.S. Leading/Diffusion Index (2016=100)',
    'ISM Manufacturing Index',
    'Recession Threat Index-%',
    'U.S. Treasury Yield Spread (10y-3m Monthly Avgerage)',
  ]},
  { name:'Rates & Financial Indicators', key:'rates', indicators:[
    'Federal Funds Rate-%','Prime Rate-%','3-Month Treasury Bill-%',
    '10-Year Treasury CMT % (Month Average)','30 Year Mortgage Rate-%',
    'London Interbank Offered Rate-%','SOFR -%',
    'Japan (Yen ¥ per US $1)','Europe (US $ per Euro €1)',
    'U.S. Trade Deficit-$ bil','M2-Money Supply- $ bil',
  ]},
  { name:'Production & Business Activity', key:'production', indicators:[
    'U.S. Coincident Index (2016=100)','Industrial Prod. Index (2017=100)',
    'New Jobs (Total Nonfarm) - millions S.A.','U.S. Unemployment Rate-%',
    'Capacity Utilization Rate-%','Retail & Food Service Sales-$ bil',
    'Housing Starts, millions-units','Average Hourly Earnings-$',
  ]},
  { name:'Prices & Financial Indicators', key:'prices', indicators:[
    'Gold-$ per ounce','Copper-$ per Pound','Oil Price-$ per Barrel',
    'Corn (No. 2 N. Central Ill.)-$ per bu','Wheat (KC Hard)-$ per bu',
    'Beef (Dressed Steer 80% Choice)',
    'Producer Price Index LTM%','Consumer Price Index LTM%','Core Inflation Index LTM%',
    'Dow Jones Industrial Average','NASDAQ',
  ]},
];

// ── SEED DATA ──────────────────────────────────────────────
const SEED_DATA = {
  'U.S. Leading/Diffusion Index (2016=100)': {
    '2021':'120.2/70','2022':'112.3/30','2023':'104.7/60','2024':'101.6/40','2025':'111.2/50',
    '2025-03':'100.4/35','2025-04':'99.1/0','2025-05':'99.1/50','2025-06':'98.8/45',
    '2025-07':'98.8/70','2025-08':'98.5/40','2025-09':'98.3/35','2025-10':'98.1/50',
    '2025-11':'97.8/60','2025-12':'97.6/50','2026-01':'97.5/60',
  },
  'ISM Manufacturing Index': {
    '2021':58.30,'2022':48.00,'2023':46.90,'2024':49.20,'2025':47.90,
    '2025-03':48.90,'2025-04':48.80,'2025-05':48.60,'2025-06':49.00,
    '2025-07':48.40,'2025-08':48.90,'2025-09':48.90,'2025-10':48.80,
    '2025-11':48.00,'2025-12':47.90,'2026-01':52.60,'2026-02':52.40,'2026-03':52.70,
  },
  'Recession Threat Index-%': {
    '2021':7.50,'2022':67.50,'2023':50.00,'2024':43.75,'2025':48.75,
    '2025-03':63.75,'2025-04':75.00,'2025-05':50.00,'2025-06':58.75,
    '2025-07':35.00,'2025-08':52.50,'2025-09':50.75,'2025-10':48.75,
    '2025-11':48.50,'2025-12':48.75,'2026-01':42.50,
  },
  'U.S. Treasury Yield Spread (10y-3m Monthly Avgerage)': {
    '2021':1.48,'2022':-0.49,'2023':-1.46,'2024':0.26,'2025':0.55,
    '2025-03':-0.02,'2025-04':-0.01,'2025-05':0.08,'2025-06':0.08,
    '2025-07':0.05,'2025-08':0.11,'2025-09':0.18,'2025-10':0.24,
    '2025-11':0.29,'2025-12':0.51,'2026-01':0.55,'2026-02':0.47,'2026-03':0.57,
  },
  'Federal Funds Rate-%': {
    '2021':0.25,'2022':4.50,'2023':5.50,'2024':4.50,'2025':3.75,
    '2025-03':4.50,'2025-04':4.50,'2025-05':4.50,'2025-06':4.50,
    '2025-07':4.50,'2025-08':4.50,'2025-09':4.25,'2025-10':4.00,
    '2025-11':4.00,'2025-12':3.75,'2026-01':3.75,'2026-02':3.75,'2026-03':3.75,
  },
  'Prime Rate-%': {
    '2021':3.25,'2022':7.50,'2023':8.50,'2024':7.50,'2025':6.75,
    '2025-03':7.50,'2025-04':7.50,'2025-05':7.50,'2025-06':7.50,
    '2025-07':7.50,'2025-08':7.50,'2025-09':7.25,'2025-10':7.00,
    '2025-11':7.00,'2025-12':6.75,'2026-01':6.75,'2026-02':6.75,'2026-03':6.75,
  },
  '3-Month Treasury Bill-%': {
    '2021':0.04,'2022':4.37,'2023':5.34,'2024':4.32,'2025':3.63,
    '2025-03':4.30,'2025-04':4.29,'2025-05':4.34,'2025-06':4.30,
    '2025-07':4.34,'2025-08':4.15,'2025-09':3.94,'2025-10':3.82,
    '2025-11':3.80,'2025-12':3.63,'2026-01':3.66,'2026-02':3.66,'2026-03':3.68,
  },
  '10-Year Treasury CMT % (Month Average)': {
    '2021':1.52,'2022':3.88,'2023':3.88,'2024':4.58,'2025':4.18,
    '2025-03':4.28,'2025-04':4.28,'2025-05':4.42,'2025-06':4.38,
    '2025-07':4.39,'2025-08':4.26,'2025-09':4.12,'2025-10':4.06,
    '2025-11':4.09,'2025-12':4.14,'2026-01':4.21,'2026-02':4.13,'2026-03':4.25,
  },
  '30 Year Mortgage Rate-%': {
    '2021':3.11,'2022':6.42,'2023':6.61,'2024':6.85,'2025':6.15,
    '2025-03':6.65,'2025-04':6.81,'2025-05':6.89,'2025-06':6.77,
    '2025-07':6.72,'2025-08':6.56,'2025-09':6.30,'2025-10':6.17,
    '2025-11':6.23,'2025-12':6.15,'2026-01':6.10,'2026-02':5.98,'2026-03':6.38,
  },
  'London Interbank Offered Rate-%': { '2021':0.21,'2022':4.77,'2023':5.59,'2024':4.85 },
  'SOFR -%': {
    '2021':0.05,'2022':4.30,'2023':5.38,'2024':4.49,'2025':3.87,
    '2025-03':4.41,'2025-04':4.41,'2025-05':4.35,'2025-06':4.45,
    '2025-07':4.39,'2025-08':4.34,'2025-09':4.24,'2025-10':4.22,
    '2025-11':4.12,'2025-12':3.87,'2026-01':3.68,'2026-02':3.68,'2026-03':3.68,
  },
  'Japan (Yen ¥ per US $1)': {
    '2021':115.08,'2022':131.12,'2023':141.04,'2024':157.20,'2025':156.71,
    '2025-03':149.96,'2025-04':143.07,'2025-05':144.02,'2025-06':144.03,
    '2025-07':150.75,'2025-08':147.05,'2025-09':147.90,'2025-10':153.99,
    '2025-11':156.18,'2025-12':156.71,'2026-01':154.78,'2026-02':156.05,'2026-03':158.72,
  },
  'Europe (US $ per Euro €1)': {
    '2021':1.14,'2022':1.07,'2023':1.10,'2024':1.04,'2025':1.17,
    '2025-03':1.08,'2025-04':1.13,'2025-05':1.13,'2025-06':1.18,
    '2025-07':1.14,'2025-08':1.17,'2025-09':1.17,'2025-10':1.15,
    '2025-11':1.16,'2025-12':1.17,'2026-01':1.19,'2026-02':1.18,'2026-03':1.16,
  },
  'U.S. Trade Deficit-$ bil': {
    '2021':-79.2,'2022':-70.5,'2023':-63.9,'2024':-96.9,'2025':-72.9,
    '2025-03':-135.9,'2025-04':-60.1,'2025-05':-70.6,'2025-06':-57.6,
    '2025-07':-74.2,'2025-08':-56.0,'2025-09':-49.2,'2025-10':-31.1,
    '2025-11':-56.0,'2025-12':-72.9,'2026-01':-54.7,
  },
  'M2-Money Supply- $ bil': {
    '2021':21499,'2022':21291,'2023':20778,'2024':21485,'2025':22387,
    '2025-03':21913,'2025-04':21703,'2025-05':21699,'2025-06':21949,
    '2025-07':21884,'2025-08':21972,'2025-09':22063,'2025-10':22097,
    '2025-11':22266,'2025-12':22635,'2026-01':22385,'2026-02':22579,
  },
  'U.S. Coincident Index (2016=100)': {
    '2021':108.40,'2022':109.70,'2023':112.30,'2024':114.20,'2025':115.00,
    '2025-03':114.70,'2025-04':114.80,'2025-05':114.60,'2025-06':114.60,
    '2025-07':115.00,'2025-08':114.90,'2025-09':114.80,'2025-10':114.70,
    '2025-11':114.80,'2025-12':115.00,'2026-01':115.30,
  },
  'Industrial Prod. Index (2017=100)': {
    '2021':99.29,'2022':100.98,'2023':100.76,'2024':100.11,'2025':101.27,
    '2025-03':101.04,'2025-04':101.13,'2025-05':100.97,'2025-06':101.48,
    '2025-07':101.89,'2025-08':101.62,'2025-09':101.67,'2025-10':101.21,
    '2025-11':101.36,'2025-12':101.68,'2026-01':102.40,'2026-02':102.55,
  },
  'New Jobs (Total Nonfarm) - millions S.A.': {
    '2021':7.268,'2022':4.526,'2023':2.515,'2024':1.459,'2025':0.116,
    '2025-03':0.067,'2025-04':0.108,'2025-05':0.013,'2025-06':-0.020,
    '2025-07':0.064,'2025-08':-0.070,'2025-09':0.076,'2025-10':-0.140,
    '2025-11':0.041,'2025-12':-0.017,'2026-01':0.160,'2026-02':-0.133,'2026-03':0.178,
  },
  'U.S. Unemployment Rate-%': {
    '2021':3.90,'2022':3.50,'2023':3.80,'2024':4.10,'2025':4.40,
    '2025-03':4.20,'2025-04':4.20,'2025-05':4.30,'2025-06':4.10,
    '2025-07':4.30,'2025-08':4.30,'2025-09':4.40,'2025-10':4.50,
    '2025-11':4.40,'2025-12':4.30,'2026-01':4.40,'2026-02':4.30,
  },
  'Capacity Utilization Rate-%': {
    '2021':76.92,'2022':78.49,'2023':77.34,'2024':76.10,'2025':75.98,
    '2025-03':76.13,'2025-04':76.10,'2025-05':75.89,'2025-06':76.18,
    '2025-07':76.40,'2025-08':76.11,'2025-09':76.05,'2025-10':75.61,
    '2025-11':75.63,'2025-12':75.78,'2026-01':76.25,'2026-02':76.29,'2026-03':76.29,
  },
  'Retail & Food Service Sales-$ bil': {
    '2021':619.94,'2022':651.76,'2023':686.28,'2024':717.27,'2025':734.72,
    '2025-03':722.57,'2025-04':721.79,'2025-05':716.10,'2025-06':723.03,
    '2025-07':727.73,'2025-08':731.70,'2025-09':732.19,'2025-10':731.05,
    '2025-11':734.72,'2025-12':734.72,'2026-01':733.96,'2026-02':738.37,
  },
  'Housing Starts, millions-units': {
    '2021':1.72,'2022':1.31,'2023':1.52,'2024':1.51,'2025':1.39,
    '2025-03':1.36,'2025-04':1.40,'2025-05':1.28,'2025-06':1.38,
    '2025-07':1.42,'2025-08':1.29,'2025-09':1.33,'2025-10':1.27,
    '2025-11':1.32,'2025-12':1.39,'2026-01':1.49,
  },
  'Average Hourly Earnings-$': {
    '2021':26.70,'2022':28.17,'2023':29.43,'2024':30.76,'2025':31.76,
    '2025-03':31.02,'2025-04':31.09,'2025-05':31.20,'2025-06':31.31,
    '2025-07':31.39,'2025-08':31.49,'2025-09':31.56,'2025-10':31.70,
    '2025-11':31.79,'2025-12':31.83,'2026-01':31.94,'2026-02':32.02,'2026-03':32.07,
  },
  'Gold-$ per ounce': {
    '2021':1827,'2022':1822,'2023':2062,'2024':2614,'2025':4344,
    '2025-03':3114,'2025-04':3309,'2025-05':3295,'2025-06':3281,
    '2025-07':3310,'2025-08':3428,'2025-09':3820,'2025-10':4030,
    '2025-11':4150,'2025-12':4344,'2026-01':5033,'2026-02':5232,'2026-03':4592,
  },
  'Copper-$ per Pound': {
    '2021':4.46,'2022':3.81,'2023':3.89,'2024':4.03,'2025':5.68,
    '2025-03':5.03,'2025-04':4.56,'2025-05':4.68,'2025-06':5.03,
    '2025-07':4.35,'2025-08':4.52,'2025-09':4.86,'2025-10':5.09,
    '2025-11':5.19,'2025-12':5.68,'2026-01':5.92,'2026-02':6.00,'2026-03':5.61,
  },
  'Oil Price-$ per Barrel': {
    '2021':77.97,'2022':81.29,'2023':78.44,'2024':74.59,'2025':60.96,
    '2025-03':76.89,'2025-04':63.69,'2025-05':63.18,'2025-06':68.35,
    '2025-07':75.34,'2025-08':70.63,'2025-09':69.42,'2025-10':66.84,
    '2025-11':64.37,'2025-12':60.96,'2026-01':66.91,'2026-02':70.07,'2026-03':123.21,
  },
  'Corn (No. 2 N. Central Ill.)-$ per bu': {
    '2021':5.78,'2022':6.58,'2023':4.33,'2024':4.29,'2025':4.13,
    '2025-03':4.29,'2025-04':4.37,'2025-05':4.17,'2025-06':3.99,
    '2025-07':3.81,'2025-08':3.81,'2025-09':3.74,'2025-10':3.97,
    '2025-11':4.14,'2025-12':4.13,'2026-01':3.91,'2026-02':4.08,'2026-03':4.31,
  },
  'Wheat (KC Hard)-$ per bu': {
    '2021':8.12,'2022':9.43,'2023':6.77,'2024':5.59,'2025':4.95,
    '2025-03':5.62,'2025-04':5.24,'2025-05':5.43,'2025-06':5.21,
    '2025-07':5.04,'2025-08':5.20,'2025-09':5.12,'2025-10':4.95,
    '2025-11':5.25,'2025-12':5.53,'2026-01':6.26,'2026-02':5.72,'2026-03':6.26,
  },
  'Beef (Dressed Steer 80% Choice)': {
    '2021':221.48,'2022':254.46,'2023':274.35,'2024':310.31,'2025':355.00,
    '2025-03':339.56,'2025-04':350.00,'2025-05':370.29,'2025-06':370.37,
    '2025-07':382.00,'2025-08':387.00,'2025-09':360.00,'2025-10':360.88,
    '2025-11':328.00,'2025-12':355.00,'2026-01':371.30,'2026-02':382.88,'2026-03':371.54,
  },
  'Producer Price Index LTM%': {
    '2021':12.3,'2022':8.9,'2023':0.1,'2024':2.8,'2025':2.2,
    '2025-03':0.8,'2025-04':0.3,'2025-05':1.2,'2025-06':1.9,
    '2025-07':1.9,'2025-08':1.9,'2025-09':3.1,'2025-10':2.5,
    '2025-11':2.8,'2025-12':2.2,'2026-01':1.0,'2026-02':1.7,
  },
  'Consumer Price Index LTM%': {
    '2021':7.0,'2022':6.5,'2023':3.4,'2024':2.9,'2025':2.7,
    '2025-03':2.4,'2025-04':2.3,'2025-05':2.4,'2025-06':2.7,
    '2025-07':2.7,'2025-08':2.9,'2025-09':3.0,'2025-10':2.7,
    '2025-11':2.7,'2025-12':2.4,'2026-01':2.4,'2026-02':2.4,'2026-03':3.3,
  },
  'Core Inflation Index LTM%': {
    '2021':5.5,'2022':5.7,'2023':3.9,'2024':3.2,'2025':2.6,
    '2025-03':2.8,'2025-04':2.8,'2025-05':2.8,'2025-06':2.9,
    '2025-07':3.1,'2025-08':3.1,'2025-09':3.0,'2025-10':2.6,
    '2025-11':2.6,'2025-12':2.5,'2026-01':2.5,'2026-02':2.5,'2026-03':2.6,
  },
  'Dow Jones Industrial Average': {
    '2021':36338,'2022':33147,'2023':37690,'2024':42544,'2025':48063,
    '2025-03':42002,'2025-04':40669,'2025-05':42270,'2025-06':44095,
    '2025-07':44131,'2025-08':45545,'2025-09':46398,'2025-10':47563,
    '2025-11':47716,'2025-12':48063,'2026-01':48892,'2026-02':48978,'2026-03':46342,
  },
  'NASDAQ': {
    '2021':15645,'2022':10466,'2023':15011,'2024':19311,'2025':23242,
    '2025-03':17299,'2025-04':17446,'2025-05':19114,'2025-06':20370,
    '2025-07':21122,'2025-08':21456,'2025-09':22660,'2025-10':23725,
    '2025-11':23366,'2025-12':23242,'2026-01':23462,'2026-02':22668,'2026-03':21591,
  },
};

// ── SUPABASE REST CLIENT ───────────────────────────────────
const sb = {
  _h() {
    return {
      'apikey': SUPABASE_ANON_KEY,
      'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
      'Content-Type': 'application/json',
    };
  },
  async query(table, opts={}) {
    const p = new URLSearchParams();
    if (opts.select) p.set('select', opts.select);
    if (opts.eq) Object.entries(opts.eq).forEach(([k,v]) => p.append(k,`eq.${v}`));
    if (opts.order) p.set('order', opts.order);
    const r = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${p}`, { headers: this._h() });
    if (!r.ok) throw new Error(`Supabase query ${table}: ${r.status} — ${await r.text()}`);
    return r.json();
  },
  async upsert(table, rows) {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
      method:'POST',
      headers:{ ...this._h(), 'Prefer':'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify(Array.isArray(rows) ? rows : [rows]),
    });
    if (!r.ok) throw new Error(`Supabase upsert ${table}: ${r.status} — ${await r.text()}`);
  },
  async delete(table, eq) {
    const p = new URLSearchParams();
    Object.entries(eq).forEach(([k,v]) => p.append(k,`eq.${v}`));
    const r = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${p}`, {
      method:'DELETE', headers: this._h(),
    });
    if (!r.ok) throw new Error(`Supabase delete ${table}: ${r.status}`);
  },
  async getMeta(key) {
    const rows = await this.query('econ_meta', { eq:{key} });
    return rows[0]?.value ?? null;
  },
  async setMeta(key, value) {
    await this.upsert('econ_meta', { key, value });
  },
};

// ── DATA CACHE ─────────────────────────────────────────────
let DATA_CACHE = {};

async function loadCache() {
  const rows = await sb.query('econ_datapoints', { select:'indicator,period,value', order:'period.asc' });
  DATA_CACHE = {};
  for (const row of rows) {
    if (!DATA_CACHE[row.indicator]) DATA_CACHE[row.indicator] = {};
    DATA_CACHE[row.indicator][row.period] = row.value;
  }
  return DATA_CACHE;
}

async function saveDataPoint(indicator, period, value) {
  // Store value as string to handle mixed types (numbers + "120.2/70" combos)
  await sb.upsert('econ_datapoints', { indicator, period, value: String(value) });
  if (!DATA_CACHE[indicator]) DATA_CACHE[indicator] = {};
  DATA_CACHE[indicator][period] = String(value);
}

async function deleteDataPoint(indicator, period) {
  await sb.delete('econ_datapoints', { indicator, period });
  if (DATA_CACHE[indicator]) delete DATA_CACHE[indicator][period];
}

async function seedIfEmpty() {
  // Check if any data exists
  const rows = await sb.query('econ_datapoints', { select:'indicator', eq:{ indicator:'ISM Manufacturing Index' } });
  if (rows.length > 0) return false;
  // Seed in batches
  const batch = [];
  for (const [indicator, periods] of Object.entries(SEED_DATA))
    for (const [period, value] of Object.entries(periods))
      batch.push({ indicator, period, value: String(value) });
  for (let i = 0; i < batch.length; i += 400)
    await sb.upsert('econ_datapoints', batch.slice(i, i+400));
  return true;
}

function getValue(indicator, period) {
  return DATA_CACHE[indicator]?.[period] ?? null;
}

function fmtVal(v) {
  if (v === null || v === undefined || v === '') return '';
  if (typeof v === 'string' && v.includes('/')) return v; // e.g. "120.2/70"
  const n = parseFloat(v);
  if (isNaN(n)) return String(v);
  if (Math.abs(n) >= 10000) return n.toLocaleString('en-US',{maximumFractionDigits:0});
  if (Math.abs(n) >= 1000)  return n.toLocaleString('en-US',{maximumFractionDigits:0});
  return n.toFixed(2);
}

// ── FRED FETCH ─────────────────────────────────────────────
async function refreshFREDData(onProgress) {
  const startDate = `${new Date().getFullYear()-15}-01-01`;
  let fetched=0, errors=0;
  const directSeries = {};

  for (const [,cfg] of Object.entries(FRED_SERIES)) {
    if (cfg.isComputed || !cfg.id) continue;
    try {
      onProgress && onProgress(`Fetching ${cfg.id}…`);
      const url = `https://api.stlouisfed.org/fred/series/observations?series_id=${cfg.id}&api_key=${FRED_API_KEY}&file_type=json&observation_start=${startDate}&frequency=m&aggregation_method=eop`;
      const r = await fetch(url);
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const data = await r.json();
      directSeries[cfg.id] = data.observations || [];
      fetched++;
    } catch(e) {
      console.warn(e); errors++;
    }
  }

  const batch = [];

  for (const [ind, cfg] of Object.entries(FRED_SERIES)) {
    if (cfg.isComputed || !cfg.id || !directSeries[cfg.id]) continue;
    const byYM={}, byY={};
    for (const o of directSeries[cfg.id]) {
      if (o.value==='.') continue;
      const v=parseFloat(o.value); if (isNaN(v)) continue;
      const [y,m]=o.date.split('-'); const ym=`${y}-${m}`;
      byYM[ym]=v;
      if (!byY[y]||m>=(byY[y].m||'00')) byY[y]={v,m};
    }
    if (cfg.isYoY) {
      for (const ym of Object.keys(byYM).sort()) {
        const [y,mo]=ym.split('-'), prev=`${y-1}-${mo}`;
        if (byYM[prev]) batch.push({indicator:ind,period:ym,value:String(+((byYM[ym]-byYM[prev])/byYM[prev]*100).toFixed(1))});
      }
      for (const [yr,d] of Object.entries(byY)) {
        const prev=`${yr-1}-${d.m}`;
        if (byYM[prev]) batch.push({indicator:ind,period:yr,value:String(+((d.v-byYM[prev])/byYM[prev]*100).toFixed(1))});
      }
    } else {
      const fmt=cfg.fmt||(x=>x);
      for (const [ym,v] of Object.entries(byYM)) batch.push({indicator:ind,period:ym,value:String(fmt(v))});
      for (const [yr,d] of Object.entries(byY))  batch.push({indicator:ind,period:yr, value:String(fmt(d.v))});
    }
  }

  // Yield spread (computed)
  for (const [ind,cfg] of Object.entries(FRED_SERIES)) {
    if (!cfg.isComputed) continue;
    const [aId,bId]=cfg.components;
    const aObs=directSeries[aId], bObs=directSeries[bId];
    if (!aObs||!bObs) continue;
    const bMap={};
    for (const o of bObs) if (o.value!=='.') bMap[o.date.slice(0,7)]=parseFloat(o.value);
    const byY={};
    for (const o of aObs) {
      if (o.value==='.') continue;
      const ym=o.date.slice(0,7), [y,m]=ym.split('-');
      if (bMap[ym]!==undefined) {
        const s=cfg.fmt(parseFloat(o.value),bMap[ym]);
        batch.push({indicator:ind,period:ym,value:String(s)});
        if (!byY[y]||m>=(byY[y]?.m||'00')) byY[y]={v:s,m};
      }
    }
    for (const [yr,d] of Object.entries(byY)) batch.push({indicator:ind,period:yr,value:String(d.v)});
    fetched++;
  }

  onProgress && onProgress(`Saving ${batch.length} records to Supabase…`);
  for (let i=0; i<batch.length; i+=400)
    await sb.upsert('econ_datapoints', batch.slice(i,i+400));

  for (const row of batch) {
    if (!DATA_CACHE[row.indicator]) DATA_CACHE[row.indicator]={};
    DATA_CACHE[row.indicator][row.period]=row.value;
  }

  await sb.setMeta('last_fred_fetch', new Date().toISOString());
  return {fetched, errors};
}
