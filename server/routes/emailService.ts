import nodemailer from 'nodemailer';

export interface EmailOptions {
  to: string;
  subject: string;
  text: string;
  html: string;
}

export class EmailService {
  static async sendEmail(options: EmailOptions): Promise<boolean> {
    // Configuration du transporteur
    // Si les variables ne sont pas définies, cela échouera probablement lors de l'envoi réel,
    // mais on peut garder la logique de simulation si on veut.
    // Ici, on tente de créer le transporteur.

    if (!process.env.SMTP_HOST && !process.env.SMTP_USER) {
      // Mode simulation si pas de config SMTP (similaire à avant)
      console.log('📧 Email simulé (SMTP non configuré):');
      console.log('À:', options.to);
      console.log('Sujet:', options.subject);
      console.log('Contenu:', options.text);
      return true;
    }

    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: process.env.SMTP_PORT === '465', // true pour 465, false pour les autres
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });

    try {
      await transporter.sendMail({
        from: {
          name: process.env.SMTP_FROM_NAME || 'Salon App',
          address: process.env.SMTP_FROM_EMAIL || 'no-reply@example.com'
        },
        to: options.to,
        subject: options.subject,
        text: options.text,
        html: options.html,
      });
      console.log('✅ Email envoyé avec succès à:', options.to);
      return true;
    } catch (error) {
      console.error('❌ Erreur envoi email:', error);
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
      L'équipe BarberPro
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
            <p>Cordialement,<br>L'équipe BarberPro</p>
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
      L'équipe BarberPro
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
            <p>Cordialement,<br>L'équipe BarberPro</p>
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
      L'équipe BarberPro
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
            <p>Cordialement,<br>L'équipe BarberPro</p>
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

  // ✅ Méthode pour le MFA Super Admin
  static async sendSuperAdminMFACode(to: string, code: string): Promise<boolean> {
    const subject = `Votre code de sécurité BarberPro - ${code}`;

    const text = `
      Votre code de vérification pour l'accès Super Admin est : ${code}
      Ce code expire dans 10 minutes.
    `;

    const html = `
      <div style="font-family: sans-serif; max-width: 500px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
        <h2 style="color: #333; text-align: center;">Vérification Super Admin</h2>
        <p>Votre code de sécurité BarberPro est :</p>
        <div style="background: #f4f4f4; padding: 20px; text-align: center; font-size: 32px; font-weight: bold; letter-spacing: 5px; color: #0891b2; border-radius: 8px; margin: 20px 0;">
          ${code}
        </div>
        <p style="color: #666; font-size: 14px;">Ce code est valable pendant 10 minutes.</p>
        <hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;">
        <p style="color: #999; font-size: 12px;">Si vous n'êtes pas à l'origine de cette demande, veuillez sécuriser votre compte immédiatement.</p>
      </div>
    `;

    return this.sendEmail({ to, subject, text: text.trim(), html });
  }

  static async sendSignupVerificationLink(to: string, token: string): Promise<boolean> {
    const subject = "Vérifiez votre email pour activer votre compte BarberPro";
    const verificationUrl = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/api/admin/confirm-signup?token=${token}`;

    const text = `
      Bienvenue chez BarberPro !
      
      Cliquez sur le lien ci-dessous pour confirmer votre adresse email et créer votre compte :
      ${verificationUrl}
      
      Ce lien expirera dans 24 heures.
    `;

    const html = `
      <div style="font-family: sans-serif; max-width: 500px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
        <h2 style="color: #333; text-align: center;">Bienvenue chez BarberPro !</h2>
        <p>Merci de vous être inscrit. Pour activer votre compte, veuillez cliquer sur le bouton ci-dessous :</p>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${verificationUrl}" style="background-color: #0891b2; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">
            Confirmer mon email
          </a>
        </div>
        <p style="color: #666; font-size: 14px;">Ou copiez et collez ce lien dans votre navigateur :</p>
        <p style="color: #0891b2; font-size: 12px; word-break: break-all;">${verificationUrl}</p>
        <hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;">
        <p style="color: #999; font-size: 12px;">Ce lien est valable pendant 24 heures. Si vous n'êtes pas à l'origine de cette demande, vous pouvez ignorer cet email.</p>
      </div>
    `;

    return this.sendEmail({ to, subject, text: text.trim(), html });
  }

  static generateMFACode(): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }
}

