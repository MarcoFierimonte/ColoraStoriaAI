import {
  createZipArchive,
  type PromptEvalEmailConfigStatus,
  type PromptEvalRunDetail,
  type ZipArchiveEntry,
} from '../../../prompt-eval-core/src/index.ts';
import {
  PromptEvalError,
  type EmailAttachment,
  type EmailMessage,
  type EmailNotificationSender,
} from '../promptEval.interface.ts';

const MAX_EMAIL_ZIP_ATTACHMENT_BYTES = 6 * 1024 * 1024;

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function slugifyFilename(value: string): string {
  return (
    value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 48) || 'prompt-eval'
  );
}

function decodeDataUrl(dataUrl: string): {
  bytes: Uint8Array;
  ext: string;
} | null {
  const match = /^data:([^;,]+);base64,(.+)$/i.exec(dataUrl.trim());
  if (!match) return null;
  const mime = match[1].toLowerCase();
  const base64 = match[2];
  const ext =
    mime === 'image/png'
      ? 'png'
      : mime === 'image/webp'
        ? 'webp'
        : mime === 'image/svg+xml'
          ? 'svg'
          : mime === 'image/jpeg' || mime === 'image/jpg'
            ? 'jpg'
            : 'bin';
  return {
    bytes: Buffer.from(base64, 'base64'),
    ext,
  };
}

export function buildRunArchiveBytes(run: PromptEvalRunDetail): Uint8Array {
  const encoder = new TextEncoder();
  const entries: ZipArchiveEntry[] = [];

  entries.push({
    name: 'prompt.txt',
    data: encoder.encode(run.promptText),
  });

  const reportPayload = {
    id: run.id,
    title: run.title,
    modality: run.modality,
    executionMode: run.executionMode,
    providerId: run.providerId,
    model: run.model,
    promptLabel: run.promptLabel,
    promptParams: run.promptParams,
    status: run.status,
    totalItems: run.totalItems,
    completedItems: run.completedItems,
    failedItems: run.failedItems,
    totalEstimatedCostUsd: run.totalEstimatedCostUsd,
    createdAt: new Date(run.createdAtMs).toISOString(),
    completedAt: run.completedAtMs
      ? new Date(run.completedAtMs).toISOString()
      : null,
    evaluation: run.evaluation ?? null,
    items: run.items.map((item) => ({
      id: item.id,
      index: item.index,
      inputName: item.inputName,
      status: item.status,
      outputFormat: item.outputFormat ?? null,
      outputText: item.outputText ?? null,
      errorMessage: item.errorMessage ?? null,
      latencyMs: item.latencyMs ?? null,
      usage: item.usage ?? null,
      evaluation: item.evaluation ?? null,
    })),
  };

  entries.push({
    name: 'evaluation-report.json',
    data: encoder.encode(JSON.stringify(reportPayload, null, 2)),
  });

  for (const item of run.items) {
    const baseStem = `${String(item.index + 1).padStart(2, '0')}-${slugifyFilename(
      item.inputName.replace(/\.[^.]+$/, '')
    )}`;
    if (item.outputImageDataUrl) {
      const decoded = decodeDataUrl(item.outputImageDataUrl);
      if (decoded) {
        entries.push({
          name: `outputs/${baseStem}.${decoded.ext}`,
          data: decoded.bytes,
        });
      }
    } else if (item.outputText) {
      entries.push({
        name: `outputs/${baseStem}.txt`,
        data: encoder.encode(item.outputText),
      });
    }
  }

  return createZipArchive(entries);
}

