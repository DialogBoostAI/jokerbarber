export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { password, fields } = req.body;

  if (!password || password !== process.env.ADMIN_PASSWORD) {
    return res.status(401).json({ error: 'Nieprawidłowe hasło' });
  }

  const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
  const OWNER       = process.env.GITHUB_OWNER || 'DialogBoostAI';
  const REPO        = process.env.GITHUB_REPO  || 'jokerbarber';
  const FILE_PATH   = 'index.html';
  const API_BASE    = 'https://api.github.com';

  try {
    // 1. Get current file content + SHA
    const getRes = await fetch(`${API_BASE}/repos/${OWNER}/${REPO}/contents/${FILE_PATH}`, {
      headers: {
        Authorization: `Bearer ${GITHUB_TOKEN}`,
        Accept: 'application/vnd.github+json',
      },
    });

    if (!getRes.ok) {
      const err = await getRes.text();
      return res.status(502).json({ error: 'GitHub GET failed', detail: err });
    }

    const fileData = await getRes.json();
    const sha = fileData.sha;
    let html = Buffer.from(fileData.content, 'base64').toString('utf8');

    // 2. Replace EDITABLE regions
    for (const [key, value] of Object.entries(fields)) {
      const safe = value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\n/g, '\\n');
      const regex = new RegExp(
        `(<!-- EDITABLE:${key} -->)([\\s\\S]*?)(<!-- /EDITABLE:${key} -->)`,
        'g'
      );
      html = html.replace(regex, `<!-- EDITABLE:${key} -->${value}<!-- /EDITABLE:${key} -->`);
    }

    // 3. Commit updated file
    const putRes = await fetch(`${API_BASE}/repos/${OWNER}/${REPO}/contents/${FILE_PATH}`, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${GITHUB_TOKEN}`,
        Accept: 'application/vnd.github+json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: 'Admin: aktualizacja treści strony',
        content: Buffer.from(html, 'utf8').toString('base64'),
        sha,
      }),
    });

    if (!putRes.ok) {
      const err = await putRes.text();
      return res.status(502).json({ error: 'GitHub PUT failed', detail: err });
    }

    return res.status(200).json({ ok: true });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
