/**
 * Simple M3U parser for IPTV playlists.
 *
 * This function takes the raw text of an M3U or M3U8 playlist and
 * extracts an array of channel objects. Each channel includes
 * properties for the channel name, group title, logo, and stream URL.
 *
 * The parser supports the common EXTINF metadata attributes used in
 * IPTV playlists such as tvg-id, tvg-name, tvg-logo, and group-title.
 * If these attributes are missing it will attempt to fall back to
 * the comma‑separated channel name at the end of the EXTINF line.
 *
 * @param {string} m3uText Raw contents of an M3U playlist.
 * @returns {Array<{name:string, group:string|null, logo:string|null, url:string}>}
 */
function parseM3U(m3uText) {
  const channels = [];
  if (!m3uText) return channels;
  const lines = m3uText.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (line.startsWith('#EXTINF')) {
      const meta = line;
      const urlLine = lines[i + 1] ? lines[i + 1].trim() : '';
      // Extract attribute key/value pairs
      const attrs = {};
      const attrRegex = /([a-zA-Z0-9\-]+)="([^"]*)"/g;
      let match;
      while ((match = attrRegex.exec(meta)) !== null) {
        attrs[match[1]] = match[2];
      }
      // Attempt to extract the channel name. The name typically
      // follows a comma at the end of the EXTINF line.
      let name = null;
      const commaIndex = meta.indexOf(',');
      if (commaIndex !== -1 && commaIndex < meta.length - 1) {
        name = meta.substring(commaIndex + 1).trim();
      }
      const channel = {
        name: attrs['tvg-name'] || name || 'Unknown Channel',
        group: attrs['group-title'] || null,
        logo: attrs['tvg-logo'] || null,
        url: urlLine || ''
      };
      channels.push(channel);
    }
  }
  return channels;
}

module.exports = parseM3U;