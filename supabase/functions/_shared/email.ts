export interface EmailMessage {
  to: string | null | undefined;
  subject: string;
  html: string;
  text?: string;
}

export interface EmailResult {
  sent: boolean;
  skipped?: boolean;
  error?: string;
}

export function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

export async function sendTransactionalEmail(message: EmailMessage): Promise<EmailResult> {
  const apiKey = Deno.env.get('RESEND_API_KEY');
  const from = Deno.env.get('EMAIL_FROM');

  if (!apiKey || !from || !message.to) {
    return { sent: false, skipped: true };
  }

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from,
        to: [message.to],
        subject: message.subject,
        html: message.html,
        text: message.text,
      }),
    });

    if (!response.ok) {
      const body = await response.text().catch(() => '');
      return { sent: false, error: `Resend ${response.status}: ${body.slice(0, 300)}` };
    }

    return { sent: true };
  } catch (error) {
    return {
      sent: false,
      error: error instanceof Error ? error.message : 'Unknown email error',
    };
  }
}
