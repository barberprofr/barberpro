import serverless from "serverless-http";
import { createServer, connectDatabase } from "../../server";

export const handler = async (event: any, context: any) => {
  // Ensure database connection
  await connectDatabase();

  console.log('🔍 Netlify Function - Incoming request:', {
    path: event.path,
    httpMethod: event.httpMethod,
    headers: event.headers
  });

  // Wrap the Express app
  const handler = serverless(createServer());

  try {
    const result = await handler(event, context);
    console.log('✅ Request handled:', {
      statusCode: (result as any).statusCode,
      path: event.path
    });
    return result;
  } catch (error) {
    console.error('❌ Error handling request:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Internal server error' })
    };
  }
};
