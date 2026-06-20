const express = require('express');
const QRCode  = require('qrcode');
const config  = require('../config');
const logger  = require('../utils/logger');

let currentQRString = null;
let botStatus = 'starting'; // 'starting' | 'qr' | 'connected' | 'disconnected'

// ─── Lista de clientes SSE conectados ────────────────────
const sseClients = new Set();

/**
 * Envia um evento SSE para todos os clientes conectados
 */
function broadcastSSE(event, data) {
  const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const res of sseClients) {
    try { res.write(payload); } catch (_) { sseClients.delete(res); }
  }
}

/**
 * Actualiza o QR Code actual (chamado pelo connection.js)
 */
function setCurrentQR(qr) {
  currentQRString = qr;
  botStatus = 'qr';
  // Notifica todos os browsers imediatamente
  QRCode.toDataURL(qr, { width: 280, margin: 2, color: { dark: '#000000', light: '#FFFFFF' } })
    .then(dataUrl => broadcastSSE('qr', { status: 'qr', qrDataUrl: dataUrl }))
    .catch(() => {});
}

/**
 * Actualiza o estado do bot (chamado pelo connection.js)
 */
function setBotStatus(status) {
  botStatus = status;
  if (status === 'connected') currentQRString = null;
  // Notifica todos os browsers imediatamente
  broadcastSSE('status', { status });
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

  // ─── SSE — stream de estado em tempo real ─────────────
  // O browser conecta aqui UMA VEZ e recebe actualizações sem reload
  app.get('/events', async (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no'); // desliga buffer no nginx/render
    res.flushHeaders();

    // Regista o cliente
    sseClients.add(res);

    // Envia estado inicial imediatamente
    let initPayload;
    if (botStatus === 'connected') {
      initPayload = { status: 'connected', qrDataUrl: null };
    } else if (currentQRString) {
      try {
        const dataUrl = await QRCode.toDataURL(currentQRString, {
          width: 280, margin: 2, color: { dark: '#000000', light: '#FFFFFF' },
        });
        initPayload = { status: 'qr', qrDataUrl: dataUrl };
      } catch (_) {
        initPayload = { status: botStatus, qrDataUrl: null };
      }
    } else {
      initPayload = { status: botStatus, qrDataUrl: null };
    }

    res.write(`event: status\ndata: ${JSON.stringify(initPayload)}\n\n`);

    // Heartbeat a cada 25s para manter a ligação viva (evita timeout do Render)
    const heartbeat = setInterval(() => {
      try { res.write(': ping\n\n'); } catch (_) { clearInterval(heartbeat); }
    }, 25000);

    // Remove cliente quando ele fechar a ligação
    req.on('close', () => {
      clearInterval(heartbeat);
      sseClients.delete(res);
    });
  });

  // ─── Raiz ─────────────────────────────────────────────
  app.get('/', (req, res) => {
    res.redirect('/qr');
  });

  // ─── Página do QR Code (sem reloads — usa SSE) ────────
  app.get('/qr', (req, res) => {
    const html = `<!DOCTYPE html>
<html lang="pt">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>QR Code — ${config.company.name}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap');

    * { box-sizing: border-box; margin: 0; padding: 0; }

    body {
      font-family: 'Inter', 'Segoe UI', sans-serif;
      background: #0a0f0d;
      color: #fff;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      padding: 20px;
    }

    .card {
      background: #141a17;
      border: 1px solid rgba(37,211,102,0.15);
      border-radius: 20px;
      padding: 36px 32px;
      text-align: center;
      max-width: 440px;
      width: 100%;
      box-shadow: 0 0 60px rgba(37,211,102,0.08);
    }

    .logo { font-size: 2.2rem; margin-bottom: 4px; }

    h1 {
      color: #25D366;
      font-size: 1.3rem;
      font-weight: 700;
      margin-bottom: 4px;
    }

    .company { color: #888; font-size: 0.85rem; margin-bottom: 20px; }

    .badge {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 6px 16px;
      border-radius: 99px;
      font-size: 0.82rem;
      font-weight: 600;
      letter-spacing: 0.04em;
      margin-bottom: 20px;
      transition: background 0.4s, color 0.4s;
    }
    .badge.starting  { background: #2a2a18; color: #f5c518; }
    .badge.qr        { background: #132b1e; color: #25D366; }
    .badge.connected { background: #102440; color: #4aa8f5; }
    .badge.disconnected { background: #2a1818; color: #f55a4a; }

    /* Dot animado */
    .dot {
      width: 8px; height: 8px;
      border-radius: 50%;
      background: currentColor;
      animation: pulse 1.6s ease-in-out infinite;
    }
    @keyframes pulse {
      0%, 100% { opacity: 1; transform: scale(1); }
      50%       { opacity: 0.4; transform: scale(0.7); }
    }

    /* QR wrapper */
    #qr-wrap {
      background: #fff;
      border-radius: 14px;
      padding: 12px;
      width: 260px;
      height: 260px;
      margin: 0 auto 20px;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: opacity 0.3s;
    }
    #qr-wrap img { width: 100%; height: 100%; border-radius: 8px; }

    /* Spinner */
    .spinner {
      width: 48px; height: 48px;
      border: 4px solid #1e2e24;
      border-top-color: #25D366;
      border-radius: 50%;
      animation: spin 0.9s linear infinite;
    }
    @keyframes spin { to { transform: rotate(360deg); } }

    .msg { color: #aaa; font-size: 0.9rem; line-height: 1.6; margin-bottom: 12px; }

    .steps { text-align: left; margin-top: 16px; }
    .steps p { color: #eee; font-weight: 600; font-size: 0.9rem; margin-bottom: 8px; }
    .steps ol { padding-left: 18px; }
    .steps li { color: #bbb; font-size: 0.85rem; margin: 5px 0; }

    .live-tag {
      margin-top: 18px;
      color: #444;
      font-size: 0.75rem;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 5px;
    }
    .live-dot {
      width: 6px; height: 6px;
      background: #25D366;
      border-radius: 50%;
      animation: pulse 1.6s ease-in-out infinite;
    }
  </style>
</head>
<body>
  <div class="card">
    <div class="logo">🤖</div>
    <h1>Bot WhatsApp</h1>
    <p class="company">${config.company.name}</p>

    <!-- Badge de estado -->
    <div class="badge starting" id="badge">
      <span class="dot"></span>
      <span id="badge-text">A INICIAR...</span>
    </div>

    <!-- Área do QR / Spinner / Mensagem de conectado -->
    <div id="qr-wrap">
      <div class="spinner" id="spinner"></div>
      <img id="qr-img" src="" alt="QR Code" style="display:none;">
    </div>

    <p class="msg" id="msg">A aguardar o QR Code...</p>

    <!-- Instruções (visíveis só quando há QR) -->
    <div class="steps" id="steps" style="display:none;">
      <p>Como conectar:</p>
      <ol>
        <li>Abra o WhatsApp no telemóvel</li>
        <li>Toque em ⋮ → <strong>Dispositivos vinculados</strong></li>
        <li>Toque em <strong>Vincular dispositivo</strong></li>
        <li>Aponte a câmara para o QR Code acima</li>
      </ol>
    </div>

    <div class="live-tag">
      <span class="live-dot"></span>
      Actualizações em tempo real · sem reload da página
    </div>
  </div>

  <script>
    const badge     = document.getElementById('badge');
    const badgeTxt  = document.getElementById('badge-text');
    const spinner   = document.getElementById('spinner');
    const qrImg     = document.getElementById('qr-img');
    const msg       = document.getElementById('msg');
    const steps     = document.getElementById('steps');
    const qrWrap    = document.getElementById('qr-wrap');

    function applyState(data) {
      const { status, qrDataUrl } = data;

      // Reset
      badge.className = 'badge ' + status;
      spinner.style.display  = 'none';
      qrImg.style.display    = 'none';
      steps.style.display    = 'none';

      if (status === 'connected') {
        badgeTxt.textContent = '✅ CONECTADO';
        qrWrap.style.opacity = '0.3';
        msg.textContent = 'O bot está activo e a receber mensagens! 🎉';

      } else if (status === 'qr' && qrDataUrl) {
        badgeTxt.textContent = '📷 AGUARDANDO SCAN';
        qrWrap.style.opacity = '1';
        qrImg.src = qrDataUrl;
        qrImg.style.display = 'block';
        steps.style.display = 'block';
        msg.textContent = '⚠️ O QR expira em ~60s — será actualizado automaticamente.';

      } else if (status === 'disconnected') {
        badgeTxt.textContent = '⚠️ DESCONECTADO';
        qrWrap.style.opacity = '0.4';
        spinner.style.display = 'block';
        msg.textContent = 'Bot desconectado. A tentar reconectar...';

      } else {
        // starting / qualquer outro
        badgeTxt.textContent = '⏳ A INICIAR...';
        qrWrap.style.opacity = '1';
        spinner.style.display = 'block';
        msg.textContent = 'A iniciar o bot. O QR Code aparecerá em breve.';
      }
    }

    // ── SSE — uma só ligação, zero reloads ──
    function conectarSSE() {
      const es = new EventSource('/events');

      es.addEventListener('status', (e) => {
        try { applyState(JSON.parse(e.data)); } catch (_) {}
      });

      es.addEventListener('qr', (e) => {
        try { applyState(JSON.parse(e.data)); } catch (_) {}
      });

      es.onerror = () => {
        // Reconecta automaticamente após 3s se a ligação cair
        es.close();
        setTimeout(conectarSSE, 3000);
      };
    }

    conectarSSE();
  </script>
</body>
</html>`;

    res.send(html);
  });

  // ─── Inicia o servidor ─────────────────────────────────
  app.listen(port, '0.0.0.0', () => {
    logger.info(`Servidor HTTP iniciado na porta ${port}`);
    logger.info(`QR Code disponível em: /qr`);
  });

  return app;
}

module.exports = { startHttpServer, setCurrentQR, setBotStatus };
