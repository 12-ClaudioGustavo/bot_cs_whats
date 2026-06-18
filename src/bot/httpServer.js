const express = require('express');
const QRCode  = require('qrcode');
const config  = require('../config');
const logger  = require('../utils/logger');

let currentQRString = null;
let botStatus = 'starting'; // 'starting' | 'qr' | 'connected' | 'disconnected'

/**
 * Actualiza o QR Code actual (chamado pelo connection.js)
 */
function setCurrentQR(qr) {
  currentQRString = qr;
  botStatus = 'qr';
}

/**
 * Actualiza o estado do bot (chamado pelo connection.js)
 */
function setBotStatus(status) {
  botStatus = status;
  if (status === 'connected') currentQRString = null;
}

/**
 * Inicia o servidor HTTP necessário para o Render
 */
async function startHttpServer() {
  const port = config.bot.port || process.env.PORT || 3000;
  const app  = express();

  // ─── Health Check (Render + UptimeRobot) ──────────────
  app.get('/health', (req, res) => {
    res.status(200).json({
      status: botStatus,
      company: config.company.name,
      timestamp: new Date().toISOString(),
    });
  });

  // ─── Raiz ─────────────────────────────────────────────
  app.get('/', (req, res) => {
    res.redirect('/qr');
  });

  // ─── Página do QR Code ────────────────────────────────
  app.get('/qr', async (req, res) => {
    const styles = `
      body { font-family: 'Segoe UI', sans-serif; background: #111; color: #fff;
             display: flex; flex-direction: column; align-items: center;
             justify-content: center; min-height: 100vh; margin: 0; padding: 20px; }
      .card { background: #1e1e1e; border-radius: 16px; padding: 32px;
              text-align: center; max-width: 420px; width: 100%;
              box-shadow: 0 0 40px rgba(0,200,100,0.15); }
      h1 { color: #25D366; margin-bottom: 8px; font-size: 1.4rem; }
      p  { color: #aaa; font-size: 0.9rem; margin: 6px 0; }
      img { border-radius: 12px; width: 260px; height: 260px; margin: 20px auto;
            display: block; background: white; padding: 10px; }
      .status { display: inline-block; padding: 6px 14px; border-radius: 20px;
                font-size: 0.85rem; font-weight: bold; margin: 10px 0; }
      .qr-status    { background: #1a4a2e; color: #25D366; }
      .ok-status    { background: #1a3a4a; color: #4aa8f5; }
      .wait-status  { background: #3a3a1a; color: #f5c518; }
      .steps { text-align: left; margin-top: 16px; }
      .steps li { margin: 6px 0; font-size: 0.88rem; color: #ccc; }
      .refresh { color: #555; font-size: 0.78rem; margin-top: 16px; }
    `;

    // Bot já conectado
    if (botStatus === 'connected') {
      return res.send(`<!DOCTYPE html><html><head><title>Bot Conectado</title>
        <style>${styles}</style></head><body><div class="card">
        <h1>✅ Bot WhatsApp</h1>
        <span class="status ok-status">CONECTADO</span>
        <p style="color:#25D366;margin-top:16px">O bot está activo e a receber mensagens!</p>
        <p>${config.company.name}</p>
        <p class="refresh">Esta página actualiza a cada 10s</p>
        </div><script>setTimeout(()=>location.reload(),10000)</script></body></html>`);
    }

    // Aguardando QR
    if (!currentQRString) {
      return res.send(`<!DOCTYPE html><html><head><title>Aguardando Bot</title>
        <style>${styles}</style></head><body><div class="card">
        <h1>🤖 Bot WhatsApp</h1>
        <span class="status wait-status">A INICIAR...</span>
        <p style="margin-top:16px">O QR Code aparecerá em breve.</p>
        <p>Aguarde alguns segundos e esta página actualiza automaticamente.</p>
        <p class="refresh">A actualizar em 5 segundos...</p>
        </div><script>setTimeout(()=>location.reload(),5000)</script></body></html>`);
    }

    // Gera QR como imagem
    try {
      const qrDataUrl = await QRCode.toDataURL(currentQRString, {
        width: 280,
        margin: 2,
        color: { dark: '#000000', light: '#FFFFFF' },
      });

      res.send(`<!DOCTYPE html>
        <html><head>
          <title>QR Code — ${config.company.name}</title>
          <meta charset="UTF-8">
          <style>${styles}</style>
        </head><body>
        <div class="card">
          <h1>🤖 ${config.company.name}</h1>
          <span class="status qr-status">AGUARDANDO SCAN</span>
          <img src="${qrDataUrl}" alt="QR Code WhatsApp" />
          <div class="steps">
            <p style="color:#fff;font-weight:bold">Como conectar:</p>
            <ol>
              <li>Abra o WhatsApp no telemóvel</li>
              <li>Toque em ⋮ → <strong>Dispositivos vinculados</strong></li>
              <li>Toque em <strong>Vincular dispositivo</strong></li>
              <li>Aponte a câmara para o QR Code acima</li>
            </ol>
          </div>
          <p class="refresh">⚠️ O QR expira em ~60s — esta página actualiza automaticamente</p>
        </div>
        <script>setTimeout(()=>location.reload(),30000)</script>
        </body></html>`);
    } catch (err) {
      logger.error(`Erro ao gerar QR: ${err.message}`);
      res.status(500).send('Erro ao gerar QR Code. Tente novamente.');
    }
  });

  // ─── Inicia o servidor ─────────────────────────────────
  app.listen(port, '0.0.0.0', () => {
    logger.info(`Servidor HTTP iniciado na porta ${port}`);
    logger.info(`QR Code disponível em: /qr`);
  });

  return app;
}

module.exports = { startHttpServer, setCurrentQR, setBotStatus };
