import { AdminLog } from '../routes/models';

export async function logSuperAdminAction(
    action: string,
    email: string,
    req: any,
    success: boolean,
    details?: any
): Promise<void> {
    try {
        const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim()
            || req.ip
            || 'unknown';
        const userAgent = req.headers['user-agent'] || 'unknown';

        await AdminLog.create({
            action,
            adminEmail: email,
            ip,
            userAgent,
            success,
            details: details || {}
        });

        console.log(`📝 [AUDIT] ${action} by ${email} from ${ip} - ${success ? 'SUCCESS' : 'FAILED'}`);
    } catch (error) {
        console.error('❌ Failed to log super admin action:', error);
        // Ne pas bloquer l'opération si le logging échoue
    }
}
