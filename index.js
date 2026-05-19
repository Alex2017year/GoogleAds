const Koa = require('koa');
const Router = require('koa-router');
const views = require('koa-views');
const serve = require('koa-static');
const koaMount = require('koa-mount');
const path = require('path');
const https = require('https');
const fs = require('fs');

function getRandomAssetSourceTime() {
  const daysAgo = 2 + Math.floor(Math.random() * 2); // 2 or 3 days ago
  const date = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000);
  date.setHours(Math.floor(Math.random() * 24));
  date.setMinutes(Math.floor(Math.random() * 60));
  date.setSeconds(Math.floor(Math.random() * 60));

  const pad = (value) => String(value).padStart(2, '0');
  const year = date.getFullYear();
  const month = pad(date.getMonth() + 1);
  const day = pad(date.getDate());
  const hours = pad(date.getHours());
  const minutes = pad(date.getMinutes());
  const seconds = pad(date.getSeconds());

  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}

const app = new Koa();
const router = new Router();
const transform = require('./transform');

// 配置模板引擎
app.use(views(path.join(__dirname, 'views'), {
  extension: 'ejs'
}));

// 静态资源服务
app.use(serve(path.join(__dirname, 'public')));
app.use(koaMount('/adassets', serve(path.join(__dirname, 'adassets'))));

async function renderHomePage(ctx) {
  // 调用 transform.js 中的函数，将 Excel 文件转换为 JSON 文件
  await transform.main();

  await ctx.render('index', {});
}

app.use(async (ctx, next) => {
  if ((ctx.method === 'GET' || ctx.method === 'HEAD') && (ctx.path === '/aw/reporteditor' || ctx.path.startsWith('/aw/reporteditor/'))) {
    await renderHomePage(ctx);
    return;
  }

  await next();
});

// 路由配置
router.get('/', renderHomePage);

router.get('/aw/reporteditor/view', renderHomePage);

async function renderGoogleAdsPage(ctx, page) {
  await transform.googleAdsMain();
  await ctx.render('google_ads', { page });
}

router.get('/aw/campaigns', async (ctx) => {
  await renderGoogleAdsPage(ctx, 'campaigns');
});

router.get('/aw/adgroups', async (ctx) => {
  await renderGoogleAdsPage(ctx, 'adgroups');
});

router.get('/aw/adassets', async (ctx) => {
  await renderGoogleAdsPage(ctx, 'adassets');
});

// Ad assets 资源接口
router.get('/api/adassets/plan1', async (ctx) => {
  const baseDir = path.join(__dirname, 'adassets', 'plan1');
  const assets = [];
  const assetIDs = ['359184726315','359102948571','359176430982','359193857264','359128640759','359165209843','359147582936','359210374685','359189264157','359132758409','359154890276','359167482905','359121940683','359198357124','359143276890','359175809432','359106528741'];
  const sizeName = ['1080 × 1080','1080 × 1080','1080 × 1080','1080 × 1080','1080 × 1080','1080 × 1080','1080 × 1080','1080 × 1080','1080 × 1080','1080 × 1080','1080 × 1080','1080 × 1080','1080 × 1080','1080 × 1080','1080 × 1080',];

  // 10 条图片
  for (let i = 1; i <= 10; i++) {
    const imgPath = path.join(baseDir, `img${i}.jpg`);
    assets.push({
      id: assetIDs[i],
      // asset: `Image ${i}`,
      asset: sizeName[i],
      assetType: 'Image',
      source: `Free stock image - ${getRandomAssetSourceTime()}_1.870`,
      status: 'Eligible',
      performance: 'Pending',
      image: `/adassets/plan1/img${i}.jpg`,
      share: Math.random() * 0.3 + 0.02
    });
  }

  // 3 条 headline
  for (let i = 1; i <= 3; i++) {
    const txtPath = path.join(baseDir, `headline${i}.txt`);
    let text = '';
    try { text = fs.readFileSync(txtPath, 'utf-8').trim(); } catch (e) {}
    assets.push({
      id: `headline-${i}`,
      asset: text || `Headline ${i}`,
      assetType: 'Headline',
      status: 'Eligible',
      performance: 'Pending',
      headlineText: text || `Headline ${i}`,
      share: Math.random() * 0.3 + 0.02
    });
  }

  // 3 条 description
  for (let i = 1; i <= 3; i++) {
    const txtPath = path.join(baseDir, `description${i}.txt`);
    let text = '';
    try { text = fs.readFileSync(txtPath, 'utf-8').trim(); } catch (e) {}
    assets.push({
      id: `desc-${i}`,
      asset: text || `Description ${i}`,
      assetType: 'Description',
      status: 'Eligible',
      performance: 'Pending',
      descriptionText: text || `Description ${i}`,
      share: Math.random() * 0.3 + 0.02
    });
  }

  ctx.body = { assets };
});

// Ad assets 图片接口
router.get('/api/adassets/plan1/image/:id', async (ctx) => {
  const imgPath = path.join(__dirname, 'adassets', 'plan1', `img${ctx.params.id}.jpg`);
  try {
    const imgBuffer = fs.readFileSync(imgPath);
    ctx.type = 'image/jpeg';
    ctx.body = imgBuffer;
  } catch (e) {
    ctx.status = 404;
    ctx.body = 'Not found';
  }
});

router.get('/adsmanager/reporting/manage', async (ctx) => {
  await ctx.render('manage', {});
});
router.get('/adsmanager/reporting/business_view', async (ctx) => {
  await ctx.render('business_view', {});
});

// 注册路由
app.use(router.routes());
app.use(router.allowedMethods());

// HTTPS 配置
const sslOptions = {
  key: fs.readFileSync(path.join(__dirname, 'ssl', 'key.pem')),
  cert: fs.readFileSync(path.join(__dirname, 'ssl', 'cert.pem'))
};

// 启动 HTTPS 服务器
const HTTPS_PORT = process.env.PORT || 443;
https.createServer(sslOptions, app.callback()).listen(HTTPS_PORT, () => {
  console.log(`HTTPS Server is running on https://ads.google.com:${HTTPS_PORT}`);
  console.log(`HTTPS Server is running on https://localhost:${HTTPS_PORT}`);
});
