const { getStore } = require('@netlify/blobs');

exports.handler = async function(event) {
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  try {
    const { codigo } = JSON.parse(event.body);
    if (!codigo) {
      return { statusCode: 400, headers, body: JSON.stringify({ valido: false, error: 'Código requerido' }) };
    }

    // Leer códigos desde variable de entorno
    // Formato: CODIGO1:usos,CODIGO2:usos  ej: JOSUE2026:50,CAMARA2026:20
    const codigosEnv = process.env.CODIGOS_ACTIVOS || '';
    const codigosMap = {};
    codigosEnv.split(',').forEach(item => {
      const [cod, usos] = item.trim().split(':');
      if (cod) codigosMap[cod.toUpperCase()] = parseInt(usos) || 0;
    });

    const codigoUp = codigo.toUpperCase().trim();

    // Verificar si el código existe en la lista
    if (!(codigoUp in codigosMap)) {
      return { statusCode: 200, headers, body: JSON.stringify({ valido: false, error: 'Código no válido' }) };
    }

    // Obtener usos actuales desde Netlify Blobs
    const store = getStore('innfocus-codigos');
    let usosActuales = 0;
    try {
      const stored = await store.get(codigoUp);
      usosActuales = stored ? parseInt(stored) : 0;
    } catch(e) {
      usosActuales = 0;
    }

    const usosMaximos = codigosMap[codigoUp];
    const usosRestantes = usosMaximos - usosActuales;

    if (usosRestantes <= 0) {
      return {
        statusCode: 200, headers,
        body: JSON.stringify({ valido: false, error: 'Este código ya agotó sus usos disponibles' })
      };
    }

    // Descontar un uso
    await store.set(codigoUp, String(usosActuales + 1));

    return {
      statusCode: 200, headers,
      body: JSON.stringify({
        valido: true,
        usosRestantes: usosRestantes - 1,
        mensaje: 'Código válido'
      })
    };

  } catch(error) {
    return {
      statusCode: 500, headers,
      body: JSON.stringify({ valido: false, error: 'Error interno: ' + error.message })
    };
  }
};
