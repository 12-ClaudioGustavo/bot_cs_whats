const { initAuthCreds, BufferJSON } = require('@whiskeysockets/baileys');
const logger = require('../utils/logger');

/**
 * Auth state do Baileys guardado no Supabase.
 * Substitui useMultiFileAuthState para persistência em produção (Render).
 */
async function useSupabaseAuthState(supabase) {
  // ─── Carrega credenciais ────────────────────────────────
  const { data: credsRow } = await supabase
    .from('bot_auth_state')
    .select('value')
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
        // Lê chaves do Supabase
        get: async (type, ids) => {
          const dbKeys = ids.map(id => `${type}--${id}`);
          const { data, error } = await supabase
            .from('bot_auth_state')
            .select('key, value')
            .in('key', dbKeys);

          if (error) {
            logger.error(`Auth state get error: ${error.message}`);
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

        // Escreve/apaga chaves no Supabase
        set: async (data) => {
          const upserts = [];
          const deleteKeys = [];

          for (const [type, values] of Object.entries(data)) {
            for (const [id, value] of Object.entries(values || {})) {
              const key = `${type}--${id}`;
              if (value != null) {
                upserts.push({
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
              .upsert(upserts, { onConflict: 'key' });
            if (error) logger.error(`Auth state upsert error: ${error.message}`);
          }

          if (deleteKeys.length > 0) {
            const { error } = await supabase
              .from('bot_auth_state')
              .delete()
              .in('key', deleteKeys);
            if (error) logger.error(`Auth state delete error: ${error.message}`);
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
            key: 'creds',
            value: toJSON(creds),
            updated_at: new Date().toISOString(),
          }, { onConflict: 'key' });

        if (error) logger.error(`Erro ao guardar creds: ${error.message}`);
      } catch (err) {
        logger.error(`saveCreds exception: ${err.message}`);
      }
    },
  };
}

module.exports = { useSupabaseAuthState };
