const { initAuthCreds, BufferJSON } = require('@whiskeysockets/baileys');
const logger = require('../utils/logger');

/**
 * Auth state do Baileys guardado no Supabase — ISOLADO POR TENANT + SESSÃO.
 * Cada tenant tem o seu próprio conjunto de credenciais/chaves na tabela
 * `bot_auth_state`, chaveado por (tenant_id, session_name, key).
 *
 * Substitui useMultiFileAuthState para persistência em produção (Render),
 * onde o disco não é persistente entre deploys.
 */
async function useSupabaseAuthState(supabase, tenantId, sessionName = 'default') {
  if (!tenantId) throw new Error('useSupabaseAuthState requer um tenantId.');

  // ─── Carrega credenciais ────────────────────────────────
  const { data: credsRow } = await supabase
    .from('bot_auth_state')
    .select('value')
    .eq('tenant_id', tenantId)
    .eq('session_name', sessionName)
    .eq('key', 'creds')
    .maybeSingle();

  let creds;
  try {
    creds = credsRow?.value
      ? JSON.parse(JSON.stringify(credsRow.value), BufferJSON.reviver)
      : initAuthCreds();
  } catch {
    creds = initAuthCreds();
  }

  // ─── Helpers ────────────────────────────────────────────
  const toJSON   = (v) => JSON.parse(JSON.stringify(v, BufferJSON.replacer));
  const fromJSON = (v) => JSON.parse(JSON.stringify(v), BufferJSON.reviver);

  return {
    state: {
      creds,

      keys: {
        // Lê chaves do Supabase (escopadas ao tenant/sessão)
        get: async (type, ids) => {
          const dbKeys = ids.map(id => `${type}--${id}`);
          const { data, error } = await supabase
            .from('bot_auth_state')
            .select('key, value')
            .eq('tenant_id', tenantId)
            .eq('session_name', sessionName)
            .in('key', dbKeys);

          if (error) {
            logger.error(`[${tenantId}/${sessionName}] Auth state get error: ${error.message}`);
            return {};
          }

          const result = {};
          for (const row of (data || [])) {
            const id = row.key.replace(`${type}--`, '');
            try {
              result[id] = fromJSON(row.value);
            } catch {
              result[id] = row.value;
            }
          }
          return result;
        },

        // Escreve/apaga chaves no Supabase (escopadas ao tenant/sessão)
        set: async (data) => {
          const upserts = [];
          const deleteKeys = [];

          for (const [type, values] of Object.entries(data)) {
            for (const [id, value] of Object.entries(values || {})) {
              const key = `${type}--${id}`;
              if (value != null) {
                upserts.push({
                  tenant_id: tenantId,
                  session_name: sessionName,
                  key,
                  value: toJSON(value),
                  updated_at: new Date().toISOString(),
                });
              } else {
                deleteKeys.push(key);
              }
            }
          }

          if (upserts.length > 0) {
            const { error } = await supabase
              .from('bot_auth_state')
              .upsert(upserts, { onConflict: 'tenant_id,session_name,key' });
            if (error) logger.error(`[${tenantId}/${sessionName}] Auth state upsert error: ${error.message}`);
          }

          if (deleteKeys.length > 0) {
            const { error } = await supabase
              .from('bot_auth_state')
              .delete()
              .eq('tenant_id', tenantId)
              .eq('session_name', sessionName)
              .in('key', deleteKeys);
            if (error) logger.error(`[${tenantId}/${sessionName}] Auth state delete error: ${error.message}`);
          }
        },
      },
    },

    // Guarda credenciais actualizadas
    saveCreds: async () => {
      try {
        const { error } = await supabase
          .from('bot_auth_state')
          .upsert({
            tenant_id: tenantId,
            session_name: sessionName,
            key: 'creds',
            value: toJSON(creds),
            updated_at: new Date().toISOString(),
          }, { onConflict: 'tenant_id,session_name,key' });

        if (error) logger.error(`[${tenantId}/${sessionName}] Erro ao guardar creds: ${error.message}`);
      } catch (err) {
        logger.error(`[${tenantId}/${sessionName}] saveCreds exception: ${err.message}`);
      }
    },

    // Apaga toda a sessão deste tenant (usado no logout/reset de QR)
    clearAuthState: async () => {
      try {
        await supabase
          .from('bot_auth_state')
          .delete()
          .eq('tenant_id', tenantId)
          .eq('session_name', sessionName);
      } catch (err) {
        logger.error(`[${tenantId}/${sessionName}] Erro ao limpar auth state: ${err.message}`);
      }
    },
  };
}

module.exports = { useSupabaseAuthState };
