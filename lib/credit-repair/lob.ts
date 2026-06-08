// Certified-mail sending via the Lob REST API (https://docs.lob.com).
// The `lob-node` npm package referenced in the spec does not exist; the modern
// path is the REST API with HTTP Basic auth (API key as username, blank password).
// Gated on LOB_API_KEY: when unset, returns a mock result so the dispute flow
// runs end-to-end in dev (same pattern as Soft Pull mock mode).

interface LobAddress {
  name: string;
  address_line1: string;
  address_city: string;
  address_state: string;
  address_zip: string;
}

export interface LobSendResult {
  lobId: string;
  status: string;
  mocked: boolean;
  error?: string;
}

// Parses a 2-line address block: "Name/Line1\nCity, ST 12345"
function parseAddressBlock(block: string): { line0: string; line1: string; city: string; state: string; zip: string } {
  const lines = block.split('\n').map((l) => l.trim()).filter(Boolean);
  const line0 = lines[0] ?? '';
  const line1 = lines[1] ?? lines[0] ?? '';
  const cityState = lines[lines.length - 1] ?? '';
  const [cityPart, stateZipPart = ''] = cityState.split(',');
  const stateZip = stateZipPart.trim().split(/\s+/);
  return {
    line0,
    line1,
    city: (cityPart ?? '').trim(),
    state: (stateZip[0] ?? '').trim(),
    zip: (stateZip[1] ?? '').trim(),
  };
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export async function sendCertifiedLetter(params: {
  description: string;
  borrowerName: string;
  borrowerAddress: string; // "line1\ncity, ST zip"
  bureauAddress: string;   // "Bureau Name\nPO Box ...\ncity, ST zip"
  letterBody: string;
}): Promise<LobSendResult> {
  const key = process.env.LOB_API_KEY;
  const mockId = `mock_ltr_${Date.now()}_${Math.floor(Math.random() * 1e6)}`;

  if (!key) {
    // Not configured — return a mock so the flow completes in dev.
    return { lobId: mockId, status: 'mock_mailed', mocked: true };
  }

  const from = parseAddressBlock(params.borrowerAddress);
  const to = parseAddressBlock(params.bureauAddress);

  const toAddr: LobAddress = {
    name: to.line0 || 'Credit Bureau',
    address_line1: to.line1 || to.line0,
    address_city: to.city,
    address_state: to.state,
    address_zip: to.zip,
  };
  const fromAddr: LobAddress = {
    name: params.borrowerName,
    address_line1: from.line0,
    address_city: from.city,
    address_state: from.state,
    address_zip: from.zip,
  };

  const file = `<html><body><p style="font-family:Arial;font-size:11pt;white-space:pre-wrap;">${escapeHtml(params.letterBody)}</p></body></html>`;

  try {
    const res = await fetch('https://api.lob.com/v1/letters', {
      method: 'POST',
      headers: {
        Authorization: `Basic ${Buffer.from(`${key}:`).toString('base64')}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        description: params.description,
        to: toAddr,
        from: fromAddr,
        file,
        color: false,
        double_sided: false,
        address_placement: 'insert_blank_page',
        extra_service: 'certified',
      }),
    });

    const data = (await res.json()) as { id?: string; expected_delivery_date?: string; error?: { message?: string } };
    if (!res.ok || !data.id) {
      return { lobId: '', status: 'failed', mocked: false, error: data.error?.message ?? `Lob error ${res.status}` };
    }
    return { lobId: data.id, status: data.expected_delivery_date ? 'mailed' : 'processing', mocked: false };
  } catch (err) {
    return { lobId: '', status: 'failed', mocked: false, error: err instanceof Error ? err.message : 'Lob request failed' };
  }
}
