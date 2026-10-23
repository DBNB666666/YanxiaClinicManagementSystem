const fs = require('node:fs')
const path = require('node:path')
const { app, BrowserWindow } = require('electron')
const { PDFDocument } = require('pdf-lib')

app.commandLine.appendSwitch('no-sandbox')
app.disableHardwareAcceleration()

const html = `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8" />
<style>
  @page { size: A5 portrait; margin: 0; }
  html, body { margin: 0; padding: 0; }
  .page {
    width: 148mm; height: 210mm; box-sizing: border-box;
    padding: 12mm 14mm 14mm; background: #fff; color: #111;
    font-family: "SimSun", "宋体", serif; font-size: 11pt; line-height: 1.6;
  }
  h1 { font-family: "SimHei", "黑体", sans-serif; font-size: 18pt; text-align: center; margin: 0 0 4mm; }
  .line { border-top: 0.5pt solid #000; margin: 3mm 0; }
  .row { display: flex; gap: 8mm; }
  table { width: 100%; border-collapse: collapse; margin-top: 3mm; }
  th, td { text-align: left; padding: 1.5mm 1mm; border-bottom: 0.5pt solid #999; }
</style>
</head>
<body>
  <div class="page">
    <h1>燕霞诊所</h1>
    <div class="line"></div>
    <div class="row"><span>姓名：张秀兰</span><span>性别：女</span><span>年龄：62</span></div>
    <div class="row"><span>日期：2026-10-23</span><span>医师：王医生</span></div>
    <div>诊断：高血压、失眠</div>
    <p>Rp：注意休息，低盐饮食。</p>
    <table>
      <thead><tr><th>药品</th><th>数量</th><th>用法</th></tr></thead>
      <tbody><tr><td>苯磺酸氨氯地平片</td><td>1 盒</td><td>口服 每日1次</td></tr></tbody>
    </table>
    <div class="line"></div>
    <div>药品金额：¥48.00　注射费：¥20.00　合计：¥68.00</div>
    <div style="margin-top: 12mm">医师签名：__________</div>
  </div>
</body>
</html>`

app.whenReady().then(async () => {
  const win = new BrowserWindow({
    show: false,
    width: 600,
    height: 900,
    webPreferences: { sandbox: false }
  })
  await win.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(html))
  await win.webContents.executeJavaScript('document.fonts.ready')
  const pdf = await win.webContents.printToPDF({
    pageSize: 'A5',
    printBackground: true,
    preferCSSPageSize: true
  })
  const out = path.join(process.cwd(), 'spike-a5.pdf')
  fs.writeFileSync(out, pdf)
  const doc = await PDFDocument.load(pdf)
  const page = doc.getPages()[0]
  const size = page.getSize()
  const widthMm = (size.width * 25.4) / 72
  const heightMm = (size.height * 25.4) / 72
  console.log(`spike-a5.pdf: ${widthMm.toFixed(2)} x ${heightMm.toFixed(2)} mm`)
  win.destroy()
  app.quit()
}).catch((error) => {
  console.error(error)
  app.quit()
  process.exit(1)
})
