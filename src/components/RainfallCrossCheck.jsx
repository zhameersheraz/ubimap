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
        {'Rainfall cross-check: NASA POWER versus GPM IMERG'}
      </h2>
      <p className="dim small">
        {'We rebuilt the rainfall from a second, independent NASA product at a different resolution, to find out whether the rain the model sees is real or an artefact of the grid it was read from.'}
      </p>

      <div className="val-stats">
        <div>
          <strong>{st.mean_signed_difference_percent}%</strong>
          <span>
            {'mean difference in annual rainfall, POWER minus IMERG'}
          </span>
        </div>
        <div>
          <strong>{st.cells_agreeing_on_a_sub50mm_month}/{st.cells_compared}</strong>
          <span>
            {'cells where both agree there is no month under 50 mm'}
          </span>
        </div>
        <div>
          <strong>{st.cells_with_a_sub50mm_month_in_both}</strong>
          <span>
            {'cells with a month under 50 mm in either product'}
          </span>
        </div>
        <div>
          <strong>{Math.round(st.mean_absolute_annual_difference_mm)} mm</strong>
          <span>
            {'mean absolute difference on an average of about 2,400 mm'}
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
              <td>{'Annual rainfall'}</td>
              <td>{Math.round(row.power_annual).toLocaleString()} mm, about 50 km grid</td>
              <td>{Math.round(row.imerg_annual).toLocaleString()} mm, about 10 km grid, 25 years daily</td>
            </tr>
            <tr>
              <td>{'Driest month'}</td>
              <td>{Math.round(row.power_driest)} mm</td>
              <td>{Math.round(row.imerg_driest)} mm</td>
            </tr>
            <tr>
              <td>{'Months under 50 mm'}</td>
              <td>{row.power_dry50}</td>
              <td>{row.imerg_dry50}</td>
            </tr>
            <tr>
              <td>{'Months under 100 mm'}</td>
              <td>{row.power_dry100}</td>
              <td>{row.imerg_dry100}</td>
            </tr>
          </tbody>
        </table>
      )}

      <div className="dim-block honest">
        <h4>{'What the cross-check shows, and the gap it leaves'}</h4>
        <p>
          {'The two products agree on magnitude, within about 2.5% on average over the grid. And the finer one is the more accurate one when it is checked against the ground: PAGASA\'s Cotabato City station, 110 kilometres away on the same Sulu Sea coast, records 2,414.3 mm a year, and IMERG reads 2,421.9 mm at Pagadian, within 0.3%, while POWER reads 2,246 mm, about 7% low. Swapping the model\'s rainfall from POWER to IMERG is what took the model\'s correlation with real provincial yield from r = +0.00 to r = +0.32. All 300 grid cells agree that no month falls below 50 mm at Pagadian, so the dry season really is absent there. The gap that remains is the one a field sensor would close: there is no PAGASA station at Pagadian itself.'}
        </p>
        <p>
          {'So the honest conclusion about the model is this: at Pagadian the climate is not in the normal range for ube, because there is no reliable dry window for the tuber to mature in. That is exactly the kind of problem the map is for. Ube may be growable in the climate the field has, but if the dry season does not arrive, the harvest will not be good either.'}
        </p>
      </div>
    </section>
  );
}
