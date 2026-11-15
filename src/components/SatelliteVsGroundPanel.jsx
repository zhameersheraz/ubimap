import React from 'react';

/**
 * The satellite versus ground comparison, charted.
 *
 * The satellite line is real: the monthly root zone wetness index from NASA POWER
 * (MERRA-2) for the selected cell. The ground side is deliberately empty, because no
 * UbiSense node has been deployed. We would rather show an honest empty chart than a
 * chart full of invented numbers.
 */
function WetnessChart({ profile }) {
  const months = profile?.months || [];
  const vals = months.map((m) => m.gwetroot).filter((v) => v !== null && v !== undefined);
  if (!vals.length) return null;
  const W = 620;
  const H = 190;
  const PAD = { l: 36, r: 12, t: 14, b: 28 };
  const lo = 0.3;
  const hi = 1.0;
  const x = (i) => PAD.l + (i / 11) * (W - PAD.l - PAD.r);
  const y = (v) => PAD.t + (1 - (Math.max(lo, Math.min(hi, v)) - lo) / (hi - lo)) * (H - PAD.t - PAD.b);
  const pts = months
    .map((m, i) => (m.gwetroot === null || m.gwetroot === undefined ? null : [x(i), y(m.gwetroot)]))
    .filter(Boolean);
  if (pts.length < 2) return null;
  const line = pts.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ');
  const area = `${line} L${pts[pts.length - 1][0].toFixed(1)},${H - PAD.b} L${pts[0][0].toFixed(1)},${H - PAD.b} Z`;
  return (
    <svg className="chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Monthly root zone wetness index">
      <defs>
        <linearGradient id="wetg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#4a86c5" stopOpacity="0.42" />
          <stop offset="100%" stopColor="#4a86c5" stopOpacity="0.03" />
        </linearGradient>
      </defs>
      {[0.3, 0.5, 0.7, 0.9, 1.0].map((v) => (
        <g key={v}>
          <line x1={PAD.l} x2={W - PAD.r} y1={y(v)} y2={y(v)} className="grid" />
          <text x={PAD.l - 6} y={y(v) + 4} className="axis" textAnchor="end">{v.toFixed(1)}</text>
        </g>
      ))}
      <path d={area} fill="url(#wetg)" />
      <path d={line} className="series" />
      {pts.map((p, i) => (<circle key={i} cx={p[0]} cy={p[1]} r="3.2" className="dot" />))}
      {months.map((m, i) => (
        <text key={i} x={x(i)} y={H - 9} className="axis" textAnchor="middle">{m.label_en.slice(0, 1)}</text>
      ))}
    </svg>
  );
}

export default function SatelliteVsGroundPanel({ lang, profile }) {
  return (
    <section className="card">
      <h2>{lang === 'bis' ? 'Satellite kontra yuta' : 'Satellite versus ground'}</h2>
      <p>
        {lang === 'bis'
          ? 'Ang matag-iya nga limitation niini sa spatial scale, ipakita diri sa simple nga numero.'
          : 'The honest limitation of this tool is spatial scale, so here it is in plain numbers.'}
      </p>

      <div className="chart-block">
        <h4>
          {lang === 'bis'
            ? 'Satellite nga bahin: moisture sa lawas sa gamot, matag bulan (NASA POWER / MERRA-2)'
            : 'Satellite side: monthly root zone wetness (NASA POWER / MERRA-2)'}
        </h4>
        {profile ? <WetnessChart profile={profile} /> : null}
        <p className="dim small">
          {lang === 'bis'
            ? 'Index gikan sa 0 hangtod sa 1, dili kubo. Nasud pa nga naa ang usa ka pixel sa SMAP, mga 36 km, so matag iya nga average sa dako nga lugar, dili sa imong plot.'
            : 'The index runs from 0 to 1, it is not a volume. This is still regional: one SMAP pixel is about 36 km across, so every point on the line is an average over a large area, not a reading of your plot.'}
        </p>
      </div>

      <div className="chart-block empty">
        <h4>
          {lang === 'bis'
            ? 'Ground nga bahin: ang sensor node sa uma (UbiSense)'
            : 'Ground side: the UbiSense node at the field'}
        </h4>
        <div className="empty-chart" aria-label="No ground data yet">
          <span className="empty-line" />
          <span className="empty-note">
            {lang === 'bis'
              ? 'Wala pa nga node nga gina-deploy sa uma, so walay ground data sa graph niini. Mas matag-iya kaysa datos nga imantin-aw.'
              : 'No node has been deployed in the field, so there is no ground data on this chart yet. An honest empty chart beats a chart full of invented numbers.'}
          </span>
        </div>
        <p className="dim small">
          {lang === 'bis'
            ? 'Ang protocol: basahi kada 15 minuto, i-post sa UbiMap, unya itandi sa satellite line sa parehong petsa. Kon agree, ang uma gikawag sa iyang kighborhood. Kon dili agree, naa tana lokal nga anomalya: baso nga utod, maa kanal, o giablado nga yuta. Mao kana ang paagi aron mapugong ang uncertainty.'
            : 'The protocol: read every 15 minutes, post to UbiMap, then compare against the satellite line for the same dates. Where they agree, the field is behaving like its neighbourhood. Where they do not, the difference points to a local anomaly: a wet corner, a blocked drain, a patch of compacted soil. That is how the uncertainty range actually gets narrowed.'}
        </p>
      </div>

      <table className="cmp">
        <thead>
          <tr>
            <th />
            <th>{lang === 'bis' ? 'Satellite' : 'Satellite'}</th>
            <th>{lang === 'bis' ? 'Sensor sa yuta' : 'Ground sensor'}</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>{lang === 'bis' ? 'Area nga ginalugdan' : 'Area it covers'}</td>
            <td>SMAP L3: about 36 km across one pixel. MODIS: 250 m. POWER: about 50 km.</td>
            <td>One ESP32 node: about 1 square metre.</td>
          </tr>
          <tr>
            <td>{lang === 'bis' ? 'Unsa iyang nakita' : 'What it sees'}</td>
            <td>The neighbourhood. Bare soil, water, canopy and heat mixed together in one pixel.</td>
            <td>One spot of soil. Moisture and temperature at root depth, every 15 minutes.</td>
          </tr>
          <tr>
            <td>{lang === 'bis' ? 'Kusog' : 'Strength'}</td>
            <td>Covers the whole province, every 2 to 3 days, for 25 years of history, at no cost.</td>
            <td>Real ground truth at the scale the farmer actually works.</td>
          </tr>
          <tr>
            <td>{lang === 'bis' ? 'Kahuyag' : 'Weakness'}</td>
            <td>Cannot separate a wet corner from a dry corner of the same field.</td>
            <td>One point. Cannot say anything about the rest of the field or the season behind it.</td>
          </tr>
        </tbody>
      </table>

      <div className="dim-block plan-box">
        <h4>UbiSense: what we built and what is still to do</h4>
        <ul className="tight">
          <li>
            <strong>Built.</strong> ESP32 firmware for a capacitive soil moisture probe plus a
            DS18B20 soil temperature probe, reading every 15 minutes and posting to the
            UbiMap endpoint. The source is in <code>firmware/ubisense/</code> in this repository.
          </li>
          <li>
            <strong>Not yet done, and we are not pretending otherwise.</strong> No node has been
            deployed in the field yet, so this build shows <em>no</em> ground measurements.
          </li>
          <li>
            <strong>Next step.</strong> One node per barangay, shared by a cooperative. The node
            cost is roughly PHP 1,000 to 1,500, which is one basket of ube.
          </li>
        </ul>
      </div>
    </section>
  );
}
