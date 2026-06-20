const express = require('express');
const QRCode  = require('qrcode');
const config  = require('../config');
const logger  = require('../utils/logger');

// ─── Estado central ──────────────────────────────────────
let currentQRString = null;
let botStatus = 'starting'; // 'starting' | 'qr' | 'connected' | 'disconnected'

// ─── Clientes SSE conectados ──────────────────────────────
const sseClients = new Set();

/**
 * Envia o estado actual para todos os clientes SSE.
 * Usa um único evento 'update' com {status, qrDataUrl} para
 * evitar que o cliente precise gerir dois listeners separados.
 */
function broadcastUpdate(payload) {
  const msg = `event: update\ndata: ${JSON.stringify(payload)}\n\n`;
  for (const res of sseClients) {
    try { res.write(msg); } catch (_) { sseClients.delete(res); }
  }
}

// ─── API pública (chamada pelo connection.js) ─────────────

/**
 * Chamado quando o Baileys gera um novo QR Code.
 */
function setCurrentQR(qr) {
  currentQRString = qr;
  botStatus = 'qr';

  // Gera a imagem uma única vez e empurra para todos os browsers
  QRCode.toDataURL(qr, { width: 280, margin: 2, color: { dark: '#000', light: '#FFF' } })
    .then(dataUrl => broadcastUpdate({ status: 'qr', qrDataUrl: dataUrl }))
    .catch(e => logger.error(`Erro ao gerar QR DataURL: ${e.message}`));
}

/**
 * Chamado pelo connection.js quando o estado muda.
 * NOTA: ignoramos 'connecting' — esse evento dispara várias vezes
 * durante a inicialização do Baileys e causaria troca incessante de estado
 * sem nenhum benefício para o utilizador.
 */
function setBotStatus(status) {
  // Ignora 'connecting' para não piscar o estado
  if (status === 'connecting') return;

  // Ignora se o estado não mudou realmente
  if (status === botStatus) return;

  botStatus = status;

  if (status === 'connected') {
    currentQRString = null;
    broadcastUpdate({ status: 'connected', qrDataUrl: null });
  } else if (status === 'disconnected') {
    broadcastUpdate({ status: 'disconnected', qrDataUrl: null });
  }
  // 'starting' não precisa de broadcast imediato — o cliente já vê o estado inicial
}

// ─── Servidor HTTP ────────────────────────────────────────

