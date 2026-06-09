/**
 * Phase 30.2 / 30.3 — AWS Textract gate (server-only).
 *
 * AWS Textract is not provisioned in this environment, and we deliberately do
 * NOT add @aws-sdk/client-textract as a dependency yet (it would bloat the
 * bundle and risk the lockfile for a feature that can't run without creds).
 *
 * This module is the single seam where Textract plugs in. Until the env vars
 * below are set, runTextract() throws TextractNotConfiguredError and callers
 * surface a 501. When AWS is provisioned:
 *   1. npm i @aws-sdk/client-textract
 *   2. set AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY / AWS_REGION / AWS_S3_BUCKET
 *   3. implement runTextract() with AnalyzeDocumentCommand (FORMS + TABLES) as
 *      sketched in the TODO below.
 */
import 'server-only';

export class TextractNotConfiguredError extends Error {
  constructor() {
    super('AWS Textract is not configured. Set AWS credentials + S3 bucket to enable document auto-extraction.');
    this.name = 'TextractNotConfiguredError';
  }
}

export function isTextractConfigured(): boolean {
  return Boolean(
    process.env.AWS_ACCESS_KEY_ID &&
      process.env.AWS_SECRET_ACCESS_KEY &&
      process.env.AWS_REGION &&
      process.env.AWS_S3_BUCKET
  );
}

export interface TextractResult {
  rawText: string;
  formFields: Record<string, string>;
}

/**
 * Returns the OCR'd text + key/value form fields for an S3 object.
 * GATED: throws until AWS is configured.
 */
export async function runTextract(_s3Key: string): Promise<TextractResult> {
  if (!isTextractConfigured()) throw new TextractNotConfiguredError();

  // TODO(aws): real implementation once @aws-sdk/client-textract is installed.
  //
  // const { TextractClient, AnalyzeDocumentCommand } = await import('@aws-sdk/client-textract');
  // const client = new TextractClient({ region: process.env.AWS_REGION });
  // const out = await client.send(new AnalyzeDocumentCommand({
  //   Document: { S3Object: { Bucket: process.env.AWS_S3_BUCKET!, Name: _s3Key } },
  //   FeatureTypes: ['FORMS', 'TABLES'],
  // }));
  // return { rawText: extractLines(out.Blocks), formFields: extractKeyValues(out.Blocks) };
  throw new TextractNotConfiguredError();
}
