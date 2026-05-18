const Koa = require('koa');
const Router = require('koa-router');
const views = require('koa-views');
const serve = require('koa-static');
const koaMount = require('koa-mount');
const path = require('path');
const https = require('https');
const fs = require('fs');

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

  // 10 条图片
  for (let i = 1; i <= 10; i++) {
    const imgPath = path.join(baseDir, `img${i}.jpg`);
    assets.push({
      id: `img-${i}`,
      asset: `Image ${i}`,
      assetType: 'Image',
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
