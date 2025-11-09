import serverless from "serverless-http";
import { createServer } from "../../server";

export const handler = async (event: any, context: any) => {
  console.log('🔍 Netlify Function - Incoming request:', {
    path: event.path,
    httpMethod: event.httpMethod,
    headers: event.headers
  });

  // Wrap the Express app with binary support for PDFs
  const handler = serverless(createServer(), {
    binary: ['application/pdf', 'application/octet-stream']
  });
  
  try {
    const result = await handler(event, context);
    console.log('✅ Request handled:', {
      statusCode: result.statusCode,
      path: event.path,
      isBase64Encoded: result.isBase64Encoded,
      contentType: result.headers?.['content-type']
    });
    
    // S'assurer que les réponses PDF sont correctement encodées en base64
    // Vérifier le content-type (peut être en minuscules ou majuscules)
    const contentType = result.headers?.['content-type'] || result.headers?.['Content-Type'];
    if (contentType === 'application/pdf' && result.body) {
      // Si le body n'est pas déjà encodé en base64, l'encoder
      if (!result.isBase64Encoded) {
        if (Buffer.isBuffer(result.body)) {
          // Convertir le Buffer en base64
          result.body = result.body.toString('base64');
          result.isBase64Encoded = true;
        } else if (typeof result.body === 'string') {
          // Vérifier si c'est déjà du base64 valide
          try {
            // Tenter de décoder pour vérifier si c'est déjà du base64
            const test = Buffer.from(result.body, 'base64');
            // Si ça fonctionne, c'est déjà du base64, juste marquer le flag
            result.isBase64Encoded = true;
          } catch {
            // Sinon, traiter comme binaire et encoder en base64
            // Si c'est une string binaire, la convertir en Buffer puis en base64
            result.body = Buffer.from(result.body, 'binary').toString('base64');
            result.isBase64Encoded = true;
          }
        }
      }
    }
    
    return result;
  } catch (error) {
    console.error('❌ Error handling request:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Internal server error' })
    };
  }
};
