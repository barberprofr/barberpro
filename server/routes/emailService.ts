import sgMail from '@sendgrid/mail';

// Configurer SendGrid
if (process.env.SENDGRID_API_KEY) {
  sgMail.setApiKey(process.env.SENDGRID_API_KEY);
} else {
  console.warn('⚠️ SENDGRID_API_KEY non configurée');
}

export interface EmailOptions {
  to: string;
  subject: string;
  text: string;
  html: string;
}

export class EmailService {
  static async sendEmail(options: EmailOptions): Promise<boolean> {
    // Si SendGrid n'est pas configuré, log en console
    if (!process.env.SENDGRID_API_KEY) {
      console.log('📧 Email simulé (SendGrid non configuré):');
      console.log('À:', options.to);
      console.log('Sujet:', options.subject);
      console.log('Contenu:', options.text);
      return true;
    }

    try {
      const msg = {
        to: options.to,
        from: {
          email: process.env.SENDGRID_FROM_EMAIL || 'no-reply@example.com',
          name: process.env.SENDGRID_FROM_NAME || 'Salon App'
        },
        subject: options.subject,
        text: options.text,
        html: options.html,
      };

      await sgMail.send(msg);
      console.log('✅ Email envoyé avec succès à:', options.to);
      return true;
    } catch (error) {
      console.error('❌ Erreur envoi email:', error);
      if (error.response) {
        console.error('Détails SendGrid:', error.response.body);
      }
      return false;
    }
  }

  // Méthode spécifique pour la récupération du CODE ADMIN
static async sendAdminCodeRecovery(to: string, code: string, salonName?: string): Promise<boolean> {
    const salon = salonName || 'Votre Salon';
    const subject = `Récupération de Code Admin - ${salon}`;
    
    const text = `
      Bonjour,
  
      Vous avez demandé la récupération de votre code administrateur pour ${salon}.
  
      Votre code de vérification est : ${code}
  
      Ce code est valable pendant 10 minutes.
  
      Utilisez ce code pour définir un nouveau code administrateur.
  
      Si vous n'êtes pas à l'origine de cette demande, veuillez ignorer cet email.
  
      Cordialement,
      L'équipe ${salon}
    `;
  
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #f8f9fa; padding: 20px; text-align: center; border-radius: 5px; }
          .code { font-size: 24px; font-weight: bold; color: #28a745; text-align: center; margin: 20px 0; padding: 15px; background: #f8f9fa; border-radius: 5px; }
          .info { background: #d1ecf1; border: 1px solid #bee5eb; padding: 10px; border-radius: 5px; margin: 15px 0; }
          .footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; color: #666; font-size: 14px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>${salon}</h1>
            <p>Récupération de Code Administrateur</p>
          </div>
          
          <p>Bonjour,</p>
          
          <p>Vous avez demandé la récupération de votre <strong>code administrateur</strong> pour <strong>${salon}</strong>.</p>
          
          <div class="code">${code}</div>
          
          <div class="info">
            <p><strong>ℹ️ Information :</strong> Ce code vous permettra de définir un nouveau code administrateur.</p>
            <p>Ce code est valable pendant <strong>10 minutes</strong>.</p>
          </div>
          
          <p>Si vous n'êtes pas à l'origine de cette demande, veuillez ignorer cet email.</p>
          
          <div class="footer">
            <p>Cordialement,<br>L'équipe ${salon}</p>
          </div>
        </div>
      </body>
      </html>
    `;
  
    return this.sendEmail({
      to,
      subject,
      text: text.trim(),
      html
    });
  }

  // Méthode spécifique pour la récupération de code admin
  static async sendAdminRecoveryCode(to: string, code: string, salonName?: string): Promise<boolean> {
    const salon = salonName || 'Votre Salon';
    const subject = `Code de récupération - ${salon}`;
    
    const text = `
      Bonjour,

      Vous avez demandé la récupération de votre code administrateur pour ${salon}.

      Votre code de récupération est : ${code}

      Ce code est valable pendant 10 minutes.

      Si vous n'êtes pas à l'origine de cette demande, veuillez ignorer cet email.

      Cordialement,
      L'équipe ${salon}
    `;

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #f8f9fa; padding: 20px; text-align: center; border-radius: 5px; }
          .code { font-size: 24px; font-weight: bold; color: #007bff; text-align: center; margin: 20px 0; padding: 15px; background: #f8f9fa; border-radius: 5px; }
          .footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; color: #666; font-size: 14px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>${salon}</h1>
            <p>Récupération de code administrateur</p>
          </div>
          
          <p>Bonjour,</p>
          
          <p>Vous avez demandé la récupération de votre code administrateur pour <strong>${salon}</strong>.</p>
          
          <div class="code">${code}</div>
          
          <p>Ce code est valable pendant <strong>10 minutes</strong>.</p>
          
          <p>Si vous n'êtes pas à l'origine de cette demande, veuillez ignorer cet email.</p>
          
          <div class="footer">
            <p>Cordialement,<br>L'équipe ${salon}</p>
          </div>
        </div>
      </body>
      </html>
    `;

    return this.sendEmail({
      to,
      subject,
      text: text.trim(),
      html
    });
  }

  // Méthode pour la réinitialisation de mot de passe
  static async sendPasswordResetCode(to: string, code: string, salonName?: string): Promise<boolean> {
    const salon = salonName || 'Votre Salon';
    const subject = `Réinitialisation de mot de passe - ${salon}`;
    
    const text = `
      Bonjour,

      Vous avez demandé la réinitialisation de votre mot de passe pour ${salon}.

      Votre code de vérification est : ${code}

      Ce code est valable pendant 10 minutes.

      Si vous n'êtes pas à l'origine de cette demande, veuillez ignorer cet email.

      Cordialement,
      L'équipe ${salon}
    `;

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #f8f9fa; padding: 20px; text-align: center; border-radius: 5px; }
          .code { font-size: 24px; font-weight: bold; color: #dc3545; text-align: center; margin: 20px 0; padding: 15px; background: #f8f9fa; border-radius: 5px; }
          .warning { background: #fff3cd; border: 1px solid #ffeaa7; padding: 10px; border-radius: 5px; margin: 15px 0; }
          .footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; color: #666; font-size: 14px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>${salon}</h1>
            <p>Réinitialisation de mot de passe</p>
          </div>
          
          <p>Bonjour,</p>
          
          <p>Vous avez demandé la réinitialisation de votre mot de passe pour <strong>${salon}</strong>.</p>
          
          <div class="code">${code}</div>
          
          <div class="warning">
            <p><strong>⚠️ Important :</strong> Ce code est valable pendant <strong>10 minutes</strong>.</p>
          </div>
          
          <p>Si vous n'êtes pas à l'origine de cette demande, veuillez ignorer cet email.</p>
          
          <div class="footer">
            <p>Cordialement,<br>L'équipe ${salon}</p>
          </div>
        </div>
      </body>
      </html>
    `;

    return this.sendEmail({
      to,
      subject,
      text: text.trim(),
      html
    });
  }
}

