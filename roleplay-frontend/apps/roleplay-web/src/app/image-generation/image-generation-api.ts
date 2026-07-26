import { inject, Injectable } from '@angular/core';

import { BACKEND_CONFIG } from '../backend-config';
import type {
  GeneratedImage,
  GeneratedImageProvenance,
  ImageGenerationPresetLimits,
  ImageGenerationPresetSummary,
  ImageGenerationRequest,
  RoleplayImageMode,
} from './image-generation.model';

interface ApiEnvelope<T> {
  readonly ok: boolean;
  readonly data?: T;
  readonly error?: {
    readonly message?: string;
    readonly reason_code?: string;
  };
}

type ApiRecord = Record<string, unknown>;

@Injectable({ providedIn: 'root' })
export class ImageGenerationApi {
  private readonly config = inject(BACKEND_CONFIG);

  async listPresets(): Promise<readonly ImageGenerationPresetSummary[]> {
    const data = await this.request<{ readonly presets?: readonly unknown[] }>(
      '/v1/admin/image-generation/presets',
    );
    return (data.presets ?? []).map(mapPreset);
  }

  async listGallery(sessionId: string): Promise<readonly GeneratedImage[]> {
    const records = await this.listAttachmentRecords(sessionId);
    return records.flatMap((record) => {
      const image = mapGeneratedImage(record, this.config.rustyCrewBaseUrl);
      return image === undefined ? [] : [image];
    });
  }

  async generate(
    request: ImageGenerationRequest,
    signal?: AbortSignal,
  ): Promise<readonly GeneratedImage[]> {
    const data = await this.request<{
      readonly attachments?: readonly ApiRecord[];
    }>('/v1/admin/image-generation/generate', {
      method: 'POST',
      body: JSON.stringify(generationBody(request)),
      ...(signal === undefined ? {} : { signal }),
    });
    const attachmentIds = new Set(
      (data.attachments ?? [])
        .map((attachment) =>
          readString(attachment['attachmentId'] ?? attachment['attachment_id']),
        )
        .filter((id): id is string => id !== undefined),
    );
    const records = (
      await this.listAttachmentRecords(request.sessionId)
    ).filter((record) =>
      attachmentIds.has(
        readString(record['attachment_id'] ?? record['attachmentId']) ?? '',
      ),
    );
    const anchorMessageId = request.anchorMessageId;
    const linkedRecords =
      anchorMessageId === undefined
        ? records
        : await Promise.all(
            records.map((record) =>
              this.linkAttachment(request, record, anchorMessageId),
            ),
          );
    return linkedRecords.flatMap((record) => {
      const image = mapGeneratedImage(record, this.config.rustyCrewBaseUrl);
      return image === undefined ? [] : [image];
    });
  }

  private async listAttachmentRecords(
    sessionId: string,
  ): Promise<readonly ApiRecord[]> {
    const query = new URLSearchParams({
      include_removed: 'false',
      limit: '100',
      offset: '0',
    });
    const data = await this.request<{ readonly items?: readonly unknown[] }>(
      `/v1/chat/sessions/${encodeURIComponent(sessionId)}/attachments?${query}`,
    );
    return (data.items ?? []).filter(isRecord);
  }

  private async linkAttachment(
    request: ImageGenerationRequest,
    attachment: ApiRecord,
    messageId: string,
  ): Promise<ApiRecord> {
    const attachmentId = requiredString(
      attachment['attachment_id'] ?? attachment['attachmentId'],
      'attachment id',
    );
    const body = {
      attachment_id: attachmentId,
      filename: requiredString(attachment['filename'], 'attachment filename'),
      mime_type: requiredString(
        attachment['mime_type'] ?? attachment['mimeType'],
        'attachment MIME type',
      ),
      byte_size: requiredNumber(
        attachment['byte_size'] ?? attachment['byteSize'],
        'attachment byte size',
      ),
      storage_url: readNullableString(
        attachment['storage_url'] ?? attachment['storageUrl'],
      ),
      download_url: readNullableString(
        attachment['download_url'] ?? attachment['downloadUrl'],
      ),
      thumbnail_url: readNullableString(
        attachment['thumbnail_url'] ?? attachment['thumbnailUrl'],
      ),
      extracted_text: readNullableString(
        attachment['extracted_text'] ?? attachment['extractedText'],
      ),
      extracted_text_truncated:
        attachment['extracted_text_truncated'] === true ||
        attachment['extractedTextTruncated'] === true,
      metadata_json: readRecord(
        attachment['metadata_json'] ?? attachment['metadataJson'],
      ),
      message_id: messageId,
      block_id: `${messageId}-attachment-${attachmentId}`,
      link_metadata_json: {
        source: 'roleplay_image_generation',
        mode: request.mode,
        include_in_narrator_context: request.includeInNarratorContext,
      },
      expires_at: readNullableString(
        attachment['expires_at'] ?? attachment['expiresAt'],
      ),
    };
    const data = await this.request<{ readonly attachment?: unknown }>(
      `/v1/chat/sessions/${encodeURIComponent(request.sessionId)}/attachments`,
      { method: 'POST', body: JSON.stringify(body) },
    );
    if (!isRecord(data.attachment)) {
      throw new Error('Linked image response did not include an attachment.');
    }
    return data.attachment;
  }

