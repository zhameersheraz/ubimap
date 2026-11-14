import React from 'react';
import crosscheck from '../../data/precip_crosscheck.json';

/**
 * The rainfall cross-check.
 *
 * The model runs on NASA POWER, which works on a roughly 50 km grid. To find out
 * whether the rainfall the model sees is an artefact of that grid, we rebuilt the same
 * 25 year monthly climatology from GPM IMERG, a second NASA product at about 10 km,
 * by decoding 9,124 daily GIBS tiles. The two products are independent. If they agree,
 * the rainfall is real. If they disagree, that is a finding and it goes on screen.
 */
export default function RainfallCrossCheck({ lang, cellId }) {
  const st = crosscheck.statistics || {};
  const row = (crosscheck.cells || []).find((c) => c.id === cellId) || null;

  return (
    <section className="card">
      <h2>
        {lang === 'bis'
          ? 'Cross-check sa ulan: NASA POWER kontra GPM IMERG'
          : 'Rainfall cross-check: NASA POWER versus GPM IMERG'}
      </h2>
      <p className="dim small">
        {lang === 'bis'
          ? 'Ginamit nami ang ulan gikan sa duha ka nga independente nga NASA produkto, sa duha ka lain nga resolution, para mahibalag kung ang atong ulan toto ba o sayup lang sa grid nga gigamit nga POWER.'
          : 'We rebuilt the rainfall from a second, independent NASA product at a different resolution, to find out whether the rain the model sees is real or an artefact of the grid it was read from.'}
      </p>

      <div className="val-stats">
        <div>
          <strong>{st.mean_signed_difference_percent}%</strong>
          <span>
            {lang === 'bis'
              ? 'kasarawan sa taunang ulan, POWER minus IMERG'
              : 'mean difference in annual rainfall, POWER minus IMERG'}
          </span>
        </div>
        <div>
          <strong>{st.cells_agreeing_on_a_sub50mm_month}/{st.cells_compared}</strong>
          <span>
            {lang === 'bis'
              ? 'ka cell nga pareho nga walay bulan nga ubos sa 50 mm'
              : 'cells where both agree there is no month under 50 mm'}
          </span>
        </div>
        <div>
          <strong>{st.cells_with_a_sub50mm_month_in_both}</strong>
          <span>
            {lang === 'bis'
              ? 'ka cell nga may bulan nga ubos sa 50 mm sa duha'
              : 'cells with a month under 50 mm in either product'}
          </span>
        </div>
        <div>
          <strong>{Math.round(st.mean_absolute_annual_difference_mm)} mm</strong>
          <span>
            {lang === 'bis'
              ? 'kasarawan sa kasukasuan, sa average nga 2,400 mm'
              : 'mean absolute difference on an average of about 2,400 mm'}
          </span>
        </div>
      </div>

      {row && (
        <table className="cmp">
          <thead>
            <tr>
              <th />
              <th>NASA POWER</th>
              <th>GPM IMERG</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>{lang === 'bis' ? 'Taunang ulan' : 'Annual rainfall'}</td>
              <td>{Math.round(row.power_annual).toLocaleString()} mm, about 50 km grid</td>
              <td>{Math.round(row.imerg_annual).toLocaleString()} mm, about 10 km grid, 25 years daily</td>
            </tr>
            <tr>
              <td>{lang === 'bis' ? 'Pinak dry nga bulan' : 'Driest month'}</td>
              <td>{Math.round(row.power_driest)} mm</td>
              <td>{Math.round(row.imerg_driest)} mm</td>
            </tr>
            <tr>
              <td>{lang === 'bis' ? 'Bulan nga ubos sa 50 mm' : 'Months under 50 mm'}</td>
              <td>{row.power_dry50}</td>
              <td>{row.imerg_dry50}</td>
            </tr>
            <tr>
              <td>{lang === 'bis' ? 'Bulan nga ubos sa 100 mm' : 'Months under 100 mm'}</td>
              <td>{row.power_dry100}</td>
              <td>{row.imerg_dry100}</td>
            </tr>
          </tbody>
        </table>
      )}

      <div className="dim-block honest">
        <h4>{lang === 'bis' ? 'Ang resulta, ug ang gap' : 'What the cross-check shows, and the gap it leaves'}</h4>
        <p>
          {lang === 'bis'
            ? 'Ang duha ka produkto nga magkasabot sa kadako, mga 2.5% lang ang kasabaan sa average sa tibuk nga grid. Ang mas detalyadong usa mao ang mas husto kung mahitungod sa ground: ang PAGASA station nga Cotabato City, 110 ka kilometro sa parehong baybayin, nga narekord 2,414.3 mm sa tuig, ug ang IMERG nagsaad og 2,421.9 mm sa Pagadian, mga 0.3% lang ang gibanayaw, pero ang POWER nagsaad og 2,246 mm, mga 7% nga ubos. Pagpalit sa ulan sa modelo gikan sa POWER to IMERG, mao kana ang nakausab sa correlation kontra sa aktuwal nga yield sa probinsiya gikan sa r = +0.00 to r = +0.32. Tanan sa 300 ka cell nga pareho nga walay bulan nga ubos sa 50 mm sa Pagadian, so tinuod nga wala ang dry season didto. Ang gap nga naa pa gikan mao kana ang gap nga ma-close sa sensor sa uma: walay PAGASA station mismo sa Pagadian.'
            : 'The two products agree on magnitude, within about 2.5% on average over the grid. And the finer one is the more accurate one when it is checked against the ground: PAGASA\'s Cotabato City station, 110 kilometres away on the same Sulu Sea coast, records 2,414.3 mm a year, and IMERG reads 2,421.9 mm at Pagadian, within 0.3%, while POWER reads 2,246 mm, about 7% low. Swapping the model\'s rainfall from POWER to IMERG is what took the model\'s correlation with real provincial yield from r = +0.00 to r = +0.32. All 300 grid cells agree that no month falls below 50 mm at Pagadian, so the dry season really is absent there. The gap that remains is the one a field sensor would close: there is no PAGASA station at Pagadian itself.'}
        </p>
        <p>
          {lang === 'bis'
            ? 'Mao nga ang hustong konklusyon sa model: sa Pagadian, ang klima wala sa kondisyon nga normal para sa ube, kay walay kasaligan nga dry window para sa pagtiniug sa tubero. Mao kana ang kiniy klase sa problema nga ang mapa makatabang nga makita: ang ube mahimong mapag-grow sa climate nga iyang, apan kung ang dry season dili, ang ani dili usab mahimong maayo.'
            : 'So the honest conclusion about the model is this: at Pagadian the climate is not in the normal range for ube, because there is no reliable dry window for the tuber to mature in. That is exactly the kind of problem the map is for. Ube may be growable in the climate the field has, but if the dry season does not arrive, the harvest will not be good either.'}
        </p>
      </div>
    </section>
  );
}
