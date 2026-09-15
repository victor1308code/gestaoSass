const nodemailer = require('nodemailer');

// Configuração para fins de desenvolvimento.
// Na produção real, deve-se usar SendGrid, AWS SES, ou SMTP corporativo via variáveis de ambiente.
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.ethereal.email',
  port: process.env.SMTP_PORT || 587,
  auth: {
    user: process.env.SMTP_USER || 'ethereal_user',
    pass: process.env.SMTP_PASS || 'ethereal_pass'
  }
});

/**
 * Envia um e-mail com link de admissão para o candidato
 */
const sendAdmissaoLink = async (email, nome, link) => {
  try {
    const mailOptions = {
      from: '"Equipe de RH" <rh@gestaosass.com>',
      to: email,
      subject: 'Bem-vindo! Precisamos dos seus documentos',
      html: `
        <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
          <h2>Olá, ${nome}!</h2>
          <p>Estamos muito felizes em ter você no nosso time.</p>
          <p>Para continuarmos o seu processo de admissão, precisamos que você preencha alguns dados e envie seus documentos básicos através do nosso portal seguro.</p>
          <p><a href="${link}" style="background-color: #2563eb; color: white; padding: 10px 15px; text-decoration: none; border-radius: 5px;">Acessar Portal do Candidato</a></p>
          <p>Se o botão não funcionar, copie e cole o link abaixo no seu navegador:</p>
          <p>${link}</p>
          <br/>
          <p>Atenciosamente,<br/>Equipe de Recursos Humanos</p>
        </div>
      `
    };

    // Apenas simula o envio e printa no console para facilitar o teste local sem configurar SMTP real
    if (!process.env.SMTP_HOST) {
      console.log('===================================================');
      console.log(`[SIMULAÇÃO DE EMAIL] Para: ${email}`);
      console.log(`Assunto: ${mailOptions.subject}`);
      console.log(`Link: ${link}`);
      console.log('===================================================');
      return { success: true, simulated: true };
    }

    const info = await transporter.sendMail(mailOptions);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('Erro ao enviar e-mail para o candidato:', error);
    throw error;
  }
};

/**
 * Encaminha o pacote de admissão para a contabilidade
 */
const sendParaContabilidade = async (emailContabilidade, candidatoNome, anexos) => {
  try {
    // anexos deve ser um array de objetos { filename, path } para o nodemailer
    const mailOptions = {
      from: '"Sistema de RH" <rh@gestaosass.com>',
      to: emailContabilidade,
      subject: `Documentos de Admissão: ${candidatoNome}`,
      text: `Olá!\n\nSeguem em anexo os documentos de admissão do novo colaborador: ${candidatoNome}.\n\nAtenciosamente,\nSistema de RH`,
      attachments: anexos
    };

    if (!process.env.SMTP_HOST) {
      console.log('===================================================');
      console.log(`[SIMULAÇÃO DE EMAIL] Para Contabilidade: ${emailContabilidade}`);
      console.log(`Assunto: ${mailOptions.subject}`);
      console.log(`Anexos contidos: ${anexos.map(a => a.filename).join(', ')}`);
      console.log('===================================================');
      return { success: true, simulated: true };
    }

    const info = await transporter.sendMail(mailOptions);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('Erro ao enviar e-mail para contabilidade:', error);
    throw error;
  }
};

module.exports = {
  sendAdmissaoLink,
  sendParaContabilidade
};
