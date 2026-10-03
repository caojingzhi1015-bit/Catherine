# CAO JINZHI · 曹静致 — Editorial Ocean Portfolio

> 「一个广告学背景的年轻运营者，以海洋为动态画布，用杂志式视觉讲述自己在 AI、内容、产品和海外运营之间不断探索的个人数字档案。」

线上地址：<https://caojingzhi1015-bit.github.io/zuopin2/>

## 这次改版做了什么

- **内容更新**：全部按最新简历（`assets/曹静致-AI内容运营-简历.pdf`）重写——岗位定位从「AI 产品实习生」改为
  **AI 内容运营 / 产品运营 / 海外运营**；项目换成 Follow Builders、艺人跨平台内容数据统计工具、
  AI Agent 工具链开源（halftone-pop / video-script-extractor）、个人 Kpop 自媒体；
  经历补上微博 27 账号矩阵、WMA 音乐盛典、大眼音乐节、A2O 扫楼、《镖人》全周期宣发与校园经历。
- **视觉系统重做**：1990 年代冲浪杂志 × 海洋摄影 × 编辑设计。Anton 超大压缩字 + Oswald 页边元信息 +
  Archivo Narrow 小标题 + Instrument Sans / 系统高级黑体正文。
- **主视觉**：AI 生成的真实海浪视频（10s 乒乓无缝循环，WebM 优先 / MP4 兜底），
  全屏循环，配 Three.js 玻璃体做**屏幕空间折射 + RGB 色散**——像漂在海里的透明观察窗口。
- **动效**：Lenis 平滑滚动 + GSAP ScrollTrigger（首屏视差 / 动态排版 / 横向杂志翻页 / 漂浮文字 /
  自定义光标 / 胶片颗粒 / 水波扭曲）。

## 目录结构

```
zuopin2/
├── index.html            主页（10 个章节）
├── posters.html          作品集子页 · 01 海报设计
├── social.html           作品集子页 · 03 自媒体运营成果
├── assets/
│   ├── style.css         全站视觉系统（token / 排版 / 章节 / 响应式 / 降级）
│   ├── config.js         ★ 全站唯一配置：邮箱、手机、各平台链接、简历文件
│   ├── app.js            配置注入 / 中英双语 / 导航高亮 / 视频源选择 / 渐显标记
│   ├── motion.js         Lenis + GSAP 动效系统
│   ├── ocean.js          Three.js 海洋场景（VideoTexture + 玻璃体折射）
│   ├── gallery.js        子页瀑布流
│   ├── media/            海浪视频、海洋摄影、肖像
│   ├── posters/          海报作品（work / fandom / school）
│   ├── social/           自媒体截图
│   └── 曹静致-AI内容运营-简历.pdf
└── tools/                本地开发脚本（.gitignore，不上线）
```

## 页面结构（滚动叙事）

```
01 HERO 海洋 + JINZHI
→ 跑马灯
→ 02 ABOUT  WHO AM I
→ 03 PRACTICE  AI 内容 / 产品 / 海外 三条能力线
→ 04 WORK  横向杂志翻页的四个项目（问题→为什么→怎么做→结果）
→ 05 EXPERIENCE  巨大年份 + 真实业务数据
→ 06 PORTFOLIO  海报 / 视频 / 自媒体
→ 07 CAPABILITIES  AI / CONTENT / PRODUCT / OVERSEAS
→ 08 CULTURE  THINGS I CARE ABOUT（漂浮文字）
→ 09 AI EXPERIMENTS  WHAT IF?（可持续扩展的档案）
→ 10 CONTACT  LET'S MAKE SOMETHING MOVE.
→ 海洋
```

## 改联系方式 / 链接

只改 `assets/config.js` 一处即可，页面会自动读取：

```js
window.SITE_CONFIG = {
  email: "485014934@qq.com",
  phone: "17555289870",
  portfolio: { label: "...", url: "..." },
  github:    { label: "...", url: "..." },
  instagram: { label: "", url: "" },   // 填空即出现，留空自动隐藏
  weibo:     { label: "", url: "" },
  resume: "assets/曹静致-AI内容运营-简历.pdf"
};
```

## 本地预览

```bash
node tools/serve.js 8918      # 支持 Range，视频能正常播放
# 浏览器打开 http://127.0.0.1:8918/
```

> 直接用 `python -m http.server` 也行，但它不支持 Range 请求，MP4 可能播不动。

## 技术要点

- **零构建**：纯静态 HTML/CSS/JS，直接推 GitHub Pages。
- **CDN**：字体走 jsDelivr fontsource（国内不走 Google Fonts）；GSAP / Lenis / Three.js 走 jsDelivr。
- **字体策略**：拉丁字形用 webfont（Anton / Oswald / Archivo Narrow / Instrument Sans），
  中文走系统高级黑体（PingFang SC / 鸿蒙 / 微软雅黑），**全站无衬线**，不加载几 MB 的中文字体包。
- **性能**：Three.js 只在 ≥981px 且有 WebGL2 时按需 `import()`，移动端只播 MP4/WebM；
  视频首屏外暂停、页面隐藏暂停；DPR 上限 1.5。
- **降级**：GSAP/Lenis/Three 任一不可用 → 自动加 `html.no-anim`，内容全部可见，
  横向项目区退化为可滑动的横向列表；`prefers-reduced-motion` 同样走静态版。

## License

仅作个人求职展示，请勿转载作品素材。