  private async request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const response = await fetch(`${this.config.rustyCrewBaseUrl}${path}`, {
      ...init,
      headers: this.headers(init.headers),
    });
    const envelope = (await response.json()) as ApiEnvelope<T>;
    if (!response.ok || !envelope.ok) {
      throw new Error(
        envelope.error?.message ??
          envelope.error?.reason_code ??
          `Image generation request failed with ${response.status}`,
      );
    }
    if (envelope.data === undefined) {
      throw new Error('Image generation response did not include data.');
    }
    return envelope.data;
  }

  private headers(headers: HeadersInit | undefined): Headers {
    const result = new Headers(headers);
    result.set('content-type', 'application/json');
    if (this.config.bearerToken !== undefined) {
      result.set('authorization', `Bearer ${this.config.bearerToken}`);
    }
    return result;
  }
}

export function mapPreset(value: unknown): ImageGenerationPresetSummary {
  const record = requiredRecord(value, 'preset');
  const defaults = readRecord(record['defaults']);
  const limits = readRecord(record['limits']);
  return {
    id: requiredString(record['id'], 'preset id'),
    version: requiredString(record['version'], 'preset version'),
    providerId: requiredString(
      record['provider_id'] ?? record['providerId'],
      'preset provider id',
    ),
    defaults: {
      negativePrompt: readString(
        defaults['negative_prompt'] ?? defaults['negativePrompt'],
      ),
      width: requiredNumber(defaults['width'], 'preset default width'),
      height: requiredNumber(defaults['height'], 'preset default height'),
      steps: requiredNumber(defaults['steps'], 'preset default steps'),
    },
    limits: mapLimits(limits),
    styles: readStringArray(record['styles']),
  };
}

export function mapGeneratedImage(
  value: unknown,
  baseUrl: string,
): GeneratedImage | undefined {
  if (!isRecord(value)) return undefined;
  const mimeType = readString(value['mime_type'] ?? value['mimeType']);
  if (mimeType === undefined || !mimeType.startsWith('image/')) {
    return undefined;
  }
  const metadata = readRecord(value['metadata_json'] ?? value['metadataJson']);
  const provenance = mapProvenance(readRecord(metadata['provenance']));
  if (provenance === undefined) return undefined;
  const links = readRecordArray(value['links']);
  const roleplayLink = links.find((link) => {
    const linkMetadata = readRecord(
      link['metadata_json'] ?? link['metadataJson'],
    );
    return linkMetadata['source'] === 'roleplay_image_generation';
  });
  const linkMetadata = readRecord(
    roleplayLink?.['metadata_json'] ?? roleplayLink?.['metadataJson'],
  );
  const downloadUrl = requiredString(
    value['download_url'] ?? value['downloadUrl'],
    'generated image download URL',
  );
  const thumbnailUrl = readString(
    value['thumbnail_url'] ?? value['thumbnailUrl'],
  );
  return {
    id: requiredString(
      value['attachment_id'] ?? value['attachmentId'],
      'generated image id',
    ),
    sessionId: requiredString(
      value['session_id'] ?? value['sessionId'],
      'generated image session id',
    ),
    filename: requiredString(value['filename'], 'generated image filename'),
    mimeType,
    byteSize: requiredNumber(
      value['byte_size'] ?? value['byteSize'],
      'generated image byte size',
    ),
    url: absoluteUrl(downloadUrl, baseUrl),
    thumbnailUrl:
      thumbnailUrl === undefined
        ? undefined
        : absoluteUrl(thumbnailUrl, baseUrl),
    createdAt:
      readString(value['created_at'] ?? value['createdAt']) ??
      new Date(0).toISOString(),
    width: readNumber(metadata['width']),
    height: readNumber(metadata['height']),
    mode: readMode(linkMetadata['mode']),
    includeInNarratorContext:
      linkMetadata['include_in_narrator_context'] === true,
    linkedMessageId: readString(
      roleplayLink?.['message_id'] ?? roleplayLink?.['messageId'],
    ),
    provenance,
  };
}