export function buildRunResultEmailMessage(params: {
  run: PromptEvalRunDetail;
  to: string;
  appBaseUrl?: string;
}): EmailMessage {
  const { run, to, appBaseUrl } = params;
  const cleanBase = appBaseUrl?.trim().replace(/\/+$/, '');
  const adminLink = cleanBase
    ? `${cleanBase}/admin?tab=prompt-lab&run=${encodeURIComponent(run.id)}`
    : null;

  const statusLabels: Record<string, string> = {
    completed: 'Completato',
    partial: 'Completato parzialmente',
    failed: 'Fallito',
    cancelled: 'Annullato',
    queued: 'In coda',
    running: 'In elaborazione',
  };
  const statusLabel = statusLabels[run.status] ?? run.status;
  const modeLabel =
    run.executionMode === 'batch' ? 'Batch API (-50%)' : 'Standard API';

  const zipBytes = buildRunArchiveBytes(run);
  const attachZip =
    run.completedItems > 0 && zipBytes.byteLength <= MAX_EMAIL_ZIP_ATTACHMENT_BYTES;
  const attachments: EmailAttachment[] = attachZip
    ? [
        {
          filename: `${slugifyFilename(run.title)}-${run.id.slice(0, 8)}.zip`,
          contentType: 'application/zip',
          contentBase64: Buffer.from(zipBytes).toString('base64'),
        },
      ]
    : [];

  const subject = `[Prompt Lab] ${statusLabel}: ${run.title} (${run.completedItems}/${run.totalItems})`;

  const itemLinesText = run.items
    .map(
      (item) =>
        `  - #${item.index + 1} ${item.inputName}: ${item.status}${
          item.errorMessage ? ` (${item.errorMessage})` : ''
        }`
    )
    .join('\n');

  const text = [
    `Risultati valutazione prompt: ${run.title}`,
    `Stato: ${statusLabel}`,
    `Modalità API: ${modeLabel}`,
    `Provider / Modello: ${run.providerId} / ${run.model}`,
    `Prompt: ${run.promptLabel}`,
    `Completate: ${run.completedItems}/${run.totalItems} (Errori: ${run.failedItems})`,
    `Costo stimato totale: $${run.totalEstimatedCostUsd.toFixed(5)}`,
    '',
    'Elementi:',
    itemLinesText,
    '',
    attachZip
      ? run.modality === 'text'
        ? 'In allegato trovi il file ZIP con tutti gli output generati, il prompt completo (prompt.txt) e il report JSON.'
        : 'In allegato trovi il file ZIP con tutte le immagini generate, il prompt completo (prompt.txt) e il report JSON.'
      : run.completedItems > 0
        ? run.modality === 'text'
          ? 'I risultati superano il limite allegati email: apri la console Admin per visualizzare e scaricare tutti i risultati.'
          : 'I risultati superano il limite allegati email: apri la console Admin per visualizzare e scaricare tutte le immagini.'
        : 'Nessun output generato da allegare.',
    adminLink ? `\nApri in Admin Console: ${adminLink}` : '',
    '',
    '--- Prompt completo ---',
    run.promptText,
  ]
    .filter(Boolean)
    .join('\n');

  const itemRowsHtml = run.items
    .map(
      (item) => `
      <tr>
        <td style="padding:8px;border:1px solid #24284f;">#${item.index + 1}</td>
        <td style="padding:8px;border:1px solid #24284f;">${escapeHtml(item.inputName)}</td>
        <td style="padding:8px;border:1px solid #24284f;font-weight:bold;">${escapeHtml(item.status)}</td>
        <td style="padding:8px;border:1px solid #24284f;">${
          item.usage ? `$${item.usage.estimatedCostUsd.toFixed(5)}` : '—'
        }</td>
        <td style="padding:8px;border:1px solid #24284f;">${escapeHtml(item.errorMessage ?? 'OK')}</td>
      </tr>`
    )
    .join('');

  const html = `
<!doctype html>
<html lang="it">
<body style="font-family:system-ui,-apple-system,sans-serif;background:#fff8d9;color:#24284f;padding:24px;">
  <div style="max-width:680px;margin:0 auto;background:#ffffff;border:3px solid #24284f;border-radius:14px;padding:24px;">
    <h1 style="margin:0 0 8px;font-size:20px;">Risultati Prompt Lab · ${escapeHtml(statusLabel)}</h1>
    <p style="margin:0 0 16px;font-size:14px;color:#4b5075;">${escapeHtml(run.title)}</p>

    <table style="width:100%;border-collapse:collapse;font-size:13px;margin-bottom:16px;">
      <tr><td style="padding:6px 8px;background:#e4f3ff;border:1px solid #24284f;"><strong>Modalità API</strong></td><td style="padding:6px 8px;border:1px solid #24284f;">${escapeHtml(modeLabel)}</td></tr>
      <tr><td style="padding:6px 8px;background:#e4f3ff;border:1px solid #24284f;"><strong>Provider / Modello</strong></td><td style="padding:6px 8px;border:1px solid #24284f;">${escapeHtml(run.providerId)} · ${escapeHtml(run.model)}</td></tr>
      <tr><td style="padding:6px 8px;background:#e4f3ff;border:1px solid #24284f;"><strong>Prompt</strong></td><td style="padding:6px 8px;border:1px solid #24284f;">${escapeHtml(run.promptLabel)}</td></tr>
      <tr><td style="padding:6px 8px;background:#e4f3ff;border:1px solid #24284f;"><strong>Esito</strong></td><td style="padding:6px 8px;border:1px solid #24284f;">${run.completedItems}/${run.totalItems} completate · ${run.failedItems} errori</td></tr>
      <tr><td style="padding:6px 8px;background:#e4f3ff;border:1px solid #24284f;"><strong>Costo stimato</strong></td><td style="padding:6px 8px;border:1px solid #24284f;">$${run.totalEstimatedCostUsd.toFixed(5)}</td></tr>
    </table>

    ${
      attachZip
        ? '<p style="background:#b4f0cb;border:2px solid #24284f;border-radius:8px;padding:10px 12px;font-size:13px;font-weight:bold;">In allegato trovi lo ZIP con tutti i risultati, prompt.txt e il report JSON.</p>'
        : run.completedItems > 0
          ? '<p style="background:#ffe680;border:2px solid #24284f;border-radius:8px;padding:10px 12px;font-size:13px;font-weight:bold;">I file generati superano il limite allegati email: scaricali direttamente dalla console Admin.</p>'
          : ''
    }

    ${
      adminLink
        ? `<p style="margin:16px 0;"><a href="${escapeHtml(adminLink)}" style="display:inline-block;background:#9acfff;color:#24284f;text-decoration:none;font-weight:bold;padding:10px 16px;border:2px solid #24284f;border-radius:8px;">Apri e valuta nella Console Admin</a></p>`
        : ''
    }

    <h2 style="font-size:15px;margin:20px 0 8px;">Dettaglio elementi</h2>
    <table style="width:100%;border-collapse:collapse;font-size:12px;">
      <thead>
        <tr style="background:#ffe680;">
          <th style="padding:8px;border:1px solid #24284f;text-align:left;">#</th>
          <th style="padding:8px;border:1px solid #24284f;text-align:left;">File / Input</th>
          <th style="padding:8px;border:1px solid #24284f;text-align:left;">Stato</th>
          <th style="padding:8px;border:1px solid #24284f;text-align:left;">Costo</th>
          <th style="padding:8px;border:1px solid #24284f;text-align:left;">Esito</th>
        </tr>
      </thead>
      <tbody>${itemRowsHtml}</tbody>
    </table>

    <h2 style="font-size:15px;margin:20px 0 8px;">Prompt utilizzato</h2>
    <pre style="white-space:pre-wrap;background:#fff8d9;border:2px solid #24284f;border-radius:8px;padding:12px;font-size:12px;line-height:1.45;">${escapeHtml(run.promptText)}</pre>
  </div>
</body>
</html>`.trim();

  return {
    to,
    subject,
    text,
    html,
    attachments,
  };
}