async function startHttpServer() {
  const port = config.bot.port || process.env.PORT || 3000;
  const app  = express();

  // ── Health Check ──────────────────────────────────────
  app.get('/health', (req, res) => {
    res.status(200).json({
      status: botStatus,
      company: config.company.name,
      timestamp: new Date().toISOString(),
    });
  });

  // ── SSE — stream de estado em tempo real ─────────────
  // O browser conecta UMA vez e recebe pushes sempre que algo muda.
  app.get('/events', async (req, res) => {
    res.setHeader('Content-Type',  'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-store');
    res.setHeader('Connection',    'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no'); // desliga buffer nginx/render
    res.flushHeaders();

    // Regista o cliente
    sseClients.add(res);

    // ── Envia o estado actual imediatamente ao ligar ───
    let initPayload;

    if (botStatus === 'connected') {
      initPayload = { status: 'connected', qrDataUrl: null };

    } else if (botStatus === 'qr' && currentQRString) {
      try {
        const dataUrl = await QRCode.toDataURL(currentQRString, {
          width: 280, margin: 2, color: { dark: '#000', light: '#FFF' },
        });
        initPayload = { status: 'qr', qrDataUrl: dataUrl };
      } catch (_) {
        initPayload = { status: 'starting', qrDataUrl: null };
      }

    } else {
      initPayload = { status: botStatus, qrDataUrl: null };
    }

    res.write(`event: update\ndata: ${JSON.stringify(initPayload)}\n\n`);

    // ── Heartbeat a cada 25s (evita timeout do Render/nginx) ──
    const heartbeat = setInterval(() => {
      try { res.write(': ping\n\n'); } catch (_) { clearInterval(heartbeat); }
    }, 25000);

    // ── Limpa quando o browser fecha a ligação ─────────
    req.on('close', () => {
      clearInterval(heartbeat);
      sseClients.delete(res);
    });
  });

  // ── Raiz → redireciona para /qr ───────────────────────
  app.get('/', (req, res) => res.redirect('/qr'));

  // ── Página do QR (SPA — sem reloads) ─────────────────
  app.get('/qr', (req, res) => {
    res.send(`<!DOCTYPE html>
<html lang="pt">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>QR Code — ${config.company.name}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap');
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

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

    .logo { font-size: 2.4rem; margin-bottom: 6px; }
    h1 { color: #25D366; font-size: 1.3rem; font-weight: 700; margin-bottom: 4px; }
    .company { color: #666; font-size: 0.82rem; margin-bottom: 22px; }

    /* Badge de estado */
    .badge {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 7px 18px;
      border-radius: 99px;
      font-size: 0.82rem;
      font-weight: 700;
      letter-spacing: 0.05em;
      margin-bottom: 22px;
    }
    .badge.starting      { background: #242416; color: #d4a800; }
    .badge.qr            { background: #0e2318; color: #25D366; }
    .badge.connected     { background: #0e1f33; color: #4aa8f5; }
    .badge.disconnected  { background: #2a1010; color: #f06060; }

    .dot {
      width: 8px; height: 8px; border-radius: 50%;
      background: currentColor;
      animation: pulse 1.8s ease-in-out infinite;
    }
    @keyframes pulse {
      0%, 100% { opacity: 1; transform: scale(1); }
      50%       { opacity: 0.3; transform: scale(0.65); }
    }

    /* Área do QR */
    #qr-area {
      background: #fff;
      border-radius: 14px;
      padding: 14px;
      width: 256px; height: 256px;
      margin: 0 auto 20px;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: opacity 0.4s;
    }
    #qr-area img { width: 100%; height: 100%; display: block; border-radius: 6px; }

    /* Spinner */
    .spinner {
      width: 48px; height: 48px;
      border: 4px solid #1e2e24;
      border-top-color: #25D366;
      border-radius: 50%;
      animation: spin 0.85s linear infinite;
    }
    @keyframes spin { to { transform: rotate(360deg); } }

    .msg { color: #999; font-size: 0.88rem; line-height: 1.65; min-height: 40px; margin-bottom: 12px; }

    /* Instruções */
    #steps { text-align: left; margin-top: 14px; display: none; }
    #steps strong { color: #eee; font-size: 0.88rem; display: block; margin-bottom: 8px; }
    #steps ol { padding-left: 18px; }
    #steps li { color: #bbb; font-size: 0.83rem; margin: 5px 0; }

    /* Tag live */
    .live {
      margin-top: 20px;
      color: #333;
      font-size: 0.73rem;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 5px;
    }
    .live-dot {
      width: 5px; height: 5px;
      background: #25D366;
      border-radius: 50%;
      animation: pulse 1.8s ease-in-out infinite;
    }
  </style>
</head>
<body>
<div class="card">
  <div class="logo">🤖</div>
  <h1>Bot WhatsApp</h1>
  <p class="company">${config.company.name}</p>

  <div id="badge" class="badge starting">
    <span class="dot"></span>
    <span id="badge-txt">A INICIAR...</span>
  </div>

  <div id="qr-area">
    <div class="spinner" id="spinner"></div>
    <img id="qr-img" src="" alt="QR Code" style="display:none;">
  </div>

  <p class="msg" id="msg">A aguardar o QR Code...</p>

  <div id="steps">
    <strong>Como conectar:</strong>
    <ol>
      <li>Abra o WhatsApp no telemóvel</li>
      <li>Toque em ⋮ → <b>Dispositivos vinculados</b></li>
      <li>Toque em <b>Vincular dispositivo</b></li>
      <li>Aponte a câmara para o QR Code acima</li>
    </ol>
  </div>

  <div class="live"><span class="live-dot"></span> Actualizações em tempo real · sem reload</div>
</div>

<script>
  const badge   = document.getElementById('badge');
  const badgeTxt= document.getElementById('badge-txt');
  const spinner = document.getElementById('spinner');
  const qrImg   = document.getElementById('qr-img');
  const msg     = document.getElementById('msg');
  const steps   = document.getElementById('steps');
  const qrArea  = document.getElementById('qr-area');

  function applyUpdate(data) {
    const { status, qrDataUrl } = data;

    // Reset visual
    spinner.style.display = 'none';
    qrImg.style.display   = 'none';
    steps.style.display   = 'none';
    qrArea.style.opacity  = '1';

    badge.className = 'badge ' + status;

    switch (status) {
      case 'connected':
        badgeTxt.textContent  = '✅ CONECTADO';
        qrArea.style.opacity  = '0.25';
        spinner.style.display = 'none';
        msg.innerHTML = '✅ Bot activo e a receber mensagens!<br><span style="color:#25D366">Pode fechar esta aba.</span>';
        break;

      case 'qr':
        badgeTxt.textContent = '📷 AGUARDANDO SCAN';
        if (qrDataUrl) {
          qrImg.src = qrDataUrl;
          qrImg.style.display = 'block';
        } else {
          spinner.style.display = 'block';
        }
        steps.style.display = 'block';
        msg.textContent = '⚠️ O QR expira em ~60s — será renovado automaticamente.';
        break;

      case 'disconnected':
        badgeTxt.textContent  = '⚠️ DESCONECTADO';
        qrArea.style.opacity  = '0.3';
        spinner.style.display = 'block';
        msg.textContent = 'Bot desconectado. A reconectar...';
        break;

      default: // starting
        badgeTxt.textContent  = '⏳ A INICIAR...';
        spinner.style.display = 'block';
        msg.textContent = 'A iniciar o bot. O QR Code aparecerá em breve.';
    }
  }

  // ── SSE — uma ligação, zero reloads ──────────────────
  function ligarSSE() {
    const es = new EventSource('/events');

    es.addEventListener('update', (e) => {
      try { applyUpdate(JSON.parse(e.data)); } catch (_) {}
    });

    es.onerror = () => {
      // Fecha e reconecta após 3s se a ligação SSE cair
      es.close();
      setTimeout(ligarSSE, 3000);
    };
  }

  ligarSSE();
</script>
</body>
</html>`);
  });

  // ── Inicia o servidor ──────────────────────────────────
  app.listen(port, '0.0.0.0', () => {
    logger.info(`Servidor HTTP iniciado na porta ${port}`);
    logger.info(`QR Code disponível em: /qr`);
  });

  return app;
}

module.exports = { startHttpServer, setCurrentQR, setBotStatus };