function generationBody(
  request: ImageGenerationRequest,
): Record<string, unknown> {
  return {
    session_id: request.sessionId,
    preset: request.preset,
    prompt: request.prompt,
    ...(request.negativePrompt === undefined
      ? {}
      : { negative_prompt: request.negativePrompt }),
    ...(request.seed === undefined ? {} : { seed: request.seed }),
    width: request.width,
    height: request.height,
    steps: request.steps,
    ...(request.style === undefined ? {} : { style: request.style }),
  };
}

function mapLimits(record: ApiRecord): ImageGenerationPresetLimits {
  return {
    minWidth: requiredNumber(
      record['minWidth'] ?? record['min_width'],
      'preset minimum width',
    ),
    maxWidth: requiredNumber(
      record['maxWidth'] ?? record['max_width'],
      'preset maximum width',
    ),
    minHeight: requiredNumber(
      record['minHeight'] ?? record['min_height'],
      'preset minimum height',
    ),
    maxHeight: requiredNumber(
      record['maxHeight'] ?? record['max_height'],
      'preset maximum height',
    ),
    minSteps: requiredNumber(
      record['minSteps'] ?? record['min_steps'],
      'preset minimum steps',
    ),
    maxSteps: requiredNumber(
      record['maxSteps'] ?? record['max_steps'],
      'preset maximum steps',
    ),
    maxPromptChars: requiredNumber(
      record['maxPromptChars'] ?? record['max_prompt_chars'],
      'preset maximum prompt length',
    ),
    maxOutputs: requiredNumber(
      record['maxOutputs'] ?? record['max_outputs'],
      'preset maximum outputs',
    ),
  };
}

function mapProvenance(
  record: ApiRecord,
): GeneratedImageProvenance | undefined {
  const presetId = readString(
    record['workflow_preset_id'] ?? record['presetId'],
  );
  const prompt = readString(record['prompt']);
  if (presetId === undefined || prompt === undefined) return undefined;
  return {
    adapter: readString(record['adapter']),
    providerId: readString(record['provider_id'] ?? record['providerId']),
    providerJobId: readString(
      record['provider_job_id'] ?? record['providerJobId'],
    ),
    presetId,
    presetVersion: readString(
      record['workflow_preset_version'] ?? record['presetVersion'],
    ),
    prompt,
    negativePrompt: readString(
      record['negative_prompt'] ?? record['negativePrompt'],
    ),
    seed: readNumber(record['seed']),
    width: readNumber(record['width']),
    height: readNumber(record['height']),
    steps: readNumber(record['steps']),
    style: readString(record['style']),
  };
}

function absoluteUrl(value: string, baseUrl: string): string {
  return new URL(value, withTrailingSlash(baseUrl)).toString();
}

function withTrailingSlash(value: string): string {
  return value.endsWith('/') ? value : `${value}/`;
}

function readMode(value: unknown): RoleplayImageMode | undefined {
  return value === 'character' ||
    value === 'face' ||
    value === 'scene' ||
    value === 'last_message' ||
    value === 'background' ||
    value === 'custom'
    ? value
    : undefined;
}

function requiredRecord(value: unknown, label: string): ApiRecord {
  if (isRecord(value)) return value;
  throw new Error(`Image generation response ${label} was not an object.`);
}

function readRecord(value: unknown): ApiRecord {
  return isRecord(value) ? value : {};
}

function isRecord(value: unknown): value is ApiRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readRecordArray(value: unknown): readonly ApiRecord[] {
  return Array.isArray(value) ? value.filter(isRecord) : [];
}

function requiredString(value: unknown, label: string): string {
  const result = readString(value);
  if (result !== undefined) return result;
  throw new Error(`Image generation response omitted ${label}.`);
}

function readString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim().length > 0
    ? value.trim()
    : undefined;
}

function readNullableString(value: unknown): string | null {
  return readString(value) ?? null;
}

function readNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value)
    ? value
    : undefined;
}

function requiredNumber(value: unknown, label: string): number {
  const result = readNumber(value);
  if (result !== undefined) return result;
  throw new Error(`Image generation response omitted ${label}.`);
}

function readStringArray(value: unknown): readonly string[] {
  return Array.isArray(value)
    ? value.filter(
        (item): item is string => typeof item === 'string' && item.length > 0,
      )
    : [];
}