export class ResendEmailSender implements EmailNotificationSender {
  readonly providerName = 'resend';
  private readonly apiKey: string;
  private readonly fromAddress: string;
  private readonly fetchImpl: typeof fetch;

  constructor(params: {
    apiKey: string;
    fromAddress: string;
    fetchImpl?: typeof fetch;
  }) {
    this.apiKey = params.apiKey.trim();
    this.fromAddress =
      params.fromAddress.trim() || 'Prompt Lab <onboarding@resend.dev>';
    this.fetchImpl = params.fetchImpl ?? fetch;
  }

  isConfigured(): boolean {
    return this.apiKey.length > 0;
  }

  getStatus(): PromptEvalEmailConfigStatus {
    return {
      configured: this.isConfigured(),
      provider: this.providerName,
      fromAddress: this.isConfigured() ? this.fromAddress : null,
      freeTierSummary: 'Resend Free Tier (3.000 email/mese, 100/giorno)',
    };
  }

  async send(message: EmailMessage): Promise<void> {
    if (!this.isConfigured()) {
      throw new PromptEvalError(
        'RESEND_API_KEY non configurata sul server.',
        503,
        'email_not_configured'
      );
    }

    const response = await this.fetchImpl('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: this.fromAddress,
        to: [message.to],
        subject: message.subject,
        text: message.text,
        html: message.html,
        ...(message.attachments && message.attachments.length > 0
          ? {
              attachments: message.attachments.map((att) => ({
                filename: att.filename,
                content: att.contentBase64,
              })),
            }
          : {}),
      }),
    });

    if (!response.ok) {
      const errText = await response.text().catch(() => '');
      throw new PromptEvalError(
        `Invio email tramite Resend fallito (HTTP ${response.status}).`,
        502,
        'email_send_failed',
        errText.slice(0, 500)
      );
    }
  }
}

export class BrevoEmailSender implements EmailNotificationSender {
  readonly providerName = 'brevo';
  private readonly apiKey: string;
  private readonly fromAddress: string;
  private readonly fromName: string;
  private readonly fetchImpl: typeof fetch;

  constructor(params: {
    apiKey: string;
    fromAddress: string;
    fromName?: string;
    fetchImpl?: typeof fetch;
  }) {
    this.apiKey = params.apiKey.trim();
    const parsedFrom = params.fromAddress.trim();
    const angleMatch = /^(.+?)\s*<([^>]+)>$/.exec(parsedFrom);
    if (angleMatch) {
      this.fromName = params.fromName?.trim() || angleMatch[1].trim();
      this.fromAddress = angleMatch[2].trim();
    } else {
      this.fromName = params.fromName?.trim() || 'Prompt Lab Admin';
      this.fromAddress = parsedFrom;
    }
    this.fetchImpl = params.fetchImpl ?? fetch;
  }

  isConfigured(): boolean {
    return this.apiKey.length > 0 && this.fromAddress.length > 0;
  }

  getStatus(): PromptEvalEmailConfigStatus {
    return {
      configured: this.isConfigured(),
      provider: this.providerName,
      fromAddress: this.isConfigured() ? this.fromAddress : null,
      freeTierSummary: 'Brevo Free Tier (300 email/giorno)',
    };
  }

  async send(message: EmailMessage): Promise<void> {
    if (!this.isConfigured()) {
      throw new PromptEvalError(
        'BREVO_API_KEY o EMAIL_FROM non configurati sul server.',
        503,
        'email_not_configured'
      );
    }

    const response = await this.fetchImpl(
      'https://api.brevo.com/v3/smtp/email',
      {
        method: 'POST',
        headers: {
          'api-key': this.apiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sender: {
            name: this.fromName,
            email: this.fromAddress,
          },
          to: [{ email: message.to }],
          subject: message.subject,
          textContent: message.text,
          htmlContent: message.html,
          ...(message.attachments && message.attachments.length > 0
            ? {
                attachment: message.attachments.map((att) => ({
                  name: att.filename,
                  content: att.contentBase64,
                })),
              }
            : {}),
        }),
      }
    );

    if (!response.ok) {
      const errText = await response.text().catch(() => '');
      throw new PromptEvalError(
        `Invio email tramite Brevo fallito (HTTP ${response.status}).`,
        502,
        'email_send_failed',
        errText.slice(0, 500)
      );
    }
  }
}

export class NoopEmailSender implements EmailNotificationSender {
  readonly providerName = 'none';

  isConfigured(): boolean {
    return false;
  }

  getStatus(): PromptEvalEmailConfigStatus {
    return {
      configured: false,
      provider: 'none',
      fromAddress: null,
      freeTierSummary:
        'Non configurato — imposta RESEND_API_KEY (3.000/mese gratis) o BREVO_API_KEY (300/giorno gratis) + EMAIL_FROM nel file .env',
    };
  }

  async send(_message: EmailMessage): Promise<void> {
    throw new PromptEvalError(
      'Servizio email non configurato sul server. Configura RESEND_API_KEY o BREVO_API_KEY (piano gratuito) nelle variabili d’ambiente.',
      503,
      'email_not_configured'
    );
  }
}
